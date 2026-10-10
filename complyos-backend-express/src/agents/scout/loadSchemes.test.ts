import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSchemes } from './loadSchemes.ts';

test('hides SCOUT schemes until official source and checker metadata are verified', async () => {
  const schemes = await loadSchemes();
  assert.deepEqual(schemes, []);
});