/**
 * ComplianceOS — VEDA Profile Merge Policy
 * Enforces Hard Rule 8:
 * - VERIFIED is never overwritten by SELF_REPORTED.
 * - VERIFIED beats SELF_REPORTED.
 * - A document value that conflicts with a self-reported value => NEEDS_CONFIRMATION
 *   with a clear question: "Aapne [X] bataya tha, [doc] mein [Y] hai. Kaunsa sahi hai?"
 * - Allowed profile fields to update: gstin, gstRegistered, state, constitution,
 *   udyamNumber, udyamRegistered, district, subSector.
 */

export const ALLOWED_PROFILE_KEYS = new Set([
  'gstin',
  'gstRegistered',
  'state',
  'constitution',
  'udyamNumber',
  'udyamRegistered',
  'district',
  'subSector',
]);

/**
 * Maps document extracted fields to standardized profile fields
 * @param {string} docType
 * @param {Record<string, any>} gatedFields
 * @returns {Record<string, any>}
 */
export function mapDocFieldsToProfile(docType, gatedFields) {
  const mapped = {};

  if (docType === 'GST_CERTIFICATE') {
    if (gatedFields.gstin?.value) {
      mapped.gstin = { ...gatedFields.gstin };
      mapped.gstRegistered = {
        value: true,
        status: gatedFields.gstin.status,
        confidence: gatedFields.gstin.confidence,
        evidenceQuote: gatedFields.gstin.evidenceQuote,
      };
    }
    if (gatedFields.state?.value) {
      mapped.state = { ...gatedFields.state };
    }
    if (gatedFields.constitution?.value) {
      mapped.constitution = { ...gatedFields.constitution };
    }
  } else if (docType === 'UDYAM_CERTIFICATE') {
    if (gatedFields.udyamNumber?.value) {
      mapped.udyamNumber = { ...gatedFields.udyamNumber };
      mapped.udyamRegistered = {
        value: true,
        status: gatedFields.udyamNumber.status,
        confidence: gatedFields.udyamNumber.confidence,
        evidenceQuote: gatedFields.udyamNumber.evidenceQuote,
      };
    }
    if (gatedFields.state?.value) {
      mapped.state = { ...gatedFields.state };
    }
    if (gatedFields.district?.value) {
      mapped.district = { ...gatedFields.district };
    }
    if (gatedFields.activity?.value) {
      mapped.subSector = { ...gatedFields.activity };
    }
  }

  return mapped;
}

/**
 * Normalize value for comparison (trim, lower, string conversion)
 */
function normalizeValue(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim().toLowerCase();
}

/**
 * Merge document fields into existing profile according to strict precedence rules
 * @param {object} existingProfile - Current profile { [key]: Field | primitive }
 * @param {Record<string, any>} mappedDocFields - fields mapped from document
 * @param {object} [context] - { docType, docId }
 * @returns {{
 *   patch: Record<string, any>,
 *   conflicts: Array<{ key: string, existingValue: any, docValue: any, question: string }>
 * }}
 */
export function mergeProfileFields(existingProfile = {}, mappedDocFields = {}, context = {}) {
  const patch = {};
  const conflicts = [];
  const now = new Date().toISOString();
  const docLabel = context.docType === 'GST_CERTIFICATE' ? 'GST certificate' :
                   context.docType === 'UDYAM_CERTIFICATE' ? 'Udyam certificate' : 'document';

  for (const [key, docField] of Object.entries(mappedDocFields)) {
    if (!ALLOWED_PROFILE_KEYS.has(key)) continue;
    if (!docField || docField.value === null || docField.value === undefined) continue;

    const existing = existingProfile[key];
    const existingVal = (existing && typeof existing === 'object' && 'value' in existing)
      ? existing.value
      : existing;
    const existingStatus = (existing && typeof existing === 'object' && existing.status)
      ? existing.status
      : (existingVal !== undefined && existingVal !== null ? 'SELF_REPORTED' : 'EMPTY');

    // Case 1: No existing value
    if (existingStatus === 'EMPTY' || existingVal === undefined || existingVal === null || existingVal === '') {
      patch[key] = {
        value: docField.value,
        status: docField.status === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_CONFIRMATION',
        confidence: docField.confidence,
        source: docField.source || 'veda_doc',
        evidence: {
          docId: context.docId,
          quote: docField.evidenceQuote,
        },
        updatedAt: now,
      };
      continue;
    }

    // Case 2: Values are the same
    if (normalizeValue(existingVal) === normalizeValue(docField.value)) {
      patch[key] = {
        value: docField.value,
        status: docField.status === 'VERIFIED' ? 'VERIFIED' : existingStatus,
        confidence: Math.max(docField.confidence, (existing && existing.confidence) || 0),
        source: docField.source || 'veda_doc',
        evidence: {
          docId: context.docId,
          quote: docField.evidenceQuote,
        },
        updatedAt: now,
      };
      continue;
    }

    // Case 3: Values CONFLICT!
    // "Aapne Kanpur bataya tha, GST certificate mein Lucknow hai. Kaunsa sahi hai?"
    const question = `Aapne ${existingVal} bataya tha, ${docLabel} mein ${docField.value} hai. Kaunsa sahi hai?`;
    conflicts.push({
      key,
      existingValue: existingVal,
      docValue: docField.value,
      question,
      evidenceQuote: docField.evidenceQuote,
    });

    patch[key] = {
      value: docField.value,
      status: 'NEEDS_CONFIRMATION',
      confidence: docField.confidence,
      source: 'veda_doc',
      evidence: {
        docId: context.docId,
        quote: docField.evidenceQuote,
      },
      conflict: {
        existingValue: existingVal,
        question,
      },
      updatedAt: now,
    };
  }

  return { patch, conflicts };
}

export default {
  ALLOWED_PROFILE_KEYS,
  mapDocFieldsToProfile,
  mergeProfileFields,
};
