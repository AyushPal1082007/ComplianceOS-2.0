/**
 * ComplianceOS — VEDA Node: Gate
 */

import { runGate } from '../pipeline/gate.js';
import { mapDocFieldsToProfile, mergeProfileFields } from '../merge.js';
import { createTraceEvent } from './traceHelper.js';

export async function gateNode(state) {
  const startedAt = Date.now();
  const { gatedFields, pendingConfirmations } = runGate(
    state.extractedFields,
    state.validatorResults
  );

  // Cross-check profile conflicts
  const mapped = mapDocFieldsToProfile(state.docType, gatedFields);
  const { conflicts } = mergeProfileFields(state.profile, mapped, {
    docType: state.docType,
    docId: state.docId,
  });

  // Add conflict items to pendingConfirmations
  for (const conf of conflicts) {
    const existingIdx = pendingConfirmations.findIndex((p) => p.key === conf.key);
    if (existingIdx !== -1) {
      pendingConfirmations[existingIdx].conflict = conf;
      pendingConfirmations[existingIdx].reasons.push(conf.question);
    } else {
      pendingConfirmations.push({
        key: conf.key,
        value: conf.docValue,
        evidenceQuote: conf.evidenceQuote,
        confidence: 0.8,
        conflict: conf,
        reasons: [conf.question],
      });
    }
  }

  const traceEvent = createTraceEvent({
    runId: state.runId,
    node: 'gate',
    startedAt,
    inputSummary: { fieldCount: Object.keys(gatedFields).length },
    outputSummary: { pendingConfirmationsCount: pendingConfirmations.length, conflictsCount: conflicts.length },
    status: 'done',
  });

  return {
    gatedFields,
    pendingConfirmations,
    trace: [traceEvent],
  };
}

export default gateNode;
