import prisma from '../db.js';
import { maskSensitiveTokens } from '../agents/veda/mask.js';
import * as memoryDocumentRepo from './memory/documentRepo.js';
import { memoryStore, usesMemoryRepository } from './memory/store.js';

function maskStructured(value, key = '') {
  if (Array.isArray(value)) return value.map((item) => maskStructured(item, key));
  if (!value || typeof value !== 'object') {
    if (typeof value !== 'string') return value;
    return /gstin|pan|aadhaar|udyam|phone|mobile/i.test(key) ? '[REDACTED]' : maskSensitiveTokens(value);
  }
  return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
    childKey,
    maskStructured(childValue, childKey),
  ]));
}

function maskDocumentText(text) {
  return maskSensitiveTokens(text)
    .replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/gi, '[REDACTED GSTIN]')
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, '[REDACTED PAN]')
    .replace(/\bUDYAM-[A-Z]{2}-\d{2}-[A-Z0-9-]+\b/gi, '[REDACTED UDYAM]')
    .replace(/\b(?:phone|mobile|contact)\s*(?:no\.?|number)?\s*[:=-]?\s*\+?[\d ()-]{8,}\b/gi, '[REDACTED PHONE]');
}

export async function saveFromVeda(userId, output) {
  const user = usesMemoryRepository()
    ? null
    : await prisma.user.findUnique({ where: { id: userId }, select: { consentGiven: true } });
  const hasConsent = usesMemoryRepository()
    ? Boolean(memoryStore.users.get(userId)?.consentGiven)
    : user?.consentGiven;
  if (!hasConsent) throw new Error('Consent is required before document persistence');

  const masked = {
    ...(output.id ? { id: output.id } : {}),
    filename: output.filename || 'compliance-document',
    cloudinaryUrl: output.cloudinaryUrl || null,
    cloudinaryId: output.cloudinaryId || null,
    documentType: output.documentType || null,
    ocrText: output.ocrText ? maskDocumentText(output.ocrText) : null,
    extractedData: output.extractedData ? maskStructured(output.extractedData) : undefined,
    confidenceScore: Number.isFinite(output.confidenceScore) ? output.confidenceScore : null,
    needsReview: Boolean(output.needsReview),
    processedByVeda: true,
  };
  if (usesMemoryRepository()) return memoryDocumentRepo.saveFromVeda(userId, masked);
  if (masked.id) {
    return prisma.document.upsert({
      where: { id: masked.id },
      create: { userId, ...masked },
      update: { ...masked, userId },
    });
  }
  return prisma.document.create({ data: { userId, ...masked } });
}

export async function removeForUser(userId) {
  if (usesMemoryRepository()) return memoryDocumentRepo.removeForUser(userId);
  const result = await prisma.document.deleteMany({ where: { userId } });
  return result.count;
}

export default { saveFromVeda, removeForUser };
