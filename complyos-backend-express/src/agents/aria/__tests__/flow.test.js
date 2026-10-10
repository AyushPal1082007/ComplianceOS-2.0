import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../index.js';
import { runTurn } from '../engine/runTurn.js';
import { QUESTIONS } from '../questionBank/loader.js';

const originalReal = process.env.ARIA_REAL;

test('tap-only onboarding reaches reveal with zero Groq calls', async () => {
  process.env.ARIA_REAL = 'true';
  let groqCalls = 0;
  const groqJson = async () => { groqCalls += 1; throw new Error('Groq must not be called'); };
  const llmClassify = async () => { groqCalls += 1; throw new Error('LLM classifier must not be called'); };
  const options = { groqJson, llmClassify };
  let profile = {};
  let result = await run({ runId: 'aria-taps', userId: 'u1', event: { type: 'START' }, profile, locale: 'hinglish' }, options);
  let session = result.session;
  assert.equal(result.status, 'OK');
  for (let step = 0; step < 10 && session.phase !== 'reveal'; step += 1) {
    const question = QUESTIONS.find((item) => item.id === session.lastQuestionId);
    const choice = question.options.find((option) => option.value !== null);
    result = await run({ runId: 'aria-taps', userId: 'u1', event: { type: 'OPTION_TAP', questionId: question.id, optionId: choice.id }, profile, session, locale: 'hinglish' }, options);
    profile = { ...profile, ...result.profilePatch };
    session = result.session;
  }
  assert.equal(session.phase, 'reveal');
  assert.ok(result.messages.some((message) => message.type === 'confirm_card'));
  assert.equal(groqCalls, 0);
  process.env.ARIA_REAL = originalReal;
});

test('one sentence can populate multiple quoted fields and invalid quotes are rejected', async () => {
  const profile = {};
  const session = { phase: 'asking', askedQuestionIds: ['state'], lastQuestionId: 'state', skippedIds: [], history: [], turnCount: 0, language: 'hinglish' };
  const output = await runTurn({ runId: 'aria-multi', userId: 'u1', event: { type: 'TEXT', text: 'Main Kanpur mein kapde ki dukaan chalata hoon, GST hai.' }, profile, session, locale: 'hinglish' }, {
    classifyIntent: async () => ({ intent: 'answer', language: 'hinglish', tokens: 0 }),
    extractSlots: async () => ({ llmTokens: 7, updates: [
      { field: 'state', value: 'Kanpur', confidence: 0.95, quote: 'Kanpur' },
      { field: 'sector', value: 'trader', confidence: 0.95, quote: 'dukaan chalata hoon' },
      { field: 'subSector', value: 'textile', confidence: 0.95, quote: 'kapde' },
      { field: 'gstRegistered', value: true, confidence: 0.95, quote: 'GST hai' },
      { field: 'district', value: 'Lucknow', confidence: 0.99, quote: 'made up' },
    ] }),
  });
  assert.equal(output.profilePatch.state.value, 'Kanpur');
  assert.equal(output.profilePatch.gstRegistered.value, true);
  assert.equal(output.profilePatch.district, undefined);
  assert.equal(output.costs.llmTokens, 7);
  assert.equal(output.session.turnCount, 1);
});

test('low-confidence voice yields NEEDS_INPUT without changing profile or session', async () => {
  const session = { phase: 'asking', askedQuestionIds: ['state'], lastQuestionId: 'state', skippedIds: [], history: [], turnCount: 1, language: 'hinglish', retryCounts: {} };
  const output = await runTurn({ runId: 'aria-voice-low', userId: 'u1', event: { type: 'VOICE', mediaId: 'fake', mime: 'audio/ogg' }, profile: { district: 'Kanpur' }, session, locale: 'hinglish' }, {
    ingest: async () => ({ needsInput: true, message: 'Awaaz saaf nahi aayi' }),
  });
  assert.equal(output.status, 'NEEDS_INPUT');
  assert.deepEqual(output.profilePatch, {});
  assert.deepEqual(output.session, session);
});

test('restart clears only SELF_REPORTED fields and preserves VERIFIED values', async () => {
  const session = { phase: 'asking', askedQuestionIds: ['state'], lastQuestionId: 'state', skippedIds: [], history: [], turnCount: 2, language: 'hinglish' };
  const profile = {
    state: { value: 'Kanpur', status: 'SELF_REPORTED', confidence: 1, source: 'aria_text', updatedAt: new Date().toISOString() },
    gstin: { value: '09AAECP1234F1ZP', status: 'VERIFIED', confidence: 1, source: 'veda_doc', updatedAt: new Date().toISOString() },
  };
  const confirm = await runTurn({ runId: 'restart', userId: 'u1', event: { type: 'TEXT', text: 'restart' }, profile, session, locale: 'hinglish' });
  assert.ok(confirm.messages.some((message) => message.type === 'confirm_card'));
  const cleared = await runTurn({ runId: 'restart', userId: 'u1', event: { type: 'OPTION_TAP', questionId: 'aria-restart', optionId: 'confirm' }, profile, session, locale: 'hinglish' });
  assert.equal(cleared.profilePatch.state.status, 'EMPTY');
  assert.equal(cleared.profilePatch.gstin, undefined);
});

test('Skip and Back options work without an LLM call and Back re-asks the prior question', async () => {
  let llmCalls = 0;
  const options = {
    classifyIntent: async (turn) => {
      if (turn.via === 'option') return { intent: turn.option.optionId === 'skip' ? 'skip' : 'answer', tokens: 0 };
      if (turn.text === 'back') return { intent: 'back', tokens: 0 };
      return { intent: 'answer', tokens: 0 };
    },
    extractSlots: async () => ({ updates: [], llmTokens: 0 }),
    llmClassify: async () => { llmCalls += 1; return { data: { intent: 'answer' }, tokens: 1 }; },
  };
  const session = { phase: 'asking', askedQuestionIds: ['state'], lastQuestionId: 'state', skippedIds: [], history: [], turnCount: 0, language: 'hinglish', retryCounts: {} };
  const skipped = await runTurn({ runId: 'aria-skip', userId: 'u', event: { type: 'OPTION_TAP', questionId: 'state', optionId: 'skip' }, profile: {}, session, locale: 'hinglish' }, options);
  assert.ok(skipped.session.skippedIds.includes('state'));
  assert.equal(llmCalls, 0);

  const withHistory = { ...skipped.session, phase: 'asking', lastQuestionId: 'sector', history: [{ qid: 'sector', field: 'sector', previousValue: null, newValue: 'trader', via: 'option', ts: new Date().toISOString() }] };
  const back = await runTurn({ runId: 'aria-back', userId: 'u', event: { type: 'TEXT', text: 'back' }, profile: { sector: { value: 'trader', status: 'SELF_REPORTED', confidence: 1, source: 'aria_option', updatedAt: new Date().toISOString() } }, session: withHistory, locale: 'hinglish' }, options);
  assert.equal(back.session.lastQuestionId, 'sector');
  assert.equal(back.messages.at(-1).id, 'sector');
  assert.equal(back.profilePatch.sector.status, 'EMPTY');
});

test('off-topic compliance questions receive the canned intake-only response', async () => {
  let extractionCalls = 0;
  const session = { phase: 'asking', askedQuestionIds: ['state'], lastQuestionId: 'state', skippedIds: [], history: [], turnCount: 0, language: 'hinglish', retryCounts: {} };
  const output = await runTurn({ runId: 'aria-off-topic', userId: 'u', event: { type: 'TEXT', text: 'How do I file GST?' }, profile: {}, session, locale: 'hinglish' }, {
    classifyIntent: async () => ({ intent: 'off_topic', tokens: 0 }),
    extractSlots: async () => { extractionCalls += 1; return { updates: [], llmTokens: 0 }; },
  });
  assert.match(output.messages[0].text, /sirf aapki jaankari samajh/i);
  assert.equal(extractionCalls, 0);
  assert.deepEqual(output.profilePatch, {});
});

test('speech adapter error returns a safe degraded response without changing profile or session', async () => {
  const session = { phase: 'asking', askedQuestionIds: ['state'], lastQuestionId: 'state', skippedIds: [], history: [], turnCount: 1, language: 'hinglish', retryCounts: {} };
  const profile = { district: { value: 'Kanpur', status: 'SELF_REPORTED', confidence: 1, source: 'aria_text', updatedAt: new Date().toISOString() } };
  const output = await runTurn({ runId: 'aria-speech-error', userId: 'u', event: { type: 'VOICE', mediaId: 'media' }, profile, session, locale: 'hinglish' }, {
    ingest: async () => { throw new Error('speech provider unavailable'); },
  });
  assert.equal(output.status, 'DEGRADED');
  assert.equal(output.messages[0].type, 'text');
  assert.deepEqual(output.profilePatch, {});
  assert.deepEqual(output.session, session);
});

test('language switch patches preferredLanguage and every per-turn stage appears in trace', async () => {
  const session = { phase: 'asking', askedQuestionIds: ['state'], lastQuestionId: 'state', skippedIds: [], history: [], turnCount: 1, language: 'hinglish', retryCounts: {} };
  const output = await runTurn({ runId: 'aria-language', userId: 'u', event: { type: 'TEXT', text: 'english mein' }, profile: {}, session, locale: 'hinglish' });
  assert.equal(output.session.language, 'en');
  assert.equal(output.profilePatch.preferredLanguage, 'en');
  for (const stage of ['ingest', 'classify', 'extract', 'apply', 'select', 'render']) assert.ok(output.trace.some((event) => event.node === stage));
});

test('delete request is escalated without a user reply or profile mutation', async () => {
  const output = await runTurn({ runId: 'aria-delete', userId: 'u', event: { type: 'TEXT', text: 'delete' }, profile: {}, locale: 'hinglish' });
  assert.equal(output.escalate, 'DELETE_REQUEST');
  assert.deepEqual(output.profilePatch, {});
  assert.deepEqual(output.messages, []);
  assert.ok(output.trace.some((event) => event.outputSummary?.escalate === 'DELETE_REQUEST'));
});

test.after(() => {
  if (originalReal === undefined) delete process.env.ARIA_REAL;
  else process.env.ARIA_REAL = originalReal;
});
