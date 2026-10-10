/**
 * Unit Tests: Profile Merge Policy
 * node --test src/agents/veda/__tests__/merge.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { mergeProfileFields } from '../merge.js';

describe('Profile Merge Policy (Hard Rule 8)', () => {
  test('SELF_REPORTED "Kanpur" vs document "Lucknow" => NEEDS_CONFIRMATION with correct question', () => {
    const existingProfile = {
      district: {
        value: 'Kanpur',
        status: 'SELF_REPORTED',
        confidence: 0.6,
      },
    };

    const mappedDoc = {
      district: {
        value: 'Lucknow',
        status: 'VERIFIED',
        confidence: 0.95,
        evidenceQuote: 'Lucknow, Uttar Pradesh',
      },
    };

    const { patch, conflicts } = mergeProfileFields(existingProfile, mappedDoc, {
      docType: 'GST_CERTIFICATE',
      docId: 'doc_123',
    });

    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].key, 'district');
    assert.equal(conflicts[0].existingValue, 'Kanpur');
    assert.equal(conflicts[0].docValue, 'Lucknow');
    assert.equal(
      conflicts[0].question,
      'Aapne Kanpur bataya tha, GST certificate mein Lucknow hai. Kaunsa sahi hai?'
    );

    assert.equal(patch.district.status, 'NEEDS_CONFIRMATION');
    assert.equal(patch.district.value, 'Lucknow');
  });

  test('empty field gets written as VERIFIED from document', () => {
    const existingProfile = {};

    const mappedDoc = {
      gstin: {
        value: '09AAECP1234F1ZP',
        status: 'VERIFIED',
        confidence: 0.98,
        evidenceQuote: '09AAECP1234F1ZP',
      },
    };

    const { patch, conflicts } = mergeProfileFields(existingProfile, mappedDoc, {
      docType: 'GST_CERTIFICATE',
    });

    assert.equal(conflicts.length, 0);
    assert.equal(patch.gstin.status, 'VERIFIED');
    assert.equal(patch.gstin.value, '09AAECP1234F1ZP');
    assert.equal(patch.gstin.source, 'veda_doc');
  });

  test('identical value upgrades SELF_REPORTED to VERIFIED', () => {
    const existingProfile = {
      state: {
        value: 'Uttar Pradesh',
        status: 'SELF_REPORTED',
      },
    };

    const mappedDoc = {
      state: {
        value: 'Uttar Pradesh',
        status: 'VERIFIED',
        confidence: 0.95,
        evidenceQuote: 'Uttar Pradesh',
      },
    };

    const { patch, conflicts } = mergeProfileFields(existingProfile, mappedDoc, {
      docType: 'GST_CERTIFICATE',
    });

    assert.equal(conflicts.length, 0);
    assert.equal(patch.state.status, 'VERIFIED');
    assert.equal(patch.state.source, 'veda_doc');
  });
});
