import prisma from '../db.js';
import { PROFILE_FIELD_KEYS } from '../contracts/profileFields.js';
import { completeness } from '../agents/aria/engine/completeness.js';
import { projectProfile } from '../profile/projection.js';
import * as memoryProfileRepo from './memory/profileRepo.js';
import { usesMemoryRepository } from './memory/store.js';

function defaultField() {
  return { value: null, status: 'EMPTY', confidence: 0, source: 'aria_text', updatedAt: new Date().toISOString() };
}

export async function load(userId) {
  if (usesMemoryRepository()) return memoryProfileRepo.load(userId);

  const [rows, user] = await Promise.all([
    prisma.profileField.findMany({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { language: true } }),
  ]);
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const profile = Object.fromEntries(PROFILE_FIELD_KEYS.map((key) => {
    const row = byKey.get(key);
    return [key, row ? {
      value: row.value,
      status: row.status,
      confidence: row.confidence,
      source: row.source,
      ...(row.evidence ? { evidence: row.evidence } : {}),
      updatedAt: row.updatedAt.toISOString(),
    } : defaultField()];
  }));
  profile.preferredLanguage = user?.language === 'hi' || user?.language === 'en' ? user.language : 'hinglish';
  profile.completeness = completeness(profile);
  return profile;
}

export async function save(userId, mergedProfile, changedKeys = []) {
  if (usesMemoryRepository()) return memoryProfileRepo.save(userId, mergedProfile, changedKeys);

  const keys = [...new Set(changedKeys)].filter((key) => PROFILE_FIELD_KEYS.includes(key));
  await prisma.$transaction(async (tx) => {
    for (const key of keys) {
      const field = mergedProfile[key];
      if (!field || field.value === null || field.value === undefined) continue;
      const data = {
        value: field.value,
        status: field.status,
        confidence: field.confidence,
        source: field.source,
        ...(field.evidence ? { evidence: field.evidence } : {}),
      };
      await tx.profileField.upsert({
        where: { userId_key: { userId, key } },
        create: { userId, key, ...data },
        update: data,
      });
    }
  });
  const progress = completeness(mergedProfile);
  await projectProfile(userId, mergedProfile, progress.core);
  return load(userId);
}

export async function loadForMatching({ cursor = null, limit = 100 } = {}) {
  if (usesMemoryRepository()) return memoryProfileRepo.loadForMatching({ cursor, limit });
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new RangeError('Profile matching page limit must be between 1 and 1000');
  }

  const where = {
    isActive: true,
    consentGiven: true,
    ...(cursor ? { id: { gt: cursor } } : {}),
  };
  const users = await prisma.user.findMany({
    where,
    orderBy: { id: 'asc' },
    take: limit,
    include: { businessProfile: true },
  });
  return Promise.all(users.map(async (user) => ({
    user,
    profile: await load(user.id),
    businessProfile: user.businessProfile,
  })));
}

export async function removeForUser(userId) {
  if (usesMemoryRepository()) return memoryProfileRepo.removeForUser(userId);
  return prisma.$transaction(async (tx) => {
    const profileFields = await tx.profileField.deleteMany({ where: { userId } });
    const businessProfile = await tx.businessProfile.deleteMany({ where: { userId } });
    return { profileFields: profileFields.count, businessProfile: businessProfile.count };
  });
}

export default { load, save, loadForMatching, removeForUser };
