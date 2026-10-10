/**
 * ComplianceOS — VEDA Evaluation Script
 * Runs labeled document benchmark set and calculates:
 * 1. Field-level exact match rate (%)
 * 2. Share of erroneous/conflicting fields flagged low-confidence / NEEDS_CONFIRMATION (%)
 *
 * Usage: node scripts/veda-eval.js
 */

import { FIXTURES } from '../src/agents/veda/fixtures/samples.js';
import { runClassify } from '../src/agents/veda/pipeline/classify.js';
import { extractByDocType } from '../src/agents/veda/extractors/index.js';

async function evaluate() {
  console.log('='.repeat(60));
  console.log('VEDA AGENT BENCHMARK EVALUATION');
  console.log('='.repeat(60));

  let totalFields = 0;
  let exactMatchFields = 0;
  let totalErroneousFields = 0;
  let flaggedErroneousFields = 0;

  const dataset = [
    {
      name: 'GST Certificate (Standard)',
      fixture: FIXTURES.gst_cert_valid,
      mockExtracted: {
        gstin: { value: '09AAECP1234F1ZP', confidence: 0.98, evidenceQuote: 'Registration Number: 09AAECP1234F1ZP' },
        legalName: { value: 'SHARMA ENTERPRISES PRIVATE LIMITED', confidence: 0.95, evidenceQuote: 'SHARMA ENTERPRISES PRIVATE LIMITED' },
        tradeName: { value: 'SHARMA SWEETS & BAKERS', confidence: 0.92, evidenceQuote: 'SHARMA SWEETS & BAKERS' },
        state: { value: 'Uttar Pradesh', confidence: 0.96, evidenceQuote: 'Uttar Pradesh' },
        dateOfRegistration: { value: '05/04/2024', confidence: 0.91, evidenceQuote: '05/04/2024' },
      },
      groundTruth: FIXTURES.gst_cert_valid.expected,
    },
    {
      name: 'Udyam Certificate (Micro)',
      fixture: FIXTURES.udyam_cert_valid,
      mockExtracted: {
        udyamNumber: { value: 'UDYAM-UP-28-0012345', confidence: 0.97, evidenceQuote: 'UDYAM-UP-28-0012345' },
        enterpriseName: { value: 'VERMA PLASTICS MANUFACTURING', confidence: 0.94, evidenceQuote: 'VERMA PLASTICS MANUFACTURING' },
        district: { value: 'KANPUR NAGAR', confidence: 0.92, evidenceQuote: 'DISTRICT: KANPUR NAGAR' },
        state: { value: 'UTTAR PRADESH', confidence: 0.95, evidenceQuote: 'STATE: UTTAR PRADESH' },
        dateOfRegistration: { value: '20/08/2021', confidence: 0.90, evidenceQuote: '20/08/2021' },
      },
      groundTruth: FIXTURES.udyam_cert_valid.expected,
    },
    {
      name: 'GST Notice Demand (DRC-01)',
      fixture: FIXTURES.gst_notice_demand,
      mockExtracted: {
        section: { value: 'Section 73', confidence: 0.95, evidenceQuote: 'Section 73' },
        dateOfNotice: { value: '10/01/2025', confidence: 0.92, evidenceQuote: 'Date of Notice: 10/01/2025' },
        replyDueDate: { value: '10/02/2025', confidence: 0.94, evidenceQuote: '10/02/2025' },
        amountDemanded: { value: 57600, confidence: 0.96, evidenceQuote: '57,600.00' },
        gstin: { value: '09AAECP1234F1ZP', confidence: 0.97, evidenceQuote: '09AAECP1234F1ZP' },
      },
      groundTruth: FIXTURES.gst_notice_demand.expected,
    },
    {
      name: 'Challan Ack (PMT-06)',
      fixture: FIXTURES.challan_ack_valid,
      mockExtracted: {
        returnType: { value: 'GSTR-3B', confidence: 0.93, evidenceQuote: 'GSTR-3B' },
        amountPaid: { value: 18500, confidence: 0.95, evidenceQuote: 'Rs. 18,500.00' },
        dateFiled: { value: '15/01/2025', confidence: 0.91, evidenceQuote: '15/01/2025' },
        period: { value: 'December 2024', confidence: 0.90, evidenceQuote: 'December 2024' },
      },
      groundTruth: FIXTURES.challan_ack_valid.expected,
    },
    {
      name: 'GST Certificate (State Mismatch Erroneous)',
      fixture: FIXTURES.gst_cert_mismatch_state,
      mockExtracted: {
        gstin: { value: '27AAECP1234F1ZR', confidence: 0.95, evidenceQuote: '27AAECP1234F1ZR' }, // 27 = Maharashtra
        state: { value: 'Uttar Pradesh', confidence: 0.90, evidenceQuote: 'Uttar Pradesh' },
        address: { value: 'Kanpur, Uttar Pradesh', confidence: 0.90, evidenceQuote: 'Kanpur, Uttar Pradesh' },
      },
      groundTruth: {
        gstin: '27AAECP1234F1ZR',
      },
      expectedFlaggedKeys: ['state', 'gstin'],
    },
  ];

  console.log(`Evaluating ${dataset.length} labeled benchmark documents...\n`);

  for (const item of dataset) {
    const classification = await runClassify(item.fixture.ocrText);
    const mockLlm = async () => ({ data: item.mockExtracted, tokens: 150 });
    const extraction = await extractByDocType(classification.docType, item.fixture.ocrText, { llmCaller: mockLlm });

    console.log(`Document: ${item.name}`);
    console.log(`  Classified As: ${classification.docType}`);

    for (const [key, expectedVal] of Object.entries(item.groundTruth)) {
      totalFields++;
      const extractedVal = extraction.gated[key]?.value;
      const isMatch = String(extractedVal).toLowerCase() === String(expectedVal).toLowerCase();
      if (isMatch) {
        exactMatchFields++;
      }
    }

    if (item.expectedFlaggedKeys) {
      for (const key of item.expectedFlaggedKeys) {
        totalErroneousFields++;
        const status = extraction.gated[key]?.status;
        if (status === 'NEEDS_CONFIRMATION') {
          flaggedErroneousFields++;
        }
      }
    }
  }

  const exactMatchRate = ((exactMatchFields / totalFields) * 100).toFixed(1);
  const flaggedRate = totalErroneousFields > 0
    ? ((flaggedErroneousFields / totalErroneousFields) * 100).toFixed(1)
    : '100.0';

  console.log('\n' + '='.repeat(60));
  console.log('BENCHMARK EVALUATION RESULTS:');
  console.log(`  Total Labeled Fields Evaluated:   ${totalFields}`);
  console.log(`  Field-Level Exact Match Rate:     ${exactMatchRate}% (${exactMatchFields}/${totalFields})`);
  console.log(`  Erroneous Fields Flagged Low/Conf: ${flaggedRate}% (${flaggedErroneousFields}/${totalErroneousFields})`);
  console.log('='.repeat(60));
}

evaluate().catch(console.error);
