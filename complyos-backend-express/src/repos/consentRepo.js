import prisma from '../db.js';
import * as memoryConsentRepo from './memory/consentRepo.js';
import { usesMemoryRepository } from './memory/store.js';

export async function record(entry) {
  if (usesMemoryRepository()) return memoryConsentRepo.record(entry);
  return prisma.consentLog.create({ data: entry });
}

export async function list(userId) {
  if (usesMemoryRepository()) return memoryConsentRepo.list(userId);
  return prisma.consentLog.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

export default { record, list };
