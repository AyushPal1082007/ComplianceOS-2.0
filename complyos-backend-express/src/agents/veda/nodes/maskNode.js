/**
 * ComplianceOS — VEDA Node: Mask
 */

import { runMask } from '../pipeline/mask.js';
import { createTraceEvent } from './traceHelper.js';

export async function maskNode(state) {
  const startedAt = Date.now();
  const maskedText = runMask(state.ocrText || '');

  const traceEvent = createTraceEvent({
    runId: state.runId,
    node: 'mask',
    startedAt,
    inputSummary: { length: (state.ocrText || '').length },
    outputSummary: { length: maskedText.length, masked: maskedText !== state.ocrText },
    status: 'done',
  });

  return {
    ocrText: maskedText,
    trace: [traceEvent],
  };
}

export default maskNode;
