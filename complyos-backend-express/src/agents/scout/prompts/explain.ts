import type { SchemeMatch, SchemeRecord } from '../schemas.ts';

export const EXPLANATION_SYSTEM_PROMPT = [
  'Explain in simple Hindi why this scheme matches and what is missing.',
  'Use ONLY facts in the JSON provided.',
  'Do not add any number, amount, date, or eligibility claim that is not in the JSON.',
  "Do not say the user is 'eligible' if the result is 'possible'.",
  'Do not give legal or financial advice.',
  'Return JSON with exactly these string fields: explanation_hi and explanation_en.',
].join(' ');

export function buildExplanationPrompt(repair = false): string {
  if (!repair) return EXPLANATION_SYSTEM_PROMPT;
  return `${EXPLANATION_SYSTEM_PROMPT} Repair the response and return valid JSON only.`;
}

export function buildExplanationInput(match: SchemeMatch, scheme: SchemeRecord): {
  matchJson: string;
  benefit: string;
} {
  return {
    matchJson: JSON.stringify(match),
    benefit: scheme.benefit,
  };
}