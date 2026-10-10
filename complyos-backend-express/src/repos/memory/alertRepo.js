import crypto from 'node:crypto';
import { memoryStore } from './store.js';

export async function createSentinelAlertWithLedger({ alert, changeId }) {
  const uniqueKey = changeId ? `${alert.userId}:${changeId}` : null;
  if (uniqueKey && memoryStore.regulationAlerts.has(uniqueKey)) {
    return { created: false, sentinelAlert: null, regulationAlert: memoryStore.regulationAlerts.get(uniqueKey) };
  }
  const sentinelAlert = { id: crypto.randomUUID(), ...structuredClone(alert), changeId: changeId || null };
  memoryStore.sentinelAlerts.set(sentinelAlert.id, sentinelAlert);
  const regulationAlert = changeId ? {
    id: crypto.randomUUID(),
    userId: alert.userId,
    changeId,
    status: 'sent',
    sentAt: new Date(),
  } : null;
  if (uniqueKey) memoryStore.regulationAlerts.set(uniqueKey, regulationAlert);
  return { created: true, sentinelAlert, regulationAlert };
}

export async function removeForUser(userId) {
  for (const [id, alert] of memoryStore.sentinelAlerts) {
    if (alert.userId === userId) memoryStore.sentinelAlerts.delete(id);
  }
  for (const [key, alert] of memoryStore.regulationAlerts) {
    if (alert.userId === userId) memoryStore.regulationAlerts.delete(key);
  }
}

export default { createSentinelAlertWithLedger, removeForUser };
