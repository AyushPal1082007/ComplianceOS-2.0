/**
 * ComplianceOS — VEDA Node: Commit
 */

import { commitDocumentResults } from '../commit.js';
import { createTraceEvent } from './traceHelper.js';

export async function commitNode(state) {
  const startedAt = Date.now();

  // Combine gatedFields (that were already VERIFIED) with resolvedConfirmations (user confirmed)
  const resolvedFields = { ...(state.gatedFields || {}) };

  for (const item of (state.resolvedConfirmations || [])) {
    resolvedFields[item.key] = {
      value: item.value,
      confidence: item.confidence || 1.0,
      evidenceQuote: (item.evidence && item.evidence.quote) || item.evidenceQuote || null,
      status: 'VERIFIED',
      source: item.source || 'user_confirmed',
    };
  }

  const commitResult = commitDocumentResults({
    docType: state.docType,
    docId: state.docId,
    resolvedFields,
    profile: state.profile,
    locale: state.locale,
  });

  const traceEvent = createTraceEvent({
    runId: state.runId,
    node: 'commit',
    startedAt,
    inputSummary: { docType: state.docType, resolvedFieldCount: Object.keys(resolvedFields).length },
    outputSummary: {
      profilePatchKeys: Object.keys(commitResult.profilePatch),
      calendarCount: commitResult.calendarItems.length,
      healthScore: commitResult.healthScore,
    },
    status: 'done',
  });

  return {
    profilePatch: commitResult.profilePatch,
    calendarItems: commitResult.calendarItems,
    claims: commitResult.claims,
    messages: commitResult.messages,
    penalty: commitResult.penalty,
    healthScore: commitResult.healthScore,
    status: 'OK',
    trace: [traceEvent],
  };
}

export default commitNode;
