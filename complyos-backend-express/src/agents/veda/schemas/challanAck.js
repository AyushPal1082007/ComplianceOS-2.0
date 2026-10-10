/**
 * Schema for Challan / Return Acknowledgement (PMT-06, GSTR Ack, etc.)
 */

import { z } from 'zod';
import { extractedField } from './index.js';

export const ChallanAckSchema = z.object({
  period: extractedField(z.string()),
  returnType: extractedField(z.string()),
  amountPaid: extractedField(z.string().or(z.number())),
  dateFiled: extractedField(z.string()),
});

export default ChallanAckSchema;
