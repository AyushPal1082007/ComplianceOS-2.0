/**
 * Trust Layer — Confidence Gate
 * Determines whether a field is VERIFIED or NEEDS_CONFIRMATION
 * based on LLM confidence score and validator results.
 *
 * Rule: confidence < 0.80 OR any validator failed => NEEDS_CONFIRMATION
 */

import config from '../config.js';

const CONFIDENCE_THRESHOLD = config.trustLayer?.confidenceGate ?? 0.80;

/**
 * @typedef {'EMPTY'|'SELF_REPORTED'|'NEEDS_CONFIRMATION'|'VERIFIED'} FieldStatus
 */

/**
 * Determine the status of a field based on confidence and validator results
 * @param {number} confidence - LLM-assigned confidence (0.0 to 1.0)
 * @param {{ ok: boolean, reason?: string }[]} validatorResults - results from validators
 * @returns {{ status: FieldStatus, reasons: string[] }}
 */
export function confidenceGate(confidence, validatorResults = []) {
  const reasons = [];

  // Check confidence threshold
  const meetsConfidence = typeof confidence === 'number' && confidence >= CONFIDENCE_THRESHOLD;
  if (!meetsConfidence) {
    reasons.push(
      `Confidence ${typeof confidence === 'number' ? (confidence * 100).toFixed(0) + '%' : 'missing'} is below ${(CONFIDENCE_THRESHOLD * 100).toFixed(0)}% threshold`
    );
  }

  // Check all validators passed
  const failedValidators = validatorResults.filter(r => !r.ok);
  for (const fail of failedValidators) {
    reasons.push(fail.reason || 'Validator failed');
  }

  if (reasons.length > 0) {
    return { status: 'NEEDS_CONFIRMATION', reasons };
  }

  return { status: 'VERIFIED', reasons: [] };
}

/**
 * Get the configured confidence threshold
 * @returns {number}
 */
export function getConfidenceThreshold() {
  return CONFIDENCE_THRESHOLD;
}
