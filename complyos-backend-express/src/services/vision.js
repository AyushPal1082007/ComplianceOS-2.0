/**
 * ComplianceOS — Free OCR Adapter
 * Uses Tesseract.js (free, open-source) for images
 * Uses pdf-parse (free) for text-based PDFs
 * No paid APIs required!
 */

import Tesseract from 'tesseract.js';
import pdfParse from 'pdf-parse';
const pdf = pdfParse;
import logger from '../logger.js';

let tesseractWorker = null;

/**
 * Initialize Tesseract worker for better performance
 */
async function getTesseractWorker() {
  if (tesseractWorker) return tesseractWorker;

  tesseractWorker = await Tesseract.createWorker('eng+hin', 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        logger.debug('Tesseract OCR progress', { progress: m.progress });
      }
    },
  });
  return tesseractWorker;
}

/**
 * Detect if PDF is text-based or scanned
 */
async function isScannedPdf(pdfBuffer) {
  try {
    const data = await pdf(pdfBuffer);
    // Text-based PDFs have substantial text; scanned ones have < 100 chars
    return !data.text || data.text.trim().length < 100;
  } catch (err) {
    logger.warn('PDF parse failed, assuming scanned', { error: err.message });
    return true;
  }
}

/**
 * Extract text from a text-based PDF (free, no OCR needed)
 */
async function extractTextFromPdf(pdfBuffer) {
  const data = await pdf(pdfBuffer);
  const text = data.text || '';
  logger.info('Extracted text from PDF', { textLength: text.length, pages: data.numpages });
  
  return {
    text,
    confidence: 0.95,
    pages: data.numpages,
    isTextBased: true,
  };
}

/**
 * Run OCR on an image URL using Tesseract.js (FREE)
 */
export async function ocr(imageUrl) {
  logger.info('Starting OCR via Tesseract.js', { source: imageUrl });

  try {
    const worker = await getTesseractWorker();
    const result = await worker.recognize(imageUrl);

    const blocks = result.data.lines.map(line => ({
      text: line.text,
      confidence: line.confidence / 100,
      bbox: line.bbox,
    }));

    const avgConfidence = blocks.length > 0
      ? blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length
      : 0;

    logger.info('OCR completed', { 
      textLength: result.data.text.length, 
      confidence: avgConfidence,
    });

    return {
      text: result.data.text,
      blocks,
      confidence: avgConfidence,
    };
  } catch (err) {
    logger.error('OCR failed', { error: err.message });
    throw err;
  }
}

/**
 * Run OCR on an image buffer using Tesseract.js (FREE)
 */
export async function ocrFromBuffer(imageBuffer) {
  logger.info('Starting OCR via Tesseract.js', { bufferSize: imageBuffer.length });

  try {
    const worker = await getTesseractWorker();
    const result = await worker.recognize(imageBuffer);

    const blocks = result.data.lines.map(line => ({
      text: line.text,
      confidence: line.confidence / 100,
      bbox: line.bbox,
    }));

    const avgConfidence = blocks.length > 0
      ? blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length
      : 0;

    logger.info('OCR completed', { 
      textLength: result.data.text.length, 
      confidence: avgConfidence,
    });

    return {
      text: result.data.text,
      blocks,
      confidence: avgConfidence,
    };
  } catch (err) {
    logger.error('OCR failed', { error: err.message });
    throw err;
  }
}

/**
 * Unified OCR that handles both images and PDFs
 * - Text-based PDFs: Uses pdf-parse (free, direct text extraction)
 * - Scanned PDFs & Images: Uses Tesseract.js (free, open-source OCR)
 */
export async function extractText(fileBuffer, mimeType) {
  const isPdf = mimeType?.includes('pdf');

  if (!isPdf) {
    // It's an image - use Tesseract OCR
    return ocrFromBuffer(fileBuffer);
  }

  // It's a PDF - check if text-based or scanned
  const scanned = await isScannedPdf(fileBuffer);

  if (!scanned) {
    // Text-based PDF - extract directly (free, no OCR needed)
    const result = await extractTextFromPdf(fileBuffer);
    return {
      text: result.text,
      blocks: result.text.split('\n').filter(t => t.trim()).map(t => ({ 
        text: t, 
        confidence: 0.95 
      })),
      confidence: result.confidence,
      pages: result.pages,
    };
  }

  // Scanned PDF - use Tesseract.js OCR
  // Note: Tesseract works with images, not PDFs directly
  // For scanned PDFs, you would need pdf2image to convert pages to images first
  // For now, try pdf-parse as fallback
  logger.info('Processing scanned PDF');
  
  try {
    const data = await pdf(fileBuffer);
    if (data.text && data.text.trim().length > 50) {
      return {
        text: data.text,
        blocks: data.text.split('\n').filter(t => t.trim()).map(t => ({ 
          text: t, 
          confidence: 0.6 
        })),
        confidence: 0.6,
        isScanned: true,
      };
    }
  } catch (err) {
    logger.warn('Scanned PDF extraction failed', { error: err.message });
  }

  // Return empty - requires proper scanned PDF handling
  return {
    text: '',
    blocks: [],
    confidence: 0,
    needsManualOCR: true,
  };
}
