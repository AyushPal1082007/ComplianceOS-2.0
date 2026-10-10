/**
 * ComplianceOS — VEDA Document Extraction Schemas
 * Each extracted field follows: { value: T, confidence: number, evidenceQuote: string }
 */

import { z } from 'zod';

/**
 * Helper to build an extracted field schema with evidence quote & confidence
 * @param {z.ZodTypeAny} valueSchema
 */
export function extractedField(valueSchema) {
  return z.object({
    value: valueSchema.nullable().default(null),
    confidence: z.number().min(0).max(1).default(0),
    evidenceQuote: z.string().nullable().default(null),
  });
}

export { GstCertificateSchema } from './gstCertificate.js';
export { UdyamCertificateSchema } from './udyamCertificate.js';
export { GstNoticeSchema } from './gstNotice.js';
export { ChallanAckSchema } from './challanAck.js';
export { LicenceInvoiceSchema } from './licenceInvoice.js';
