/**
 * ComplianceOS — GST Certificate Extractor
 */

import { GstCertificateSchema } from '../schemas/gstCertificate.js';
import { BASE_SYSTEM_PROMPT, PROMPTS_BY_DOC_TYPE } from '../prompts/index.js';
import { completeJson } from '../stubs/groq.stub.js';
import { checkAllEvidence } from './evidenceCheck.js';
import { validateGstin } from '../../../trust/validators/gstin.js';
import { validateDate } from '../../../trust/validators/dates.js';
import { validateStateConsistency } from '../../../trust/validators/stateConsistency.js';
import { confidenceGate } from '../../../trust/confidenceGate.js';

/**
 * Extract GST Certificate fields from OCR text
 * @param {string} ocrText - masked OCR text
 * @param {object} [options]
 * @param {Function} [options.llmCaller] - custom LLM caller for tests
 * @returns {Promise<{ fields: Record<string, any>, gated: Record<string, any>, validatorResults: Record<string, any[]>, tokens: number }>}
 */
export async function extractGstCertificate(ocrText, options = {}) {
  const caller = options.llmCaller || (async (params) => completeJson(params));

  const { data, tokens = 0 } = await caller({
    systemPrompt: `${BASE_SYSTEM_PROMPT}\n\n${PROMPTS_BY_DOC_TYPE.GST_CERTIFICATE}`,
    userPrompt: `DOCUMENT OCR TEXT:\n${ocrText}`,
    schema: GstCertificateSchema,
  });

  // Step 1: Evidence check — drop any field whose quote is not in OCR text
  const { fields } = checkAllEvidence(data, ocrText);

  // Step 2: Deterministic validators per field
  const validatorResults = {
    gstin: [],
    dateOfRegistration: [],
    state: [],
  };

  if (fields.gstin?.value) {
    validatorResults.gstin.push(validateGstin(fields.gstin.value));
  }

  if (fields.dateOfRegistration?.value) {
    validatorResults.dateOfRegistration.push(validateDate(fields.dateOfRegistration.value));
  }

  if (fields.gstin?.value && (fields.address?.value || fields.state?.value)) {
    const addressOrState = fields.state?.value || fields.address?.value;
    const consistency = validateStateConsistency(fields.gstin.value, addressOrState);
    validatorResults.state.push(consistency);
    if (!consistency.ok) {
      validatorResults.gstin.push(consistency);
    }
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

export default extractGstCertificate;
