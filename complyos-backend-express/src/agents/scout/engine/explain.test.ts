import assert from 'node:assert/strict';
import test from 'node:test';
import type { ZodType } from 'zod';
import { explainMatch } from './explain.ts';
import { explainCheck } from './explainCheck.ts';
import { templateExplain } from './templateExplain.ts';
import type { GroqClient } from '../groqPlaceholder.ts';
import type { ExplanationPayload, SchemeMatch, SchemeRecord } from '../schemas.ts';

function match(id: string, result: SchemeMatch['result'] = 'possible'): SchemeMatch {
  return {
    schemeId: id,
    name: { en: 'Verified Scheme', hi: 'सत्यापित योजना' },
    result,
    metCount: 1,
    totalCount: 2,
    missingFields: ['turnoverBand'],
    benefit: 'Benefits are reviewed yearly.',
    applyUrl: 'https://example.test/apply',
    sourceUrl: 'https://example.test/source',
    lastVerified: '2026-10-10T00:00:00.000Z',
    stale: false,
    basedOn: 'verified',
    priority: 5,
  };
}

function scheme(id: string): SchemeRecord {
  return {
    id,
    name: { en: 'Verified Scheme', hi: 'सत्यापित योजना' },
    level: 'central',
    state: 'all',
    benefit: 'Benefits are reviewed yearly.',
    criteria: [],
    priority: 5,
    applyUrl: 'https://example.test/apply',
    sourceUrl: 'https://example.test/source',
    retrievedOn: '2026-10-10T00:00:00.000Z',
    checkedBy: 'reviewer',
    sourceHash: 'test-hash',
    status: 'active',
  };
}

const validPayload: ExplanationPayload = {
  explanation_hi: 'सत्यापित योजना में 1 of 2 मानदंड पूरे हुए।',
  explanation_en: 'Verified Scheme is possible because 1 of 2 criteria are met.',
};

function fakeClient(
  handler: (prompt: string, input: unknown, call: number) => unknown | Promise<unknown>,
  tokenCount = 7,
): GroqClient & { calls: number } {
  const client = {
    calls: 0,
    async json<T>(_schema: ZodType<T>, prompt: string, input: unknown): Promise<T> {
      client.calls++;
      return await handler(prompt, input, client.calls) as T;
    },
    getLastTokenCount: () => tokenCount,
  };
  return client;
}

test('valid LLM output is accepted and used', async () => {
  const client = fakeClient(async (_prompt, input) => {
    assert.deepEqual(Object.keys(input as object).sort(), ['benefit', 'matchJson']);
    return validPayload;
  });
  const result = await explainMatch(match('valid-llm-output'), scheme('valid-llm-output'), 'en', client);

  assert.equal(result.text, validPayload.explanation_en);
  assert.equal(result.basis, 'llm_summary');
  assert.equal(result.degraded, false);
  assert.equal(result.llmTokens, 7);
});

test('an invented rupee amount is rejected and replaced by the template', async () => {
  const client = fakeClient(async () => ({
    explanation_hi: 'इस योजना में 10 लाख रुपये का लाभ है।',
    explanation_en: 'Verified Scheme gives ₹10 lakh.',
  }));
  const result = await explainMatch(match('invented-amount'), scheme('invented-amount'), 'en', client);

  assert.equal(result.basis, 'code_rule');
  assert.equal(result.degraded, false);
  assert.match(result.text, /Benefits are reviewed yearly\./);
  assert.doesNotMatch(result.text, /10 lakh/i);
});

test('eligible claim for a possible result is rejected', async () => {
  const client = fakeClient(async () => ({
    explanation_hi: 'यह योजना पात्र है।',
    explanation_en: 'The user is eligible for this scheme.',
  }));
  const result = await explainMatch(match('eligible-possible'), scheme('eligible-possible'), 'en', client);

  assert.equal(result.basis, 'code_rule');
  assert.equal(result.degraded, false);
});

test('invalid JSON gets one repair attempt then falls back', async () => {
  const client = fakeClient(async () => null);
  const result = await explainMatch(match('invalid-json'), scheme('invalid-json'), 'en', client);

  assert.equal(client.calls, 2);
  assert.equal(result.basis, 'code_rule');
  assert.equal(result.degraded, true);
});

test('client failure retries twice with backoff then returns degraded fallback', async () => {
  const waits: number[] = [];
  const client = fakeClient(async () => {
    throw new Error('rate limit');
  });
  const result = await explainMatch(
    match('client-failure'),
    scheme('client-failure'),
    'en',
    client,
    async (milliseconds) => { waits.push(milliseconds); },
  );

  assert.equal(client.calls, 3);
  assert.deepEqual(waits, [250, 500]);
  assert.equal(result.degraded, true);
  assert.equal(result.basis, 'code_rule');
});

test('validator catches unsupported Devanagari numerals and lakh words', () => {
  const unsupported: ExplanationPayload = {
    explanation_hi: 'इस योजना में १० लाख रुपये मिलेंगे।',
    explanation_en: 'This scheme provides 10 lakh rupees.',
  };

  assert.equal(explainCheck(unsupported, match('devanagari-numbers'), scheme('devanagari-numbers')), false);
});

test('cache hit avoids a second client call', async () => {
  const client = fakeClient(async () => validPayload);
  const first = await explainMatch(match('cache-hit'), scheme('cache-hit'), 'en', client);
  const second = await explainMatch(match('cache-hit'), scheme('cache-hit'), 'en', client);

  assert.equal(client.calls, 1);
  assert.equal(first.text, second.text);
  assert.equal(second.llmTokens, 0);
});

test('template fallback copies the benefit verbatim without added eligibility claims', () => {
  const benefit = 'Support may be available after review.';
  const record = { ...scheme('template-benefit'), benefit };
  const text = templateExplain(match('template-benefit'), record, 'hinglish');

  assert(text.includes(benefit));
  assert.doesNotMatch(text, /eligible/i);
});