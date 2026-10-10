import crypto from 'node:crypto';
import { memoryStore } from './store.js';

export async function append(events = []) {
  const saved = events.map((event) => ({
    id: crypto.randomUUID(),
    ...structuredClone(event),
    createdAt: new Date(),
  }));
  memoryStore.traces.push(...saved);
  return saved;
}

export async function removeForUser(userId) {
  const before = memoryStore.traces.length;
  memoryStore.traces = memoryStore.traces.filter((event) => event.userId !== userId);
  return before - memoryStore.traces.length;
}

export default { append, removeForUser };
