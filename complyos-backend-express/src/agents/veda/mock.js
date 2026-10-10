/**
 * ComplianceOS — VEDA Mock Runner
 * Used when VEDA_REAL=false or in testing environments.
 * Returns valid AgentOutput conforming strictly to contracts.stub.js.
 */

import { FIXTURES } from './fixtures/samples.js';
import { AgentOutputSchema } from './stubs/contracts.stub.js';

/**
 * Return schema-valid mock AgentOutput for an input event
 * @param {object} input - AgentInput
 * @returns {object} AgentOutput
 */
export function runMock(input = {}) {
  const event = input.event || {};
  const sampleKey = event.sampleKey || 'gst_cert_valid';
  const sample = FIXTURES[sampleKey] || FIXTURES.gst_cert_valid;
  const now = new Date().toISOString();

  const profilePatch = {
    gstin: {
      value: '09AAECP1234F1Z5',
      status: 'VERIFIED',
      confidence: 0.98,
      source: 'veda_doc',
      evidence: {
        docId: input.event?.docId || 'mock-doc-1',
        quote: 'Registration Number: 09AAECP1234F1Z5',
      },
      updatedAt: now,
    },
    gstRegistered: {
      value: true,
      status: 'VERIFIED',
      confidence: 0.98,
      source: 'veda_doc',
      evidence: {
        docId: input.event?.docId || 'mock-doc-1',
        quote: 'Registration Number: 09AAECP1234F1Z5',
      },
      updatedAt: now,
    },
    state: {
      value: 'Uttar Pradesh',
      status: 'VERIFIED',
      confidence: 0.95,
      source: 'veda_doc',
      evidence: {
        docId: input.event?.docId || 'mock-doc-1',
        quote: 'Lucknow, Uttar Pradesh',
      },
      updatedAt: now,
    },
    constitution: {
      value: 'Private Limited Company',
      status: 'VERIFIED',
      confidence: 0.96,
      source: 'veda_doc',
      evidence: {
        docId: input.event?.docId || 'mock-doc-1',
        quote: 'Constitution of Business: Private Limited Company',
      },
      updatedAt: now,
    },
  };

  const calendarItems = [
    {
      id: 'statutory-gstr-1',
      title: 'GSTR-1 (Outward Supplies)',
      deadlineDate: '2026-11-11',
      urgency: 'high',
      category: 'GST',
      description: 'Monthly return for outward supplies',
      sourceUrl: 'https://gst.gov.in',
    },
    {
      id: 'statutory-gstr-3b',
      title: 'GSTR-3B (Summary Return & Tax Payment)',
      deadlineDate: '2026-11-20',
      urgency: 'high',
      category: 'GST',
      description: 'Monthly summary return and tax payment',
      sourceUrl: 'https://gst.gov.in',
    },
  ];

  const claims = [
    {
      text: 'Verified GSTIN 09AAECP1234F1Z5 from FORM GST REG-06',
      sourceUrl: 'https://services.gst.gov.in/services/searchtp',
      lastVerified: '2026-09-30',
      basis: 'document',
      confidence: 0.98,
    },
    {
      text: 'Statutory deadline for GSTR-1: 2026-11-11',
      sourceUrl: 'https://gst.gov.in',
      lastVerified: '2026-09-30',
      basis: 'code_rule',
      confidence: 1.0,
    },
  ];

  const messages = [
    {
      type: 'text',
      text: `✅ GST Registration Certificate verify ho gaya hai.\n\n• GSTIN: 09AAECP1234F1Z5\n• Business: SHARMA ENTERPRISES PRIVATE LIMITED\n• State: Uttar Pradesh\n• Health Score: 95/100\n\nYeh jaankari sirf samajhne ke liye hai, professional salaah nahi.`,
    },
    {
      type: 'option_card',
      title: 'Next Actions',
      options: [
        { id: 'share_ca', label: '🤝 CA ko share karein', value: { action: 'share_ca' } },
        { id: 'view_calendar', label: '📅 Compliance Calendar dekhein', value: { action: 'view_calendar' } },
      ],
    },
  ];

  const trace = [
    {
      runId: input.runId || 'mock-run',
      agent: 'VEDA',
      node: 'mock',
      startedAt: now,
      durationMs: 5,
      inputSummary: 'Mock mode execution',
      outputSummary: 'Mock output generated successfully',
      status: 'done',
    },
  ];

  const output = {
    status: 'OK',
    profilePatch,
    messages,
    claims,
    calendarItems,
    trace,
    costs: {
      llmTokens: 0,
      tinyfishAgentCalls: 0,
    },
  };

  return AgentOutputSchema.parse(output);
}

export default runMock;
