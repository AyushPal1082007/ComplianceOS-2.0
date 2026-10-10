/**
 * ComplianceOS — VEDA Pipeline: Evidence Check
 * Pure function: drops fields whose evidence quotes are not substrings of OCR text.
 */

import { checkAllEvidence } from '../extractors/evidenceCheck.js';

export function runEvidenceCheck(rawFields, ocrText) {
  return checkAllEvidence(rawFields, ocrText);
}

export default runEvidenceCheck;
