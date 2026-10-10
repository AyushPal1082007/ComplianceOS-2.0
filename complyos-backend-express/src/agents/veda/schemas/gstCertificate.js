/**
 * Schema for GST Registration Certificate (FORM GST REG-06)
 */

import { z } from 'zod';
import { extractedField } from './index.js';

export const GstCertificateSchema = z.object({
  gstin: extractedField(z.string()),
  legalName: extractedField(z.string()),
  tradeName: extractedField(z.string()),
  state: extractedField(z.string()),
  registrationType: extractedField(z.string()),
  constitution: extractedField(z.string()),
  dateOfRegistration: extractedField(z.string()),
  address: extractedField(z.string()),
});

export default GstCertificateSchema;
