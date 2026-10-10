/**
 * ComplianceOS — VEDA Pipeline: Mask
 * Pure function: sanitizes OCR text by masking Aadhaar numbers and credentials.
 */

import { maskSensitiveTokens } from '../mask.js';

export function runMask(text) {
  return maskSensitiveTokens(text);
}

export default runMask;
