import prisma from '../db.js';
import * as memoryConsentRepo from './memory/consentRepo.js';
import * as memoryUserRepo from './memory/userRepo.js';
import { usesMemoryRepository } from './memory/store.js';

export async function record(entry) {
  if (usesMemoryRepository()) return memoryConsentRepo.record(entry);
  return prisma.consentLog.create({ data: entry });
}

export async function accept(userId, channel, textVersion = 'consent-v1', consentAt = new Date()) {
  const entry = { userId, action: 'accepted', textVersion, channel };
  if (usesMemoryRepository()) {
    const updatedUser = await memoryUserRepo.setConsent(userId, true, consentAt);
    const consentLog = await memoryConsentRepo.record(entry);
    return { user: updatedUser, consentLog };
  }
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { consentGiven: true, consentAt },
    });
    const consentLog = await tx.consentLog.create({ data: entry });
    return { user, consentLog };
  });
}

export async function list(userId) {
  if (usesMemoryRepository()) return memoryConsentRepo.list(userId);
  return prisma.consentLog.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

export default { record, accept, list };
