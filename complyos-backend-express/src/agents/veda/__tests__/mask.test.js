/**
 * Unit Tests: Aadhaar and Sensitive Data Masking
 * node --test src/agents/veda/__tests__/mask.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { maskAadhaar, maskSensitiveTokens } from '../mask.js';

describe('Aadhaar & Privacy Masking', () => {
  test('masks 12-digit spaced Aadhaar', () => {
    const raw = 'Entrepreneur Aadhaar: 5432 8765 1234 for registration';
    const masked = maskAadhaar(raw);
    assert.equal(masked, 'Entrepreneur Aadhaar: XXXX XXXX 1234 for registration');
    assert.equal(masked.includes('5432'), false);
    assert.equal(masked.includes('8765'), false);
    assert.equal(masked.includes('1234'), true);
  });

  test('masks 12-digit hyphenated Aadhaar', () => {
    const raw = 'Aadhaar: 1234-5678-9012';
    const masked = maskAadhaar(raw);
    assert.equal(masked, 'Aadhaar: XXXX-XXXX-9012');
  });

  test('masks 12-digit continuous Aadhaar', () => {
    const raw = 'ID: 123456789012';
    const masked = maskAadhaar(raw);
    assert.equal(masked, 'ID: XXXXXXXX9012');
  });

  test('does not corrupt 15-char GSTIN or 10-char PAN', () => {
    const raw = 'GSTIN: 09AAECP1234F1ZP and PAN: AAECP1234F';
    const masked = maskAadhaar(raw);
    assert.equal(masked, 'GSTIN: 09AAECP1234F1ZP and PAN: AAECP1234F');
  });

  test('masks OTPs and passwords', () => {
    const raw = 'Your OTP is 987654. Password: MySecretPassword123';
    const masked = maskSensitiveTokens(raw);
    assert.match(masked, /otp\s*is\s*\*{6}/i);
    assert.match(masked, /password:\s*\[REDACTED\]/i);
  });
});
