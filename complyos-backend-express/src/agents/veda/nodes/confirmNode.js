/**
 * ComplianceOS — VEDA Node: Confirm
 * Interrupts with a confirm_card for flagged/conflicting fields.
 * Handles resume with confirm or edit actions and re-validates before resolving.
 */

import { interrupt } from '@langchain/langgraph';
import { buildConfirmCard, applyUserAction } from '../confirm.js';
import { createTraceEvent } from './traceHelper.js';

export async function confirmNode(state) {
  const startedAt = Date.now();
  let currentPending = [...(state.pendingConfirmations || [])];
  const allResolved = [...(state.resolvedConfirmations || [])];
  const addedMessages = [];

  while (currentPending.length > 0) {
    const confirmCard = buildConfirmCard(currentPending, state.locale);
    addedMessages.push(confirmCard);

    // Call LangGraph interrupt to pause execution and present confirm_card
    const actionPayload = interrupt(confirmCard);

    // Resume action: { key: string, action: 'confirm'|'edit', value?: any }
    const { remainingPending, resolved } = applyUserAction(actionPayload, currentPending);

    if (resolved.length > 0) {
      allResolved.push(...resolved);
    }

    currentPending = remainingPending;
  }

  const traceEvent = createTraceEvent({
    runId: state.runId,
    node: 'confirm',
    startedAt,
    inputSummary: { initialPendingCount: (state.pendingConfirmations || []).length },
    outputSummary: { resolvedCount: allResolved.length },
    status: 'done',
  });

  return {
    pendingConfirmations: [],
    resolvedConfirmations: allResolved,
    messages: addedMessages,
    trace: [traceEvent],
  };
}

export default confirmNode;
