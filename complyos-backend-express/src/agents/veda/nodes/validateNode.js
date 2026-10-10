/**
 * ComplianceOS — VEDA Node: Validate
 */

import { runValidate } from '../pipeline/validate.js';
import { createTraceEvent } from './traceHelper.js';

export async function validateNode(state) {
  const startedAt = Date.now();
  const { validatorResults } = runValidate(state.docType, state.extractedFields);

  const failCount = Object.values(validatorResults)
    .flatMap((r) => r)
    .filter((r) => !r.ok).length;

  const traceEvent = createTraceEvent({
    runId: state.runId,
    node: 'validate',
    startedAt,
    inputSummary: { docType: state.docType, fieldCount: Object.keys(state.extractedFields || {}).length },
    outputSummary: { validatorFailures: failCount },
    status: 'done',
  });

  return {
    validatorResults,
    trace: [traceEvent],
  };
}

export default validateNode;
