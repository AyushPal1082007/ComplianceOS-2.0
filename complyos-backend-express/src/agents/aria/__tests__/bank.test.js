import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { QUESTIONS, QUESTION_BANK, loadQuestionBank } from '../questionBank/loader.js';
import { classifyIntent } from '../engine/classifyIntent.js';
import { selectNext } from '../engine/selectNext.js';
import { newSession, applyAnswer, undo, markSkipped } from '../engine/session.js';
import { completeness } from '../engine/completeness.js';
import { readFile } from 'node:fs/promises';

test('bank is marked for native review and every question has all locales and unique unsure options', async () => {
  assert.equal(QUESTION_BANK.reviewStatus, 'NEEDS_NATIVE_REVIEW');
  for (const question of QUESTIONS) {
    for (const language of ['hi', 'en', 'hinglish']) {
      assert.ok(question.text[language]);
      assert.ok(question.why[language]);
      assert.ok(question.options.every((option) => option.label[language]));
    }
    assert.ok(question.options.some((option) => option.id === 'unsure'));
    assert.equal(new Set(question.options.map((option) => option.id)).size, question.options.length);
  }
  await assert.rejects(() => loadQuestionBank(fileURLToPath(new URL('../fixtures/bad-bank.json', import.meta.url))));
});

test('slot-evaluation fixture corpus has at least 30 labeled utterances', async () => {
  const utterances = JSON.parse(await readFile(fileURLToPath(new URL('../fixtures/utterances.json', import.meta.url)), 'utf8'));
  assert.ok(utterances.length >= 30);
  assert.ok(utterances.some((utterance) => /[\u0900-\u097f]/u.test(utterance.text)));
  assert.ok(utterances.some((utterance) => /[a-z]/i.test(utterance.text)));
});

test('intent keyword rules work in three scripts and only exact standalone stop terminates', async () => {
  for (const text of ['chhodo', 'छोड़ो', 'skip']) assert.equal((await classifyIntent({ text, via: 'text' })).intent, 'skip');
  for (const text of ['pata nahi', 'पता नहीं', 'not sure']) assert.equal((await classifyIntent({ text, via: 'text' })).intent, 'unsure');
  assert.equal((await classifyIntent({ text: 'bas', via: 'text' })).intent, 'stop');
  assert.equal((await classifyIntent({ text: 'bas 5 log hain', via: 'text' })).intent, 'answer');
  assert.equal((await classifyIntent({ text: 'why', via: 'text' })).intent, 'why');
  assert.equal((await classifyIntent({ text: 'delete', via: 'text' })).intent, 'delete');
});

test('undo restores previous field provenance and skipped questions are not selected again', () => {
  const session = newSession();
  const withAnswer = applyAnswer(session, 'state', 'state', null, 'Kanpur', 'text');
  const undone = undo(withAnswer);
  assert.equal(undone.change.field, 'state');
  assert.equal(undone.session.history.length, 0);
  const skipped = markSkipped(session, 'state');
  assert.notEqual(selectNext({}, skipped, { phase: 'asking' }).id, 'state');
});

test('inapplicable GST frequency is not counted as a missing extended field', () => {
  assert.equal(completeness({ gstRegistered: { value: false, status: 'SELF_REPORTED' } }).extended, 0);
});
