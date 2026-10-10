import test from 'node:test';
import assert from 'node:assert/strict';
import { ingest } from '../engine/ingest.js';
import { classifyIntent } from '../engine/classifyIntent.js';
import { extractSlots, sanitizeForLlm } from '../engine/extractSlots.js';
import { applyUpdates } from '../engine/applyUpdates.js';
import { newSession } from '../engine/session.js';
import { selectNext } from '../engine/selectNext.js';

test('option tap maps deterministically and never calls the intent LLM', async () => {
  let calls = 0;
  const { turn } = await ingest({ type: 'OPTION_TAP', questionId: 'sector', optionId: 'trader' });
  const result = await classifyIntent(turn, { llmClassify: async () => { calls += 1; throw new Error('must not run'); } });
  assert.equal(result.intent, 'answer');
  assert.equal(turn.option.value, 'trader');
  assert.equal(calls, 0);
});

test('stop requires an exact stop phrase and does not consume normal answers', async () => {
  const fake = async () => ({ data: { intent: 'answer', language: 'hinglish' }, tokens: 1 });
  assert.equal((await classifyIntent({ text: 'bas', via: 'text' }, { llmClassify: fake })).intent, 'stop');
  assert.equal((await classifyIntent({ text: 'bas 5 log hain', via: 'text' }, { llmClassify: fake })).intent, 'answer');
});

test('extraction drops fabricated evidence and computes turnover band in code', async () => {
  const userText = 'Mera turnover 60 lakh hai aur rajya Uttar Pradesh hai.';
  const result = await extractSlots(userText, {
    groqJson: async () => ({ data: { language: 'hinglish', updates: [
      { field: 'turnoverBand', value: 'lt20L', rawPhrase: '60 lakh', confidence: 0.95, quote: '60 lakh' },
      { field: 'state', value: 'Delhi', confidence: 0.9, quote: 'imaginary quote' },
    ] }, tokens: 8 }),
  });
  assert.equal(result.updates.length, 1);
  assert.equal(result.updates[0].value, '40L_1_5Cr');
});

test('sensitive identifiers and credentials are redacted before the LLM call', async () => {
  const original = 'State Kanpur, Aadhaar 1234 5678 9012, PAN ABCDE1234F, OTP 4321, password is secret';
  const sanitized = sanitizeForLlm(original);
  assert.ok(!sanitized.includes('1234 5678 9012'));
  assert.ok(!sanitized.includes('ABCDE1234F'));
  assert.ok(!sanitized.includes('OTP 4321'));
  assert.ok(!sanitized.includes('password is secret'));
  let prompt;
  await extractSlots(original, { groqJson: async (_schema, _system, userPrompt) => {
    prompt = userPrompt;
    return { data: { updates: [], language: 'en' }, tokens: 0 };
  } });
  assert.ok(!prompt.includes('1234 5678 9012'));
  assert.ok(!prompt.includes('ABCDE1234F'));
});

test('updates never overwrite verified values and sensitive registration numbers need confirmation', () => {
  const session = newSession('hinglish');
  const verified = { value: 'Kanpur', status: 'VERIFIED', confidence: 1, source: 'veda_doc', evidence: { quote: 'Kanpur' }, updatedAt: new Date().toISOString() };
  const result = applyUpdates({ state: verified }, session, [
    { field: 'state', value: 'Lucknow', confidence: 0.95, quote: 'Lucknow', via: 'text' },
    { field: 'gstin', value: '09AAECP1234F1ZP', confidence: 1, quote: '09AAECP1234F1ZP', via: 'text' },
  ]);
  assert.equal(result.profilePatch.state.value, 'Kanpur');
  assert.equal(result.profilePatch.state.status, 'NEEDS_CONFIRMATION');
  assert.equal(result.profilePatch.state.evidence.verifiedValue, 'Kanpur');
  assert.equal(result.profilePatch.gstin.status, 'NEEDS_CONFIRMATION');
});

test('next question selection is deterministic and begins with state', () => {
  const session = newSession();
  assert.equal(selectNext({}, session, { phase: 'asking' }).id, 'state');
});
