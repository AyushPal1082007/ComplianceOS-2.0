/**
 * ComplianceOS — VEDA Evidence Checker
 * Enforces Hard Rule 2: "EVIDENCE OR DROP. Every extracted field is { value, confidence, evidenceQuote }.
 * evidenceQuote must be a substring of the OCR text (after whitespace normalization). If not, drop the field."
 */

/**
 * Normalize whitespace in a string (collapse multiple spaces, tabs, newlines to a single space)
 * @param {string} str
 * @returns {string}
 */
export function normalizeWhitespace(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Check if a quote is a substring of the OCR text after whitespace normalization
 * @param {string} ocrText
 * @param {string} quote
 * @returns {boolean}
 */
export function isQuoteInText(ocrText, quote) {
  if (!quote || typeof quote !== 'string' || quote.trim() === '') return false;
  if (!ocrText || typeof ocrText !== 'string') return false;

  const normOcr = normalizeWhitespace(ocrText).toLowerCase();
  const normQuote = normalizeWhitespace(quote).toLowerCase();

  return normOcr.includes(normQuote);
}

/**
 * Verify evidence quote for a field.
 * If evidence quote is missing or not a substring of OCR text, the field is dropped.
 * @param {object} field - { value, confidence, evidenceQuote }
 * @param {string} ocrText - normalized/masked OCR text
 * @returns {object} { field, dropped: boolean, reason?: string }
 */
export function verifyFieldEvidence(field, ocrText) {
  if (!field || field.value === null || field.value === undefined) {
    return {
      field: { value: null, confidence: 0, evidenceQuote: null },
      dropped: false,
    };
  }

  if (!field.evidenceQuote) {
    return {
      field: { value: null, confidence: 0, evidenceQuote: null },
      dropped: true,
      reason: 'No evidence quote provided for field',
    };
  }

  if (!isQuoteInText(ocrText, field.evidenceQuote)) {
    return {
      field: { value: null, confidence: 0, evidenceQuote: null },
      dropped: true,
      reason: `Evidence quote "${field.evidenceQuote}" is not a substring of the OCR text`,
    };
  }

  return {
    field,
    dropped: false,
  };
}

/**
 * Apply evidence check across all fields in an extraction object
 * @param {Record<string, { value: any, confidence: number, evidenceQuote?: string }>} extractedFields
 * @param {string} ocrText
 * @returns {{ fields: Record<string, any>, droppedFields: Record<string, string> }}
 */
export function checkAllEvidence(extractedFields, ocrText) {
  const verified = {};
  const dropped = {};

  for (const [key, field] of Object.entries(extractedFields || {})) {
    if (!field || typeof field !== 'object') {
      verified[key] = { value: null, confidence: 0, evidenceQuote: null };
      continue;
    }

    const result = verifyFieldEvidence(field, ocrText);
    verified[key] = result.field;
    if (result.dropped) {
      dropped[key] = result.reason;
    }
  }

  return { fields: verified, droppedFields: dropped };
}

export default {
  normalizeWhitespace,
  isQuoteInText,
  verifyFieldEvidence,
  checkAllEvidence,
};
