/**
 * ComplianceOS — Udyam Certificate Extractor
 */

import { UdyamCertificateSchema } from '../schemas/udyamCertificate.js';
import { BASE_SYSTEM_PROMPT, PROMPTS_BY_DOC_TYPE } from '../prompts/index.js';
import { completeJson } from '../stubs/groq.stub.js';
import { checkAllEvidence } from './evidenceCheck.js';
import { validateUdyam } from '../../../trust/validators/udyam.js';
import { validateDate } from '../../../trust/validators/dates.js';
import { confidenceGate } from '../../../trust/confidenceGate.js';

/**
 * Extract Udyam Certificate fields from OCR text
 * @param {string} ocrText - masked OCR text
 * @param {object} [options]
 * @param {Function} [options.llmCaller] - custom LLM caller for tests
 * @returns {Promise<{ fields: Record<string, any>, gated: Record<string, any>, validatorResults: Record<string, any[]>, tokens: number }>}
 */
export async function extractUdyamCertificate(ocrText, options = {}) {
  const caller = options.llmCaller || (async (params) => completeJson(params));

  const { data, tokens = 0 } = await caller({
    systemPrompt: `${BASE_SYSTEM_PROMPT}\n\n${PROMPTS_BY_DOC_TYPE.UDYAM_CERTIFICATE}`,
    userPrompt: `DOCUMENT OCR TEXT:\n${ocrText}`,
    schema: UdyamCertificateSchema,
  });

  // Step 1: Evidence check
  const { fields } = checkAllEvidence(data, ocrText);

  // Step 2: Deterministic validators
  const validatorResults = {
    udyamNumber: [],
    dateOfRegistration: [],
  };

  if (fields.udyamNumber?.value) {
    validatorResults.udyamNumber.push(validateUdyam(fields.udyamNumber.value));
  }

  if (fields.dateOfRegistration?.value) {
    validatorResults.dateOfRegistration.push(validateDate(fields.dateOfRegistration.value));
  }

  // Step 3: Confidence gating
  const gated = {};
  for (const [key, field] of Object.entries(fields)) {
    if (!field || field.value === null || field.value === undefined) {
      gated[key] = { ...field, status: 'EMPTY', reasons: [] };
      continue;
    }

    const fieldValidators = validatorResults[key] || [];
    const gateResult = confidenceGate(field.confidence, fieldValidators);
    gated[key] = {
      ...field,
      status: gateResult.status,
      reasons: gateResult.reasons,
    };
  }

  return { fields, gated, validatorResults, tokens };
}

export default extractUdyamCertificate;
