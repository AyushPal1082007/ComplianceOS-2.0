import crypto from 'node:crypto';
import { memoryStore } from './store.js';

export async function recordOnce({ channel, externalId, userId = null }) {
  const key = `${channel}:${externalId}`;
  if (memoryStore.inboundEvents.has(key)) return { created: false, event: memoryStore.inboundEvents.get(key) };
  const event = { id: crypto.randomUUID(), channel, externalId, userId, createdAt: new Date() };
  memoryStore.inboundEvents.set(key, event);
  return { created: true, event };
}

export async function removeForUser(userId) {
  let count = 0;
  for (const [key, event] of memoryStore.inboundEvents) {
    if (event.userId === userId) {
      memoryStore.inboundEvents.delete(key);
      count++;
    }
  }
  return count;
}

export default { recordOnce, removeForUser };
