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
import { deliverApprovedChange } from '../../graph/nodes/sentinelDeliveryNode.js';
import * as profileRepo from '../../repos/profileRepo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadMatchingProfiles() {
  const rows = [];
  let cursor = null;
  while (true) {
    const page = await profileRepo.loadForMatching({ cursor, limit: 1000 });
    rows.push(...page.map((row) => {
      const profileValues = Object.fromEntries(Object.entries(row.profile || {}).map(([key, field]) => [
        key,
        field && typeof field === 'object' && 'value' in field ? field.value : field,
      ]));
      const businessProfile = row.businessProfile || {};
      return {
        ...profileValues,
        ...businessProfile,
        id: row.user.id,
        user: row.user,
        profile: { ...businessProfile, ...profileValues, id: businessProfile.id || row.user.id },
      };
    }));
    if (page.length < 1000) break;
    cursor = page[page.length - 1].user.id;
  }
  return rows;
}

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

    const profiles = await loadMatchingProfiles();
    const matchedProfiles = matchProfiles(profiles, change.affects || {});

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

    const delivery = regulationChange
      ? await deliverApprovedChange({
        source,
        change: { ...change, simulated: Boolean(source.simulated) },
        changeId: regulationChange.id,
        profiles,
      })
      : { sent: 0, digest: 0 };

    if (matchedProfiles.length === 0) {
      logger.info('No profiles matched the SENTINEL change criteria', { sourceId: source.id, change: change.title });
    }

    await persistSnapshot(source, normalizedText);

    return {
      sourceId: source.id,
      status: delivery.sent ? 'ALERTED' : delivery.digest ? 'DIGEST_QUEUED' : 'NO_MATCH',
      alerts: delivery.sent,
      digest: delivery.digest,
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
