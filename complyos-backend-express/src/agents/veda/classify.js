/**
 * ComplianceOS — VEDA Document Classifier
 * Classifies document type using deterministic keywords & regex first.
 * Returns: GST_CERTIFICATE | UDYAM_CERTIFICATE | GST_NOTICE | CHALLAN_ACK | LICENCE_INVOICE | UNKNOWN
 * Falls back to Groq LLM only if deterministic rules are unsure.
 */

import config from '../../config.js';
import logger from '../../logger.js';

export const DOC_TYPES = {
  GST_CERTIFICATE: 'GST_CERTIFICATE',
  UDYAM_CERTIFICATE: 'UDYAM_CERTIFICATE',
  GST_NOTICE: 'GST_NOTICE',
  CHALLAN_ACK: 'CHALLAN_ACK',
  LICENCE_INVOICE: 'LICENCE_INVOICE',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Deterministic rule-based classification based on keywords and patterns
 * @param {string} text
 * @returns {string|null} Doc type or null if unsure
 */
export function classifyByRules(text) {
  if (!text || typeof text !== 'string') return DOC_TYPES.UNKNOWN;

  const upper = text.toUpperCase();

  // 1. Udyam Registration Certificate (checked first because it contains "REGISTRATION CERTIFICATE")
  if (
    upper.includes('UDYAM REGISTRATION CERTIFICATE') ||
    upper.includes('MINISTRY OF MICRO, SMALL & MEDIUM ENTERPRISES') ||
    upper.includes('UDYAM-') ||
    (upper.includes('UDYAM') && (upper.includes('ENTERPRISE') || upper.includes('पंजीकरण')))
  ) {
    return DOC_TYPES.UDYAM_CERTIFICATE;
  }

  // 2. GST Registration Certificate
  if (
    upper.includes('FORM GST REG-06') ||
    /F[O0]RM\s+GST\s+REG[ -]?0?6/i.test(upper) ||
    ((upper.includes('REGISTRATION CERTIFICATE') || /REG[1I]STRAT[1I0O]+N/i.test(upper)) &&
     (upper.includes('GOODS AND SERVICES TAX') || upper.includes('GSTIN') || upper.includes('GST') || /09[A-Z0-9]{13}/.test(upper))) ||
    /GOVERNMENT OF INDIA.*REGISTRATION CERTIFICATE/s.test(upper) ||
    (upper.includes('GSTIN') && upper.includes('LEGAL NAME') && upper.includes('TRADE NAME'))
  ) {
    return DOC_TYPES.GST_CERTIFICATE;
  }

  // 3. GST Notice / Demand / SCN
  if (
    upper.includes('ASMT-10') ||
    upper.includes('DRC-01') ||
    upper.includes('SHOW CAUSE NOTICE') ||
    upper.includes('DEMAND ORDER') ||
    upper.includes('FORM GST DRC') ||
    upper.includes('SECTION 73') ||
    upper.includes('SECTION 74') ||
    (upper.includes('NOTICE') && (upper.includes('TAX DUE') || upper.includes('REPLY') || upper.includes('DISCREPANCY')))
  ) {
    return DOC_TYPES.GST_NOTICE;
  }

  // 4. Challan / Return Acknowledgement
  if (
    upper.includes('PMT-06') ||
    upper.includes('CHALLAN IDENTIFICATION NUMBER') ||
    upper.includes('CPIN') ||
    upper.includes('CHALLAN') && (upper.includes('NEFT') || upper.includes('RTGS') || upper.includes('NET BANKING') || upper.includes('PAID')) ||
    upper.includes('APPLICATION REFERENCE NUMBER') && upper.includes('GSTR') ||
    upper.includes('RETURN FILED') && upper.includes('ARN')
  ) {
    return DOC_TYPES.CHALLAN_ACK;
  }

  // 5. Licence / Invoice
  if (
    upper.includes('FSSAI') ||
    upper.includes('FOOD SAFETY AND STANDARDS') ||
    upper.includes('TRADE LICENCE') ||
    upper.includes('SHOP AND ESTABLISHMENT') ||
    upper.includes('TAX INVOICE') ||
    upper.includes('COMMERCIAL INVOICE') ||
    upper.includes('BILL OF SUPPLY')
  ) {
    return DOC_TYPES.LICENCE_INVOICE;
  }

  return null; // Unsure
}

/**
 * Classify document type (rules first, optional LLM fallback)
 * @param {string} text - OCR text (masked)
 * @param {object} [options]
 * @param {Function} [options.groqClient] - optional LLM caller
 * @returns {Promise<string>}
 */
export async function classifyDocType(text, options = {}) {
  const ruleResult = classifyByRules(text);
  if (ruleResult) {
    return ruleResult;
  }

  // Optional LLM classification fallback if provided and configured
  if (options.groqClient) {
    try {
      const response = await options.groqClient({
        systemPrompt: 'Classify this Indian business document text into exactly one category: GST_CERTIFICATE, UDYAM_CERTIFICATE, GST_NOTICE, CHALLAN_ACK, LICENCE_INVOICE, or UNKNOWN. Return only the category name.',
        userPrompt: text.substring(0, 1500),
      });

      const cleaned = (response || '').trim().toUpperCase();
      if (DOC_TYPES[cleaned]) {
        return DOC_TYPES[cleaned];
      }
    } catch (err) {
      logger.warn('LLM classification failed, falling back to UNKNOWN', { error: err.message });
    }
  }

  return DOC_TYPES.UNKNOWN;
}

export default {
  DOC_TYPES,
  classifyByRules,
  classifyDocType,
};
