'use strict';
/**
 * ComplianceOS — Document Routes (VEDA Agent)
 * POST /api/documents/upload   — Upload doc → VEDA processes → calendar items
 * GET  /api/documents          — List user's documents
 * GET  /api/documents/:id      — Get single document
 * PATCH /api/documents/:id/confirm — Confirm low-confidence fields
 * DELETE /api/documents/:id    — Delete document (DPDP)
 */
import express from 'express';
import multer from 'multer';

import { authenticate } from '../middleware/auth.js';
import { processDocument } from '../agents/veda.js';
import prisma from '../db.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP images and PDFs are allowed.'));
    }
  },
});

// ── POST /api/documents/upload ────────────────────────────────────────────────

router.post('/upload', authenticate, upload.any(), async (req, res) => {
  const file = req.file || (req.files && req.files[0]);
  if (!file) {
    return res.status(400).json({ error: 'Document file required.' });
  }

  // Check free tier limit: 1 document/month per PDF
  if (req.user.plan === 'free') {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyCount = await prisma.document.count({
      where: { userId: req.user.id, createdAt: { gte: startOfMonth } },
    });

    if (monthlyCount >= 1) {
      return res.status(429).json({
        error: 'Free tier allows 1 document per month. Upgrade to Growth (₹249/month) for unlimited documents.',
        upgradeUrl: '/pricing',
      });
    }
  }

  const result = await processDocument(
    file.buffer,
    file.originalname,
    file.mimetype,
    req.user.id
  );

  if (!result.success) {
    return res.status(422).json(result);
  }

  res.status(201).json(result);
});

// ── GET /api/documents ────────────────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
      select: {
        id: true, filename: true, documentType: true,
        cloudinaryUrl: true, confidenceScore: true,
        needsReview: true, processedByVeda: true,
        caApproved: true, createdAt: true,
      },
    }),
    prisma.document.count({ where: { userId: req.user.id } }),
  ]);

  res.json({ documents, total, page: parseInt(page), limit: parseInt(limit) });
});

// ── GET /api/documents/:id ────────────────────────────────────────────────────

router.get('/:id', authenticate, async (req, res) => {
  const document = await prisma.document.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: { deadlines: true },
  });

  if (!document) return res.status(404).json({ error: 'Document not found.' });

  res.json(document);
});

// ── PATCH /api/documents/:id/confirm — User confirms low-confidence field ─────

router.patch('/:id/confirm', authenticate, async (req, res) => {
  const { confirmedFields } = req.body; // { "date": "20/07/2025", "gstin": "..." }

  const document = await prisma.document.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });

  if (!document) return res.status(404).json({ error: 'Document not found.' });

  const updatedData = {
    ...document.extractedData,
    _userConfirmed: confirmedFields,
    _confirmedAt: new Date().toISOString(),
  };

  await prisma.document.update({
    where: { id: req.params.id },
    data: { extractedData: updatedData, needsReview: false },
  });

  res.json({ message: 'Fields confirmed successfully.', confirmedFields });
});

// ── DELETE /api/documents/:id — DPDP right to erasure ────────────────────────

router.delete('/:id', authenticate, async (req, res) => {
  const document = await prisma.document.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });

  if (!document) return res.status(404).json({ error: 'Document not found.' });

  // TODO: Delete from Cloudinary too
  await prisma.document.delete({ where: { id: req.params.id } });

  res.json({ message: 'Document deleted permanently.' });
});

export default router;
