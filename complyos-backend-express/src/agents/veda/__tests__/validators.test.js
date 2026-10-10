/**
 * Unit Tests: Trust Layer Validators
 * node --test src/agents/veda/__tests__/validators.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { validateGstin, extractPanFromGstin, getStateFromGstin } from '../../../trust/validators/gstin.js';
import { validatePan, validatePanGstinMatch } from '../../../trust/validators/pan.js';
import { validateUdyam } from '../../../trust/validators/udyam.js';
import { validateDate, validateDateOrder, parseDate } from '../../../trust/validators/dates.js';
import { validateAmount, parseAmount } from '../../../trust/validators/amounts.js';
import { validateStateConsistency } from '../../../trust/validators/stateConsistency.js';

describe('GSTIN Validator', () => {
  test('valid GSTIN with correct checksum passes', () => {
    // 09AAECP1234F1ZP has verified checksum P
    const res = validateGstin('09AAECP1234F1ZP');
    assert.equal(res.ok, true);
  });

  test('valid Maharashtra GSTIN passes', () => {
    // 27AAECP1234F1ZR has verified checksum R
    const res = validateGstin('27AAECP1234F1ZR');
    assert.equal(res.ok, true);
  });

  test('invalid checksum fails', () => {
    // Checksum changed from P to 6
    const res = validateGstin('09AAECP1234F1Z6');
    assert.equal(res.ok, false);
    assert.match(res.reason, /checksum mismatch/i);
  });

  test('invalid state code fails', () => {
    const res = validateGstin('99AAECP1234F1ZP');
    assert.equal(res.ok, false);
    assert.match(res.reason, /Invalid state code/i);
  });

  test('invalid format fails', () => {
    assert.equal(validateGstin('12345').ok, false);
    assert.equal(validateGstin('').ok, false);
    assert.equal(validateGstin(null).ok, false);
  });

  test('extract PAN and state from GSTIN', () => {
    assert.equal(extractPanFromGstin('09AAECP1234F1ZP'), 'AAECP1234F');
    assert.equal(getStateFromGstin('09AAECP1234F1ZP'), 'Uttar Pradesh');
  });
});

describe('PAN Validator', () => {
  test('valid PAN passes', () => {
    assert.equal(validatePan('AAECP1234F').ok, true);
  });

  test('invalid PAN structure fails', () => {
    assert.equal(validatePan('1234567890').ok, false);
    assert.equal(validatePan('ABC1234DEF').ok, false);
    assert.equal(validatePan('').ok, false);
  });

  test('PAN matches GSTIN embedded PAN', () => {
    assert.equal(validatePanGstinMatch('AAECP1234F', '09AAECP1234F1ZP').ok, true);
  });

  test('PAN mismatch with GSTIN fails', () => {
    const res = validatePanGstinMatch('ZZZCP9999Z', '09AAECP1234F1ZP');
    assert.equal(res.ok, false);
    assert.match(res.reason, /does not match PAN embedded in GSTIN/i);
  });
});

describe('Udyam Validator', () => {
  test('valid Udyam number passes', () => {
    assert.equal(validateUdyam('UDYAM-UP-28-0012345').ok, true);
  });

  test('invalid Udyam formats fail', () => {
    assert.equal(validateUdyam('UDYAM-123').ok, false);
    assert.equal(validateUdyam('UDYAM-UP-28-123').ok, false);
    assert.equal(validateUdyam('').ok, false);
  });
});

describe('Date Validator', () => {
  test('parses dd/mm/yyyy', () => {
    const res = parseDate('15/08/2024');
    assert.ok(res.date);
    assert.equal(res.date.getDate(), 15);
    assert.equal(res.date.getMonth(), 7); // August = index 7
    assert.equal(res.date.getFullYear(), 2024);
  });

  test('parses "12 March 2025"', () => {
    const res = parseDate('12 March 2025');
    assert.ok(res.date);
    assert.equal(res.date.getDate(), 12);
    assert.equal(res.date.getMonth(), 2); // March = index 2
  });

  test('rejects impossible dates like Feb 30', () => {
    const res = validateDate('30/02/2024');
    assert.equal(res.ok, false);
    assert.match(res.reason, /does not exist/i);
  });

  test('validates date ordering (noticeDate before replyDueDate)', () => {
    assert.equal(validateDateOrder('10/01/2025', '10/02/2025', 'notice', 'reply').ok, true);
    const fail = validateDateOrder('10/03/2025', '10/02/2025', 'notice', 'reply');
    assert.equal(fail.ok, false);
    assert.match(fail.reason, /must be before/i);
  });
});

describe('Amount Validator', () => {
  test('parses Indian format amounts with commas and currency', () => {
    assert.equal(parseAmount('₹ 1,25,000.00').amount, 125000);
    assert.equal(parseAmount('Rs. 45,000/-').amount, 45000);
    assert.equal(parseAmount('57,600').amount, 57600);
    assert.equal(parseAmount(12000).amount, 12000);
  });

  test('rejects negative and invalid amounts', () => {
    assert.equal(validateAmount('-500').ok, false);
    assert.equal(validateAmount('abc').ok, false);
  });
});

describe('State Consistency Validator', () => {
  test('matching state passes', () => {
    assert.equal(validateStateConsistency('09AAECP1234F1ZP', 'Uttar Pradesh').ok, true);
    assert.equal(validateStateConsistency('09AAECP1234F1ZP', 'UP').ok, true);
  });

  test('mismatching state flags confirmation question', () => {
    const res = validateStateConsistency('09AAECP1234F1ZP', 'Maharashtra');
    assert.equal(res.ok, false);
    assert.match(res.reason, /Kaunsa sahi hai\?/i);
  });
});
