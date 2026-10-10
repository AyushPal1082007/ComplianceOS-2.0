/**
 * ComplianceOS — VEDA Pipeline: OCR
 * Pure function: runs OCR via Vision service adapter or returns provided text.
 */

import { ocr as visionOcr } from '../../../services/vision.js';
import { getTextMessage, RETAKE_TIPS } from '../messages/index.js';

/**
 * Execute OCR on document
 * @param {object} params
 * @param {string} params.url - image url
 * @param {string} [params.ocrText] - pre-existing text (e.g. from fixtures/tests)
 * @param {string} [params.locale='hinglish']
 * @param {Function} [params.visionClient] - mock client for tests
 * @returns {Promise<{
 *   success: boolean,
 *   text: string,
 *   confidence: number,
 *   needsInput?: boolean,
 *   message?: object
 * }>}
 */
export async function runOcr({ url, ocrText = '', locale = 'hinglish', visionClient = null }) {
  let text = (ocrText || '').trim();
  let confidence = 1.0;

  if (!text && url) {
    const ocrFn = visionClient || visionOcr;
    const result = await ocrFn(url);
    text = (result.text || '').trim();
    confidence = result.confidence || 0;
  }

  // If text is empty or very short (< 15 characters)
  if (!text || text.length < 15) {
    const tips = RETAKE_TIPS[locale] || RETAKE_TIPS.hinglish;
    const message = getTextMessage('unclear_photo', locale, tips);

    return {
      success: false,
      text: '',
      confidence: 0,
      needsInput: true,
      message,
    };
  }

  return {
    success: true,
    text,
    confidence,
  };
}

export default runOcr;
