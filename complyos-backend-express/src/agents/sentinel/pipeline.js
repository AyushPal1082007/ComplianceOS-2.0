import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import prisma from '../../db.js';
import logger from '../../logger.js';
import { fetchPages, withBlockCheck } from '../../services/tinyfish.js';
import { normalizeSourceText } from './normalize.js';
import { diffText } from './diff.js';
import { classifyChange } from './classify.js';
import { matchProfiles } from './matchProfiles.js';
import { buildAlert } from './buildAlert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadSources() {
  const sourceJsonPath = path.join(__dirname, 'sources.json');
  const raw = await fs.readFile(sourceJsonPath, 'utf8');
  const sources = JSON.parse(raw);
  const valid = sources.filter((source) => !String(source.url || '').startsWith('TODO'));

  valid.forEach((source) => {
    if (source.simulated) {
      logger.warn('Loaded simulated SENTINEL source', { sourceId: source.id, url: source.url });
    }
  });

  return valid;
}

export async function persistSnapshot(source, text) {
  const hash = crypto.createHash('sha256').update(text).digest('hex');

  try {
    if (prisma && typeof prisma.regulationSnapshot?.create === 'function') {
      await prisma.regulationSnapshot.create({
        data: {
          sourceId: source.id,
          hash,
          text,
        },
      });
    }
  } catch (error) {
    logger.warn('Snapshot persistence skipped', { sourceId: source.id, error: error.message });
  }

  return { hash };
}

export async function getLatestSnapshot(source) {
  try {
    if (prisma && typeof prisma.regulationSnapshot?.findFirst === 'function') {
      return await prisma.regulationSnapshot.findFirst({
        where: { sourceId: source.id },
        orderBy: { fetchedAt: 'desc' },
      });
    }
  } catch (error) {
    logger.warn('Snapshot lookup skipped', { sourceId: source.id, error: error.message });
  }

  return null;
}

export async function runSingleSource(source) {
  if (!source || !source.url) {
    return { sourceId: 'unknown', status: 'SKIPPED', reason: 'No source configured' };
  }

  if (String(source.url).startsWith('TODO')) {
    logger.warn('Skipping SENTINEL source with placeholder URL', { sourceId: source.id, url: source.url });
    return { sourceId: source.id, status: 'SKIPPED', reason: 'Placeholder URL' };
  }

  try {
    const [pageResult] = await fetchPages([source.url], { ttl: 0, sourceId: source.id });
    const checked = withBlockCheck(pageResult || {});

    if (checked.blocked || (typeof checked.text === 'string' && checked.text.toLowerCase().includes('captcha'))) {
      return { sourceId: source.id, status: 'BLOCKED', reason: 'Captcha or blocked page detected' };
    }

    const normalizedText = normalizeSourceText(checked.text || '');
    if (!normalizedText) {
      return { sourceId: source.id, status: 'EMPTY', reason: 'No text extracted from source' };
    }

    const previous = await getLatestSnapshot(source);
    const currentHash = crypto.createHash('sha256').update(normalizedText).digest('hex');
    if (!previous) {
      await persistSnapshot(source, normalizedText);
      return { sourceId: source.id, status: 'BASELINE_STORED', hash: currentHash };
    }

    if (previous.hash === currentHash) {
      return { sourceId: source.id, status: 'NO_CHANGE', hash: currentHash };
    }

    const delta = diffText(previous.text, normalizedText);
    const change = classifyChange({ source, oldText: previous.text, newText: normalizedText, paragraphs: delta.changedParagraphs });

    // A missing or invalid quote is never eligible for an alert.
    if (!change.quote || change.confidence < 0.8 || change.status === 'NEEDS_REVIEW') {
      return {
        sourceId: source.id,
        status: 'NEEDS_REVIEW',
        change,
      };
    }

    const matchedProfiles = matchProfiles(profiles || [], change.affects || {});
    const alerts = [];

    // Create RegulationChange record for tracking the change
    let regulationChange = null;
    try {
      if (prisma && typeof prisma.regulationChange?.create === 'function') {
        regulationChange = await prisma.regulationChange.create({
          data: {
            sourceId: source.id,
            snapshotId: previous.id,
            changedParagraphs: delta.changedParagraphs,
            status: 'APPROVED',
            classification: change,
            quoteVerified: true,
            simulated: Boolean(source.simulated),
          },
        });
      }
    } catch (error) {
      logger.warn('Regulation change persistence skipped', { sourceId: source.id, error: error.message });
    }

    for (const profile of matchedProfiles) {
      const builtAlert = buildAlert({
        user: profile.user,
        source,
        change,
        profile,
        simulated: Boolean(source.simulated),
      });

      alerts.push(builtAlert);

      // Write to SentinelAlert for user-facing display
      try {
        if (prisma && typeof prisma.sentinelAlert?.create === 'function') {
          await prisma.sentinelAlert.create({
            data: {
              userId: builtAlert.userId,
              title: builtAlert.title,
              summary: builtAlert.summary,
              sourceUrl: builtAlert.sourceUrl,
              lastVerifiedAt: new Date(builtAlert.lastVerified),
              isSimulated: builtAlert.isSimulated,
              affectedAttributes: builtAlert.affectedAttributes,
              status: builtAlert.status,
            },
          });
        }
      } catch (error) {
        logger.warn('SentinelAlert persistence skipped', { userId: builtAlert.userId, sourceId: source.id, error: error.message });
      }

      // Write to RegulationAlert for change-delivery tracking (if RegulationChange was created)
      if (regulationChange) {
        try {
          if (prisma && typeof prisma.regulationAlert?.create === 'function') {
            await prisma.regulationAlert.create({
              data: {
                userId: builtAlert.userId,
                changeId: regulationChange.id,
                status: 'sent',
                sentAt: new Date(),
              },
            });
          }
        } catch (error) {
          logger.warn('RegulationAlert persistence skipped', { userId: builtAlert.userId, changeId: regulationChange.id, error: error.message });
        }
      }
    }


    if (matchedProfiles.length === 0) {
      logger.info('No profiles matched the SENTINEL change criteria', { sourceId: source.id, change: change.title });
    }

    await persistSnapshot(source, normalizedText);

    return {
      sourceId: source.id,
      status: matchedProfiles.length ? 'ALERTED' : 'NO_MATCH',
      alerts: alerts.length,
      change,
    };
  } catch (error) {
    logger.warn('SENTINEL pipeline failed', { sourceId: source.id, error: error.message });
    return {
      sourceId: source.id,
      status: 'FAILED',
      error: error.message,
    };
  }
}

export async function runSentinelCrawl() {
  const sources = await loadSources();
  const results = [];

  for (const source of sources) {
    const result = await runSingleSource(source);
    results.push(result);
  }

  return results;
}

export default {
  loadSources,
  runSingleSource,
  runSentinelCrawl,
};
