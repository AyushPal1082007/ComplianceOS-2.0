/**
 * Schema for Licence / Tax Invoice (FSSAI, Trade Licence, Factory Licence, Invoice)
 */

import { z } from 'zod';
import { extractedField } from './index.js';

export const LicenceInvoiceSchema = z.object({
  licenceType: extractedField(z.string()),
  number: extractedField(z.string()),
  validFrom: extractedField(z.string()),
  validTo: extractedField(z.string()),
  issuingAuthority: extractedField(z.string()),
});

export default LicenceInvoiceSchema;
