import { createHash } from 'node:crypto';
import { ZodError } from 'zod';
import { buildExplanationInput, buildExplanationPrompt } from '../prompts/explain.ts';
import type { GroqClient } from '../groqPlaceholder.ts';
import {
  ExplanationPayloadSchema,
  type Explanation,
  type ExplanationPayload,
  type SchemeMatch,
  type SchemeRecord,
  type TeaserLanguage,
} from '../schemas.ts';
import { explainCheck } from './explainCheck.ts';
import { templateExplain } from './templateExplain.ts';

type Delay = (milliseconds: number) => Promise<void>;

const explanationCache = new Map<string, Explanation>();

function defaultDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function cacheKey(match: SchemeMatch, scheme: SchemeRecord, lang: TeaserLanguage): string {
  const keyData = JSON.stringify([
    scheme.id,
    match.result,
    match.metCount,
    match.missingFields,
    lang,
  ]);
  return createHash('sha256').update(keyData).digest('hex');
}

function outputText(payload: ExplanationPayload, lang: TeaserLanguage): string {
  return lang === 'hi' ? payload.explanation_hi : payload.explanation_en;
}

function fallback(
  match: SchemeMatch,
  scheme: SchemeRecord,
  lang: TeaserLanguage,
  degraded: boolean,
  llmTokens: number,
): Explanation {
  return {
    explanation_hi: templateExplain(match, scheme, 'hi'),
    explanation_en: templateExplain(match, scheme, 'en'),
    text: templateExplain(match, scheme, lang),
    degraded,
    llmTokens,
    basis: 'code_rule',
  };
}

function isInvalidJsonError(error: unknown): boolean {
  return error instanceof ZodError ||
    error instanceof SyntaxError ||
    (error instanceof Error && /invalid\s+(?:json|response)|json\s+(?:parse|validation)|unexpected token/i.test(error.message));
}

function readTokens(client: GroqClient): number {
  const tokens = client.getLastTokenCount?.() ?? 0;
  return Number.isFinite(tokens) && tokens > 0 ? Math.floor(tokens) : 0;
}

function attachResult(
  payload: ExplanationPayload,
  match: SchemeMatch,
  scheme: SchemeRecord,
  lang: TeaserLanguage,
  llmTokens: number,
): Explanation {
  return {
    ...payload,
    text: outputText(payload, lang),
    degraded: false,
    llmTokens,
    basis: 'llm_summary',
  };
}

export async function explainMatch(
  match: SchemeMatch,
  scheme: SchemeRecord,
  lang: TeaserLanguage,
  client?: GroqClient,
  delay: Delay = defaultDelay,
): Promise<Explanation> {
  const key = cacheKey(match, scheme, lang);
  const cached = explanationCache.get(key);
  if (cached) return { ...cached, llmTokens: 0 };

  if (!client) return fallback(match, scheme, lang, false, 0);

  const modelInput = buildExplanationInput(match, scheme);
  let prompt = buildExplanationPrompt();
  let repairAttempted = false;
  let transientRetries = 0;
  let llmTokens = 0;

  while (true) {
    let response: unknown;
    try {
      response = await client.json(ExplanationPayloadSchema, prompt, modelInput);
      llmTokens += readTokens(client);
    } catch (error) {
      llmTokens += readTokens(client);
      if (isInvalidJsonError(error)) {
        if (repairAttempted) {
          return fallback(match, scheme, lang, true, llmTokens);
        }
        repairAttempted = true;
        prompt = buildExplanationPrompt(true);
        continue;
      }

      if (transientRetries >= 2) {
        return fallback(match, scheme, lang, true, llmTokens);
      }
      await delay(250 * (transientRetries + 1));
      transientRetries++;
      continue;
    }

    const parsed = ExplanationPayloadSchema.safeParse(response);
    if (!parsed.success) {
      if (repairAttempted) {
        return fallback(match, scheme, lang, true, llmTokens);
      }
      repairAttempted = true;
      prompt = buildExplanationPrompt(true);
      continue;
    }

    if (!explainCheck(parsed.data, match, scheme)) {
      const result = fallback(match, scheme, lang, false, llmTokens);
      explanationCache.set(key, result);
      return result;
    }

    const result = attachResult(parsed.data, match, scheme, lang, llmTokens);
    explanationCache.set(key, result);
    return result;
  }
}