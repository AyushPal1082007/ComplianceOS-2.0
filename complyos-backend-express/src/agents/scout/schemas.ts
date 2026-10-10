import { z } from 'zod';

// TODO(owner): contract change: replace this placeholder with ProfileFieldKey from src/contracts.
export type ProfileFieldKey = string;

export type ProfileField = {
  value: unknown;
  status: 'EMPTY' | 'SELF_REPORTED' | 'NEEDS_CONFIRMATION' | 'VERIFIED';
};

// TODO(owner): replace this local shape with BusinessProfile from src/contracts when available.
export type BusinessProfile = Record<string, ProfileField | string | undefined>;

const ProfileFieldSchema = z.object({
  value: z.unknown(),
  status: z.enum(['EMPTY', 'SELF_REPORTED', 'NEEDS_CONFIRMATION', 'VERIFIED']),
}).passthrough();

export const BusinessProfileSchema = z.object({
  profileId: z.string().min(1),
  preferredLanguage: z.string().optional(),
}).catchall(z.union([ProfileFieldSchema, z.string()]));

const profileFieldKeySchema = z.string().min(1);
const criterionValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const criterionBase = {
  field: profileFieldKeySchema,
};

export const CriterionSchema = z.union([
  z.object({ ...criterionBase, eq: criterionValueSchema }).strict(),
  z.object({ ...criterionBase, in: z.array(criterionValueSchema) }).strict(),
  z.object({ ...criterionBase, notIn: z.array(criterionValueSchema) }).strict(),
  z.object({ ...criterionBase, gte: z.number() }).strict(),
]);

export const SchemeRecordSchema = z.object({
  id: z.string().min(1),
  name: z.object({
    en: z.string().min(1),
    hi: z.string().min(1),
  }).strict(),
  level: z.enum(['central', 'state']),
  state: z.string().min(1),
  benefit: z.string().min(1),
  criteria: z.array(CriterionSchema),
  priority: z.number().int().min(0).max(10),
  applyUrl: z.string().min(1),
  sourceUrl: z.string().min(1),
  retrievedOn: z.string().min(1),
  checkedBy: z.string().min(1),
  sourceHash: z.string().min(1),
  status: z.enum(['active', 'stale', 'closed']),
}).strict();

export type Criterion = z.infer<typeof CriterionSchema> & { field: ProfileFieldKey };
export type SchemeRecord = z.infer<typeof SchemeRecordSchema>;

export const SchemeMatchSchema = z.object({
  schemeId: z.string().min(1),
  name: z.object({
    en: z.string().min(1),
    hi: z.string().min(1),
  }).strict(),
  result: z.enum(['likely_eligible', 'possible']),
  metCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  missingFields: z.array(profileFieldKeySchema),
  benefit: z.string(),
  applyUrl: z.string(),
  sourceUrl: z.string(),
  lastVerified: z.string(),
  stale: z.boolean(),
  basedOn: z.enum(['self_reported', 'verified', 'mixed', 'none']),
  priority: z.number().int().min(0).max(10),
  note: z.string().optional(),
}).strict();

export type SchemeMatch = z.infer<typeof SchemeMatchSchema>;

export type MissingFieldRank = {
  field: ProfileFieldKey;
  score: number;
  schemeIds: string[];
};

export type TeaserLanguage = 'hi' | 'en' | 'hinglish';

export type TeaserResult = {
  show: boolean;
  text?: string;
  count: number;
};

export const ExplanationPayloadSchema = z.object({
  explanation_hi: z.string(),
  explanation_en: z.string(),
}).strict();

export type ExplanationPayload = z.infer<typeof ExplanationPayloadSchema>;

export type Explanation = ExplanationPayload & {
  text: string;
  degraded: boolean;
  llmTokens: number;
  basis: 'code_rule' | 'llm_summary';
};

export type VerifyStatus =
  | 'SKIPPED_CLOSED'
  | 'SKIPPED_NO_SOURCE'
  | 'DEGRADED'
  | 'BASELINE_NEEDED'
  | 'UNCHANGED'
  | 'CHANGED';

export type ReviewItem = {
  schemeId: string;
  oldHash: string;
  newHash: string;
  checkedAt: string;
  sourceUrl: string;
};

export type VerifyResult = {
  schemeId: string;
  result: VerifyStatus;
  scheme: SchemeRecord;
  hash?: string;
  reason?: string;
  reviewItem?: ReviewItem;
};

export type VerifyReport = {
  results: VerifyResult[];
  reviewItems: ReviewItem[];
  updatedSchemes: SchemeRecord[];
  degradedCount: number;
  checkedAt: string;
};

export type EvalLabel = 'likely_eligible' | 'possible' | 'not_eligible';

export type EvalLabelEntry = {
  profileId: string;
  schemeId: string;
  label: EvalLabel | null;
};

export type EvalMetric = {
  numerator: number;
  denominator: number;
  value: number | null;
};

export type EvalClass = 'likely_eligible' | 'possible' | 'not_eligible';

export type EvalReport = {
  heading: string;
  totalPairs: number;
  labelledPairs: number;
  unlabelledPairs: number;
  precision: EvalMetric;
  recall: EvalMetric;
  possibleRate: EvalMetric;
  dangerousErrorCount: number;
  dangerousErrors: Array<{ profileId: string; schemeId: string; label: EvalLabel }>;
  confusionMatrix: Record<EvalClass, Record<EvalClass, number>>;
};