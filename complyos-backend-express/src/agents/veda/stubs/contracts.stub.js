// STUB
/**
 * ComplianceOS — Contracts Stub
 * Owned by backend lead / contracts owner.
 * Provides Zod schemas and TypeScript/JSDoc types for cross-agent contracts.
 */

import { z } from 'zod';

export const FieldStatusSchema = z.enum(['EMPTY', 'SELF_REPORTED', 'NEEDS_CONFIRMATION', 'VERIFIED']);

export const FieldSourceSchema = z.enum([
  'aria_text',
  'aria_voice',
  'aria_option',
  'veda_doc',
  'user_confirmed',
]);

export const EvidenceSchema = z.object({
  docId: z.string().optional(),
  quote: z.string().optional(),
  transcriptId: z.string().optional(),
}).optional();

export const FieldSchema = z.object({
  value: z.any(),
  status: FieldStatusSchema,
  confidence: z.number().min(0).max(1),
  source: FieldSourceSchema,
  evidence: EvidenceSchema,
  updatedAt: z.string(),
});

export const ClaimBasisSchema = z.enum([
  'code_rule',
  'verified_db',
  'document',
  'llm_summary',
  'live_fetch',
]);

export const ClaimSchema = z.object({
  text: z.string(),
  sourceUrl: z.string(),
  lastVerified: z.string(),
  basis: ClaimBasisSchema,
  confidence: z.number().min(0).max(1),
});

export const AgentStatusSchema = z.enum([
  'OK',
  'NEEDS_INPUT',
  'NEEDS_CONFIRMATION',
  'DEGRADED',
  'FAILED',
]);

export const OutboundMessageSchema = z.object({
  type: z.enum(['text', 'option_card', 'confirm_card', 'file']),
  text: z.string().optional(),
  title: z.string().optional(),
  options: z.array(z.object({
    id: z.string(),
    label: z.string(),
    value: z.any().optional(),
  })).optional(),
  card: z.record(z.string(), z.any()).optional(),
  fileUrl: z.string().optional(),
  mimeType: z.string().optional(),
});

export const TraceEventSchema = z.object({
  runId: z.string(),
  agent: z.string(),
  node: z.string(),
  startedAt: z.string(),
  durationMs: z.number(),
  inputSummary: z.any().optional(),
  outputSummary: z.any().optional(),
  status: z.enum(['started', 'done', 'error', 'skipped']),
  error: z.string().optional(),
});

export const CalendarItemSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  deadlineDate: z.string(),
  urgency: z.enum(['high', 'medium', 'low']).optional(),
  category: z.string().optional(),
  sourceUrl: z.string().optional(),
});

export const AgentOutputSchema = z.object({
  status: AgentStatusSchema,
  profilePatch: z.record(z.string(), FieldSchema).optional(),
  messages: z.array(z.record(z.string(), z.any())),
  claims: z.array(ClaimSchema),
  calendarItems: z.array(CalendarItemSchema).optional(),
  trace: z.array(z.record(z.string(), z.any())),
  costs: z.object({
    llmTokens: z.number().optional(),
    tinyfishAgentCalls: z.number().optional(),
  }),
});

export const AgentInputSchema = z.object({
  runId: z.string(),
  userId: z.string(),
  event: z.object({
    type: z.string(),
    docId: z.string().optional(),
    url: z.string().optional(),
    mime: z.string().optional(),
    ocrText: z.string().optional(),
    action: z.string().optional(),
    payload: z.any().optional(),
  }),
  profile: z.record(z.string(), z.any()).default({}),
  locale: z.string().default('hinglish'),
});

export default {
  FieldStatusSchema,
  FieldSourceSchema,
  FieldSchema,
  ClaimBasisSchema,
  ClaimSchema,
  AgentStatusSchema,
  OutboundMessageSchema,
  TraceEventSchema,
  CalendarItemSchema,
  AgentOutputSchema,
  AgentInputSchema,
};
