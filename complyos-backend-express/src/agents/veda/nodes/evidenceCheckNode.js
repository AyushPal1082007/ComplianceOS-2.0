/**
 * ComplianceOS — VEDA Node: Evidence Check
 */

import { runEvidenceCheck } from '../pipeline/evidenceCheck.js';
import { createTraceEvent } from './traceHelper.js';

export async function evidenceCheckNode(state) {
  const startedAt = Date.now();
  const { fields, droppedFields } = runEvidenceCheck(state.extractedFields, state.ocrText);

  const droppedKeys = Object.keys(droppedFields);
  const traceEvent = createTraceEvent({
    runId: state.runId,
    node: 'evidenceCheck',
    startedAt,
    inputSummary: { fieldCount: Object.keys(state.extractedFields || {}).length },
    outputSummary: { verifiedCount: Object.keys(fields).length, droppedCount: droppedKeys.length, droppedKeys },
    status: 'done',
  });

  return {
    extractedFields: fields,
    trace: [traceEvent],
  };
}

export default evidenceCheckNode;
