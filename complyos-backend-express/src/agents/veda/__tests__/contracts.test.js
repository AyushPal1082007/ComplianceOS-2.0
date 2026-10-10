/**
 * Contract & Schema Conformance Tests
 * Ensures run() output and all fixture outputs conform strictly to AgentOutputSchema.
 * node --test src/agents/veda/__tests__/contracts.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AgentOutputSchema } from '../stubs/contracts.stub.js';
import { run } from '../index.js';
import { FIXTURES } from '../fixtures/samples.js';

describe('Contracts & Schema Conformance (AgentOutput)', () => {
  test('run() with valid fixture produces schema-valid AgentOutput', async () => {
    const input = {
      runId: 'run_contract_1',
      userId: 'user_1',
      event: {
        type: 'DOCUMENT',
        docId: 'doc_sample_1',
        url: 'https://example.com/gst.jpg',
        ocrText: FIXTURES.gst_cert_valid.ocrText,
      },
      profile: {},
      locale: 'hinglish',
    };

    // Pre-extracted to run offline without external API call
    input.extractedFields = {
      gstin: {
        value: '09AAECP1234F1ZP',
        confidence: 0.95,
        evidenceQuote: 'Registration Number: 09AAECP1234F1ZP',
      },
      legalName: {
        value: 'SHARMA ENTERPRISES PRIVATE LIMITED',
        confidence: 0.95,
        evidenceQuote: 'SHARMA ENTERPRISES PRIVATE LIMITED',
      },
      state: {
        value: 'Uttar Pradesh',
        confidence: 0.95,
        evidenceQuote: 'Uttar Pradesh',
      },
    };

    const output = await run(input);
    const parsed = AgentOutputSchema.safeParse(output);
    assert.equal(parsed.success, true, `Schema validation failed: ${JSON.stringify(parsed.error?.issues)}`);
    assert.equal(output.status, 'OK');
    assert.ok(output.claims.length > 0);
    assert.ok(output.calendarItems.length > 0);
    assert.ok(output.messages.length > 0);
  });

  test('run() with blurry photo produces schema-valid AgentOutput with NEEDS_INPUT', async () => {
    const input = {
      runId: 'run_contract_blurry',
      userId: 'user_1',
      event: {
        type: 'DOCUMENT',
        docId: 'doc_blurry',
        url: 'https://example.com/blurry.jpg',
        ocrText: 'Too short',
      },
      profile: {},
      locale: 'hinglish',
    };

    const output = await run(input);
    const parsed = AgentOutputSchema.safeParse(output);
    assert.equal(parsed.success, true);
    assert.equal(output.status, 'NEEDS_INPUT');
    assert.ok(output.messages[0].text.includes('Photo clear nahi hai'));
  });

  test('run() with unsupported mime produces schema-valid AgentOutput with DEGRADED', async () => {
    const input = {
      runId: 'run_contract_mime',
      userId: 'user_1',
      event: {
        type: 'DOCUMENT',
        docId: 'doc_audio',
        mime: 'audio/mp3',
      },
      profile: {},
      locale: 'hinglish',
    };

    const output = await run(input);
    const parsed = AgentOutputSchema.safeParse(output);
    assert.equal(parsed.success, true);
    assert.equal(output.status, 'DEGRADED');
  });
});
