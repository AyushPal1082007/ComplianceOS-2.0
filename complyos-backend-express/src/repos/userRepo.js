import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../db.js';
import { memoryStore, usesMemoryRepository } from './memory/store.js';
import * as memoryUserRepo from './memory/userRepo.js';

export async function findOrCreateByPhone(phone, channel = 'whatsapp') {
  if (usesMemoryRepository()) return memoryUserRepo.findOrCreateByPhone(phone, channel);
  const normalized = String(phone || '').replace(/\D/g, '');
  if (!normalized) throw new TypeError('A phone number is required');
  const existing = await prisma.user.findFirst({ where: { phone: normalized } });
  if (existing) return existing;

  const user = {
    email: `wa-${normalized}@users.complianceos.invalid`,
    passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
    phone: normalized,
    fullName: 'WhatsApp user',
    role: 'owner',
    plan: 'free',
  };
  try {
    return await prisma.user.create({ data: user });
  } catch (error) {
    if (error?.code !== 'P2002') throw error;
    const concurrentCreate = await prisma.user.findFirst({ where: { phone: normalized } });
    if (concurrentCreate) return concurrentCreate;
    throw error;
  }
}

export async function findById(userId) {
  if (usesMemoryRepository()) return memoryStore.users.get(userId) || null;
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function anonymizeUser(userId) {
  if (usesMemoryRepository()) return memoryUserRepo.anonymizeUser(userId);
  return prisma.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@users.complianceos.invalid`,
      phone: null,
      fullName: 'Deleted user',
      isActive: false,
      consentGiven: false,
    },
  });
}

export default { findOrCreateByPhone, findById, anonymizeUser };
