import { z } from 'zod';

export const FieldStatusSchema = z.enum(['EMPTY', 'SELF_REPORTED', 'NEEDS_CONFIRMATION', 'VERIFIED']);
export const ProfileFieldKeySchema = z.enum([
  'state', 'district', 'sector', 'subSector', 'constitution', 'turnoverBand',
  'gstRegistered', 'gstFilingFrequency', 'udyamRegistered', 'employeesBand',
  'womenLed', 'ownerAgeBand', 'socialCategory', 'hasLoan', 'yearsInBusiness',
  'isExporter', 'goal', 'gstin', 'udyamNumber',
]);
export const IntentSchema = z.enum([
  'answer', 'skip', 'unsure', 'back', 'why', 'restart', 'change_language',
  'delete', 'stop', 'confirm_yes', 'confirm_edit', 'off_topic',
]);
export const AriaSessionSchema = z.object({
  phase: z.enum(['welcome', 'asking', 'reveal', 'editing', 'extended', 'done']),
  askedQuestionIds: z.array(z.string()),
  lastQuestionId: z.string().optional(),
  skippedIds: z.array(z.string()),
  history: z.array(z.object({
    qid: z.string(), field: ProfileFieldKeySchema, previousValue: z.any(), newValue: z.any(),
    via: z.enum(['option', 'text', 'voice']), ts: z.string(),
  })),
  turnCount: z.number().int().nonnegative(),
  language: z.enum(['hi', 'en', 'hinglish']),
  editingField: ProfileFieldKeySchema.optional(),
  reasking: z.boolean().optional(),
  teaserShown: z.boolean().optional(),
  retryCounts: z.record(z.string(), z.number().int().nonnegative()).default({}),
});
export const UserTurnSchema = z.object({
  text: z.string(), via: z.enum(['option', 'text', 'voice']), confidence: z.number().min(0).max(1),
  quoteSource: z.string(), transcriptId: z.string().optional(), option: z.object({
    questionId: z.string(), optionId: z.string(), value: z.any(),
  }).optional(),
});

export const AgentStatusSchema = z.enum(['OK', 'NEEDS_INPUT', 'NEEDS_CONFIRMATION', 'DEGRADED', 'FAILED']);
export const ProfileFieldSchema = z.object({
  value: z.any().nullable(),
  status: FieldStatusSchema,
  confidence: z.number().min(0).max(1),
  source: z.enum(['aria_text', 'aria_voice', 'aria_option', 'veda_doc', 'user_confirmed']),
  evidence: z.object({ docId: z.string().optional(), quote: z.string().optional(), transcriptId: z.string().optional() }).passthrough().optional(),
  updatedAt: z.string(),
});
export const OutboundMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }).passthrough(),
  z.object({ type: z.literal('option_card'), id: z.string(), text: z.string(), options: z.array(z.object({ id: z.string(), label: z.string() })), progress: z.object({ done: z.number(), total: z.number() }).optional(), allowFreeText: z.literal(true) }).passthrough(),
  z.object({ type: z.literal('list'), id: z.string(), text: z.string(), rows: z.array(z.object({ id: z.string(), label: z.string(), description: z.string().optional() })), allowFreeText: z.literal(true).optional() }).passthrough(),
  z.object({ type: z.literal('confirm_card'), id: z.string(), text: z.string(), actions: z.array(z.object({ id: z.string(), label: z.string() })) }).passthrough(),
  z.object({ type: z.literal('file'), fileUrl: z.string(), mimeType: z.string().optional() }).passthrough(),
]);
export const TraceEventSchema = z.object({
  runId: z.string(), agent: z.literal('ARIA'), node: z.string(), startedAt: z.string(), durationMs: z.number(),
  inputSummary: z.any().optional(), outputSummary: z.any().optional(), status: z.enum(['started', 'done', 'error', 'skipped']), error: z.string().optional(),
}).passthrough();
export const ClaimSchema = z.object({ text: z.string(), sourceUrl: z.string(), lastVerified: z.string(), basis: z.string(), confidence: z.number().min(0).max(1) });
export const AgentInputSchema = z.object({
  runId: z.string(), userId: z.string(), event: z.object({ type: z.string() }).passthrough(),
  profile: z.record(z.string(), z.any()).default({}), locale: z.enum(['hi', 'en', 'hinglish']).default('hinglish'),
  session: AriaSessionSchema.optional(),
}).passthrough();
export const AgentOutputSchema = z.object({
  status: AgentStatusSchema, profilePatch: z.record(z.string(), z.union([
    ProfileFieldSchema,
    z.object({ core: z.number().min(0).max(1), extended: z.number().min(0).max(1) }),
    z.enum(['hi', 'en', 'hinglish']),
  ])).optional(),
  messages: z.array(OutboundMessageSchema), claims: z.array(ClaimSchema), trace: z.array(TraceEventSchema),
  costs: z.object({ llmTokens: z.number().optional() }), session: AriaSessionSchema.optional(), escalate: z.string().optional(),
}).passthrough();

/** @typedef {z.infer<typeof AriaSessionSchema>} AriaSession */
/** @typedef {z.infer<typeof UserTurnSchema>} UserTurn */
/** @typedef {z.infer<typeof ProfileFieldKeySchema>} ProfileFieldKey */
