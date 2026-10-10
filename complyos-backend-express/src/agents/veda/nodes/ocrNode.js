/**
 * ComplianceOS — VEDA Node: OCR
 */

import { runOcr } from '../pipeline/ocr.js';
import { createTraceEvent } from './traceHelper.js';

export async function ocrNode(state) {
  const startedAt = Date.now();
  const res = await runOcr({
    url: state.url,
    ocrText: state.ocrText,
    locale: state.locale,
  });

  if (!res.success) {
    const traceEvent = createTraceEvent({
      runId: state.runId,
      node: 'ocr',
      startedAt,
      inputSummary: { url: state.url },
      outputSummary: { success: false, textLength: 0 },
      status: 'done',
    });

    return {
      ocrText: '',
      status: 'NEEDS_INPUT',
      messages: res.message ? [res.message] : [],
      trace: [traceEvent],
    };
  }

  const traceEvent = createTraceEvent({
    runId: state.runId,
    node: 'ocr',
    startedAt,
    inputSummary: { url: state.url },
    outputSummary: { textLength: res.text.length, confidence: res.confidence },
    status: 'done',
  });

  return {
    ocrText: res.text,
    trace: [traceEvent],
  };
}

export default ocrNode;
