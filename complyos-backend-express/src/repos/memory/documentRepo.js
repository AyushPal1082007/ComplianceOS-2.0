import crypto from 'node:crypto';
import { memoryStore } from './store.js';

export async function saveFromVeda(userId, data) {
  const document = { id: crypto.randomUUID(), userId, ...structuredClone(data), createdAt: new Date() };
  memoryStore.documents.set(document.id, document);
  return document;
}

export async function removeForUser(userId) {
  let count = 0;
  for (const [id, document] of memoryStore.documents) {
    if (document.userId === userId) {
      memoryStore.documents.delete(id);
      count++;
    }
  }
  return count;
}

export default { saveFromVeda, removeForUser };
