import crypto from 'node:crypto';
import prisma from '../db.js';
import logger from '../logger.js';
import { memoryStore, usesMemoryRepository } from '../repos/memory/store.js';

function valueOf(field) {
  return field && typeof field === 'object' && 'status' in field ? field.value : field;
}

function fieldStatus(field) {
  return field && typeof field === 'object' ? field.status : undefined;
}

export function buildBusinessProfileProjection(userId, profile, completeness = 0) {
  const data = { userId, profileComplete: completeness >= 0.8 };
  const columns = {
    state: 'state',
    district: 'district',
    sector: 'sector',
    udyamNumber: 'udyamNumber',
    turnoverBand: 'turnoverBand',
    employeesBand: 'employeesBand',
  };
  for (const [field, column] of Object.entries(columns)) {
    const value = valueOf(profile[field]);
    if (value !== null && value !== undefined) data[column] = value;
  }
  if (valueOf(profile.womenLed) !== null && valueOf(profile.womenLed) !== undefined) {
    data.isWomenLed = valueOf(profile.womenLed) === true;
  }

  if (fieldStatus(profile.gstin) === 'VERIFIED' && valueOf(profile.gstin)) {
    data.gstin = valueOf(profile.gstin);
  }
  for (const metric of ['healthScore', 'penaltyAtRisk', 'schemeHeadroom']) {
    if (Number.isFinite(profile[metric])) data[metric] = profile[metric];
  }

  return data;
}

export async function projectProfile(userId, profile, completeness = 0, { client = prisma } = {}) {
  const data = buildBusinessProfileProjection(userId, profile, completeness);
  if (usesMemoryRepository()) {
    const existing = memoryStore.profiles.get(userId) || { id: crypto.randomUUID(), userId };
    const merged = { ...existing, ...data };
    memoryStore.profiles.set(userId, merged);
    return merged;
  }

  const upsert = (projected) => client.businessProfile.upsert({
    where: { userId },
    create: projected,
    update: Object.fromEntries(Object.entries(projected).filter(([key]) => key !== 'userId')),
  });

  try {
    return await upsert(data);
  } catch (error) {
    const target = error?.meta?.target;
    const gstinCollision = error?.code === 'P2002'
      && (Array.isArray(target) ? target.includes('gstin') : String(target || '').includes('gstin'));
    if (!gstinCollision || !Object.hasOwn(data, 'gstin')) throw error;

    logger.warn('Business profile GSTIN projection skipped due to uniqueness conflict', { userId });
    const { gstin, ...withoutGstin } = data;
    return upsert(withoutGstin);
  }
}

export default { buildBusinessProfileProjection, projectProfile };
