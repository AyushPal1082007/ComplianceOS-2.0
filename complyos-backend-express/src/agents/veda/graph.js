/**
 * ComplianceOS — VEDA Subgraph (LangGraph)
 *
 * Flow:
 * intake -> ocr -> mask -> classify -> extract -> evidenceCheck -> validate -> gate -> confirm -> commit -> respond
 * (with askDocType branch if classify returns UNKNOWN)
 */

import { StateGraph, START, END, isGraphInterrupt } from '@langchain/langgraph';
import { VedaState } from './state.js';

import { intakeNode } from './nodes/intakeNode.js';
import { ocrNode } from './nodes/ocrNode.js';
import { maskNode } from './nodes/maskNode.js';
import { classifyNode } from './nodes/classifyNode.js';
import { askDocTypeNode } from './nodes/askDocTypeNode.js';
import { extractNode } from './nodes/extractNode.js';
import { evidenceCheckNode } from './nodes/evidenceCheckNode.js';
import { validateNode } from './nodes/validateNode.js';
import { gateNode } from './nodes/gateNode.js';
import { confirmNode } from './nodes/confirmNode.js';
import { commitNode } from './nodes/commitNode.js';
import { respondNode } from './nodes/respondNode.js';
import { createTraceEvent } from './nodes/traceHelper.js';
import { getTextMessage } from './messages/index.js';

/**
 * Wrap node function to catch errors (never throw out of graph, except for LangGraph interrupts)
 */
function wrapSafeNode(fn, nodeName) {
  return async (state) => {
    try {
      return await fn(state);
    } catch (err) {
      if (isGraphInterrupt(err)) {
        throw err;
      }

      const traceEvent = createTraceEvent({
        runId: state.runId,
        node: nodeName,
        startedAt: Date.now(),
        inputSummary: { node: nodeName },
        outputSummary: { error: err.message },
        status: 'error',
        error: err.message,
      });

      return {
        status: 'FAILED',
        messages: [getTextMessage('generic_error', state.locale)],
        trace: [traceEvent],
      };
    }
  };
}

/**
 * Build and compile the VEDA LangGraph subgraph
 * @param {object} [options]
 * @param {import('@langchain/langgraph').BaseCheckpointSaver} [options.checkpointer]
 * @returns {import('@langchain/langgraph').CompiledStateGraph}
 */
export function buildVedaGraph({ checkpointer } = {}) {
  const workflow = new StateGraph(VedaState)
    .addNode('intake', wrapSafeNode(intakeNode, 'intake'))
    .addNode('ocr', wrapSafeNode(ocrNode, 'ocr'))
    .addNode('mask', wrapSafeNode(maskNode, 'mask'))
    .addNode('classify', wrapSafeNode(classifyNode, 'classify'))
    .addNode('askDocType', wrapSafeNode(askDocTypeNode, 'askDocType'))
    .addNode('extract', wrapSafeNode(extractNode, 'extract'))
    .addNode('evidenceCheck', wrapSafeNode(evidenceCheckNode, 'evidenceCheck'))
    .addNode('validate', wrapSafeNode(validateNode, 'validate'))
    .addNode('gate', wrapSafeNode(gateNode, 'gate'))
    .addNode('confirm', wrapSafeNode(confirmNode, 'confirm'))
    .addNode('commit', wrapSafeNode(commitNode, 'commit'))
    .addNode('respond', wrapSafeNode(respondNode, 'respond'));

  // START edge
  workflow.addEdge(START, 'intake');

  // Intake -> OCR or Respond (if unsupported mime)
  workflow.addConditionalEdges('intake', (state) => {
    if (state.status === 'DEGRADED' || state.status === 'FAILED') return 'respond';
    return 'ocr';
  });

  // OCR -> Mask or Respond (if empty / unclear photo)
  workflow.addConditionalEdges('ocr', (state) => {
    if (state.status === 'NEEDS_INPUT' || state.status === 'FAILED') return 'respond';
    return 'mask';
  });

  // Mask -> Classify or Respond
  workflow.addConditionalEdges('mask', (state) => {
    if (state.status === 'FAILED') return 'respond';
    return 'classify';
  });

  // Classify -> askDocType (if UNKNOWN) or Extract
  workflow.addConditionalEdges('classify', (state) => {
    if (state.status === 'FAILED') return 'respond';
    if (!state.docType || state.docType === 'UNKNOWN') return 'askDocType';
    return 'extract';
  });

  // askDocType -> Extract
  workflow.addEdge('askDocType', 'extract');

  // Extract -> EvidenceCheck or Respond (if degraded)
  workflow.addConditionalEdges('extract', (state) => {
    if (state.status === 'DEGRADED' || state.status === 'FAILED') return 'respond';
    return 'evidenceCheck';
  });

  // EvidenceCheck -> Validate
  workflow.addConditionalEdges('evidenceCheck', (state) => {
    if (state.status === 'FAILED') return 'respond';
    return 'validate';
  });

  // Validate -> Gate
  workflow.addConditionalEdges('validate', (state) => {
    if (state.status === 'FAILED') return 'respond';
    return 'gate';
  });

  // Gate -> Confirm (if any pending confirmations) or Commit
  workflow.addConditionalEdges('gate', (state) => {
    if (state.status === 'FAILED') return 'respond';
    if (state.pendingConfirmations && state.pendingConfirmations.length > 0) {
      return 'confirm';
    }
    return 'commit';
  });

  // Confirm -> Commit
  workflow.addConditionalEdges('confirm', (state) => {
    if (state.status === 'FAILED') return 'respond';
    return 'commit';
  });

  // Commit -> Respond
  workflow.addEdge('commit', 'respond');

  // Respond -> END
  workflow.addEdge('respond', END);

  return workflow.compile({ checkpointer });
}

export default buildVedaGraph;
