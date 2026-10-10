/**
 * ComplianceOS — VEDA Agent Public Entry Point
 * Exports `run(input)` returning Promise<AgentOutput>.
 * Respects VEDA_REAL feature flag.
 * Manages LangGraph subgraph invocation, interrupts, and resume commands.
 */

import { Command, MemorySaver } from '@langchain/langgraph';
import { buildVedaGraph } from './graph.js';
import { runMock } from './mock.js';
import { AgentOutputSchema, AgentInputSchema } from './stubs/contracts.stub.js';
import logger from '../../logger.js';

// Cache compiled graphs per checkpointer/session if needed
const defaultCheckpointer = new MemorySaver();
let defaultGraph = null;

function getGraph(checkpointer = defaultCheckpointer) {
  if (!defaultGraph || checkpointer !== defaultCheckpointer) {
    return buildVedaGraph({ checkpointer });
  }
  return defaultGraph;
}

/**
 * Public execution entry for VEDA
 * @param {object} input - AgentInput
 * @param {object} [options]
 * @param {import('@langchain/langgraph').BaseCheckpointSaver} [options.checkpointer]
 * @returns {Promise<import('./stubs/contracts.stub.js').AgentOutput>}
 */
export async function run(input = {}, options = {}) {
  // Feature flag check
  if (process.env.VEDA_REAL !== 'true') {
    return runMock(input);
  }

  // Validate or normalize input
  const runId = input.runId || `run_${Date.now()}`;
  const userId = input.userId || 'user_default';
  const event = input.event || {};
  const profile = input.profile || {};
  const locale = input.locale || 'hinglish';

  const checkpointer = options.checkpointer || defaultCheckpointer;
  const graph = getGraph(checkpointer);
  const thread = { configurable: { thread_id: runId } };

  try {
    let result;

    // Check if this is a resume invocation
    if (event.action === 'resume' || event.action === 'CONFIRM_ACTION') {
      const resumeCommand = new Command({ resume: event.payload || event });
      result = await graph.invoke(resumeCommand, thread);
    } else {
      const initialState = {
        runId,
        userId,
        event,
        profile,
        locale,
        url: event.url || event.imageUrl || '',
        mime: event.mime || event.mimeType || 'image/jpeg',
        ocrText: event.ocrText || '',
        extractedFields: input.extractedFields || event.extractedFields || {},
        trace: [],
        costs: { llmTokens: 0, tinyfishAgentCalls: 0 },
        messages: [],
      };
      result = await graph.invoke(initialState, thread);
    }

    // Check if graph halted on an interrupt
    if (result && result.__interrupt__ && result.__interrupt__.length > 0) {
      const interruptData = result.__interrupt__[0].value;
      const isConfirm = interruptData?.type === 'confirm_card' || interruptData?.card?.type === 'confirm_card';

      const output = {
        status: isConfirm ? 'NEEDS_CONFIRMATION' : 'NEEDS_INPUT',
        profilePatch: result.profilePatch || {},
        messages: [...(result.messages || []), interruptData],
        claims: result.claims || [],
        calendarItems: result.calendarItems || [],
        trace: result.trace || [],
        costs: result.costs || { llmTokens: 0, tinyfishAgentCalls: 0 },
      };

      return AgentOutputSchema.parse(output);
    }

    const output = {
      status: result.status || 'OK',
      profilePatch: result.profilePatch || {},
      messages: result.messages || [],
      claims: result.claims || [],
      calendarItems: result.calendarItems || [],
      trace: result.trace || [],
      costs: result.costs || { llmTokens: 0, tinyfishAgentCalls: 0 },
    };

    return AgentOutputSchema.parse(output);
  } catch (err) {
    logger.error('VEDA run failed', { error: err.message, runId });

    const failedOutput = {
      status: 'FAILED',
      profilePatch: {},
      messages: [
        {
          type: 'text',
          text: 'Kuch takneeki kharabi aayi hai. Kripya thodi der baad dubara koshish karein.',
        },
      ],
      claims: [],
      calendarItems: [],
      trace: [
        {
          runId,
          agent: 'VEDA',
          node: 'entry',
          startedAt: new Date().toISOString(),
          durationMs: 0,
          status: 'error',
          error: err.message,
        },
      ],
      costs: { llmTokens: 0, tinyfishAgentCalls: 0 },
    };

    return AgentOutputSchema.parse(failedOutput);
  }
}

export {
  buildVedaGraph,
};

export default {
  run,
  buildVedaGraph,
};
