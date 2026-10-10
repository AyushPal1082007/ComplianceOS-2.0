import crypto from 'node:crypto';
import prisma from '../db.js';
import * as memoryDeadlineRepo from './memory/deadlineRepo.js';
import { usesMemoryRepository } from './memory/store.js';

function makeDedupeKey(userId, complianceType, deadlineDate, sourceDocumentId) {
  return crypto.createHash('sha1')
    .update([userId, complianceType, deadlineDate.toISOString(), sourceDocumentId || ''].join('|'))
    .digest('hex');
}

export async function upsertFromCalendarItems(userId, items = []) {
  if (usesMemoryRepository()) return memoryDeadlineRepo.upsertFromCalendarItems(userId, items);
  const results = [];
  for (const item of items) {
    const deadlineDate = new Date(item.deadlineDate);
    if (Number.isNaN(deadlineDate.getTime())) continue;
    const complianceType = item.complianceType || item.category || 'other';
    const sourceDocumentId = item.sourceDocumentId || null;
    const dedupeKey = makeDedupeKey(userId, complianceType, deadlineDate, sourceDocumentId);
    const data = {
      userId,
      title: item.title,
      description: item.description || null,
      deadlineDate,
      complianceType,
      status: item.status || 'pending',
      urgency: item.urgency || 'medium',
      sourceUrl: item.sourceUrl || null,
      lastVerifiedAt: item.lastVerified ? new Date(item.lastVerified) : item.lastVerifiedAt || null,
      sourceDocumentId,
      createdByAgent: item.createdByAgent || 'VEDA',
      penaltyEstimate: item.penaltyEstimate ?? null,
      dedupeKey,
    };
    results.push(await prisma.complianceDeadline.upsert({
      where: { dedupeKey },
      create: data,
      update: data,
    }));
  }
  return results;
}

export async function listUpcomingForUser(userId, { limit = 5, now = new Date() } = {}) {
  if (usesMemoryRepository()) return memoryDeadlineRepo.listUpcomingForUser(userId, { limit, now });
  return prisma.complianceDeadline.findMany({
    where: { userId, status: 'pending', deadlineDate: { gte: now } },
    orderBy: { deadlineDate: 'asc' },
    take: limit,
  });
}

export async function removeForUser(userId) {
  if (usesMemoryRepository()) return memoryDeadlineRepo.removeForUser(userId);
  return (await prisma.complianceDeadline.deleteMany({ where: { userId } })).count;
}

export default { upsertFromCalendarItems, listUpcomingForUser, removeForUser };
