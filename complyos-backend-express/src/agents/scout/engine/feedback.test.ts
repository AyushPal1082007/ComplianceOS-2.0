import assert from 'node:assert/strict';
import test from 'node:test';
import { matchSchemes } from './match.ts';
import { rankMissingFields } from './missingFields.ts';
import { buildTeaser, CORE_PROFILE_FIELDS } from './teaser.ts';
import type {
  BusinessProfile,
  Criterion,
  SchemeMatch,
  SchemeRecord,
} from '../schemas.ts';

type FieldStatus = 'EMPTY' | 'SELF_REPORTED' | 'NEEDS_CONFIRMATION' | 'VERIFIED';

function field(value: unknown, status: FieldStatus) {
  return { value, status };
}

function scheme(
  id: string,
  criteria: Criterion[],
  priority = 5,
  status: SchemeRecord['status'] = 'active',
): SchemeRecord {
  return {
    id,
    name: { en: id, hi: id },
    level: 'state',
    state: 'TODO(owner)',
    benefit: 'TODO(owner)',
    criteria,
    priority,
    applyUrl: 'TODO(owner)',
    sourceUrl: 'TODO(owner)',
    retrievedOn: 'TODO(owner)',
    checkedBy: 'TODO(owner)',
    sourceHash: 'TODO(owner)',
    status,
  };
}

function match(
  schemeId: string,
  missingFields: string[],
  priority: number,
  result: SchemeMatch['result'] = 'possible',
): SchemeMatch {
  return {
    schemeId,
    name: { en: schemeId, hi: schemeId },
    result,
    metCount: 0,
    totalCount: missingFields.length,
    missingFields,
    benefit: 'TODO(owner)',
    applyUrl: 'TODO(owner)',
    sourceUrl: 'TODO(owner)',
    lastVerified: 'TODO(owner)',
    stale: false,
    basedOn: 'verified',
    priority,
  };
}

test('ranks fields that unblock more schemes higher', () => {
  const ranking = rankMissingFields([
    match('scheme-a', ['state', 'sector'], 3),
    match('scheme-b', ['state'], 2),
  ]);

  assert.deepEqual(ranking[0], { field: 'state', score: 5, schemeIds: ['scheme-a', 'scheme-b'] });
  assert.deepEqual(ranking[1], { field: 'sector', score: 3, schemeIds: ['scheme-a'] });
});

test('priority weighting can change field ranking', () => {
  const ranking = rankMissingFields([
    match('low-priority', ['state'], 2),
    match('high-priority', ['sector'], 8),
  ]);

  assert.deepEqual(ranking.map(({ field }) => field), ['sector', 'state']);
});

test('only possible matches contribute to missing-field ranking', () => {
  const ranking = rankMissingFields([
    match('possible', ['state'], 3),
    match('likely', ['sector'], 9, 'likely_eligible'),
  ]);

  assert.deepEqual(ranking.map(({ field }) => field), ['state']);
});

test('ties sort by field name for stable ordering', () => {
  const ranking = rankMissingFields([
    match('b-match', ['sector'], 4),
    match('a-match', ['state'], 4),
  ]);

  assert.deepEqual(ranking.map(({ field }) => field), ['sector', 'state']);
});

test('teaser is hidden at three known core fields and shown at four', () => {
  const matches = [match('possible', ['state'], 5)];
  const threeKnown: BusinessProfile = {
    state: field('Uttar Pradesh', 'VERIFIED'),
    sector: field('manufacturer', 'SELF_REPORTED'),
    subSector: field('textiles', 'VERIFIED'),
  };
  const fourKnown: BusinessProfile = {
    ...threeKnown,
    gstRegistered: field(false, 'SELF_REPORTED'),
  };

  assert.equal(buildTeaser(threeKnown, matches, 'en').show, false);
  assert.equal(buildTeaser(fourKnown, matches, 'en').show, true);
});

test('teaser count excludes not_met and closed schemes', () => {
  const criteria = [{ field: 'state', eq: 'Uttar Pradesh' }] as Criterion[];
  const matches = matchSchemes({
    state: field('Uttar Pradesh', 'VERIFIED'),
  }, [
    scheme('possible', [{ field: 'sector', eq: 'manufacturer' }], 5),
    scheme('not-met', [{ field: 'state', eq: 'Bihar' }], 5),
    scheme('closed', [{ field: 'sector', eq: 'manufacturer' }], 5, 'closed'),
  ]);
  const profile: BusinessProfile = {
    state: field('Uttar Pradesh', 'VERIFIED'),
    sector: field('manufacturer', 'VERIFIED'),
    subSector: field('textiles', 'VERIFIED'),
    gstRegistered: field(false, 'VERIFIED'),
  };
  const teaser = buildTeaser(profile, matches, 'en');

  assert.equal(teaser.count, 1);
});

test('Hindi, English, and Hinglish teaser templates say possible, never eligible', () => {
  const profile: BusinessProfile = Object.fromEntries(
    CORE_PROFILE_FIELDS.slice(0, 4).map((key) => [key, field('known', 'VERIFIED')]),
  );
  const matches = [match('possible', [], 5)];

  for (const lang of ['hi', 'en', 'hinglish'] as const) {
    const teaser = buildTeaser(profile, matches, lang);
    assert.equal(teaser.show, true);
    assert.match(teaser.text ?? '', /possible/i);
    assert.doesNotMatch(teaser.text ?? '', /eligible/i);
  }
});

test('empty profile hides teaser', () => {
  const teaser = buildTeaser({}, [match('possible', ['state'], 5)], 'hinglish');
  assert.equal(teaser.show, false);
  assert.equal(teaser.count, 1);
});