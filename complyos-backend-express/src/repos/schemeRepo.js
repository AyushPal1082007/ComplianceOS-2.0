import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../db.js';
import logger from '../logger.js';
import * as memorySchemeRepo from './memory/schemeRepo.js';
import { memoryStore, usesMemoryRepository } from './memory/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCOUT_SCHEMES_DIR = path.join(__dirname, '../agents/scout/schemes');

export function isOfficialGovernmentUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    return hostname === 'gov.in' || hostname.endsWith('.gov.in')
      || hostname === 'nic.in' || hostname.endsWith('.nic.in');
  } catch {
    return false;
  }
}

export async function syncVerifiedFromScout() {
  if (usesMemoryRepository()) return memorySchemeRepo.syncVerifiedFromScout();
  const entries = await fs.readdir(SCOUT_SCHEMES_DIR, { withFileTypes: true });
  let synced = 0;
  let skipped = 0;
  for (const entry of entries.filter((file) => file.isFile() && file.name.endsWith('.json')).sort((a, b) => a.name.localeCompare(b.name))) {
    const scheme = JSON.parse(await fs.readFile(path.join(SCOUT_SCHEMES_DIR, entry.name), 'utf8'));
    if (!scheme.id || !scheme.name?.en || !scheme.benefit || !scheme.applyUrl
      || !scheme.sourceUrl || !scheme.checkedBy || !scheme.retrievedOn
      || [scheme.name.en, scheme.benefit, scheme.applyUrl, scheme.sourceUrl, scheme.checkedBy, scheme.retrievedOn]
        .some((value) => String(value).includes('TODO'))
      || !isOfficialGovernmentUrl(scheme.sourceUrl)
      || !isOfficialGovernmentUrl(scheme.applyUrl)) {
      skipped++;
      continue;
    }

    const data = {
      id: scheme.id,
      name: scheme.name.en,
      nameHindi: scheme.name.hi || null,
      description: scheme.benefit,
      descriptionHindi: null,
      ministry: scheme.ministry || null,
      schemeType: scheme.schemeType || scheme.category || 'scheme',
      maxBenefit: scheme.benefit,
      eligibilityCriteria: scheme.criteria || {},
      officialUrl: scheme.applyUrl,
      sourceUrl: scheme.sourceUrl,
      retrievedOn: new Date(scheme.retrievedOn),
      checkedBy: scheme.checkedBy,
      isActive: scheme.status !== 'closed',
      checklist: scheme.checklist || undefined,
    };
    await prisma.scheme.upsert({
      where: { id: scheme.id },
      create: data,
      update: data,
    });
    synced++;
  }
  logger.info('Synchronized verified SCOUT schemes', { synced, skipped });
  return { synced, skipped };
}

export async function saveMatches(userId, matches = []) {
  if (usesMemoryRepository()) return memorySchemeRepo.saveMatches(userId, matches);
  const business = await prisma.businessProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!business) return [];
  const results = [];
  for (const match of matches) {
    if (!match.schemeId) continue;
    const data = {
      businessId: business.id,
      schemeId: match.schemeId,
      matchScore: match.matchScore ?? match.score ?? 0,
      criteriaMetCount: match.criteriaMetCount ?? 0,
      criteriaTotalCount: match.criteriaTotalCount ?? 0,
      missingInfo: match.missingInfo || match.missingFields || undefined,
      explanationHindi: match.explanationHindi || null,
    };
    results.push(await prisma.schemeMatch.upsert({
      where: { businessId_schemeId: { businessId: business.id, schemeId: match.schemeId } },
      create: data,
      update: data,
    }));
  }
  return results;
}

export async function deactivateUnverifiedLegacySchemes() {
  const sql = `UPDATE "schemes"
SET "is_active" = FALSE
WHERE "source_url" IS NULL
   OR BTRIM("source_url") = ''
   OR LOWER("source_url") LIKE '%todo%'
   OR "checked_by" IS NULL
   OR BTRIM("checked_by") = ''
   OR LOWER("checked_by") LIKE '%todo%'
   OR (
      LOWER(REGEXP_REPLACE(SPLIT_PART(SPLIT_PART("source_url", '://', 2), '/', 1), '^www\\.', '')) NOT LIKE '%.gov.in'
      AND LOWER(REGEXP_REPLACE(SPLIT_PART(SPLIT_PART("source_url", '://', 2), '/', 1), '^www\\.', '')) NOT LIKE '%.nic.in'
      AND LOWER(REGEXP_REPLACE(SPLIT_PART(SPLIT_PART("source_url", '://', 2), '/', 1), '^www\\.', '')) NOT IN ('gov.in', 'nic.in')
   );`;
  return sql;
}

export async function removeMatchesForUser(userId) {
  if (usesMemoryRepository()) return memorySchemeRepo.removeMatchesForUser(userId);
  const business = await prisma.businessProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!business) return 0;
  return (await prisma.schemeMatch.deleteMany({ where: { businessId: business.id } })).count;
}

export default { syncVerifiedFromScout, saveMatches, deactivateUnverifiedLegacySchemes, removeMatchesForUser };
