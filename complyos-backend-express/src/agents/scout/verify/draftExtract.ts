import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CriterionSchema, type Criterion } from '../schemas.ts';
import type { GroqClient } from '../groqPlaceholder.ts';
import {
  DraftSchemeSchema,
  type DraftScheme,
  type Evidence,
  type SchemeCandidate,
} from './draftSchema.ts';
import { hashNormalized } from './hash.ts';
import { normalizeText } from './normalize.ts';
import { withBlockCheck, type TinyFishClient } from './tinyfishPlaceholder.ts';

export type AgentCallBudget = {
  dailyCap: number;
  callsUsed: number;
};

type Fact = { value: string; evidenceQuote: string };
type Extraction = {
  nameEn?: Fact;
  nameHi?: Fact;
  benefit?: Fact;
  applyUrl?: Fact;
  conditions: Array<{ text: string; evidenceQuote: string }>;
};

const FactSchema = z.object({ value: z.string().min(1), evidenceQuote: z.string().min(1) }).strict();
const ExtractedFactSchema = z.union([FactSchema, z.literal('NOT_FOUND'), z.null()]);
const ExtractionSchema = z.object({
  nameEn: ExtractedFactSchema.optional(),
  nameHi: ExtractedFactSchema.optional(),
  benefit: ExtractedFactSchema.optional(),
  applyUrl: ExtractedFactSchema.optional(),
  conditions: z.array(z.object({
    text: z.string().min(1),
    evidenceQuote: z.string().min(1),
  }).strict()).default([]),
}).strict();

const CriteriaMappingSchema = z.array(z.object({
  condition: z.string().min(1),
  evidenceQuote: z.string().min(1),
  criterion: CriterionSchema,
}).strict());

type RawExtraction = z.infer<typeof ExtractionSchema>;

function buildDraftCriteriaPrompt(
  fieldNames: string[],
  allowedValues: Record<string, readonly (string | boolean)[]>,
): string {
  return [
    'Convert only the supplied eligibility condition text into criteria.',
    'Do not add facts, conditions, values, fields, or evidence quotes.',
    'Use only these profile field names and enum values.',
    `Fields: ${fieldNames.join(', ')}`,
    `Enum values: ${JSON.stringify(allowedValues)}`,
    'Return an array of { condition, evidenceQuote, criterion } objects.',
  ].join(' ');
}

const profileFields = new Set([
  'state', 'district', 'sector', 'subSector', 'constitution', 'turnoverBand',
  'gstRegistered', 'gstin', 'gstFilingFrequency', 'udyamRegistered', 'udyamNumber',
  'employeesBand', 'womenLed', 'ownerAgeBand', 'socialCategory', 'hasLoan',
  'yearsInBusiness', 'isExporter', 'goal',
]);

const enumValues: Record<string, readonly (string | boolean)[]> = {
  sector: ['trader', 'manufacturer', 'service', 'other'],
  turnoverBand: ['lt20L', '20L_40L', '40L_1_5Cr', '1_5_5Cr', 'gt5Cr'],
  employeesBand: ['0', '1_9', '10_19', '20plus'],
  ownerAgeBand: ['lt21', '21_40', '41_60', 'gt60'],
  gstRegistered: [true, false],
  udyamRegistered: [true, false],
  womenLed: [true, false],
  hasLoan: [true, false],
  isExporter: [true, false],
};

const booleanFields = new Set(['gstRegistered', 'udyamRegistered', 'womenLed', 'hasLoan', 'isExporter']);
const stringFields = new Set([
  'state', 'district', 'subSector', 'constitution', 'gstin', 'gstFilingFrequency',
  'udyamNumber', 'socialCategory', 'goal',
]);

function factFromCandidateTitle(candidate: SchemeCandidate, pageText: string): Extraction {
  const extraction: Extraction = { conditions: [] };
  const title = candidate.title.trim();
  if (title && pageText.includes(title)) {
    extraction.nameEn = { value: title, evidenceQuote: title };
    const hindi = title.match(/[\u0900-\u097F][\u0900-\u097F\s,()'-]*/u)?.[0]?.trim();
    if (hindi && pageText.includes(hindi)) {
      extraction.nameHi = { value: hindi, evidenceQuote: hindi };
    }
  }
  return extraction;
}

function sentenceLines(text: string): string[] {
  return text.split(/(?<=[.!?।])\s+|\n+/u).map((line) => line.trim()).filter(Boolean);
}

function findApplyUrl(rawPage: string, candidateUrl: string, pageText: string): Fact | undefined {
  const anchors = /<a\b[^>]*href\s*=\s*['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a\s*>/gi;
  for (const match of rawPage.matchAll(anchors)) {
    const href = match[1];
    const anchorText = normalizeText(match[2] ?? '');
    if (!href || !/apply|application|आवेदन|लागू/i.test(anchorText) || !pageText.includes(anchorText)) continue;
    try {
      const url = new URL(href, candidateUrl);
      const host = url.hostname.toLowerCase();
      if (host.endsWith('.gov.in') || host.endsWith('.nic.in')) {
        return { value: url.toString(), evidenceQuote: anchorText };
      }
    } catch {
      continue;
    }
  }

  const visibleUrl = pageText.match(/https?:\/\/[^\s<>()]+/gi)?.find((value) => /apply|application/i.test(value));
  if (!visibleUrl) return undefined;
  try {
    const url = new URL(visibleUrl);
    const host = url.hostname.toLowerCase();
    return host.endsWith('.gov.in') || host.endsWith('.nic.in')
      ? { value: url.toString(), evidenceQuote: visibleUrl }
      : undefined;
  } catch {
    return undefined;
  }
}

function extractReadablePage(candidate: SchemeCandidate, rawPage: string, pageText: string): Extraction {
  const extraction = factFromCandidateTitle(candidate, pageText);
  const sentences = sentenceLines(pageText);
  const benefit = sentences.find((sentence) => /benefit|assistance|support|subsidy|incentive|grant|लाभ|सहायता|अनुदान/i.test(sentence));
  if (benefit) extraction.benefit = { value: benefit, evidenceQuote: benefit };

  extraction.conditions = sentences
    .filter((sentence) => /eligib|criteria|condition|must|required|shall|registered|पात्रता|शर्त|आवश्यक/i.test(sentence))
    .map((sentence) => ({ text: sentence, evidenceQuote: sentence }));
  extraction.applyUrl = findApplyUrl(rawPage, candidate.url, pageText);
  return extraction;
}

function isGroundedFact(fact: Fact | undefined, pageText: string): fact is Fact {
  return Boolean(fact?.value.trim() && fact.evidenceQuote && pageText.includes(fact.evidenceQuote));
}

function isOfficialUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.endsWith('.gov.in') || host.endsWith('.nic.in');
  } catch {
    return false;
  }
}

function valuesFor(criterion: Criterion): Array<string | number | boolean | null> {
  if ('eq' in criterion) return [criterion.eq];
  if ('in' in criterion) return criterion.in;
  if ('notIn' in criterion) return criterion.notIn;
  if ('gte' in criterion) return [criterion.gte];
  return [];
}

function validCriterion(criterion: Criterion): boolean {
  if (!profileFields.has(criterion.field)) return false;
  const values = valuesFor(criterion);
  if (values.length === 0) return false;

  const allowed = enumValues[criterion.field];
  if (allowed && values.some((value) => !allowed.includes(value as string & boolean))) return false;
  if (booleanFields.has(criterion.field) && (!('eq' in criterion) || typeof criterion.eq !== 'boolean')) return false;
  if (stringFields.has(criterion.field) && values.some((value) => typeof value !== 'string')) return false;
  if (criterion.field === 'yearsInBusiness' && (!('gte' in criterion) || criterion.gte < 0)) return false;
  if (criterion.field !== 'yearsInBusiness' && 'gte' in criterion) return false;
  return true;
}

async function mapConditions(
  conditions: Extraction['conditions'],
  pageText: string,
  groq?: GroqClient,
): Promise<{ criteria: Criterion[]; unmapped: string[]; evidence: Evidence[] }> {
  const grounded = conditions.filter((condition) =>
    condition.text.trim() && condition.evidenceQuote && pageText.includes(condition.evidenceQuote),
  );
  if (grounded.length === 0) return { criteria: [], unmapped: [], evidence: [] };

  if (!groq) {
    return { criteria: [], unmapped: grounded.map((condition) => condition.text), evidence: [] };
  }

  try {
    const mapped = CriteriaMappingSchema.parse(await groq.json(
      CriteriaMappingSchema,
      buildDraftCriteriaPrompt([...profileFields], enumValues),
      { conditions: grounded },
    ));
    const criteria: Criterion[] = [];
    const unmapped: string[] = [];
    const evidence: Evidence[] = [];
    const handled = new Set<number>();

    for (const mapping of mapped) {
      const conditionIndex = grounded.findIndex((condition, index) =>
        !handled.has(index) &&
        condition.text === mapping.condition &&
        condition.evidenceQuote === mapping.evidenceQuote,
      );
      if (conditionIndex < 0) continue;
      handled.add(conditionIndex);
      const condition = grounded[conditionIndex];
      if (!validCriterion(mapping.criterion)) {
        unmapped.push(condition.text);
        continue;
      }

      criteria.push(mapping.criterion);
      evidence.push({ fieldPath: `criteria.${criteria.length - 1}`, evidenceQuote: condition.evidenceQuote });
    }

    grounded.forEach((condition, index) => {
      if (!handled.has(index)) unmapped.push(condition.text);
    });
    return { criteria, unmapped, evidence };
  } catch {
    return { criteria: [], unmapped: grounded.map((condition) => condition.text), evidence: [] };
  }
}

function agentGoal(): string {
  return 'Extract: scheme name (English and Hindi), benefit text, eligibility conditions, official apply URL. Return JSON only. Return NOT_FOUND for anything not on the page. Do not guess, do not log in, do not fill any form.';
}

function parseAgentExtraction(content: string): Extraction | undefined {
  try {
    const raw = ExtractionSchema.parse(JSON.parse(content)) as RawExtraction;
    const fact = (value: RawExtraction['nameEn']): Fact | undefined =>
      value && value !== 'NOT_FOUND' ? value : undefined;
    return {
      nameEn: fact(raw.nameEn),
      nameHi: fact(raw.nameHi),
      benefit: fact(raw.benefit),
      applyUrl: fact(raw.applyUrl),
      conditions: raw.conditions,
    };
  } catch {
    return undefined;
  }
}

export async function draftFromCandidate(
  candidate: SchemeCandidate,
  client: TinyFishClient,
  groq?: GroqClient,
  budget: AgentCallBudget = { dailyCap: 0, callsUsed: 0 },
  today: () => Date = () => new Date(),
): Promise<DraftScheme | undefined> {
  let tinyfishAgentCalls = 0;
  let fetchedText = '';
  let fetchedRaw = '';
  let extraction: Extraction | undefined;

  try {
    const fetched = await client.fetchPages([candidate.url], { ttl: 0 });
    const first = fetched[0];
    if (first) {
      fetchedRaw = first.content;
      const blockCheck = withBlockCheck(first);
      if (/captcha|blocked|access denied/i.test(first.content)) return undefined;
      const normalized = blockCheck.ok ? normalizeText(blockCheck.content) : '';
      if (blockCheck.ok && normalized.length >= 80) {
        fetchedText = normalized;
        extraction = extractReadablePage(candidate, fetchedRaw, fetchedText);
      }
    }
  } catch {
    fetchedRaw = '';
  }

  if (!extraction) {
    if (budget.callsUsed >= budget.dailyCap) return undefined;
    budget.callsUsed++;
    tinyfishAgentCalls++;

    let agentResult;
    try {
      agentResult = await client.runAgent({ url: candidate.url, goal: agentGoal() });
    } catch {
      return undefined;
    }
    const agentCheck = withBlockCheck(agentResult);
    if (!agentCheck.ok || /captcha|blocked|access denied/i.test(agentResult.pageText ?? '')) return undefined;

    const agentText = normalizeText(agentResult.pageText ?? fetchedRaw);
    if (agentText.length < 20) return undefined;
    fetchedText = agentText;
    extraction = parseAgentExtraction(agentCheck.content);
    if (!extraction) return undefined;
  }

  const sourceHash = hashNormalized(fetchedText);
  const criteria = await mapConditions(extraction.conditions, fetchedText, groq);
  const evidence: Evidence[] = [...criteria.evidence];
  const nameEn = isGroundedFact(extraction.nameEn, fetchedText) ? extraction.nameEn : undefined;
  const nameHi = isGroundedFact(extraction.nameHi, fetchedText) ? extraction.nameHi : undefined;
  const benefit = isGroundedFact(extraction.benefit, fetchedText) ? extraction.benefit : undefined;
  const applyUrl = isGroundedFact(extraction.applyUrl, fetchedText) && isOfficialUrl(extraction.applyUrl.value)
    ? extraction.applyUrl
    : undefined;

  if (nameEn) evidence.push({ fieldPath: 'name.en', evidenceQuote: nameEn.evidenceQuote });
  if (nameHi) evidence.push({ fieldPath: 'name.hi', evidenceQuote: nameHi.evidenceQuote });
  if (benefit) evidence.push({ fieldPath: 'benefit', evidenceQuote: benefit.evidenceQuote });
  if (applyUrl) evidence.push({ fieldPath: 'applyUrl', evidenceQuote: applyUrl.evidenceQuote });

  const unmappedConditions = [...new Set(criteria.unmapped)];
  unmappedConditions.forEach((conditionText, index) => {
    const condition = extraction.conditions.find((candidateCondition) =>
      candidateCondition.text === conditionText &&
      candidateCondition.evidenceQuote &&
      fetchedText.includes(candidateCondition.evidenceQuote),
    );
    if (condition) {
      evidence.push({
        fieldPath: `unmappedConditions.${index}`,
        evidenceQuote: condition.evidenceQuote,
      });
    }
  });

  const id = `draft-${createHash('sha256').update(candidate.url).digest('hex').slice(0, 16)}`;
  return DraftSchemeSchema.parse({
    id,
    name: { en: nameEn?.value ?? null, hi: nameHi?.value ?? null },
    level: null,
    state: null,
    benefit: benefit?.value ?? null,
    criteria: criteria.criteria,
    priority: 0,
    applyUrl: applyUrl?.value ?? null,
    sourceUrl: candidate.url,
    retrievedOn: today().toISOString().slice(0, 10),
    checkedBy: null,
    sourceHash,
    status: 'stale',
    draft: true,
    unmappedConditions,
    evidence,
    costs: { tinyfishAgentCalls },
  });
}