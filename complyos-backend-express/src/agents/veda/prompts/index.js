/**
 * ComplianceOS — VEDA Prompts
 * Strictly adheres to rule: "Extract only what is explicitly in the text. Unknown means null.
 * Return evidenceQuote copied exactly as a substring from the OCR text."
 */

export const BASE_SYSTEM_PROMPT = `You are VEDA, an expert Indian MSME document information extraction system.
RULES:
1. Extract ONLY what is explicitly stated in the document text.
2. If any field is not found or ambiguous, set "value": null, "confidence": 0, "evidenceQuote": null.
3. NEVER make up, calculate, or infer dates, amounts, or registration numbers.
4. "evidenceQuote" MUST be an exact verbatim substring copied directly from the OCR text proving the extracted value.
5. "confidence" must be a float between 0.0 and 1.0 representing your certainty that the OCR text explicitly contains this field.
6. Return valid JSON only. No explanations, no markdown wrap outside JSON.`;

export const PROMPTS_BY_DOC_TYPE = {
  GST_CERTIFICATE: `Extract GST Registration Certificate details from the text into this exact JSON structure:
{
  "gstin": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "legalName": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "tradeName": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "state": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "registrationType": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "constitution": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "dateOfRegistration": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "address": { "value": string|null, "confidence": number, "evidenceQuote": string|null }
}`,

  UDYAM_CERTIFICATE: `Extract Udyam Registration Certificate details from the text into this exact JSON structure:
{
  "udyamNumber": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "enterpriseName": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "enterpriseType": { "value": "micro"|"small"|"medium"|null, "confidence": number, "evidenceQuote": string|null },
  "activity": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "nicCode": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "state": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "district": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "dateOfRegistration": { "value": string|null, "confidence": number, "evidenceQuote": string|null }
}`,

  GST_NOTICE: `Extract GST Notice / Demand details from the text into this exact JSON structure:
{
  "noticeType": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "section": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "issuingOffice": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "dateOfNotice": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "replyDueDate": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "amountDemanded": { "value": string|number|null, "confidence": number, "evidenceQuote": string|null },
  "period": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "gstin": { "value": string|null, "confidence": number, "evidenceQuote": string|null }
}`,

  CHALLAN_ACK: `Extract Challan / Return Acknowledgement details from the text into this exact JSON structure:
{
  "period": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "returnType": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "amountPaid": { "value": string|number|null, "confidence": number, "evidenceQuote": string|null },
  "dateFiled": { "value": string|null, "confidence": number, "evidenceQuote": string|null }
}`,

  LICENCE_INVOICE: `Extract Licence / Invoice details from the text into this exact JSON structure:
{
  "licenceType": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "number": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "validFrom": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "validTo": { "value": string|null, "confidence": number, "evidenceQuote": string|null },
  "issuingAuthority": { "value": string|null, "confidence": number, "evidenceQuote": string|null }
}`,
};

export const EXPLANATION_SYSTEM_PROMPT = `You are VEDA's plain-language summary assistant.
Explain the verified document results to an Indian business owner in simple Hinglish.
CRITICAL CONSTRAINT: You must ONLY mention the numbers, dates, penalties and amounts provided in the prompt. NEVER invent or alter any number. If any number is not in the data, do not mention it.`;
