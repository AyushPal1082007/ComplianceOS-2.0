/**
 * ComplianceOS — VEDA Pipeline: Extract
 * Pure function: invokes LLM with doc-specific prompt and schema to extract raw fields.
 */

import { BASE_SYSTEM_PROMPT, PROMPTS_BY_DOC_TYPE } from '../prompts/index.js';
import {
  GstCertificateSchema,
  UdyamCertificateSchema,
  GstNoticeSchema,
  ChallanAckSchema,
  LicenceInvoiceSchema,
} from '../schemas/index.js';
import { completeJson } from '../stubs/groq.stub.js';

const SCHEMAS_BY_TYPE = {
  GST_CERTIFICATE: GstCertificateSchema,
  UDYAM_CERTIFICATE: UdyamCertificateSchema,
  GST_NOTICE: GstNoticeSchema,
  CHALLAN_ACK: ChallanAckSchema,
  LICENCE_INVOICE: LicenceInvoiceSchema,
};

export async function runExtract({ docType, ocrText, llmCaller = null }) {
  const prompt = PROMPTS_BY_DOC_TYPE[docType];
  const schema = SCHEMAS_BY_TYPE[docType];

  if (!prompt || !schema) {
    throw new Error(`Unsupported document type for extraction: ${docType}`);
  }

  const caller = llmCaller || (async (params) => completeJson(params));

  const result = await caller({
    systemPrompt: `${BASE_SYSTEM_PROMPT}\n\n${prompt}`,
    userPrompt: `DOCUMENT OCR TEXT:\n${ocrText}`,
    schema,
  });

  return {
    rawFields: result.data || {},
    tokens: result.tokens || 0,
  };
}

export default runExtract;
