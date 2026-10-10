/**
 * Mock Mode Tests
 * Ensures that when VEDA_REAL=false, run() and vedaNode() return schema-valid mock output.
 * node --test src/agents/veda/__tests__/mock.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AgentOutputSchema } from '../stubs/contracts.stub.js';
import { run } from '../index.js';
import { vedaNode } from '../../../graph/nodes/veda.node.js';

describe('VEDA Mock Mode (VEDA_REAL=false)', () => {
  test('run() returns schema-valid AgentOutput when VEDA_REAL=false', async () => {
    const originalEnv = process.env.VEDA_REAL;
    process.env.VEDA_REAL = 'false';

    try {
      const output = await run({
        runId: 'mock_test_1',
        userId: 'user_1',
        event: { type: 'DOCUMENT', docId: 'doc_1' },
      });

      const parsed = AgentOutputSchema.safeParse(output);
      assert.equal(parsed.success, true);
      assert.equal(output.status, 'OK');
      assert.ok(output.profilePatch.gstin);
      assert.equal(output.profilePatch.gstin.value, '09AAECP1234F1Z5');
      assert.ok(output.claims.length > 0);
      assert.ok(output.calendarItems.length > 0);
    } finally {
      process.env.VEDA_REAL = originalEnv;
    }
  });

  test('vedaNode() mounts into parent graph and returns valid structure with VEDA_REAL=false', async () => {
    const originalEnv = process.env.VEDA_REAL;
    process.env.VEDA_REAL = 'false';

    try {
      const parentState = {
        runId: 'parent_run_1',
        userId: 'user_1',
        event: { type: 'DOCUMENT' },
        profile: { businessName: 'My Business' },
        messages: [],
        trace: [],
      };

      const result = await vedaNode(parentState);
      assert.ok(result.vedaOutput);
      assert.equal(result.vedaOutput.status, 'OK');
      assert.ok(result.profile.gstin);
      assert.ok(result.messages.length > 0);
      assert.ok(result.trace.length > 0);
    } finally {
      process.env.VEDA_REAL = originalEnv;
    }
  });
});
