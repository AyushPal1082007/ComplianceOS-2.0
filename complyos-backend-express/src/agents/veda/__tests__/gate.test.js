/**
 * Unit Tests: Confidence Gate
 * node --test src/agents/veda/__tests__/gate.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { confidenceGate } from '../../../trust/confidenceGate.js';

describe('Confidence Gate (Hard Rule 3)', () => {
  test('confidence 0.79 without failures => NEEDS_CONFIRMATION', () => {
    const res = confidenceGate(0.79, [{ ok: true }]);
    assert.equal(res.status, 'NEEDS_CONFIRMATION');
    assert.ok(res.reasons.some((r) => r.includes('threshold')));
  });

  test('confidence 0.80 with passing validators => VERIFIED', () => {
    const res = confidenceGate(0.80, [{ ok: true }, { ok: true }]);
    assert.equal(res.status, 'VERIFIED');
    assert.equal(res.reasons.length, 0);
  });

  test('confidence 0.99 with any failed validator => NEEDS_CONFIRMATION', () => {
    const res = confidenceGate(0.99, [
      { ok: true },
      { ok: false, reason: 'GSTIN checksum mismatch' },
    ]);
    assert.equal(res.status, 'NEEDS_CONFIRMATION');
    assert.ok(res.reasons.some((r) => r.includes('GSTIN checksum mismatch')));
  });

  test('missing confidence => NEEDS_CONFIRMATION', () => {
    const res = confidenceGate(null, []);
    assert.equal(res.status, 'NEEDS_CONFIRMATION');
  });
});
