'use strict';
/**
 * ComplianceOS — Compliance Routes
 * GET  /api/compliance/deadlines     — Get all deadlines (calendar data)
 * POST /api/compliance/deadlines     — Manually add deadline
 * PATCH /api/compliance/deadlines/:id — Update deadline status
 * GET  /api/compliance/gst-calculator — Deterministic GST late fee
 * GET  /api/compliance/due-dates     — GST return due dates
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');

const { authenticate } = require('../middleware/auth');
const prisma = require('../db');
const { gstLateFee, getGSTDueDates } = require('../utils/complianceCalculators');

const router = express.Router();

// ── GET /api/compliance/deadlines ─────────────────────────────────────────────

router.get('/deadlines', authenticate, async (req, res) => {
  const { status, urgency, from, to } = req.query;

  const where = { userId: req.user.id };
  if (status) where.status = status;
  if (urgency) where.urgency = urgency;
  if (from || to) {
    where.deadlineDate = {};
    if (from) where.deadlineDate.gte = new Date(from);
    if (to) where.deadlineDate.lte = new Date(to);
  }

  const deadlines = await prisma.complianceDeadline.findMany({
    where,
    orderBy: { deadlineDate: 'asc' },
    include: { document: { select: { id: true, filename: true, documentType: true } } },
  });

  res.json(deadlines);
});

// ── POST /api/compliance/deadlines — Manually add ────────────────────────────

router.post('/deadlines', authenticate, async (req, res) => {
  const { title, deadlineDate, complianceType, urgency, description, sourceUrl } = req.body;

  if (!title || !deadlineDate || !complianceType) {
    return res.status(400).json({ error: 'title, deadlineDate, and complianceType are required.' });
  }

  const deadline = await prisma.complianceDeadline.create({
    data: {
      id: uuidv4(),
      userId: req.user.id,
      title,
      description,
      deadlineDate: new Date(deadlineDate),
      complianceType,
      urgency: urgency || 'medium',
      status: 'pending',
      sourceUrl,
      createdByAgent: 'manual',
    },
  });

  res.status(201).json(deadline);
});

// ── PATCH /api/compliance/deadlines/:id ──────────────────────────────────────

router.patch('/deadlines/:id', authenticate, async (req, res) => {
  const { status, urgency } = req.body;

  const deadline = await prisma.complianceDeadline.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });

  if (!deadline) return res.status(404).json({ error: 'Deadline not found.' });

  const updated = await prisma.complianceDeadline.update({
    where: { id: req.params.id },
    data: {
      ...(status && { status }),
      ...(urgency && { urgency }),
    },
  });

  res.json(updated);
});

// ── GET /api/compliance/gst-calculator — Deterministic (per S.47/S.50) ───────

router.get('/gst-calculator', authenticate, async (req, res) => {
  const { turnoverLakhs, isNilReturn, daysLate, returnCount } = req.query;

  if (!turnoverLakhs || !daysLate) {
    return res.status(400).json({ error: 'turnoverLakhs and daysLate are required.' });
  }

  const result = gstLateFee({
    annualTurnoverLakhs: parseFloat(turnoverLakhs),
    isNilReturn: isNilReturn === 'true',
    daysLate: parseInt(daysLate),
    returnCount: parseInt(returnCount) || 1,
  });

  res.json({
    ...result,
    input: { turnoverLakhs: parseFloat(turnoverLakhs), daysLate: parseInt(daysLate) },
    trustLayer: {
      note: 'Calculated from deterministic code. Not LLM output.',
      source: 'S.47 + S.50 CGST Act, FY 2026-27',
    },
  });
});

// ── GET /api/compliance/due-dates ─────────────────────────────────────────────

router.get('/due-dates', authenticate, async (req, res) => {
  const { turnoverLakhs } = req.query;

  const profile = await prisma.businessProfile.findUnique({ where: { userId: req.user.id } });
  const turnover = parseFloat(turnoverLakhs) || profile?.annualTurnover || 50;

  const dueDates = getGSTDueDates(turnover);

  res.json({
    ...dueDates,
    turnoverLakhs: turnover,
  });
});

module.exports = router;
