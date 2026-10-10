/**
 * ComplianceOS — VEDA Graph Node
 * Mounts VEDA agent into the parent multi-agent LangGraph orchestrator.
 * Delegates to veda.run(input) or exposes subgraph builder.
 */

import { run, buildVedaGraph } from '../../agents/veda/index.js';

/**
 * Node wrapper for parent graph execution
 * @param {object} state - Parent graph state
 * @returns {Promise<object>} Patch for parent state
 */
export async function vedaNode(state) {
  const agentInput = {
    runId: state.runId,
    userId: state.userId,
    event: state.event || {},
    profile: state.profile || {},
    locale: state.locale || 'hinglish',
  };

  const output = await run(agentInput, {
    checkpointer: state.checkpointer,
  });

  return {
    vedaOutput: output,
    profile: output.profilePatch ? { ...state.profile, ...output.profilePatch } : state.profile,
    messages: [...(state.messages || []), ...(output.messages || [])],
    trace: [...(state.trace || []), ...(output.trace || [])],
  };
}

export { buildVedaGraph };
export default vedaNode;
