import test from 'node:test';
import assert from 'node:assert/strict';
import { run, AgentOutputSchema } from '../index.js';
import { ariaNode } from '../../../graph/nodes/aria.node.js';

test('public run returns output conforming to the ARIA contract in mock mode', async () => {
  const output = await run({ runId: 'contract-run', userId: 'u1', event: { type: 'START' }, profile: {}, locale: 'hinglish' }, { mock: true });
  assert.equal(AgentOutputSchema.safeParse(output).success, true);
  assert.ok(output.session);
  assert.ok(output.messages.length >= 1);
});

test('graph wrapper merges patch, messages, trace, and session without database access', async () => {
  const result = await ariaNode({ runId: 'node-run', userId: 'u1', event: { type: 'START' }, profile: {}, messages: [], trace: [], mock: true });
  assert.equal(result.ariaOutput.status, 'OK');
  assert.equal(result.ariaSession.phase, 'asking');
  assert.ok(result.messages.length >= 1);
  assert.ok(result.trace.some((entry) => entry.agent === 'ARIA'));
});

test('mock mode handles voice fixture events without media downloads or speech network calls', async () => {
  const previous = process.env.ARIA_REAL;
  process.env.ARIA_REAL = 'false';
  try {
    const output = await run({
      runId: 'voice-mock', userId: 'u1', locale: 'hi', profile: {},
      event: {
        type: 'VOICE', mediaId: 'mock-media', fixtureId: 'voice-hi',
        mockUpdates: [{ field: 'state', value: 'Kanpur', confidence: 0.9, quote: 'कानपुर' }],
      },
    });
    assert.equal(output.status, 'OK');
    assert.equal(output.profilePatch.state.value, 'Kanpur');
    assert.ok(output.messages.some((message) => message.text?.includes('मैंने सुना:')));
  } finally {
    if (previous === undefined) delete process.env.ARIA_REAL;
    else process.env.ARIA_REAL = previous;
  }
});
