import assert from 'node:assert/strict';
import test from 'node:test';
import { matchSchemes } from './match.ts';
import type { BusinessProfile, Criterion, SchemeRecord } from '../schemas.ts';

type FieldStatus = 'EMPTY' | 'SELF_REPORTED' | 'NEEDS_CONFIRMATION' | 'VERIFIED';

function field(value: unknown, status: FieldStatus) {
  return { value, status };
}

function scheme(
  id: string,
  criteria: Criterion[],
  options: Partial<Pick<SchemeRecord, 'priority' | 'status'>> = {},
): SchemeRecord {
  return {
    id,
    name: { en: id, hi: id },
    level: 'state',
    state: 'Uttar Pradesh',
    benefit: 'TODO(owner)',
    criteria,
    priority: options.priority ?? 5,
    applyUrl: 'TODO(owner)',
    sourceUrl: 'TODO(owner)',
    retrievedOn: 'TODO(owner)',
    checkedBy: 'TODO(owner)',
    sourceHash: 'TODO(owner)',
    status: options.status ?? 'active',
  };
}

const stateIsUp: Criterion = { field: 'state', eq: 'Uttar Pradesh' };
const sectorAllowed: Criterion = { field: 'sector', in: ['manufacturer', 'service'] };

test('all criteria met returns likely_eligible and matching counts', () => {
  const matches = matchSchemes({
    state: field('Uttar Pradesh', 'VERIFIED'),
    sector: field('manufacturer', 'SELF_REPORTED'),
  }, [scheme('all-met', [stateIsUp, sectorAllowed])]);

  assert.equal(matches[0].result, 'likely_eligible');
  assert.equal(`${matches[0].metCount} of ${matches[0].totalCount}`, '2 of 2');
});

test('a not_met criterion excludes the scheme', () => {
  const matches = matchSchemes({ state: field('Bihar', 'VERIFIED') }, [scheme('not-met', [stateIsUp])]);
  assert.deepEqual(matches, []);
});

test('EMPTY fields are unknown and listed in missingFields', () => {
  const matches = matchSchemes({ state: field(null, 'EMPTY') }, [scheme('empty', [stateIsUp])]);
  assert.equal(matches[0].result, 'possible');
  assert.deepEqual(matches[0].missingFields, ['state']);
});

test('NEEDS_CONFIRMATION fields are unknown', () => {
  const matches = matchSchemes({ state: field('Uttar Pradesh', 'NEEDS_CONFIRMATION') }, [scheme('needs-confirmation', [stateIsUp])]);
  assert.equal(matches[0].result, 'possible');
  assert.deepEqual(matches[0].missingFields, ['state']);
});

test('basedOn reflects verified, self-reported, and mixed met criteria', () => {
  const records = [scheme('verified', [stateIsUp]), scheme('self', [stateIsUp]), scheme('mixed', [stateIsUp, sectorAllowed])];
  const matches = matchSchemes({
    state: field('Uttar Pradesh', 'VERIFIED'),
    sector: field('manufacturer', 'SELF_REPORTED'),
  }, records);
  const byId = new Map(matches.map((match) => [match.schemeId, match.basedOn]));

  assert.equal(byId.get('verified'), 'verified');
  assert.equal(byId.get('self'), 'verified');
  assert.equal(byId.get('mixed'), 'mixed');

  const selfOnly = matchSchemes({ state: field('Uttar Pradesh', 'SELF_REPORTED') }, [scheme('self-only', [stateIsUp])]);
  assert.equal(selfOnly[0].basedOn, 'self_reported');
});

test('an empty profile makes every criteria-bearing scheme possible', () => {
  const matches = matchSchemes({}, [scheme('state', [stateIsUp]), scheme('sector', [sectorAllowed])]);
  assert(matches.every((match) => match.result === 'possible'));
  assert(matches.every((match) => match.result !== 'likely_eligible'));
});

test('closed schemes are skipped and stale schemes are retained as stale', () => {
  const matches = matchSchemes({}, [
    scheme('closed', [stateIsUp], { status: 'closed' }),
    scheme('stale', [stateIsUp], { status: 'stale' }),
  ]);

  assert.deepEqual(matches.map((match) => match.schemeId), ['stale']);
  assert.equal(matches[0].stale, true);
});

test('sorts likely matches first, then priority, then met ratio', () => {
  const matches = matchSchemes({
    state: field('Uttar Pradesh', 'VERIFIED'),
    sector: field('manufacturer', 'SELF_REPORTED'),
  }, [
    scheme('possible-low-ratio', [
      stateIsUp,
      sectorAllowed,
      { field: 'gstRegistered', eq: true },
      { field: 'womenLed', eq: true },
      { field: 'employeesBand', eq: '1_9' },
    ], { priority: 4 }),
    scheme('likely-low-priority', [stateIsUp], { priority: 2 }),
    scheme('possible-high-priority', [stateIsUp, sectorAllowed, { field: 'gstRegistered', eq: true }], { priority: 5 }),
    scheme('possible-high-ratio', [stateIsUp, { field: 'gstRegistered', eq: true }], { priority: 4 }),
    scheme('likely-high-priority', [stateIsUp, sectorAllowed], { priority: 8 }),
  ]);

  assert.deepEqual(matches.map((match) => match.schemeId), [
    'likely-high-priority',
    'likely-low-priority',
    'possible-high-priority',
    'possible-high-ratio',
    'possible-low-ratio',
  ]);
});

test('empty criteria produce possible with an owner note', () => {
  const matches = matchSchemes({} as BusinessProfile, [scheme('no-criteria', [])]);
  assert.equal(matches[0].result, 'possible');
  assert.equal(matches[0].metCount, 0);
  assert.equal(matches[0].totalCount, 0);
  assert.match(matches[0].note ?? '', /TODO\(owner\)/);
});

test('supports notIn and gte criteria', () => {
  const matches = matchSchemes({
    sector: field('manufacturer', 'VERIFIED'),
    yearsInBusiness: field(4, 'VERIFIED'),
  }, [scheme('operators', [
    { field: 'sector', notIn: ['trader'] },
    { field: 'yearsInBusiness', gte: 3 },
  ])]);

  assert.equal(matches[0].result, 'likely_eligible');
  assert.equal(matches[0].metCount, 2);
});