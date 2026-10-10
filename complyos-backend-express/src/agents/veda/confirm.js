/**
 * ComplianceOS — VEDA Confirmation Card Builder & Action Resolver
 * Builds confirm_card payloads for human-in-the-loop review.
 * Resolves user confirm/edit actions with deterministic re-validation.
 */

import { validateGstin } from '../../trust/validators/gstin.js';
import { validatePan } from '../../trust/validators/pan.js';
import { validateUdyam } from '../../trust/validators/udyam.js';
import { validateDate } from '../../trust/validators/dates.js';
import { validateAmount } from '../../trust/validators/amounts.js';

const VALIDATOR_BY_KEY = {
  gstin: validateGstin,
  pan: validatePan,
  udyamNumber: validateUdyam,
  dateOfRegistration: validateDate,
  dateOfNotice: validateDate,
  replyDueDate: validateDate,
  dateFiled: validateDate,
  validFrom: validateDate,
  validTo: validateDate,
  amountDemanded: validateAmount,
  amountPaid: validateAmount,
};

const FIELD_LABELS = {
  gstin: 'GSTIN (GST Number)',
  pan: 'PAN Card',
  udyamNumber: 'Udyam Registration Number',
  legalName: 'Legal Business Name',
  tradeName: 'Trade Name',
  state: 'State',
  district: 'District',
  dateOfRegistration: 'Registration Date',
  dateOfNotice: 'Notice Date',
  replyDueDate: 'Reply Due Date',
  amountDemanded: 'Demanded Amount',
  amountPaid: 'Paid Amount',
  period: 'Tax Period',
  constitution: 'Constitution of Business',
};

/**
 * Build a confirm_card OutboundMessage for pending confirmations
 * @param {Array<{ key: string, value: any, evidenceQuote?: string, reasons?: string[], conflict?: object }>} pending
 * @param {string} [locale='hinglish']
 * @returns {object} OutboundMessage shape
 */
export function buildConfirmCard(pending = [], locale = 'hinglish') {
  const items = pending.map((p) => ({
    key: p.key,
    label: FIELD_LABELS[p.key] || p.key,
    value: p.value,
    evidenceQuote: p.evidenceQuote || null,
    reasons: p.reasons || (p.conflict ? [p.conflict.question] : []),
    buttons: [
      { id: `confirm_${p.key}`, action: 'confirm', label: '✅ Sahi' },
      { id: `edit_${p.key}`, action: 'edit', label: '✏️ Badlo' },
    ],
  }));

  const disclaimer = 'Yeh jaankari sirf samajhne ke liye hai, professional salaah nahi.';
  const messageText = locale === 'hi'
    ? `कृपया इन विवरणों की पुष्टि करें:\n${disclaimer}`
    : `Kripya in details ko verify karein:\n${disclaimer}`;

  return {
    type: 'confirm_card',
    text: messageText,
    title: 'Verification Needed',
    card: {
      type: 'confirm_card',
      items,
      disclaimer,
    },
  };
}

/**
 * Build an option_card for UNKNOWN document types
 * @param {string} [locale='hinglish']
 * @returns {object} OutboundMessage shape
 */
export function buildAskDocTypeCard(locale = 'hinglish') {
  return {
    type: 'option_card',
    title: 'Document Type Select',
    text: locale === 'hi'
      ? 'यह किस प्रकार का दस्तावेज़ है? कृपया चुनें:'
      : 'Yeh kis tarah ka document hai? Kripya chunein:',
    options: [
      { id: 'GST_CERTIFICATE', label: 'GST Registration Certificate (REG-06)' },
      { id: 'UDYAM_CERTIFICATE', label: 'Udyam Registration Certificate' },
      { id: 'GST_NOTICE', label: 'GST Notice / Demand (DRC-01, ASMT-10)' },
      { id: 'CHALLAN_ACK', label: 'GST Challan / Filing Ack (PMT-06)' },
      { id: 'LICENCE_INVOICE', label: 'Licence or Tax Invoice' },
    ],
  };
}

/**
 * Apply user confirmation or edit to pending confirmations
 * @param {object} actionPayload - { key: string, action: 'confirm'|'edit', value?: any }
 * @param {Array<object>} pendingList - current pending confirmations
 * @returns {{
 *   remainingPending: Array<object>,
 *   resolved: Array<object>,
 *   revalidationError?: string
 * }}
 */
export function applyUserAction(actionPayload, pendingList = []) {
  if (!actionPayload || !actionPayload.key) {
    return { remainingPending: [...pendingList], resolved: [] };
  }

  const { key, action, value } = actionPayload;
  const targetIndex = pendingList.findIndex((p) => p.key === key);

  if (targetIndex === -1) {
    return { remainingPending: [...pendingList], resolved: [] };
  }

  const target = pendingList[targetIndex];
  const now = new Date().toISOString();

  if (action === 'confirm') {
    const resolvedItem = {
      key,
      value: target.value,
      status: 'VERIFIED',
      confidence: 1.0,
      source: 'user_confirmed',
      evidence: target.evidence || { quote: target.evidenceQuote },
      updatedAt: now,
    };

    const remaining = pendingList.filter((_, idx) => idx !== targetIndex);
    return { remainingPending: remaining, resolved: [resolvedItem] };
  }

  if (action === 'edit') {
    // Re-validate edited value with the deterministic validator
    const validator = VALIDATOR_BY_KEY[key];
    if (validator && value !== undefined && value !== null) {
      const valResult = validator(value);
      if (!valResult.ok) {
        // Edit fails validation -> re-ask via pending confirmations with updated reason!
        const updatedTarget = {
          ...target,
          value,
          reasons: [valResult.reason || 'Invalid format'],
        };
        const updatedPending = [...pendingList];
        updatedPending[targetIndex] = updatedTarget;
        return {
          remainingPending: updatedPending,
          resolved: [],
          revalidationError: valResult.reason,
        };
      }
    }

    const resolvedItem = {
      key,
      value: value !== undefined ? value : target.value,
      status: 'VERIFIED',
      confidence: 1.0,
      source: 'user_confirmed',
      evidence: target.evidence || { quote: target.evidenceQuote },
      updatedAt: now,
    };

    const remaining = pendingList.filter((_, idx) => idx !== targetIndex);
    return { remainingPending: remaining, resolved: [resolvedItem] };
  }

  return { remainingPending: [...pendingList], resolved: [] };
}

export default {
  buildConfirmCard,
  buildAskDocTypeCard,
  applyUserAction,
};
