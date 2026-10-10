/**
 * Schema for Udyam Registration Certificate
 */

import { z } from 'zod';
import { extractedField } from './index.js';

export const UdyamCertificateSchema = z.object({
  udyamNumber: extractedField(z.string()),
  enterpriseName: extractedField(z.string()),
  enterpriseType: extractedField(z.enum(['micro', 'small', 'medium', 'MICRO', 'SMALL', 'MEDIUM']).or(z.string())),
  activity: extractedField(z.string()),
  nicCode: extractedField(z.string()),
  state: extractedField(z.string()),
  district: extractedField(z.string()),
  dateOfRegistration: extractedField(z.string()),
});

export default UdyamCertificateSchema;
