/**
 * ComplianceOS — VEDA Node: Intake
 */

import { runIntake } from '../pipeline/intake.js';
import { createTraceEvent } from './traceHelper.js';

export async function intakeNode(state) {
  const startedAt = Date.now();
  const res = runIntake(state.event, state.locale);

  if (!res.valid) {
    const traceEvent = createTraceEvent({
      runId: state.runId,
      node: 'intake',
      startedAt,
      inputSummary: { mime: res.mime, url: res.url },
      outputSummary: { valid: false, error: 'Unsupported MIME' },
      status: 'done',
    });

    return {
      docId: res.docId,
      url: res.url,
      mime: res.mime,
      status: 'DEGRADED',
      messages: res.rejectionMessage ? [res.rejectionMessage] : [],
      trace: [traceEvent],
    };
  }

  const traceEvent = createTraceEvent({
    runId: state.runId,
    node: 'intake',
    startedAt,
    inputSummary: { docId: res.docId, mime: res.mime },
    outputSummary: { valid: true },
    status: 'done',
  });

  return {
    docId: res.docId,
    url: res.url,
    mime: res.mime,
    ocrText: res.ocrText || state.ocrText || '',
    trace: [traceEvent],
  };
}

export default intakeNode;
