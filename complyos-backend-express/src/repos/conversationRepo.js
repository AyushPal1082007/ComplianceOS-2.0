import prisma from '../db.js';
import { ConversationStateSchema } from '../contracts/common.js';
import * as memoryConversationRepo from './memory/conversationRepo.js';
import { usesMemoryRepository } from './memory/store.js';

export async function load(userId) {
  if (usesMemoryRepository()) return memoryConversationRepo.load(userId);
  const row = await prisma.conversationState.findUnique({ where: { userId } });
  return row
    ? { userId, state: row.state, version: row.version, lastInboundAt: row.lastInboundAt }
    : { userId, state: null, version: 0, lastInboundAt: null };
}

export async function save(userId, state, { expectedVersion, lastInboundAt = null } = {}) {
  const parsedState = ConversationStateSchema.parse(state);
  if (usesMemoryRepository()) return memoryConversationRepo.save(userId, parsedState, { expectedVersion, lastInboundAt });
  const current = await prisma.conversationState.findUnique({ where: { userId }, select: { version: true } });
  const currentVersion = current?.version || 0;
  if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
    throw new Error('Conversation state version conflict');
  }
  if (!current) {
    return prisma.conversationState.create({
      data: { userId, state: parsedState, version: 1, lastInboundAt },
    });
  }
  const updated = await prisma.conversationState.updateMany({
    where: { userId, version: currentVersion },
    data: { state: parsedState, version: currentVersion + 1, lastInboundAt },
  });
  if (updated.count !== 1) throw new Error('Conversation state version conflict');
  return prisma.conversationState.findUnique({ where: { userId } });
}

export async function remove(userId) {
  if (usesMemoryRepository()) return memoryConversationRepo.remove(userId);
  return prisma.conversationState.deleteMany({ where: { userId } });
}

export default { load, save, remove };
