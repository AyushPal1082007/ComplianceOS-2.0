import prisma from '../db.js';
import * as memoryInboundEventRepo from './memory/inboundEventRepo.js';
import { usesMemoryRepository } from './memory/store.js';

export async function recordOnce({ channel, externalId, userId = null }) {
  if (usesMemoryRepository()) return memoryInboundEventRepo.recordOnce({ channel, externalId, userId });
  try {
    const event = await prisma.inboundEvent.create({ data: { channel, externalId, userId } });
    return { created: true, event };
  } catch (error) {
    if (error?.code !== 'P2002') throw error;
    const event = await prisma.inboundEvent.findUnique({ where: { channel_externalId: { channel, externalId } } });
    if (!event) throw error;
    return { created: false, event };
  }
}

export async function removeForUser(userId) {
  if (usesMemoryRepository()) return memoryInboundEventRepo.removeForUser(userId);
  return (await prisma.inboundEvent.deleteMany({ where: { userId } })).count;
}

export default { recordOnce, removeForUser };
