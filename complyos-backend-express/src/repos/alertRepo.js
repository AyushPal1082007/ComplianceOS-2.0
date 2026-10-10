import prisma from '../db.js';
import * as memoryAlertRepo from './memory/alertRepo.js';
import { usesMemoryRepository } from './memory/store.js';

export async function createSentinelAlertWithLedger({ alert, changeId, now = new Date() }) {
  if (usesMemoryRepository()) return memoryAlertRepo.createSentinelAlertWithLedger({ alert, changeId, now });

  try {
    return await prisma.$transaction(async (tx) => {
    if (changeId) {
      const existing = await tx.regulationAlert.findUnique({
        where: { userId_changeId: { userId: alert.userId, changeId } },
      });
      if (existing) return { created: false, sentinelAlert: null, regulationAlert: existing };
    }

    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const dailyCount = await tx.sentinelAlert.count({
      where: { userId: alert.userId, createdAt: { gte: startOfDay } },
    });
    if (dailyCount >= 1) return { created: false, reason: 'daily_limit', sentinelAlert: null, regulationAlert: null };

    const sentinelAlert = await tx.sentinelAlert.create({
      data: {
        userId: alert.userId,
        title: alert.title,
        summary: alert.summary,
        sourceUrl: alert.sourceUrl,
        lastVerifiedAt: new Date(alert.lastVerified),
        isSimulated: Boolean(alert.isSimulated),
        affectedAttributes: alert.affectedAttributes || {},
        status: alert.status || 'unread',
        createdAt: now,
        ...(changeId ? { changeId } : {}),
      },
    });
    const regulationAlert = changeId
      ? await tx.regulationAlert.create({
        data: { userId: alert.userId, changeId, status: 'sent', sentAt: now, isDigest: false },
      })
      : null;
    return { created: true, sentinelAlert, regulationAlert };
    });
  } catch (error) {
    if (error?.code !== 'P2002' || !changeId) throw error;
    const existing = await prisma.regulationAlert.findUnique({
      where: { userId_changeId: { userId: alert.userId, changeId } },
    });
    if (!existing) throw error;
    return { created: false, sentinelAlert: null, regulationAlert: existing };
  }
}

export async function createDigestLedger({ userId, changeId, now = new Date() }) {
  if (!userId || !changeId) throw new TypeError('Digest entries require userId and changeId');
  if (usesMemoryRepository()) return memoryAlertRepo.createDigestLedger({ userId, changeId, now });
  try {
    const entry = await prisma.regulationAlert.create({
      data: { userId, changeId, status: 'digest', isDigest: true, createdAt: now },
    });
    return { created: true, regulationAlert: entry };
  } catch (error) {
    if (error?.code !== 'P2002') throw error;
    const existing = await prisma.regulationAlert.findUnique({
      where: { userId_changeId: { userId, changeId } },
    });
    if (!existing) throw error;
    return { created: false, regulationAlert: existing };
  }
}

export async function listRecentForUser(userId, { limit = 5 } = {}) {
  if (usesMemoryRepository()) return memoryAlertRepo.listRecentForUser(userId, { limit });
  return prisma.sentinelAlert.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function removeForUser(userId) {
  if (usesMemoryRepository()) return memoryAlertRepo.removeForUser(userId);
  const [sentinelAlerts, regulationAlerts] = await prisma.$transaction([
    prisma.sentinelAlert.deleteMany({ where: { userId } }),
    prisma.regulationAlert.deleteMany({ where: { userId } }),
  ]);
  return { sentinelAlerts: sentinelAlerts.count, regulationAlerts: regulationAlerts.count };
}

export default { createSentinelAlertWithLedger, createDigestLedger, listRecentForUser, removeForUser };
