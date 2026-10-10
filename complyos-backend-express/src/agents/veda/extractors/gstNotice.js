/**
 * ComplianceOS — GST Notice / Demand Extractor
 */

import { GstNoticeSchema } from '../schemas/gstNotice.js';
import { BASE_SYSTEM_PROMPT, PROMPTS_BY_DOC_TYPE } from '../prompts/index.js';
import { completeJson } from '../stubs/groq.stub.js';
import { checkAllEvidence } from './evidenceCheck.js';
import { validateGstin } from '../../../trust/validators/gstin.js';
import { validateDate, validateDateOrder } from '../../../trust/validators/dates.js';
import { validateAmount } from '../../../trust/validators/amounts.js';
import { confidenceGate } from '../../../trust/confidenceGate.js';

/**
 * Extract GST Notice fields from OCR text
 * @param {string} ocrText - masked OCR text
 * @param {object} [options]
 * @param {Function} [options.llmCaller] - custom LLM caller for tests
 * @returns {Promise<{ fields: Record<string, any>, gated: Record<string, any>, validatorResults: Record<string, any[]>, tokens: number }>}
 */
export async function extractGstNotice(ocrText, options = {}) {
  const caller = options.llmCaller || (async (params) => completeJson(params));

  const { data, tokens = 0 } = await caller({
    systemPrompt: `${BASE_SYSTEM_PROMPT}\n\n${PROMPTS_BY_DOC_TYPE.GST_NOTICE}`,
    userPrompt: `DOCUMENT OCR TEXT:\n${ocrText}`,
    schema: GstNoticeSchema,
  });

  // Step 1: Evidence check
  const { fields } = checkAllEvidence(data, ocrText);

  // Step 2: Deterministic validators
  const validatorResults = {
    gstin: [],
    dateOfNotice: [],
    replyDueDate: [],
    amountDemanded: [],
  };

  if (fields.gstin?.value) {
    validatorResults.gstin.push(validateGstin(fields.gstin.value));
  }

  if (fields.dateOfNotice?.value) {
    validatorResults.dateOfNotice.push(validateDate(fields.dateOfNotice.value));
  }

  if (fields.replyDueDate?.value) {
    validatorResults.replyDueDate.push(validateDate(fields.replyDueDate.value));
  }

  if (fields.dateOfNotice?.value && fields.replyDueDate?.value) {
    const orderCheck = validateDateOrder(
      fields.dateOfNotice.value,
      fields.replyDueDate.value,
      'dateOfNotice',
      'replyDueDate'
    );
    validatorResults.replyDueDate.push(orderCheck);
  }

  if (fields.amountDemanded?.value !== null && fields.amountDemanded?.value !== undefined) {
    validatorResults.amountDemanded.push(validateAmount(fields.amountDemanded.value));
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

export default extractGstNotice;
