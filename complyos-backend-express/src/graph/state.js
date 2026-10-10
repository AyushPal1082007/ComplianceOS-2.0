import { z } from 'zod';
import { ConversationStateSchema } from '../contracts/common.js';

export const GraphStateSchema = z.object({
  runId: z.string(),
  userId: z.string(),
  event: z.record(z.string(), z.unknown()),
  user: z.record(z.string(), z.unknown()),
  profile: z.record(z.string(), z.unknown()),
  conversation: ConversationStateSchema,
  messages: z.array(z.record(z.string(), z.unknown())).default([]),
  claims: z.array(z.record(z.string(), z.unknown())).default([]),
  trace: z.array(z.record(z.string(), z.unknown())).default([]),
  status: z.string().optional(),
}).passthrough();

export function createGraphState({ runId, user, event, profile, conversation, agentRunners, services }) {
  return GraphStateSchema.parse({
    runId,
    userId: user.id,
    user,
    event,
    profile,
    conversation: conversation || { phase: 'intake' },
    messages: [],
    claims: [],
    trace: [],
    agentRunners,
    services,
  });
}

export default { GraphStateSchema, createGraphState };
