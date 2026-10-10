/**
 * ComplianceOS — VEDA Pipeline: Classify
 * Pure function: determines document type.
 */

import { classifyDocType, DOC_TYPES } from '../classify.js';

export async function runClassify(text, options = {}) {
  const docType = await classifyDocType(text, options);
  return { docType };
}

export default runClassify;
