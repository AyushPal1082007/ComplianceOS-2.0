import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { BusinessProfileSchema, SchemeRecordSchema, type BusinessProfile, type EvalLabelEntry, type SchemeRecord } from '../schemas.ts';
import { formatEvalReport, runEval } from './runEval.ts';

const fixtureDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');

function profile(profileId = 'profile-test', fields: Record<string, unknown> = {}): BusinessProfile & { profileId: string } {
  return { profileId, ...fields } as BusinessProfile & { profileId: string };
}

function field(value: unknown, status = 'VERIFIED') {
  return { value, status };
}

function scheme(id: string, fieldName: string, expected: unknown): SchemeRecord {
  return {
    id,
    name: { en: `TEST ${id}`, hi: `TEST ${id}` },
    level: 'central',
    state: 'all',
    benefit: 'TEST ONLY.',
    criteria: [{ field: fieldName, eq: expected }],
    priority: 1,
    applyUrl: `https://example.invalid/${id}/apply`,
    sourceUrl: `https://example.invalid/${id}/source`,
    retrievedOn: '2026-10-10T00:00:00.000Z',
    checkedBy: 'TEST_ONLY',
    sourceHash: `test-hash-${id}`,
    status: 'active',
  };
}

test('hand-labelled pairs produce exact likely precision and recall', () => {
  const testProfile = profile('p1', {
    state: field('Uttar Pradesh'),
    sector: field('manufacturer'),
  });
  const schemes = [
    scheme('s-true-positive', 'state', 'Uttar Pradesh'),
    scheme('s-false-negative', 'sector', 'service'),
    scheme('s-dangerous', 'state', 'Uttar Pradesh'),
  ];
  const labels: EvalLabelEntry[] = [
    { profileId: 'p1', schemeId: 's-true-positive', label: 'likely_eligible' },
    { profileId: 'p1', schemeId: 's-false-negative', label: 'likely_eligible' },
    { profileId: 'p1', schemeId: 's-dangerous', label: 'not_eligible' },
  ];

  const report = runEval([testProfile], schemes, labels);
  assert.deepEqual(report.precision, { numerator: 1, denominator: 2, value: 0.5 });
  assert.deepEqual(report.recall, { numerator: 1, denominator: 2, value: 0.5 });
});

test('dangerous false likely result is counted and prominently printed', () => {
  const report = runEval(
    [profile('p1', { state: field('Uttar Pradesh') })],
    [scheme('danger', 'state', 'Uttar Pradesh')],
    [{ profileId: 'p1', schemeId: 'danger', label: 'possible' }],
  );
  const output = formatEvalReport(report, 'fixtures');

  assert.equal(report.dangerousErrorCount, 1);
  assert.match(output, /Dangerous errors .*: 1/);
  assert.match(output, /p1 \/ danger: predicted likely_eligible, label possible/);
});

test('null labels are excluded and flagged as partial', () => {
  const report = runEval(
    [profile('p1', { state: field('Uttar Pradesh') }), profile('p2', { state: field('Bihar') })],
    [scheme('s1', 'state', 'Uttar Pradesh')],
    [{ profileId: 'p1', schemeId: 's1', label: 'likely_eligible' }],
  );

  assert.equal(report.labelledPairs, 1);
  assert.equal(report.unlabelledPairs, 1);
  assert.match(report.heading, /^PARTIAL: 1 of 2 pairs unlabelled/);
});

test('zero labels report NOT MEASURED and retain partial pair count', () => {
  const report = runEval(
    [profile('p1')],
    [scheme('s1', 'state', 'Uttar Pradesh')],
    [],
  );

  assert.match(report.heading, /PARTIAL: 1 of 1 pairs unlabelled/);
  assert.match(report.heading, /NOT MEASURED: no labels provided/);
  assert.equal(report.labelledPairs, 0);
});

test('zero metric denominators format as n/a, never NaN or zero', () => {
  const report = runEval(
    [profile('p1', { state: field('Bihar') })],
    [scheme('s1', 'state', 'Uttar Pradesh')],
    [{ profileId: 'p1', schemeId: 's1', label: 'possible' }],
  );
  const output = formatEvalReport(report, 'real');

  assert.equal(report.precision.value, null);
  assert.equal(report.recall.value, null);
  assert.match(output, /Likely-eligible precision: n\/a/);
  assert.match(output, /Likely-eligible recall: n\/a/);
  assert.doesNotMatch(output, /NaN|precision: 0\.000|recall: 0\.000/);
});

test('evaluation report serialization is deterministic', () => {
  const profiles = [profile('p1', { state: field('Uttar Pradesh') })];
  const schemes = [scheme('s1', 'state', 'Uttar Pradesh')];
  const labels: EvalLabelEntry[] = [{ profileId: 'p1', schemeId: 's1', label: 'likely_eligible' }];

  assert.equal(
    JSON.stringify(runEval(profiles, schemes, labels)),
    JSON.stringify(runEval(profiles, schemes, labels)),
  );
});

test('profiles and synthetic schemes validate against existing zod schemas', async () => {
  const profiles = JSON.parse(await readFile(path.join(fixtureDirectory, 'profiles.json'), 'utf8')) as unknown;
  const schemes = JSON.parse(await readFile(path.join(fixtureDirectory, 'test-schemes.json'), 'utf8')) as unknown;

  assert.equal(BusinessProfileSchema.array().parse(profiles).length, 10);
  const parsedSchemes = SchemeRecordSchema.array().parse(schemes);
  assert.equal(parsedSchemes.length, 5);
  assert(parsedSchemes.every((record) => record.id.startsWith('test-')));
  assert(parsedSchemes.every((record) => record.sourceUrl.startsWith('https://example.invalid/')));
});