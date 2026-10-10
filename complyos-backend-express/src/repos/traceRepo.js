import prisma from '../db.js';
import { TraceEventSchema } from '../contracts/common.js';
import * as memoryTraceRepo from './memory/traceRepo.js';
import { usesMemoryRepository } from './memory/store.js';

export async function append(events = []) {
  const parsed = events.map((event) => TraceEventSchema.parse(event));
  if (usesMemoryRepository()) return memoryTraceRepo.append(parsed);
  const saved = [];
  for (const event of parsed) {
    const summary = Object.fromEntries(Object.entries({
      inputSummary: event.inputSummary,
      outputSummary: event.outputSummary,
      ...(event.error ? { error: event.error } : {}),
    }).filter(([, value]) => value !== undefined));
    saved.push(await prisma.agentTraceEvent.create({
      data: {
        runId: event.runId,
        userId: event.userId || null,
        agent: event.agent,
        node: event.node,
        status: event.status,
        durationMs: event.durationMs,
        summary,
      },
    }));
  }
  return saved;
}

export async function removeForUser(userId) {
  if (usesMemoryRepository()) return memoryTraceRepo.removeForUser(userId);
  return (await prisma.agentTraceEvent.deleteMany({ where: { userId } })).count;
}

export default { append, removeForUser };
