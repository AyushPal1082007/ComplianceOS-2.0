import crypto from 'node:crypto';
import { memoryStore } from './store.js';

export async function saveFromVeda(userId, data) {
  const documentId = data.id || crypto.randomUUID();
  const existing = memoryStore.documents.get(documentId);
  if (existing && existing.userId !== userId) throw new Error('Document id is already owned by another user');
  const document = {
    ...existing,
    ...structuredClone(data),
    id: documentId,
    userId,
    createdAt: existing?.createdAt || new Date(),
  };
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
