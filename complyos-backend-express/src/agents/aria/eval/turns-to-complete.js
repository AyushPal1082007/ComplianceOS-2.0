import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { run } from '../index.js';
import { QUESTIONS } from '../questionBank/loader.js';
import { completeness } from '../engine/completeness.js';
import { recordEval } from './report.js';

const fixturePath = fileURLToPath(new URL('../fixtures/personas.json', import.meta.url));
const personas = JSON.parse(await readFile(fixturePath, 'utf8'));
const prior = process.env.ARIA_REAL;
process.env.ARIA_REAL = 'true';
const results = [];
const scriptedUpdates = {
  'text-01': [{ field: 'state', value: 'Kanpur', confidence: 1, quote: 'Kanpur' }, { field: 'sector', value: 'trader', confidence: 1, quote: 'dukaan chalata hoon' }, { field: 'subSector', value: 'textile', confidence: 1, quote: 'kapde' }, { field: 'gstRegistered', value: true, confidence: 1, quote: 'GST hai' }],
  'text-02': [{ field: 'state', value: 'Bihar', confidence: 1, quote: 'बिहार' }, { field: 'udyamRegistered', value: true, confidence: 1, quote: 'Udyam registration है' }],
  'text-03': [{ field: 'state', value: 'Gujarat', confidence: 1, quote: 'Gujarat' }, { field: 'subSector', value: 'food', confidence: 1, quote: 'food business' }],
  'voice-01': [{ field: 'state', value: 'Rajasthan', confidence: 1, quote: 'राजस्थान' }, { field: 'subSector', value: 'handicraft', confidence: 1, quote: 'हस्तशिल्प' }],
  'voice-02': [{ field: 'state', value: 'Delhi', confidence: 1, quote: 'Delhi' }, { field: 'sector', value: 'service', confidence: 1, quote: 'service business' }],
  'voice-03': [{ field: 'state', value: 'Maharashtra', confidence: 1, quote: 'Maharashtra' }, { field: 'sector', value: 'manufacturer', confidence: 1, quote: 'manufacture' }, { field: 'subSector', value: 'textile', confidence: 1, quote: 'textiles' }],
  'voice-04': [{ field: 'state', value: 'Uttar Pradesh', confidence: 1, quote: 'उत्तर प्रदेश' }, { field: 'sector', value: 'trader', confidence: 1, quote: 'बेचते हैं' }],
  'voice-05': [{ field: 'state', value: 'Gujarat', confidence: 1, quote: 'Gujarat' }, { field: 'sector', value: 'manufacturer', confidence: 1, quote: 'manufacturing' }, { field: 'subSector', value: 'textile', confidence: 1, quote: 'textile' }],
};
for (const persona of personas) {
  let profile = {};
  let session;
  let turns = 0;
  let event = persona.mode === 'tap' ? { type: 'START' }
    : persona.mode === 'text' ? { type: 'TEXT', text: persona.utterance, mockUpdates: scriptedUpdates[persona.id] }
      : { type: 'VOICE', text: persona.transcript, mockUpdates: scriptedUpdates[persona.id] };
  while (turns < 12) {
    const options = persona.mode === 'voice' && turns === 0
      ? { mock: true, ingest: async () => ({ turn: { text: persona.transcript, via: 'voice', confidence: 0.95, quoteSource: persona.transcript, transcriptId: `${persona.id}-transcript` } }) }
      : { mock: true };
    const output = await run({ runId: persona.id, userId: persona.id, event, profile, session, locale: persona.language }, options);
    profile = { ...profile, ...output.profilePatch };
    session = output.session;
    turns += event.type === 'START' ? 0 : 1;
    if (completeness(profile).core >= 0.8) break;
    const question = QUESTIONS.find((item) => item.id === session.lastQuestionId);
    const choice = question?.options.find((option) => option.value !== null);
    if (!question || !choice) break;
    event = { type: 'OPTION_TAP', questionId: question.id, optionId: choice.id };
  }
  results.push({ id: persona.id, mode: persona.mode, turns, coreCompleteness: completeness(profile).core });
}
if (prior === undefined) delete process.env.ARIA_REAL;
else process.env.ARIA_REAL = prior;
const groups = Object.groupBy(results, (item) => item.mode);
const summary = Object.fromEntries(Object.entries(groups).map(([mode, items]) => [mode, { personas: items.length, averageTurns: items.reduce((sum, item) => sum + item.turns, 0) / items.length }]));
console.table(results);
console.log('Measured summary:', summary);
await recordEval('turnsToComplete', { status: 'measured', summary, results });
