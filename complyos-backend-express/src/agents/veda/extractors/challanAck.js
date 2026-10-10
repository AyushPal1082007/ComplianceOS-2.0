/**
 * ComplianceOS — Challan / Return Acknowledgement Extractor
 */

import { ChallanAckSchema } from '../schemas/challanAck.js';
import { BASE_SYSTEM_PROMPT, PROMPTS_BY_DOC_TYPE } from '../prompts/index.js';
import { completeJson } from '../stubs/groq.stub.js';
import { checkAllEvidence } from './evidenceCheck.js';
import { validateDate } from '../../../trust/validators/dates.js';
import { validateAmount } from '../../../trust/validators/amounts.js';
import { confidenceGate } from '../../../trust/confidenceGate.js';

/**
 * Extract Challan Acknowledgement fields from OCR text
 * @param {string} ocrText - masked OCR text
 * @param {object} [options]
 * @param {Function} [options.llmCaller] - custom LLM caller for tests
 * @returns {Promise<{ fields: Record<string, any>, gated: Record<string, any>, validatorResults: Record<string, any[]>, tokens: number }>}
 */
export async function extractChallanAck(ocrText, options = {}) {
  const caller = options.llmCaller || (async (params) => completeJson(params));

  const { data, tokens = 0 } = await caller({
    systemPrompt: `${BASE_SYSTEM_PROMPT}\n\n${PROMPTS_BY_DOC_TYPE.CHALLAN_ACK}`,
    userPrompt: `DOCUMENT OCR TEXT:\n${ocrText}`,
    schema: ChallanAckSchema,
  });

  // Step 1: Evidence check
  const { fields } = checkAllEvidence(data, ocrText);

  // Step 2: Deterministic validators
  const validatorResults = {
    dateFiled: [],
    amountPaid: [],
  };

  if (fields.dateFiled?.value) {
    validatorResults.dateFiled.push(validateDate(fields.dateFiled.value));
  }

  if (fields.amountPaid?.value !== null && fields.amountPaid?.value !== undefined) {
    validatorResults.amountPaid.push(validateAmount(fields.amountPaid.value));
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

export default extractChallanAck;
