'use strict';
/**
 * ComplianceOS — VEDA Agent (Vision and Evidence Document Analyzer)
 * Phone photo or PDF → Tesseract.js (FREE) or pdf-parse → Groq JSON extraction
 * Field-level confidence scoring → Calendar items + Health Score
 * Per PDF Section 7: "Works on 30 sample docs; low-confidence fields flagged"
 */
import Groq from 'groq-sdk';
import { v4 as uuidv4 } from 'uuid';

import config from '../config.js';
import logger from '../logger.js';
import prisma from '../db.js';
import cloudinaryService from '../services/cloudinaryService.js';
import { extractText } from '../services/vision.js';

const groq = new Groq({ apiKey: config.groq.apiKey });

// ── VEDA Extraction Prompt ────────────────────────────────────────────────────

const VEDA_EXTRACTION_PROMPT = `You are VEDA, an expert document intelligence agent for Indian MSME compliance documents.
Analyze the OCR text and extract ALL important fields with confidence scores.

Return ONLY valid JSON (no markdown, no explanation):
{
  "document_type": "GST Certificate | GST Notice | Udyam Certificate | Invoice | FSSAI License | Shop License | TDS Certificate | Other",
  "registration_numbers": {
    "gstin": { "value": "", "confidence": 0.0 },
    "udyam_number": { "value": "", "confidence": 0.0 },
    "pan": { "value": "", "confidence": 0.0 },
    "cin": { "value": "", "confidence": 0.0 },
    "fssai": { "value": "", "confidence": 0.0 }
  },
  "important_dates": [
    {
      "date": "DD/MM/YYYY",
      "type": "filing_deadline | expiry | payment | renewal | notice_date | response_deadline",
      "description": "what this date is for",
      "urgency": "high | medium | low",
      "confidence": 0.0,
      "source_section": "which part of document mentions this date"
    }
  ],
  "business_details": {
    "name": { "value": "", "confidence": 0.0 },
    "address": { "value": "", "confidence": 0.0 },
    "gstin": { "value": "", "confidence": 0.0 }
  },
  "tax_details": {
    "amount_due": { "value": 0, "currency": "INR", "confidence": 0.0 },
    "tax_period": { "value": "", "confidence": 0.0 },
    "tax_type": { "value": "", "confidence": 0.0 }
  },
  "scheme_enrollments": [],
  "summary": "One line summary of the document",
  "overall_confidence": 0.0,
  "needs_human_review": false
}

Document OCR Text:
{TEXT}`;

// ── Extract text via Google Cloud Vision ──────────────────────────────────────

/**
 * Extract text from image or PDF using free OCR
 * Uses Tesseract.js for images, pdf-parse for text-based PDFs
 */
async function extractTextFromFile(fileBuffer, mimeType) {
  logger.info('Extracting text from document', { mimeType, size: fileBuffer.length });
  
  const result = await extractText(fileBuffer, mimeType);
  
  if (!result.text || result.text.trim().length < 10) {
    logger.warn('Extracted text too short or empty', { 
      length: result.text?.length,
      needsManualOCR: result.needsManualOCR 
    });
    return { text: '', confidence: 0 };
  }
  
  return { 
    text: result.text, 
    confidence: result.confidence,
    pages: result.pages,
  };
}

// ── Extract structured data via Groq ─────────────────────────────────────────

async function extractStructuredData(ocrText) {
  const prompt = VEDA_EXTRACTION_PROMPT.replace('{TEXT}', ocrText.substring(0, 4000));

  const response = await groq.chat.completions.create({
    model: config.groq.model,
    messages: [
      { role: 'system', content: 'You are a precise data extraction engine. Return ONLY valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw);
  } catch (err) {
    logger.error('VEDA JSON parse error', { raw: raw.substring(0, 200) });
    return { document_type: 'Unknown', overall_confidence: 0, needs_human_review: true };
  }
}

// ── Main VEDA process document function ──────────────────────────────────────

async function processDocument(fileBuffer, filename, mimeType, userId) {
  const traceSteps = [];
  
  try {
    // Step 1: Upload to Cloudinary
    traceSteps.push({ agent: 'VEDA', step: 'cloudinary_upload', status: 'started' });
    const cloudResult = await cloudinaryService.uploadBuffer(fileBuffer, {
      folder: `complyos/${userId}`,
      public_id: `doc_${uuidv4()}`,
      resource_type: 'auto',
    });
    traceSteps.push({ agent: 'VEDA', step: 'cloudinary_upload', status: 'done', url: cloudResult.secure_url });

    // Step 2: Extract text (FREE - Tesseract.js for images, pdf-parse for PDFs)
    traceSteps.push({ agent: 'VEDA', step: 'text_extraction', status: 'started' });
    const { text: ocrText, confidence: ocrConfidence, pages } = await extractTextFromFile(fileBuffer, mimeType);
    traceSteps.push({ 
      agent: 'VEDA', step: 'text_extraction', status: 'done',
      textLength: ocrText.length, confidence: ocrConfidence, pages,
    });

    if (!ocrText || ocrText.trim().length < 10) {
      return {
        success: false,
        error: 'Document text could not be read. Please upload a clearer image or text-based PDF.',
        traceSteps,
      };
    }

    // Step 3: Structured extraction via Groq
    traceSteps.push({ agent: 'VEDA', step: 'groq_extraction', status: 'started' });
    const extractedData = await extractStructuredData(ocrText);
    traceSteps.push({ 
      agent: 'VEDA', step: 'groq_extraction', status: 'done',
      documentType: extractedData.document_type,
      overallConfidence: extractedData.overall_confidence,
    });

    // Step 4: Apply trust layer confidence gate (< 0.80 → needs_review)
    const needsReview = extractedData.overall_confidence < config.trustLayer.confidenceGate
      || extractedData.needs_human_review;

    // Step 5: Save document record to DB
    const document = await prisma.document.create({
      data: {
        id: uuidv4(),
        userId,
        filename,
        cloudinaryUrl: cloudResult.secure_url,
        cloudinaryId: cloudResult.public_id,
        documentType: extractedData.document_type,
        ocrText: ocrText.substring(0, 10000),
        extractedData: extractedData,
        confidenceScore: extractedData.overall_confidence || ocrConfidence,
        needsReview,
        processedByVeda: true,
      },
    });

    // Step 6: Update Business Profile with registration numbers
    const regs = extractedData.registration_numbers || {};
    const profileUpdates = {};
    if (regs.gstin?.value && regs.gstin.confidence >= config.trustLayer.confidenceGate) {
      profileUpdates.gstin = regs.gstin.value.toUpperCase();
    }
    if (regs.udyam_number?.value && regs.udyam_number.confidence >= config.trustLayer.confidenceGate) {
      profileUpdates.udyamNumber = regs.udyam_number.value.toUpperCase();
    }
    if (regs.pan?.value && regs.pan.confidence >= config.trustLayer.confidenceGate) {
      profileUpdates.pan = regs.pan.value.toUpperCase();
    }

    if (Object.keys(profileUpdates).length > 0) {
      await prisma.businessProfile.updateMany({
        where: { userId },
        data: profileUpdates,
      });
      traceSteps.push({ agent: 'VEDA', step: 'profile_update', status: 'done', updates: Object.keys(profileUpdates) });
    }

    // Step 7: Create compliance deadlines from extracted dates
    const dates = extractedData.important_dates || [];
    const createdDeadlines = [];

    for (const d of dates) {
      try {
        if (!d.date) continue;
        const [day, month, year] = d.date.split('/').map(Number);
        if (!day || !month || !year) continue;

        const deadlineDate = new Date(year, month - 1, day);
        if (isNaN(deadlineDate.getTime())) continue;

        // Only create if confidence >= gate or flag for review
        const deadlineConfidence = d.confidence || 0.5;

        const deadline = await prisma.complianceDeadline.create({
          data: {
            id: uuidv4(),
            userId,
            title: d.description || `Deadline from ${extractedData.document_type}`,
            deadlineDate,
            complianceType: d.type || 'document',
            urgency: d.urgency || 'medium',
            status: 'pending',
            sourceDocumentId: document.id,
            createdByAgent: 'VEDA',
            sourceUrl: null,
            // Confidence gate: below 0.80 → flag for review
            ...(deadlineConfidence < config.trustLayer.confidenceGate
              ? { status: 'flagged', description: `⚠️ Low confidence (${Math.round(deadlineConfidence * 100)}%) — please verify this date.` }
              : {}
            ),
          },
        });

        createdDeadlines.push({
          id: deadline.id,
          date: d.date,
          description: d.description,
          urgency: d.urgency,
          confidence: deadlineConfidence,
          needsConfirmation: deadlineConfidence < config.trustLayer.confidenceGate,
        });
      } catch (dateErr) {
        logger.warn('VEDA date parse error', { date: d.date, error: dateErr.message });
      }
    }

    traceSteps.push({ 
      agent: 'VEDA', step: 'deadlines_created', status: 'done',
      count: createdDeadlines.length,
    });

    return {
      success: true,
      documentId: document.id,
      documentType: extractedData.document_type,
      summary: extractedData.summary,
      overallConfidence: extractedData.overall_confidence,
      needsReview,
      confidenceGate: config.trustLayer.confidenceGate,
      deadlinesCreated: createdDeadlines.length,
      deadlines: createdDeadlines,
      registrationNumbers: {
        gstin: regs.gstin?.value || null,
        pan: regs.pan?.value || null,
        udyamNumber: regs.udyam_number?.value || null,
      },
      extractedData: needsReview ? extractedData : undefined,
      traceSteps,
      // Trust layer metadata per PDF
      trustLayer: {
        citationRequired: config.trustLayer.citationRequired,
        confidenceGate: config.trustLayer.confidenceGate,
        status: needsReview ? 'please_confirm' : 'verified',
        message: needsReview
          ? 'कुछ जानकारी की पुष्टि करना आवश्यक है। (Some information needs your confirmation.)'
          : 'दस्तावेज़ सफलतापूर्वक पढ़ा गया। (Document read successfully.)',
      },
    };
  } catch (err) {
    logger.error('VEDA processing error', { error: err.message, userId, filename });
    return {
      success: false,
      error: `Document processing failed: ${err.message}`,
      traceSteps,
    };
  }
}

export { processDocument, extractTextFromFile, extractStructuredData };
export default { processDocument, extractTextFromFile, extractStructuredData };
