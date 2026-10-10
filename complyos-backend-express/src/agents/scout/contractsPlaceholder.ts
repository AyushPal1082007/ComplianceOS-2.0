// TODO(owner): replace with imports from src/contracts when it exists.
import { z } from 'zod';
import type { BusinessProfile } from './schemas.ts';

export type AgentStatus = 'OK' | 'NEEDS_INPUT' | 'NEEDS_CONFIRMATION' | 'DEGRADED' | 'FAILED';

export type GraphEvent = {
  type: string;
  [key: string]: unknown;
};

export type AgentInput = {
  runId: string;
  userId: string;
  event: GraphEvent;
  profile: BusinessProfile;
  locale: string;
};

export type Claim = {
  text: string;
  sourceUrl: string;
  lastVerified: string;
  basis: 'code_rule' | 'verified_db' | 'document' | 'llm_summary' | 'live_fetch';
  confidence: number;
};

export type TraceEvent = {
  runId: string;
  agent: string;
  node: string;
  startedAt: string;
  durationMs: number;
  inputSummary: string;
  outputSummary: string;
  status: AgentStatus;
  error?: string;
};

export type OutboundMessage =
  | { type: 'text'; text: string }
  | {
      type: 'list';
      text: string;
      items: Array<{ title: string; details: string; tags: string[]; sourceUrl: string; lastVerified: string }>;
    };

export type AgentOutput = {
  status: AgentStatus;
  messages: OutboundMessage[];
  claims: Claim[];
  trace: TraceEvent[];
  costs: { llmTokens?: number; tinyfishAgentCalls?: number };
};

const OutboundMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }).strict(),
  z.object({
    type: z.literal('list'),
    text: z.string(),
    items: z.array(z.object({
      title: z.string(),
      details: z.string(),
      tags: z.array(z.string()),
      sourceUrl: z.string().url(),
      lastVerified: z.string().min(1),
    }).strict()),
  }).strict(),
]);

const ClaimSchema = z.object({
  text: z.string(),
  sourceUrl: z.string(),
  lastVerified: z.string(),
  basis: z.enum(['code_rule', 'verified_db', 'document', 'llm_summary', 'live_fetch']),
  confidence: z.number().min(0).max(1),
}).strict();

const TraceEventSchema = z.object({
  runId: z.string(),
  agent: z.string(),
  node: z.string(),
  startedAt: z.string(),
  durationMs: z.number().nonnegative(),
  inputSummary: z.string(),
  outputSummary: z.string(),
  status: z.enum(['OK', 'NEEDS_INPUT', 'NEEDS_CONFIRMATION', 'DEGRADED', 'FAILED']),
  error: z.string().optional(),
}).strict();

export const AgentOutputSchema = z.object({
  status: z.enum(['OK', 'NEEDS_INPUT', 'NEEDS_CONFIRMATION', 'DEGRADED', 'FAILED']),
  messages: z.array(OutboundMessageSchema),
  claims: z.array(ClaimSchema),
  trace: z.array(TraceEventSchema),
  costs: z.object({
    llmTokens: z.number().nonnegative().optional(),
    tinyfishAgentCalls: z.number().nonnegative().optional(),
  }).strict(),
}).strict();