/**
 * ComplianceOS — Google Cloud Vision OCR Adapter
 * Wraps @google-cloud/vision for document text detection.
 * All Vision calls go through this service. Agent code never calls Vision directly.
 */

import vision from '@google-cloud/vision';
import config from '../config.js';
import logger from '../logger.js';

let client = null;

/**
 * Lazily initialize the Vision client
 * @returns {import('@google-cloud/vision').ImageAnnotatorClient|null}
 */
function getClient() {
  if (client) return client;

  try {
    client = new vision.ImageAnnotatorClient({
      keyFilename: config.gcp.credentialsFile,
      projectId: config.gcp.projectId,
    });
    return client;
  } catch (err) {
    logger.error('Vision client initialization failed', { error: err.message });
    return null;
  }
}

/**
 * Run OCR on an image URL or buffer using document text detection
 * @param {string} imageUrl - Public URL of the image (Cloudinary)
 * @returns {Promise<{ text: string, blocks: object[], confidence: number }>}
 */
export async function ocr(imageUrl) {
  const visionClient = getClient();
  if (!visionClient) {
    throw new Error('Google Cloud Vision is not configured');
  }

  const request = {
    image: { source: { imageUri: imageUrl } },
    features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
  };

  const [result] = await visionClient.annotateImage(request);

  const fullTextAnnotation = result.fullTextAnnotation;
  if (!fullTextAnnotation || !fullTextAnnotation.text) {
    return { text: '', blocks: [], confidence: 0 };
  }

  // Extract block-level data for structured analysis
  const blocks = (fullTextAnnotation.pages || []).flatMap(page =>
    (page.blocks || []).map(block => ({
      text: (block.paragraphs || [])
        .flatMap(p => (p.words || []).map(w =>
          (w.symbols || []).map(s => s.text).join('')
        ))
        .join(' '),
      confidence: block.confidence || 0,
      boundingBox: block.boundingBox,
    }))
  );

  // Average confidence across blocks
  const avgConfidence = blocks.length > 0
    ? blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length
    : 0;

  return {
    text: fullTextAnnotation.text,
    blocks,
    confidence: avgConfidence,
  };
}

/**
 * Run OCR on a raw image buffer
 * @param {Buffer} imageBuffer
 * @returns {Promise<{ text: string, blocks: object[], confidence: number }>}
 */
export async function ocrFromBuffer(imageBuffer) {
  const visionClient = getClient();
  if (!visionClient) {
    throw new Error('Google Cloud Vision is not configured');
  }

  const request = {
    image: { content: imageBuffer },
    features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
  };

  const [result] = await visionClient.annotateImage(request);

  const fullTextAnnotation = result.fullTextAnnotation;
  if (!fullTextAnnotation || !fullTextAnnotation.text) {
    return { text: '', blocks: [], confidence: 0 };
  }

  const blocks = (fullTextAnnotation.pages || []).flatMap(page =>
    (page.blocks || []).map(block => ({
      text: (block.paragraphs || [])
        .flatMap(p => (p.words || []).map(w =>
          (w.symbols || []).map(s => s.text).join('')
        ))
        .join(' '),
      confidence: block.confidence || 0,
      boundingBox: block.boundingBox,
    }))
  );

  const avgConfidence = blocks.length > 0
    ? blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length
    : 0;

  return {
    text: fullTextAnnotation.text,
    blocks,
    confidence: avgConfidence,
  };
}
