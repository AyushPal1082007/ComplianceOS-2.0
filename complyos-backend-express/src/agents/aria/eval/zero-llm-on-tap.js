import assert from 'node:assert/strict';
import { classifyIntent } from '../engine/classifyIntent.js';
import { ingest } from '../engine/ingest.js';
import { QUESTIONS } from '../questionBank/loader.js';
import { recordEval } from './report.js';

let llmCalls = 0;
for (const question of QUESTIONS) {
  for (const option of question.options) {
    const { turn } = await ingest({ type: 'OPTION_TAP', questionId: question.id, optionId: option.id });
    await classifyIntent(turn, { llmClassify: async () => { llmCalls += 1; throw new Error('LLM call is forbidden for option taps'); } });
  }
}
assert.equal(llmCalls, 0);
console.log(`Measured LLM calls for ${QUESTIONS.reduce((total, question) => total + question.options.length, 0)} option taps: ${llmCalls}`);
await recordEval('zeroLlmOnTap', { status: 'measured', optionTaps: QUESTIONS.reduce((total, question) => total + question.options.length, 0), llmCalls });
