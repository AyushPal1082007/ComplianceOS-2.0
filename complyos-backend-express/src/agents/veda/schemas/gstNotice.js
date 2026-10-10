/**
 * Schema for GST Notice / Demand (ASMT-10, DRC-01, SCN, etc.)
 */

import { z } from 'zod';
import { extractedField } from './index.js';

export const GstNoticeSchema = z.object({
  noticeType: extractedField(z.string()),
  section: extractedField(z.string()),
  issuingOffice: extractedField(z.string()),
  dateOfNotice: extractedField(z.string()),
  replyDueDate: extractedField(z.string()),
  amountDemanded: extractedField(z.string().or(z.number())),
  period: extractedField(z.string()),
  gstin: extractedField(z.string()),
});

export default GstNoticeSchema;
