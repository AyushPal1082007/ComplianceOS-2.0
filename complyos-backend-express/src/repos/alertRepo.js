import prisma from '../db.js';
import * as memoryAlertRepo from './memory/alertRepo.js';
import { usesMemoryRepository } from './memory/store.js';

export async function createSentinelAlertWithLedger({ alert, changeId }) {
  if (usesMemoryRepository()) return memoryAlertRepo.createSentinelAlertWithLedger({ alert, changeId });

  return prisma.$transaction(async (tx) => {
    if (changeId) {
      const existing = await tx.regulationAlert.findUnique({
        where: { userId_changeId: { userId: alert.userId, changeId } },
      });
      if (existing) return { created: false, sentinelAlert: null, regulationAlert: existing };
    }

    const sentinelAlert = await tx.sentinelAlert.create({
      data: { ...alert, ...(changeId ? { changeId } : {}) },
    });
    const regulationAlert = changeId
      ? await tx.regulationAlert.create({
        data: { userId: alert.userId, changeId, status: 'sent', sentAt: new Date() },
      })
      : null;
    return { created: true, sentinelAlert, regulationAlert };
  });
}

export async function removeForUser(userId) {
  if (usesMemoryRepository()) return memoryAlertRepo.removeForUser(userId);
  return prisma.$transaction([
    prisma.sentinelAlert.deleteMany({ where: { userId } }),
    prisma.regulationAlert.deleteMany({ where: { userId } }),
  ]);
}

export default { createSentinelAlertWithLedger, removeForUser };
