/**
 * ComplianceOS — VEDA Pipeline: Gate
 * Pure function: runs confidenceGate on all fields.
 */

import { confidenceGate } from '../../../trust/confidenceGate.js';

export function runGate(fields = {}, validatorResults = {}) {
  const gatedFields = {};
  const pendingConfirmations = [];

  for (const [key, field] of Object.entries(fields)) {
    if (!field || field.value === null || field.value === undefined) {
      gatedFields[key] = { ...field, status: 'EMPTY', reasons: [] };
      continue;
    }

    const fieldValidators = validatorResults[key] || [];
    const gateResult = confidenceGate(field.confidence, fieldValidators);

    gatedFields[key] = {
      ...field,
      status: gateResult.status,
      reasons: gateResult.reasons,
    };

    if (gateResult.status === 'NEEDS_CONFIRMATION') {
      pendingConfirmations.push({
        key,
        value: field.value,
        evidenceQuote: field.evidenceQuote,
        confidence: field.confidence,
        reasons: gateResult.reasons,
      });
    }
  }

  return { gatedFields, pendingConfirmations };
}

export default runGate;
