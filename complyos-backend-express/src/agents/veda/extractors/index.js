/**
 * ComplianceOS — VEDA Extractors Registry
 */

import { extractGstCertificate } from './gstCertificate.js';
import { extractUdyamCertificate } from './udyamCertificate.js';
import { extractGstNotice } from './gstNotice.js';
import { extractChallanAck } from './challanAck.js';
import { extractLicenceInvoice } from './licenceInvoice.js';
import { DOC_TYPES } from '../classify.js';

export {
  extractGstCertificate,
  extractUdyamCertificate,
  extractGstNotice,
  extractChallanAck,
  extractLicenceInvoice,
};

export const EXTRACTORS = {
  [DOC_TYPES.GST_CERTIFICATE]: extractGstCertificate,
  [DOC_TYPES.UDYAM_CERTIFICATE]: extractUdyamCertificate,
  [DOC_TYPES.GST_NOTICE]: extractGstNotice,
  [DOC_TYPES.CHALLAN_ACK]: extractChallanAck,
  [DOC_TYPES.LICENCE_INVOICE]: extractLicenceInvoice,
};

/**
 * Run extraction for a given docType
 * @param {string} docType
 * @param {string} ocrText
 * @param {object} [options]
 * @returns {Promise<{ fields: Record<string, any>, gated: Record<string, any>, validatorResults: Record<string, any[]>, tokens: number }>}
 */
export async function extractByDocType(docType, ocrText, options = {}) {
  const extractor = EXTRACTORS[docType];
  if (!extractor) {
    throw new Error(`No extractor registered for document type: ${docType}`);
  }
  return extractor(ocrText, options);
}

export default {
  EXTRACTORS,
  extractByDocType,
};
