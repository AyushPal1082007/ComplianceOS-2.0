import { z } from 'zod';
import {
  AgentStatusSchema,
  ClaimSchema,
  FieldStatusSchema,
  ProfileFieldKeySchema,
  ProfileFieldSchema,
} from './aria.js';

export const FieldSourceSchema = z.enum([
  'aria_text',
  'aria_voice',
  'aria_option',
  'veda_doc',
  'user_confirmed',
]);

const MessageOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
}).passthrough();

export const OutboundMessageSchema = z.union([
  z.object({ type: z.literal('text'), text: z.string() }).passthrough(),
  z.object({
    type: z.literal('option_card'),
    id: z.string(),
    text: z.string(),
    options: z.array(MessageOptionSchema),
  }).passthrough(),
  z.object({
    type: z.literal('confirm_card'),
    id: z.string(),
    text: z.string(),
    actions: z.array(MessageOptionSchema),
  }).passthrough(),
  z.object({
    type: z.literal('list'),
    text: z.string(),
    id: z.string().optional(),
    rows: z.array(MessageOptionSchema).optional(),
    items: z.array(z.object({
      title: z.string(),
      details: z.string(),
      tags: z.array(z.string()),
    }).passthrough()).optional(),
  }).passthrough(),
  z.object({ type: z.literal('file'), fileUrl: z.string(), mimeType: z.string().optional() }).passthrough(),
]);

export const TraceEventSchema = z.object({
  runId: z.string(),
  agent: z.enum(['ARIA', 'VEDA', 'SCOUT', 'SENTINEL', 'PATHWAY', 'ORCHESTRATOR']),
  node: z.string(),
  startedAt: z.string(),
  durationMs: z.number().nonnegative(),
  inputSummary: z.unknown().optional(),
  outputSummary: z.unknown().optional(),
  status: z.enum(['started', 'done', 'error', 'skipped', 'OK', 'NEEDS_INPUT', 'NEEDS_CONFIRMATION', 'DEGRADED', 'FAILED']),
  error: z.string().optional(),
}).passthrough();

export const AgentOutputBaseSchema = z.object({
  status: AgentStatusSchema,
  messages: z.array(OutboundMessageSchema),
  claims: z.array(ClaimSchema).default([]),
  trace: z.array(TraceEventSchema).default([]),
  costs: z.object({
    llmTokens: z.number().nonnegative().optional(),
    tinyfishAgentCalls: z.number().nonnegative().optional(),
  }).passthrough().default({}),
  profilePatch: z.record(z.string(), z.unknown()).optional(),
  calendarItems: z.array(z.record(z.string(), z.unknown())).optional(),
  session: z.unknown().optional(),
  escalate: z.string().optional(),
}).passthrough();

export const InboundEventSchema = z.object({
  channel: z.enum(['whatsapp', 'web']),
  externalId: z.string(),
  userId: z.string().optional(),
  phone: z.string().optional(),
  receivedAt: z.union([z.string(), z.date()]),
  type: z.enum(['TEXT', 'VOICE', 'OPTION_TAP', 'DOCUMENT', 'CONSENT', 'CONFIRM_ACTION', 'MENU', 'DELETE_CONFIRM']),
  text: z.string().optional(),
  audio: z.object({
    buffer: z.instanceof(Uint8Array).optional(),
    url: z.string().optional(),
    mime: z.string(),
  }).optional(),
  document: z.object({
    buffer: z.instanceof(Uint8Array).optional(),
    url: z.string().optional(),
    mime: z.string(),
    filename: z.string().optional(),
  }).optional(),
  card: z.object({ cardId: z.string(), actionId: z.string() }).optional(),
  language: z.enum(['hi', 'en', 'hinglish']).optional(),
}).passthrough();

export const ConversationStateSchema = z.object({
  phase: z.enum(['consent', 'intake', 'home', 'deleting']),
  ariaSession: z.unknown().optional(),
  pendingVeda: z.object({
    threadId: z.string(),
    cardId: z.string(),
    startedAt: z.string(),
  }).optional(),
  pendingDelete: z.boolean().optional(),
  outstandingCards: z.record(z.string(), z.enum(['ARIA', 'VEDA', 'MENU', 'SYSTEM'])).default({}),
  language: z.enum(['hi', 'en', 'hinglish']).default('hinglish'),
  lastInboundAt: z.union([z.string(), z.date()]).nullable().optional(),
  counters: z.object({
    docsThisMonth: z.object({ month: z.string(), count: z.number().int().nonnegative() }),
    schemeMatchesShown: z.number().int().nonnegative(),
  }).default({ docsThisMonth: { month: '', count: 0 }, schemeMatchesShown: 0 }),
  flags: z.object({ introduced: z.boolean().default(false) }).default({ introduced: false }),
}).passthrough();

export {
  AgentStatusSchema,
  ClaimSchema,
  FieldStatusSchema,
  ProfileFieldKeySchema,
  ProfileFieldSchema,
};
