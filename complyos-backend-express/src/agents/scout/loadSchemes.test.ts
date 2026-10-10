import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSchemes } from './loadSchemes.ts';

test('loads and validates all SCOUT scheme records', async () => {
  const schemes = await loadSchemes();

  assert.deepEqual(
    schemes.map((scheme) => scheme.id),
    ['odop-up', 'up-cm-yuva', 'up-msme-policy-2022'],
  );
  assert(schemes.every((scheme) => scheme.status !== 'closed'));
});