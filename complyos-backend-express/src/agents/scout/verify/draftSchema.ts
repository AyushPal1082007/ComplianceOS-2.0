import { z } from 'zod';
import { CriterionSchema } from '../schemas.ts';

export const SchemeCandidateSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  snippet: z.string(),
  foundAt: z.string().datetime(),
}).strict();

export type SchemeCandidate = z.infer<typeof SchemeCandidateSchema>;

export const EvidenceSchema = z.object({
  fieldPath: z.string().min(1),
  evidenceQuote: z.string().min(1),
}).strict();

export const DraftSchemeSchema = z.object({
  id: z.string().min(1),
  name: z.object({ en: z.string().nullable(), hi: z.string().nullable() }).strict(),
  level: z.enum(['central', 'state']).nullable(),
  state: z.string().nullable(),
  benefit: z.string().nullable(),
  criteria: z.array(CriterionSchema),
  priority: z.number().int().min(0).max(10),
  applyUrl: z.string().url().nullable(),
  sourceUrl: z.string().url(),
  retrievedOn: z.string().date(),
  checkedBy: z.null(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.literal('stale'),
  draft: z.literal(true),
  unmappedConditions: z.array(z.string()),
  evidence: z.array(EvidenceSchema),
  costs: z.object({ tinyfishAgentCalls: z.number().int().nonnegative() }).strict(),
}).strict();

export type Evidence = z.infer<typeof EvidenceSchema>;
export type DraftScheme = z.infer<typeof DraftSchemeSchema>;