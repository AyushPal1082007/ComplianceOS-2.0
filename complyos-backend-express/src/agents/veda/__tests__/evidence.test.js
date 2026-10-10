/**
 * Unit Tests: Evidence Check
 * node --test src/agents/veda/__tests__/evidence.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { verifyFieldEvidence, checkAllEvidence } from '../extractors/evidenceCheck.js';

describe('Evidence Check (Hard Rule 2)', () => {
  const ocrText = `GOVERNMENT OF INDIA
FORM GST REG-06
Registration Number: 09AAECP1234F1ZP
Legal Name: SHARMA ENTERPRISES PRIVATE LIMITED
Trade Name: SHARMA SWEETS & BAKERS
Address: Hazratganj, Lucknow, Uttar Pradesh`;

  test('valid verbatim quote keeps field intact', () => {
    const field = {
      value: '09AAECP1234F1ZP',
      confidence: 0.95,
      evidenceQuote: 'Registration Number: 09AAECP1234F1ZP',
    };

    const res = verifyFieldEvidence(field, ocrText);
    assert.equal(res.dropped, false);
    assert.equal(res.field.value, '09AAECP1234F1ZP');
  });

  test('whitespace normalized quote keeps field intact', () => {
    const field = {
      value: 'SHARMA ENTERPRISES PRIVATE LIMITED',
      confidence: 0.9,
      // Multiple spaces in quote
      evidenceQuote: 'Legal Name:   SHARMA ENTERPRISES   PRIVATE LIMITED',
    };

    const res = verifyFieldEvidence(field, ocrText);
    assert.equal(res.dropped, false);
    assert.equal(res.field.value, 'SHARMA ENTERPRISES PRIVATE LIMITED');
  });

  test('fabricated quote causes field to be dropped', () => {
    const field = {
      value: '27AABCS1234F1Z1',
      confidence: 0.99,
      // Fabricated quote not in document
      evidenceQuote: 'Registration Number: 27AABCS1234F1Z1',
    };

    const res = verifyFieldEvidence(field, ocrText);
    assert.equal(res.dropped, true);
    assert.equal(res.field.value, null);
    assert.equal(res.field.confidence, 0);
    assert.match(res.reason, /not a substring of the OCR text/i);
  });

  test('missing evidenceQuote causes field to be dropped', () => {
    const field = {
      value: 'Lucknow',
      confidence: 0.85,
      evidenceQuote: null,
    };

    const res = verifyFieldEvidence(field, ocrText);
    assert.equal(res.dropped, true);
    assert.equal(res.field.value, null);
  });

  test('batch checkAllEvidence drops fabricated fields while keeping valid ones', () => {
    const extracted = {
      gstin: {
        value: '09AAECP1234F1ZP',
        confidence: 0.95,
        evidenceQuote: 'Registration Number: 09AAECP1234F1ZP',
      },
      fakeField: {
        value: 'FakeValue',
        confidence: 0.95,
        evidenceQuote: 'This is not anywhere in the doc',
      },
    };

    const { fields, droppedFields } = checkAllEvidence(extracted, ocrText);
    assert.equal(fields.gstin.value, '09AAECP1234F1ZP');
    assert.equal(fields.fakeField.value, null);
    assert.ok(droppedFields.fakeField);
  });
});
