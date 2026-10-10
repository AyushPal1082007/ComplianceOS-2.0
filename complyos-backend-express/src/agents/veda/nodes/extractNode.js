/**
 * ComplianceOS — VEDA Node: Extract
 */

import { runExtract } from '../pipeline/extract.js';
import { createTraceEvent } from './traceHelper.js';
import { getTextMessage } from '../messages/index.js';

export async function extractNode(state) {
  const startedAt = Date.now();

  // If fields are already provided (e.g. test fixtures or offline runner)
  if (state.extractedFields && Object.keys(state.extractedFields).length > 0) {
    const traceEvent = createTraceEvent({
      runId: state.runId,
      node: 'extract',
      startedAt,
      inputSummary: { preExtracted: true, docType: state.docType },
      outputSummary: { fieldCount: Object.keys(state.extractedFields).length },
      status: 'done',
    });

    return {
      extractedFields: state.extractedFields,
      trace: [traceEvent],
    };
  }

  try {
    const res = await runExtract({
      docType: state.docType,
      ocrText: state.ocrText,
    });

    const traceEvent = createTraceEvent({
      runId: state.runId,
      node: 'extract',
      startedAt,
      inputSummary: { docType: state.docType },
      outputSummary: { fieldCount: Object.keys(res.rawFields).length, tokens: res.tokens },
      status: 'done',
    });

    return {
      extractedFields: res.rawFields,
      costs: { llmTokens: res.tokens },
      trace: [traceEvent],
    };
  } catch (err) {
    const traceEvent = createTraceEvent({
      runId: state.runId,
      node: 'extract',
      startedAt,
      inputSummary: { docType: state.docType },
      outputSummary: { error: err.message },
      status: 'error',
      error: err.message,
    });

    return {
      status: 'DEGRADED',
      messages: [getTextMessage('degraded_ocr', state.locale)],
      trace: [traceEvent],
    };
  }
}

export default extractNode;
