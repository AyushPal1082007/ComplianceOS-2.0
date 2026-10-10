import { memoryStore } from './store.js';

export async function load(userId) {
  const entry = memoryStore.conversations.get(userId);
  return entry ? structuredClone(entry) : { userId, state: null, version: 0, lastInboundAt: null };
}

export async function save(userId, state, { expectedVersion, lastInboundAt = null } = {}) {
  const current = memoryStore.conversations.get(userId);
  const version = current?.version || 0;
  if (expectedVersion !== undefined && expectedVersion !== version) {
    throw new Error('Conversation state version conflict');
  }
  const saved = { userId, state: structuredClone(state), version: version + 1, lastInboundAt };
  memoryStore.conversations.set(userId, saved);
  return structuredClone(saved);
}

export async function remove(userId) {
  return memoryStore.conversations.delete(userId);
}

export default { load, save, remove };
