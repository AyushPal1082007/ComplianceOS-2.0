import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extractSlots } from '../engine/extractSlots.js';
import { recordEval } from './report.js';

const fixtures = JSON.parse(await readFile(fileURLToPath(new URL('../fixtures/utterances.json', import.meta.url)), 'utf8'));
if (process.env.ARIA_REAL !== 'true') {
  console.log('Slot accuracy skipped: set ARIA_REAL=true and GROQ_API_KEY to measure live extraction.');
  await recordEval('slotAccuracy', { status: 'skipped', reason: 'Set ARIA_REAL=true and GROQ_API_KEY to measure live extraction.' });
  process.exit(0);
}
const labels = new Map(fixtures.map((fixture) => [fixture.text, fixture.updates]));
const perField = new Map();
let expectedTotal = 0;
let predictedTotal = 0;
let truePositive = 0;
for (const fixture of fixtures) {
  const expected = labels.get(fixture.text);
  const result = await extractSlots(fixture.text);
  const expectedKeys = new Set(expected.map((item) => `${item.field}:${item.value}`));
  const predictedKeys = new Set(result.updates.map((item) => `${item.field}:${item.value}`));
  expectedTotal += expectedKeys.size;
  predictedTotal += predictedKeys.size;
  for (const key of expectedKeys) {
    const field = key.split(':')[0];
    const count = perField.get(field) || { expected: 0, predicted: 0, correct: 0 };
    count.expected += 1;
    if (predictedKeys.has(key)) { count.correct += 1; truePositive += 1; }
    perField.set(field, count);
  }
  for (const key of predictedKeys) {
    const field = key.split(':')[0];
    const count = perField.get(field) || { expected: 0, predicted: 0, correct: 0 };
    count.predicted += 1;
    perField.set(field, count);
  }
}
const report = [...perField].map(([field, counts]) => ({ field, precision: counts.predicted ? counts.correct / counts.predicted : 0, recall: counts.expected ? counts.correct / counts.expected : 0 }));
const summary = { utterances: fixtures.length, precision: predictedTotal ? truePositive / predictedTotal : 0, recall: expectedTotal ? truePositive / expectedTotal : 0, perField: report };
console.table(report);
console.log('Measured summary:', summary);
await recordEval('slotAccuracy', { status: 'measured', ...summary });
