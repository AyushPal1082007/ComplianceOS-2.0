import crypto from 'node:crypto';
import { memoryStore } from './store.js';

export async function findOrCreateByPhone(phone, channel) {
  const normalized = String(phone || '').replace(/\D/g, '');
  if (!normalized) throw new TypeError('A phone number is required');
  const existing = [...memoryStore.users.values()].find((user) => user.phone === normalized);
  if (existing) return existing;
  const user = {
    id: crypto.randomUUID(),
    email: `wa-${normalized}@users.complianceos.invalid`,
    passwordHash: `disabled:${crypto.randomUUID()}`,
    phone: normalized,
    fullName: 'WhatsApp user',
    role: 'owner',
    plan: 'free',
    consentGiven: false,
    isActive: true,
  };
  memoryStore.users.set(user.id, user);
  return user;
}

export async function findByPhone(phone) {
  const normalized = String(phone || '').replace(/\D/g, '');
  if (!normalized) return null;
  return [...memoryStore.users.values()].find((user) => user.phone === normalized) || null;
}

export async function setConsent(userId, consentGiven, consentAt = new Date()) {
  const user = memoryStore.users.get(userId);
  if (!user) throw new Error('User not found while updating consent');
  const updated = { ...user, consentGiven, consentAt: consentGiven ? consentAt : null };
  memoryStore.users.set(userId, updated);
  return updated;
}

export async function anonymizeUser(userId) {
  const user = memoryStore.users.get(userId);
  if (!user) return null;
  const anonymized = {
    ...user,
    email: `deleted-${userId}@users.complianceos.invalid`,
    phone: null,
    fullName: 'Deleted user',
    isActive: false,
    consentGiven: false,
  };
  memoryStore.users.set(userId, anonymized);
  return anonymized;
}

export default { findOrCreateByPhone, findByPhone, setConsent, anonymizeUser };
