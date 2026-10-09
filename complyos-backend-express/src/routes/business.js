'use strict';
/**
 * ComplianceOS — Business Profile Routes
 * GET  /api/business/profile
 * PUT  /api/business/profile
 * GET  /api/business/health-score
 * POST /api/business/aria/chat       — ARIA slot-filling chat
 * POST /api/business/aria/voice      — Bhashini ASR → ARIA
 * GET  /api/business/agent-trace     — agent trace panel
 */
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';

import { authenticate } from '../middleware/auth.js';
import prisma from '../db.js';
import { ariaChat, ariaSummarizeNotice } from '../agents/aria.js';
import { calculateHealthScore, calculatePenaltyAtRisk, gstLateFee } from '../utils/complianceCalculators.js';
import { scoutSchemes } from '../agents/scout.js';
import bhashiniService from '../services/bhashiniService.js';
import logger from '../logger.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── GET /api/business/profile ─────────────────────────────────────────────────

router.get('/profile', authenticate, async (req, res) => {
  const profile = await prisma.businessProfile.findUnique({
    where: { userId: req.user.id },
  });

  if (!profile) {
    return res.status(404).json({ error: 'Business profile not found.' });
  }

  res.json(profile);
});

// ── PUT /api/business/profile ─────────────────────────────────────────────────

router.put('/profile', authenticate, async (req, res) => {
  const {
    businessName, gstin, pan, udyamNumber, fssaiNumber, cinNumber,
    businessType, sector, state, district, annualTurnover,
    employeeCount, isWomenLed, registeredDate,
  } = req.body;

  const profile = await prisma.businessProfile.upsert({
    where: { userId: req.user.id },
    update: {
      ...(businessName !== undefined && { businessName }),
      ...(gstin !== undefined && { gstin: gstin?.toUpperCase() }),
      ...(pan !== undefined && { pan: pan?.toUpperCase() }),
      ...(udyamNumber !== undefined && { udyamNumber: udyamNumber?.toUpperCase() }),
      ...(fssaiNumber !== undefined && { fssaiNumber }),
      ...(cinNumber !== undefined && { cinNumber }),
      ...(businessType !== undefined && { businessType }),
      ...(sector !== undefined && { sector }),
      ...(state !== undefined && { state }),
      ...(district !== undefined && { district }),
      ...(annualTurnover !== undefined && { annualTurnover: parseFloat(annualTurnover) }),
      ...(employeeCount !== undefined && { employeeCount: parseInt(employeeCount) }),
      ...(isWomenLed !== undefined && { isWomenLed }),
      ...(registeredDate !== undefined && { registeredDate: new Date(registeredDate) }),
    },
    create: {
      id: uuidv4(),
      userId: req.user.id,
      businessName, gstin, pan, udyamNumber, fssaiNumber, cinNumber,
      businessType, sector, state, district,
      annualTurnover: annualTurnover ? parseFloat(annualTurnover) : null,
      employeeCount: employeeCount ? parseInt(employeeCount) : null,
      isWomenLed: isWomenLed || false,
    },
  });

  res.json(profile);
});

// ── GET /api/business/health-score ────────────────────────────────────────────

router.get('/health-score', authenticate, async (req, res) => {
  const [profile, deadlines] = await Promise.all([
    prisma.businessProfile.findUnique({ where: { userId: req.user.id } }),
    prisma.complianceDeadline.findMany({ where: { userId: req.user.id } }),
  ]);

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found.' });
  }

  const healthScore = calculateHealthScore(profile, deadlines);
  const penaltyAtRisk = calculatePenaltyAtRisk(profile, deadlines);

  // Run SCOUT for scheme headroom
  let schemeCount = 0;
  try {
    const scoutResult = await scoutSchemes(profile, { includeExplanations: false, limit: 20 });
    schemeCount = scoutResult.eligibleSchemesFound;
  } catch (e) {
    logger.warn('Health score SCOUT failed', { error: e.message });
  }

  // Update profile with computed values
  await prisma.businessProfile.update({
    where: { userId: req.user.id },
    data: { healthScore, penaltyAtRisk, schemeHeadroom: schemeCount },
  });

  // GST late fee reference
  const gstInfo = profile.annualTurnover
    ? gstLateFee({
        annualTurnoverLakhs: profile.annualTurnover,
        isNilReturn: false,
        daysLate: 30,
        returnCount: 2,
      })
    : null;

  res.json({
    healthScore,
    penaltyAtRisk,
    schemeHeadroom: schemeCount,
    // Trust layer: deterministic values, not LLM
    trustLayer: {
      note: 'Health score and penalty-at-risk computed from deterministic code and verified statutory rates.',
      source: gstInfo?.source || null,
    },
    gstLateFeeReference: gstInfo,
    breakdown: {
      profileComplete: profile.profileComplete,
      hasGSTIN: !!profile.gstin,
      hasPAN: !!profile.pan,
      hasUdyam: !!profile.udyamNumber,
      overdueItems: deadlines.filter(d => d.status === 'overdue').length,
    },
  });
});

// ── POST /api/business/aria/chat — ARIA conversational slot-filling ───────────

router.post('/aria/chat', authenticate, async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required.' });
  }

  // Get or create ARIA session
  let session;
  if (sessionId) {
    session = await prisma.aRIASession.findUnique({ where: { sessionId } });
  }

  if (!session) {
    session = await prisma.aRIASession.create({
      data: {
        id: uuidv4(),
        userId: req.user.id,
        sessionId: uuidv4(),
        messages: [],
        slotsFilled: {},
      },
    });
  }

  // Add user message to session
  const messages = [...(session.messages || []), { role: 'user', content: message }];
  const currentSlots = session.slotsFilled || {};

  // Call ARIA agent
  const ariaResponse = await ariaChat(messages, currentSlots);

  // Update slots with extracted values
  const updatedSlots = {
    ...currentSlots,
    ...(ariaResponse.extracted || {}),
  };

  // Add assistant message to history
  messages.push({ role: 'assistant', content: ariaResponse.message });

  // Save updated session
  await prisma.aRIASession.update({
    where: { id: session.id },
    data: {
      messages,
      slotsFilled: updatedSlots,
      isComplete: ariaResponse.profile_complete || false,
    },
  });

  // If profile is complete, update the business profile
  if (ariaResponse.profile_complete) {
    await prisma.businessProfile.updateMany({
      where: { userId: req.user.id },
      data: {
        ...Object.fromEntries(
          Object.entries(updatedSlots).filter(([, v]) => v != null)
        ),
        profileComplete: true,
        ariaSessionId: session.sessionId,
      },
    });
  }

  res.json({
    message: ariaResponse.message,
    sessionId: session.sessionId,
    slotsCollected: Object.keys(updatedSlots).filter(k => updatedSlots[k] != null).length,
    profileComplete: ariaResponse.profile_complete || false,
    nextSlot: ariaResponse.next_slot,
    confidence: ariaResponse.confidence,
    // Agent trace
    trace: {
      agent: 'ARIA',
      model: 'llama3-70b-8192 (Groq)',
      slotsFilledThisTurn: Object.keys(ariaResponse.extracted || {}),
    },
  });
});

// ── POST /api/business/aria/voice — Bhashini Hindi ASR → ARIA ────────────────

router.post('/aria/voice', authenticate, upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Audio file required.' });
  }

  let transcribedText;

  try {
    // Step 1: Bhashini ASR
    const bhashiniResult = await bhashiniService.transcribeHindi(req.file.buffer, req.file.mimetype);
    transcribedText = bhashiniResult.transcript;
  } catch (bhashiniErr) {
    logger.warn('Bhashini ASR failed, returning error', { error: bhashiniErr.message });
    return res.status(503).json({
      error: 'Speech recognition unavailable. Please type your message.',
      fallback: 'text_input',
    });
  }

  if (!transcribedText || transcribedText.trim().length < 2) {
    return res.status(422).json({ error: 'Could not transcribe audio. Please try again or type your message.' });
  }

  // Step 2: Forward to ARIA chat
  req.body.message = transcribedText;
  req.body.sessionId = req.body.sessionId;

  // Reuse the chat handler (call inline)
  const { sessionId } = req.body;
  let session = sessionId
    ? await prisma.aRIASession.findUnique({ where: { sessionId } })
    : null;

  if (!session) {
    session = await prisma.aRIASession.create({
      data: {
        id: uuidv4(), userId: req.user.id,
        sessionId: uuidv4(), messages: [], slotsFilled: {},
      },
    });
  }

  const messages = [...(session.messages || []), { role: 'user', content: transcribedText }];
  const currentSlots = session.slotsFilled || {};
  const ariaResponse = await ariaChat(messages, currentSlots);
  const updatedSlots = { ...currentSlots, ...(ariaResponse.extracted || {}) };
  messages.push({ role: 'assistant', content: ariaResponse.message });

  await prisma.aRIASession.update({
    where: { id: session.id },
    data: { messages, slotsFilled: updatedSlots, isComplete: ariaResponse.profile_complete || false },
  });

  res.json({
    transcription: transcribedText,
    message: ariaResponse.message,
    sessionId: session.sessionId,
    profileComplete: ariaResponse.profile_complete || false,
    trace: { agent: 'ARIA', speechSource: 'Bhashini ASR (government-funded, free)', model: 'llama3-70b-8192' },
  });
});

// ── POST /api/business/aria/summarize-notice ──────────────────────────────────

router.post('/aria/summarize-notice', authenticate, async (req, res) => {
  const { noticeText } = req.body;

  if (!noticeText) {
    return res.status(400).json({ error: 'noticeText is required.' });
  }

  const summary = await ariaSummarizeNotice(noticeText);

  res.json({
    ...summary,
    trustLayer: {
      note: 'Summary is AI-generated. Verify due dates and penalties on the official portal.',
      confidenceGate: 0.80,
      status: summary.confidence >= 0.80 ? 'verified' : 'please_confirm',
    },
  });
});

export default router;
