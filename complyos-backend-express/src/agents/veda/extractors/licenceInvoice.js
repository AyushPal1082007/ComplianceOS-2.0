/**
 * ComplianceOS — Licence / Invoice Extractor
 */

import { LicenceInvoiceSchema } from '../schemas/licenceInvoice.js';
import { BASE_SYSTEM_PROMPT, PROMPTS_BY_DOC_TYPE } from '../prompts/index.js';
import { completeJson } from '../stubs/groq.stub.js';
import { checkAllEvidence } from './evidenceCheck.js';
import { validateDate, validateDateOrder } from '../../../trust/validators/dates.js';
import { confidenceGate } from '../../../trust/confidenceGate.js';

/**
 * Extract Licence / Invoice fields from OCR text
 * @param {string} ocrText - masked OCR text
 * @param {object} [options]
 * @param {Function} [options.llmCaller] - custom LLM caller for tests
 * @returns {Promise<{ fields: Record<string, any>, gated: Record<string, any>, validatorResults: Record<string, any[]>, tokens: number }>}
 */
export async function extractLicenceInvoice(ocrText, options = {}) {
  const caller = options.llmCaller || (async (params) => completeJson(params));

  const { data, tokens = 0 } = await caller({
    systemPrompt: `${BASE_SYSTEM_PROMPT}\n\n${PROMPTS_BY_DOC_TYPE.LICENCE_INVOICE}`,
    userPrompt: `DOCUMENT OCR TEXT:\n${ocrText}`,
    schema: LicenceInvoiceSchema,
  });

  // Step 1: Evidence check
  const { fields } = checkAllEvidence(data, ocrText);

  // Step 2: Deterministic validators
  const validatorResults = {
    validFrom: [],
    validTo: [],
  };

  if (fields.validFrom?.value) {
    validatorResults.validFrom.push(validateDate(fields.validFrom.value));
  }

  if (fields.validTo?.value) {
    validatorResults.validTo.push(validateDate(fields.validTo.value));
  }

  if (fields.validFrom?.value && fields.validTo?.value) {
    validatorResults.validTo.push(
      validateDateOrder(fields.validFrom.value, fields.validTo.value, 'validFrom', 'validTo')
    );
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

export default extractLicenceInvoice;
