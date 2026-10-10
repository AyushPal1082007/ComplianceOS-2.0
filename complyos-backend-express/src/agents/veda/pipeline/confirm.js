/**
 * ComplianceOS — VEDA Pipeline: Confirm
 * Pure functions for building confirm card and applying resume actions.
 */

import { buildConfirmCard, applyUserAction } from '../confirm.js';

export function runConfirmCard(pendingConfirmations, locale = 'hinglish') {
  return buildConfirmCard(pendingConfirmations, locale);
}

export function runApplyConfirmAction(actionPayload, pendingList) {
  return applyUserAction(actionPayload, pendingList);
}

export default {
  runConfirmCard,
  runApplyConfirmAction,
};
