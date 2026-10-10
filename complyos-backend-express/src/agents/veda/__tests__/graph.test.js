/**
 * Graph Tests using MemorySaver
 * (a) a fixture runs to the confirm interrupt and resumes with confirm
 * (b) resuming with an edited value that fails validation re-asks
 * (c) empty OCR never reaches extract
 * (d) UNKNOWN doc type interrupts with an option_card and continues after the answer
 *
 * node --test src/agents/veda/__tests__/graph.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MemorySaver, Command } from '@langchain/langgraph';

import { buildVedaGraph } from '../graph.js';
import { FIXTURES } from '../fixtures/samples.js';

describe('VEDA LangGraph Subgraph Execution (MemorySaver)', () => {
  test('(a) fixture runs to confirm interrupt and resumes with confirm', async () => {
    const checkpointer = new MemorySaver();
    const graph = buildVedaGraph({ checkpointer });
    const thread = { configurable: { thread_id: 'thread_confirm_test' } };

    // Run with GST notice where confidence on amountDemanded is 0.70 (< 0.80) to trigger confirm
    const initialState = {
      runId: 'run_test_a',
      userId: 'user_1',
      event: { type: 'DOCUMENT', docId: 'doc_1' },
      profile: {},
      locale: 'hinglish',
      url: 'https://example.com/doc.jpg',
      ocrText: FIXTURES.gst_cert_valid.ocrText,
      // Inject extractedFields with low confidence to trigger gate -> confirm
      extractedFields: {
        gstin: {
          value: '09AAECP1234F1ZP',
          confidence: 0.75, // < 0.80 triggers gate
          evidenceQuote: 'Registration Number: 09AAECP1234F1ZP',
        },
      },
      docType: 'GST_CERTIFICATE',
    };

    // Step 1: Run to interrupt
    const res1 = await graph.invoke(initialState, thread);
    assert.ok(res1.__interrupt__, 'Should halt with an interrupt');
    const interruptValue = res1.__interrupt__[0].value;
    assert.equal(interruptValue.type, 'confirm_card');
    assert.equal(interruptValue.card.items[0].key, 'gstin');

    // Step 2: Resume with confirm action
    const resumeCommand = new Command({
      resume: { key: 'gstin', action: 'confirm' },
    });
    const res2 = await graph.invoke(resumeCommand, thread);

    // Resumed execution completes to respond!
    assert.equal(res2.status, 'OK');
    assert.ok(res2.profilePatch.gstin);
    assert.equal(res2.profilePatch.gstin.value, '09AAECP1234F1ZP');
    assert.equal(res2.profilePatch.gstin.status, 'VERIFIED');
    assert.equal(res2.profilePatch.gstin.source, 'user_confirmed');
  });

  test('(b) resuming with an edited value that fails validation re-asks', async () => {
    const checkpointer = new MemorySaver();
    const graph = buildVedaGraph({ checkpointer });
    const thread = { configurable: { thread_id: 'thread_revalidate_test' } };

    const initialState = {
      runId: 'run_test_b',
      userId: 'user_1',
      event: { type: 'DOCUMENT' },
      profile: {},
      locale: 'hinglish',
      url: 'https://example.com/doc.jpg',
      ocrText: FIXTURES.gst_cert_valid.ocrText,
      extractedFields: {
        gstin: {
          value: '09AAECP1234F1ZP',
          confidence: 0.70,
          evidenceQuote: 'Registration Number: 09AAECP1234F1ZP',
        },
      },
      docType: 'GST_CERTIFICATE',
    };

    // Step 1: First interrupt
    const res1 = await graph.invoke(initialState, thread);
    assert.ok(res1.__interrupt__);

    // Step 2: User provides invalid GSTIN (bad checksum)
    const badEditCommand = new Command({
      resume: { key: 'gstin', action: 'edit', value: '09AAECP1234F1Z9' },
    });

    const res2 = await graph.invoke(badEditCommand, thread);
    // Should re-interrupt because validation failed!
    assert.ok(res2.__interrupt__, 'Invalid edit must re-trigger confirm interrupt');
    const secondInterrupt = res2.__interrupt__[0].value;
    assert.ok(
      secondInterrupt.card.items[0].reasons.some((r) => r.includes('checksum mismatch')),
      'Should display checksum mismatch reason'
    );

    // Step 3: Now user provides valid GSTIN
    const goodEditCommand = new Command({
      resume: { key: 'gstin', action: 'edit', value: '27AAECP1234F1ZR' },
    });
    const res3 = await graph.invoke(goodEditCommand, thread);
    assert.equal(res3.status, 'OK');
    assert.equal(res3.profilePatch.gstin.value, '27AAECP1234F1ZR');
    assert.equal(res3.profilePatch.gstin.status, 'VERIFIED');
  });

  test('(c) empty OCR never reaches extract', async () => {
    const checkpointer = new MemorySaver();
    const graph = buildVedaGraph({ checkpointer });
    const thread = { configurable: { thread_id: 'thread_empty_ocr' } };

    const initialState = {
      runId: 'run_test_c',
      userId: 'user_1',
      event: { type: 'DOCUMENT' },
      profile: {},
      locale: 'hinglish',
      url: 'https://example.com/blurry.jpg',
      ocrText: 'Too short', // < 15 chars triggers NEEDS_INPUT in OCR
    };

    const res = await graph.invoke(initialState, thread);
    assert.equal(res.status, 'NEEDS_INPUT');
    assert.ok(res.messages.some((m) => m.text?.includes('Photo clear nahi hai')));

    // Verify 'extract' was never recorded in trace
    const nodeNames = res.trace.map((t) => t.node);
    assert.ok(!nodeNames.includes('extract'), 'Extract node must not run for empty OCR');
    assert.ok(nodeNames.includes('ocr'));
    assert.ok(nodeNames.includes('respond'));
  });

  test('(d) UNKNOWN doc type interrupts with an option_card and continues after the answer', async () => {
    const checkpointer = new MemorySaver();
    const graph = buildVedaGraph({ checkpointer });
    const thread = { configurable: { thread_id: 'thread_unknown_doctype' } };

    const initialState = {
      runId: 'run_test_d',
      userId: 'user_1',
      event: { type: 'DOCUMENT' },
      profile: {},
      locale: 'hinglish',
      url: 'https://example.com/unknown.jpg',
      ocrText: 'Some unclassifiable plain text without any compliance keywords that is longer than 15 chars.',
      docType: 'UNKNOWN',
    };

    // Step 1: Pauses at askDocType
    const res1 = await graph.invoke(initialState, thread);
    assert.ok(res1.__interrupt__, 'Should interrupt with option_card');
    const optionCard = res1.__interrupt__[0].value;
    assert.equal(optionCard.type, 'option_card');
    assert.ok(optionCard.options.some((o) => o.id === 'GST_CERTIFICATE'));

    // Step 2: User selects GST_CERTIFICATE
    const resumeCommand = new Command({
      resume: { docType: 'GST_CERTIFICATE' },
    });

    // Mock extract since we are running offline
    // The graph resumes, sets docType to GST_CERTIFICATE and proceeds to extract
    const res2 = await graph.invoke(resumeCommand, thread);
    const traceNodes = res2.trace.map((t) => t.node);
    assert.ok(traceNodes.includes('askDocType'));
    assert.ok(traceNodes.includes('extract'));
  });
});
