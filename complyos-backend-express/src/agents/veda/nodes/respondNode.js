/**
 * ComplianceOS — VEDA Node: Respond
 */

import { runRespond } from '../pipeline/respond.js';
import { createTraceEvent } from './traceHelper.js';

export async function respondNode(state) {
  const startedAt = Date.now();

  const finalOutput = runRespond({
    status: state.status || 'OK',
    profilePatch: state.profilePatch || {},
    messages: state.messages || [],
    claims: state.claims || [],
    calendarItems: state.calendarItems || [],
    trace: state.trace || [],
    costs: state.costs || { llmTokens: 0, tinyfishAgentCalls: 0 },
  });

  const traceEvent = createTraceEvent({
    runId: state.runId,
    node: 'respond',
    startedAt,
    inputSummary: { status: state.status },
    outputSummary: { finalStatus: finalOutput.status, messageCount: finalOutput.messages.length },
    status: 'done',
  });

  return {
    ...finalOutput,
    trace: [...(state.trace || []), traceEvent],
  };
}

export default respondNode;
