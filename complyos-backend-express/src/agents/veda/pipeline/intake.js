/**
 * ComplianceOS — VEDA Pipeline: Intake
 * Pure function: validates event and mime type. Accepts images and PDFs.
 */

import { getTextMessage } from '../messages/index.js';

const SUPPORTED_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

/**
 * Process document intake event
 * @param {object} event - DOCUMENT event
 * @param {string} [locale='hinglish']
 * @returns {{
 *   valid: boolean,
 *   docId: string,
 *   url: string,
 *   mime: string,
 *   ocrText?: string,
 *   rejectionMessage?: object
 * }}
 */
export function runIntake(event = {}, locale = 'hinglish') {
  const docId = event.docId || event.documentId || `doc_${Date.now()}`;
  const url = event.url || event.imageUrl || event.fileUrl || '';
  const mime = (event.mime || event.mimeType || 'image/jpeg').toLowerCase();
  const ocrText = event.ocrText || '';

  // If mime is unsupported and not a test text override
  if (!ocrText && mime && !SUPPORTED_MIMES.has(mime) && !mime.startsWith('image/')) {
    return {
      valid: false,
      docId,
      url,
      mime,
      rejectionMessage: getTextMessage('unsupported_mime', locale),
    };
  }

  return {
    valid: true,
    docId,
    url,
    mime,
    ocrText,
  };
}

export default runIntake;
