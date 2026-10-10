import crypto from 'node:crypto';
import { memoryStore } from './store.js';

export async function createSentinelAlertWithLedger({ alert, changeId, now = new Date() }) {
  const uniqueKey = changeId ? `${alert.userId}:${changeId}` : null;
  if (uniqueKey && memoryStore.regulationAlerts.has(uniqueKey)) {
    return { created: false, sentinelAlert: null, regulationAlert: memoryStore.regulationAlerts.get(uniqueKey) };
  }
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const immediateToday = [...memoryStore.sentinelAlerts.values()].filter((item) => (
    item.userId === alert.userId && new Date(item.createdAt || 0) >= startOfDay
  ));
  if (immediateToday.length >= 1) {
    return { created: false, reason: 'daily_limit', sentinelAlert: null, regulationAlert: null };
  }
  const sentinelAlert = { id: crypto.randomUUID(), ...structuredClone(alert), changeId: changeId || null, createdAt: new Date(now) };
  memoryStore.sentinelAlerts.set(sentinelAlert.id, sentinelAlert);
  const regulationAlert = changeId ? {
    id: crypto.randomUUID(),
    userId: alert.userId,
    changeId,
    status: 'sent',
    sentAt: new Date(now),
    isDigest: false,
  } : null;
  if (uniqueKey) memoryStore.regulationAlerts.set(uniqueKey, regulationAlert);
  return { created: true, sentinelAlert, regulationAlert };
}

export async function createDigestLedger({ userId, changeId, now = new Date() }) {
  const key = `${userId}:${changeId}`;
  if (memoryStore.regulationAlerts.has(key)) {
    return { created: false, regulationAlert: memoryStore.regulationAlerts.get(key) };
  }
  const regulationAlert = {
    id: crypto.randomUUID(),
    userId,
    changeId,
    status: 'digest',
    sentAt: null,
    isDigest: true,
    createdAt: new Date(now),
  };
  memoryStore.regulationAlerts.set(key, regulationAlert);
  return { created: true, regulationAlert };
}

export async function listRecentForUser(userId, { limit = 5 } = {}) {
  return [...memoryStore.sentinelAlerts.values()]
    .filter((item) => item.userId === userId)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .slice(0, limit)
    .map((item) => structuredClone(item));
}

export async function removeForUser(userId) {
  let sentinelAlerts = 0;
  let regulationAlerts = 0;
  for (const [id, alert] of memoryStore.sentinelAlerts) {
    if (alert.userId === userId) {
      memoryStore.sentinelAlerts.delete(id);
      sentinelAlerts++;
    }
  }
  for (const [key, alert] of memoryStore.regulationAlerts) {
    if (alert.userId === userId) {
      memoryStore.regulationAlerts.delete(key);
      regulationAlerts++;
    }
  }
  return { sentinelAlerts, regulationAlerts };
}

export default { createSentinelAlertWithLedger, createDigestLedger, listRecentForUser, removeForUser };
