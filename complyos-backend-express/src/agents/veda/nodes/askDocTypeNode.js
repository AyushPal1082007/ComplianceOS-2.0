/**
 * ComplianceOS — VEDA Node: Ask Doc Type
 * Interrupts with an option_card if classification is UNKNOWN.
 */

import { interrupt } from '@langchain/langgraph';
import { runAskDocType } from '../pipeline/askDocType.js';
import { createTraceEvent } from './traceHelper.js';

export async function askDocTypeNode(state) {
  const startedAt = Date.now();
  const optionCard = runAskDocType(state.locale);

  // Interrupt graph execution and present option_card to user
  const resumePayload = interrupt(optionCard);

  // When resumed, payload contains user's chosen docType: e.g. { docType: 'GST_CERTIFICATE' } or 'GST_CERTIFICATE'
  const chosenType = (typeof resumePayload === 'object' && resumePayload !== null)
    ? (resumePayload.docType || resumePayload.id || 'GST_CERTIFICATE')
    : String(resumePayload || 'GST_CERTIFICATE');

  const traceEvent = createTraceEvent({
    runId: state.runId,
    node: 'askDocType',
    startedAt,
    inputSummary: { previousDocType: state.docType },
    outputSummary: { chosenDocType: chosenType },
    status: 'done',
  });

  return {
    docType: chosenType,
    messages: [optionCard],
    trace: [traceEvent],
  };
}

export default askDocTypeNode;
