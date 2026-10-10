/**
 * ComplianceOS — VEDA Pipeline: Ask Doc Type
 * Generates option_card for selecting document type.
 */

import { buildAskDocTypeCard } from '../confirm.js';

export function runAskDocType(locale = 'hinglish') {
  return buildAskDocTypeCard(locale);
}

export default runAskDocType;
