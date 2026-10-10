/**
 * ComplianceOS — VEDA Mock Runner
 * Extracts REAL data from documents - NO hardcoded values!
 */

import { AgentOutputSchema } from './stubs/contracts.stub.js';
import { getTextMessage } from './messages/index.js';

// Helper: Extract GSTIN from text (e.g., 09AAECP1234F1Z5)
function extractGSTIN(text) {
  const pattern = /[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/gi;
  const match = text.match(pattern);
  return match ? match[0].toUpperCase() : null;
}

// Helper: Extract PAN from text (e.g., AAAPU1234F)
function extractPAN(text) {
  const pattern = /[A-Z]{5}[0-9]{4}[A-Z]{1}/g;
  const match = text.match(pattern);
  return match ? match[0].toUpperCase() : null;
}

// Helper: Extract Udyam number
function extractUdyam(text) {
  const pattern = /UDYAM-[A-Z]{2}-\d{2}-\d{7}/gi;
  const match = text.match(pattern);
  return match ? match[0].toUpperCase() : null;
}

// Helper: Detect document type from content
function detectDocType(text) {
  const t = text.toLowerCase();
  if (t.includes('gst') && t.includes('registration')) return 'GST Registration Certificate';
  if (t.includes('gstr-3b')) return 'GSTR-3B Return';
  if (t.includes('gstr-1')) return 'GSTR-1 Return';
  if (t.includes('udyam') || t.includes('msme')) return 'Udyam Registration';
  if (t.includes('fssai')) return 'FSSAI License';
  if (t.includes('trade license')) return 'Trade License';
  if (t.includes('invoice')) return 'Invoice';
  if (t.includes('bank statement')) return 'Bank Statement';
  return 'Document';
}

// Helper: Build profile patch from extracted data
function buildPatch(extracted, docId) {
  const patch = {};
  const now = new Date().toISOString();

  if (extracted.gstin) {
    const stateCode = extracted.gstin.substring(0, 2);
    const stateMap = { '09': 'Uttar Pradesh', '07': 'Delhi', '27': 'Maharashtra', '24': 'Gujarat', '08': 'Rajasthan', '23': 'Madhya Pradesh', '10': 'Bihar', '29': 'Karnataka', '33': 'Tamil Nadu' };
    patch.gstin = { value: extracted.gstin, status: 'VERIFIED', confidence: 0.95, source: 'veda_doc', evidence: { docId, quote: extracted.gstin }, updatedAt: now };
    patch.gstRegistered = { value: true, status: 'VERIFIED', confidence: 0.95, source: 'veda_doc', evidence: { docId }, updatedAt: now };
    if (stateMap[stateCode]) patch.state = { value: stateMap[stateCode], status: 'VERIFIED', confidence: 0.90, source: 'veda_doc', evidence: { docId }, updatedAt: now };
  }
  if (extracted.pan) patch.pan = { value: extracted.pan, status: 'VERIFIED', confidence: 0.95, source: 'veda_doc', evidence: { docId, quote: extracted.pan }, updatedAt: now };
  if (extracted.udyamNumber) {
    patch.udyamNumber = { value: extracted.udyamNumber, status: 'VERIFIED', confidence: 0.95, source: 'veda_doc', evidence: { docId }, updatedAt: now };
    patch.udyamRegistered = { value: true, status: 'VERIFIED', confidence: 0.95, source: 'veda_doc', evidence: { docId }, updatedAt: now };
  }
  if (extracted.businessName) patch.businessName = { value: extracted.businessName, status: 'VERIFIED', confidence: 0.90, source: 'veda_doc', evidence: { docId }, updatedAt: now };
  if (extracted.constitution) patch.constitution = { value: extracted.constitution, status: 'VERIFIED', confidence: 0.90, source: 'veda_doc', evidence: { docId }, updatedAt: now };
  return patch;
}

// Helper: Generate calendar items based on document type
function generateCalendar(docType) {
  const items = [];
  if (docType.includes('GST') && !docType.includes('Return')) {
    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    items.push({ id: 'statutory-gstr-1', title: 'GSTR-1 (Outward Supplies)', deadlineDate: nextY + '-' + String(nextM).padStart(2,'0') + '-11', urgency: 'high', category: 'GST', description: 'Monthly return for outward supplies', sourceUrl: 'https://gst.gov.in' });
    items.push({ id: 'statutory-gstr-3b', title: 'GSTR-3B (Summary Return)', deadlineDate: nextY + '-' + String(nextM).padStart(2,'0') + '-20', urgency: 'high', category: 'GST', description: 'Monthly summary return and tax payment', sourceUrl: 'https://gst.gov.in' });
  }
  return items;
}

// Helper: Generate success message based on locale
function genMessage(extracted, docType, locale) {
  const isHi = locale === 'hi';
  const isEn = locale === 'en';
  let msg = isEn ? '✅ ' + docType + ' processed successfully!\n\n' : isHi ? '✅ ' + docType + ' सफलतापूर्वक प्रोसेस हुआ!\n\n' : '✅ ' + docType + ' successfully process ho gaya!\n\n';
  const parts = [];
  if (extracted.gstin) parts.push('GSTIN: ' + extracted.gstin);
  if (extracted.pan) parts.push('PAN: ' + extracted.pan);
  if (extracted.businessName) parts.push('Business: ' + extracted.businessName);
  if (extracted.udyamNumber) parts.push('Udyam: ' + extracted.udyamNumber);
  msg += parts.join('\n');
  msg += isEn ? '\n\nThis is for understanding only, not professional advice.' : isHi ? '\n\nयह जानकारी केवल समझने के लिए है।' : '\n\nYeh jaankari sirf samajhne ke liye hai.';
  return msg;
}

/**
 * Return schema-valid mock AgentOutput - extracts REAL data from documents
 */
export function runMock(input = {}) {
  const event = input.event || {};
  const now = new Date().toISOString();
  const mime = (event.mime || event.mimeType || 'image/jpeg').toLowerCase();
  const docId = input.event?.docId || 'doc_' + Date.now();
  
  const trace = [{ runId: input.runId || 'veda-mock-run', agent: 'VEDA', node: 'mock', startedAt: now, durationMs: 0, inputSummary: 'Extracting from actual document text', outputSummary: 'Extracted fields from document', status: 'done' }];
  const costs = { llmTokens: 0, tinyfishAgentCalls: 0 };

  // Check unsupported mime
  if (!event.ocrText && !['image/jpeg','image/jpg','image/png','image/webp','application/pdf'].includes(mime)) {
    return AgentOutputSchema.parse({ status: 'DEGRADED', profilePatch: {}, messages: [getTextMessage('unsupported_mime', input.locale || 'hinglish')], claims: [], calendarItems: [], trace, costs });
  }
  // Check unclear text
  if (event.ocrText && event.ocrText.trim().length < 15) {
    return AgentOutputSchema.parse({ status: 'NEEDS_INPUT', profilePatch: {}, messages: [getTextMessage('unclear_photo', input.locale || 'hinglish')], claims: [], calendarItems: [], trace, costs });
  }

  const ocrText = event.ocrText || '';
  const extracted = { gstin: extractGSTIN(ocrText), pan: extractPAN(ocrText), udyamNumber: extractUdyam(ocrText), businessName: null, constitution: null };
  
  // Try to extract business name
  const nameMatch = ocrText.match(/(?:Name|Business|Company|Enterprise)[:\s]*([A-Za-z][A-Za-z\s&.\-]{2,80})/i);
  if (nameMatch) extracted.businessName = nameMatch[1].trim();
  
  // Try to extract constitution
  const constMatch = ocrText.match(/(?:Constitution|Type)[:\s]*(Proprietorship|Partnership|Pvt\.?\s*Ltd|Private\s*Limited|LLP)/i);
  if (constMatch) extracted.constitution = constMatch[1].trim();

  const docType = detectDocType(ocrText);
  const profilePatch = buildPatch(extracted, docId);
  
  const hasData = Object.values(extracted).some(v => v !== null);
  if (!hasData) {
    const msg = input.locale === 'hi' ? 'Document se important info nahi mili. Thoda saaf photo upload karein.' : input.locale === 'en' ? 'Could not extract important info. Please upload clearer photo.' : 'Document se koi important info nahi mila. Thoda saaf photo upload karein.';
    return AgentOutputSchema.parse({ status: 'NEEDS_INPUT', profilePatch: {}, messages: [{ type: 'text', text: msg }], claims: [], calendarItems: [], trace, costs });
  }

  const calendarItems = generateCalendar(docType);
  const claims = [];
  if (extracted.gstin) claims.push({ text: 'GSTIN ' + extracted.gstin + ' extracted from document', basis: 'document', confidence: 0.95 });
  if (extracted.pan) claims.push({ text: 'PAN ' + extracted.pan + ' extracted from document', basis: 'document', confidence: 0.95 });

  const messages = [{ type: 'text', text: genMessage(extracted, docType, input.locale) }];
  if (calendarItems.length > 0) {
    const title = input.locale === 'hi' ? 'अगले कदम' : 'Next Actions';
    messages.push({ type: 'option_card', title: title, options: [{ id: 'view_calendar', label: '📅 Calendar dekhein', value: { action: 'view_calendar' } }, { id: 'upload_more', label: '📄 Aur documents upload', value: { action: 'upload_more' } }] });
  }

  return AgentOutputSchema.parse({ status: 'OK', profilePatch, messages, claims, calendarItems, trace, costs });
}

export default runMock;
