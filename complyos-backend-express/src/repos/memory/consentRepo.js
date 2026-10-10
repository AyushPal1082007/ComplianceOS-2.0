import crypto from 'node:crypto';
import { memoryStore } from './store.js';

export async function record({ userId, action, textVersion, channel }) {
  const entry = { id: crypto.randomUUID(), userId, action, textVersion, channel, createdAt: new Date() };
  memoryStore.consentLogs.push(entry);
  return entry;
}

export async function list(userId) {
  return memoryStore.consentLogs.filter((entry) => entry.userId === userId);
}

export default { record, list };
