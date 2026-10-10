/**
 * ComplianceOS — VEDA Node: Classify
 */

import { runClassify } from '../pipeline/classify.js';
import { createTraceEvent } from './traceHelper.js';

export async function classifyNode(state) {
  const startedAt = Date.now();
  const res = await runClassify(state.ocrText || '');

  const traceEvent = createTraceEvent({
    runId: state.runId,
    node: 'classify',
    startedAt,
    inputSummary: { ocrLength: (state.ocrText || '').length },
    outputSummary: { docType: res.docType },
    status: 'done',
  });

  return {
    docType: res.docType,
    trace: [traceEvent],
  };
}

export default classifyNode;
