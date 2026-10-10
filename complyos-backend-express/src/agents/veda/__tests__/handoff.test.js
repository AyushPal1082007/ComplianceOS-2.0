/**
 * Handoff Drift Prevention Tests
 * Validates that all sample responses and status states documented in FRONTEND_HANDOFF.md
 * strictly satisfy the AgentOutputSchema.
 *
 * node --test src/agents/veda/__tests__/handoff.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AgentOutputSchema } from '../stubs/contracts.stub.js';
import { runMock } from '../mock.js';
import { commitDocumentResults } from '../commit.js';
import { getTextMessage, RETAKE_TIPS } from '../messages/index.js';
import { buildConfirmCard } from '../confirm.js';

describe('Frontend Handoff Drift Prevention', () => {
  test('OK status sample satisfies AgentOutputSchema', () => {
    const committed = commitDocumentResults({
      docType: 'GST_CERTIFICATE',
      docId: 'doc_123',
      resolvedFields: {
        gstin: { value: '09AAECP1234F1ZP', confidence: 0.98, evidenceQuote: '09AAECP1234F1ZP' },
        state: { value: 'Uttar Pradesh', confidence: 0.96, evidenceQuote: 'Uttar Pradesh' },
      },
      profile: {},
      locale: 'hinglish',
    });

    const output = {
      status: 'OK',
      profilePatch: committed.profilePatch,
      messages: committed.messages,
      claims: committed.claims,
      calendarItems: committed.calendarItems,
      trace: [],
      costs: { llmTokens: 250, tinyfishAgentCalls: 0 },
    };

    const parsed = AgentOutputSchema.safeParse(output);
    assert.equal(parsed.success, true);
  });

  test('NEEDS_INPUT status sample satisfies AgentOutputSchema', () => {
    const tips = RETAKE_TIPS.hinglish;
    const msg = getTextMessage('unclear_photo', 'hinglish', tips);

    const output = {
      status: 'NEEDS_INPUT',
      profilePatch: {},
      messages: [msg],
      claims: [],
      calendarItems: [],
      trace: [],
      costs: { llmTokens: 0, tinyfishAgentCalls: 0 },
    };

    const parsed = AgentOutputSchema.safeParse(output);
    assert.equal(parsed.success, true);
  });

  test('NEEDS_CONFIRMATION status sample with confirm_card satisfies AgentOutputSchema', () => {
    const confirmCard = buildConfirmCard([
      {
        key: 'district',
        value: 'Lucknow',
        evidenceQuote: 'Lucknow, Uttar Pradesh',
        reasons: ['Aapne Kanpur bataya tha, GST certificate mein Lucknow hai. Kaunsa sahi hai?'],
      },
    ]);

    const output = {
      status: 'NEEDS_CONFIRMATION',
      profilePatch: {},
      messages: [confirmCard],
      claims: [],
      calendarItems: [],
      trace: [],
      costs: { llmTokens: 210, tinyfishAgentCalls: 0 },
    };

    const parsed = AgentOutputSchema.safeParse(output);
    assert.equal(parsed.success, true);
  });

  test('DEGRADED status sample satisfies AgentOutputSchema', () => {
    const msg = getTextMessage('degraded_ocr', 'hinglish');

    const output = {
      status: 'DEGRADED',
      profilePatch: {},
      messages: [msg],
      claims: [],
      calendarItems: [],
      trace: [],
      costs: { llmTokens: 0, tinyfishAgentCalls: 0 },
    };

    const parsed = AgentOutputSchema.safeParse(output);
    assert.equal(parsed.success, true);
  });

  test('FAILED status sample satisfies AgentOutputSchema', () => {
    const msg = getTextMessage('generic_error', 'hinglish');

    const output = {
      status: 'FAILED',
      profilePatch: {},
      messages: [msg],
      claims: [],
      calendarItems: [],
      trace: [],
      costs: { llmTokens: 0, tinyfishAgentCalls: 0 },
    };

    const parsed = AgentOutputSchema.safeParse(output);
    assert.equal(parsed.success, true);
  });

  test('mock.js output satisfies AgentOutputSchema', () => {
    const output = runMock({ runId: 'test' });
    const parsed = AgentOutputSchema.safeParse(output);
    assert.equal(parsed.success, true);
  });
});
