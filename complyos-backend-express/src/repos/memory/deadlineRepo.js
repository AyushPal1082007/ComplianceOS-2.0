import crypto from 'node:crypto';
import { memoryStore } from './store.js';

export async function upsertFromCalendarItems(userId, items) {
  const saved = [];
  for (const item of items) {
    const date = new Date(item.deadlineDate);
    if (Number.isNaN(date.getTime())) continue;
    const complianceType = item.complianceType || item.category || 'other';
    const dedupeKey = crypto.createHash('sha1')
      .update([userId, complianceType, date.toISOString(), item.sourceDocumentId || ''].join('|'))
      .digest('hex');
    const existing = memoryStore.deadlines.get(dedupeKey);
    const row = {
      ...existing,
      ...structuredClone(item),
      userId,
      complianceType,
      deadlineDate: date,
      sourceUrl: item.sourceUrl || null,
      lastVerifiedAt: item.lastVerified ? new Date(item.lastVerified) : item.lastVerifiedAt || null,
      sourceDocumentId: item.sourceDocumentId || null,
      createdByAgent: item.createdByAgent || 'VEDA',
      penaltyEstimate: item.penaltyEstimate ?? null,
      dedupeKey,
    };
    memoryStore.deadlines.set(dedupeKey, row);
    saved.push(row);
  }
  return saved;
}

export async function listUpcomingForUser(userId, { limit = 5, now = new Date() } = {}) {
  return [...memoryStore.deadlines.values()]
    .filter((item) => item.userId === userId && item.status === 'pending' && new Date(item.deadlineDate) >= now)
    .sort((left, right) => new Date(left.deadlineDate) - new Date(right.deadlineDate))
    .slice(0, limit)
    .map((item) => structuredClone(item));
}

export async function removeForUser(userId) {
  let count = 0;
  for (const [key, deadline] of memoryStore.deadlines) {
    if (deadline.userId === userId) {
      memoryStore.deadlines.delete(key);
      count++;
    }
  }
  return count;
}

export default { upsertFromCalendarItems, listUpcomingForUser, removeForUser };
