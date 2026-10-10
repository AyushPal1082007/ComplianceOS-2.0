/**
 * Pipeline Integration Tests (Text-only fixtures, no network calls)
 * node --test src/agents/veda/__tests__/pipeline.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { FIXTURES } from '../fixtures/samples.js';
import { runClassify } from '../pipeline/classify.js';
import { extractGstCertificate } from '../extractors/gstCertificate.js';
import { extractUdyamCertificate } from '../extractors/udyamCertificate.js';
import { extractGstNotice } from '../extractors/gstNotice.js';
import { extractChallanAck } from '../extractors/challanAck.js';
import { extractLicenceInvoice } from '../extractors/licenceInvoice.js';

describe('Document Classification (Text-only)', () => {
  test('classifies GST Certificate correctly', async () => {
    const { docType } = await runClassify(FIXTURES.gst_cert_valid.ocrText);
    assert.equal(docType, 'GST_CERTIFICATE');
  });

  test('classifies Udyam Certificate correctly', async () => {
    const { docType } = await runClassify(FIXTURES.udyam_cert_valid.ocrText);
    assert.equal(docType, 'UDYAM_CERTIFICATE');
  });

  test('classifies GST Notice DRC-01 correctly', async () => {
    const { docType } = await runClassify(FIXTURES.gst_notice_demand.ocrText);
    assert.equal(docType, 'GST_NOTICE');
  });

  test('classifies Challan PMT-06 correctly', async () => {
    const { docType } = await runClassify(FIXTURES.challan_ack_valid.ocrText);
    assert.equal(docType, 'CHALLAN_ACK');
  });

  test('classifies FSSAI Licence correctly', async () => {
    const { docType } = await runClassify(FIXTURES.fssai_licence_valid.ocrText);
    assert.equal(docType, 'LICENCE_INVOICE');
  });

  test('classifies Bilingual/Hindi Udyam sample correctly', async () => {
    const { docType } = await runClassify(FIXTURES.hindi_udyam_sample.ocrText);
    assert.equal(docType, 'UDYAM_CERTIFICATE');
  });

  test('classifies Noisy OCR sample correctly', async () => {
    const { docType } = await runClassify(FIXTURES.noisy_ocr_gst_cert.ocrText);
    assert.equal(docType, 'GST_CERTIFICATE');
  });
});

describe('Document Extraction per Type (No Network)', () => {
  test('extracts GST Certificate and validates checksum & state', async () => {
    const mockLlm = async () => ({
      data: {
        gstin: { value: '09AAECP1234F1ZP', confidence: 0.95, evidenceQuote: 'Registration Number: 09AAECP1234F1ZP' },
        legalName: { value: 'SHARMA ENTERPRISES PRIVATE LIMITED', confidence: 0.95, evidenceQuote: 'SHARMA ENTERPRISES PRIVATE LIMITED' },
        tradeName: { value: 'SHARMA SWEETS & BAKERS', confidence: 0.9, evidenceQuote: 'SHARMA SWEETS & BAKERS' },
        state: { value: 'Uttar Pradesh', confidence: 0.95, evidenceQuote: 'Uttar Pradesh' },
        registrationType: { value: 'Regular', confidence: 0.9, evidenceQuote: 'Regular' },
        constitution: { value: 'Private Limited Company', confidence: 0.95, evidenceQuote: 'Private Limited Company' },
        dateOfRegistration: { value: '05/04/2024', confidence: 0.9, evidenceQuote: '05/04/2024' },
        address: { value: 'Lucknow, Uttar Pradesh', confidence: 0.9, evidenceQuote: 'Lucknow, Uttar Pradesh' },
      },
      tokens: 250,
    });

    const res = await extractGstCertificate(FIXTURES.gst_cert_valid.ocrText, { llmCaller: mockLlm });
    assert.equal(res.gated.gstin.status, 'VERIFIED');
    assert.equal(res.gated.gstin.value, '09AAECP1234F1ZP');
    assert.equal(res.gated.dateOfRegistration.status, 'VERIFIED');
  });

  test('extracts Udyam Certificate with Udyam regex check', async () => {
    const mockLlm = async () => ({
      data: {
        udyamNumber: { value: 'UDYAM-UP-28-0012345', confidence: 0.95, evidenceQuote: 'UDYAM-UP-28-0012345' },
        enterpriseName: { value: 'VERMA PLASTICS MANUFACTURING', confidence: 0.9, evidenceQuote: 'VERMA PLASTICS MANUFACTURING' },
        enterpriseType: { value: 'micro', confidence: 0.9, evidenceQuote: 'MICRO' },
        activity: { value: 'MANUFACTURING', confidence: 0.9, evidenceQuote: 'MANUFACTURING' },
        nicCode: { value: '22209', confidence: 0.9, evidenceQuote: '22209' },
        state: { value: 'UTTAR PRADESH', confidence: 0.9, evidenceQuote: 'STATE: UTTAR PRADESH' },
        district: { value: 'KANPUR NAGAR', confidence: 0.9, evidenceQuote: 'DISTRICT: KANPUR NAGAR' },
        dateOfRegistration: { value: '20/08/2021', confidence: 0.9, evidenceQuote: '20/08/2021' },
      },
      tokens: 220,
    });

    const res = await extractUdyamCertificate(FIXTURES.udyam_cert_valid.ocrText, { llmCaller: mockLlm });
    assert.equal(res.gated.udyamNumber.status, 'VERIFIED');
    assert.equal(res.gated.udyamNumber.value, 'UDYAM-UP-28-0012345');
  });

  test('extracts GST Notice with date order and amount verification', async () => {
    const mockLlm = async () => ({
      data: {
        noticeType: { value: 'Show Cause Notice', confidence: 0.9, evidenceQuote: 'Show Cause Notice under Section 73' },
        section: { value: 'Section 73', confidence: 0.9, evidenceQuote: 'Section 73' },
        issuingOffice: { value: 'COMMERCIAL TAX DEPARTMENT, NOIDA', confidence: 0.9, evidenceQuote: 'COMMERCIAL TAX DEPARTMENT, NOIDA' },
        dateOfNotice: { value: '10/01/2025', confidence: 0.9, evidenceQuote: 'Date of Notice: 10/01/2025' },
        replyDueDate: { value: '10/02/2025', confidence: 0.95, evidenceQuote: '10/02/2025' },
        amountDemanded: { value: 57600, confidence: 0.95, evidenceQuote: '57,600.00' },
        period: { value: 'FY 2022-23', confidence: 0.9, evidenceQuote: 'FY 2022-23' },
        gstin: { value: '09AAECP1234F1ZP', confidence: 0.95, evidenceQuote: '09AAECP1234F1ZP' },
      },
      tokens: 280,
    });

    const res = await extractGstNotice(FIXTURES.gst_notice_demand.ocrText, { llmCaller: mockLlm });
    assert.equal(res.gated.replyDueDate.status, 'VERIFIED');
    assert.equal(res.gated.amountDemanded.status, 'VERIFIED');
    assert.equal(res.gated.amountDemanded.value, 57600);
  });
});
