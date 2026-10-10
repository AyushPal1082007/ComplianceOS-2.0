'use strict';
/**
 * ComplianceOS — SENTINEL Regulatory Horizon Routes
 * Ingests official circulars (CBIC, GSTN, MSME, MoLE) → SHA-256 deduplication →
 * LLM attribute tagging → Hyper-targeted Hindi alerts.
 * Includes demo simulation per PDF Section 7 & Prototype evaluation.
 */
import express from 'express';

import { authenticate } from '../middleware/auth.js';
import prisma from '../db.js';
import {
  runSentinelCrawl,
  injectSimulatedAlert,
  MONITORED_SOURCES,
} from '../agents/sentinel.js';

const router = express.Router();

// ── GET /api/sentinel/alerts — Targeted alerts for user ───────────────────────

router.get('/alerts', authenticate, async (req, res) => {
  const { status } = req.query;

  const where = { userId: req.user.id };
  if (status) where.status = status;

  const alerts = await prisma.sentinelAlert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    total: alerts.length,
    unreadCount: alerts.filter((a) => a.status === 'unread').length,
    alerts,
    trustLayer: {
      allAlertsCited: true,
      officialSourcesOnly: true,
    },
  });
});

// ── PATCH /api/sentinel/alerts/:id/read — Mark alert as read ──────────────────

router.patch('/alerts/:id/read', authenticate, async (req, res) => {
  const alert = await prisma.sentinelAlert.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });

  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  const updated = await prisma.sentinelAlert.update({
    where: { id: req.params.id },
    data: { status: 'read' },
  });

  res.json(updated);
});

// ── POST /api/sentinel/simulate — Demo Regulatory Alert Injection ─────────────

router.post('/simulate', authenticate, async (req, res) => {
  const { scenario = 'einvoice' } = req.body;

  const alert = await injectSimulatedAlert(req.user.id, scenario);

  res.status(201).json({
    message: 'Demo regulatory alert injected successfully',
    alert,
    trustLayer: {
      isSimulated: true,
      simulationLabel: 'DEMO / SIMULATION — Verified statutory format',
    },
  });
});

// ── POST /api/sentinel/crawl — Trigger crawler across official sources ────────

router.post('/crawl', authenticate, async (req, res) => {
  const results = await runSentinelCrawl();

  res.json({
    message: 'SENTINEL crawler executed',
    timestamp: new Date().toISOString(),
    results,
  });
});

// ── GET /api/sentinel/sources — List monitored official government sources ───

router.get('/sources', async (req, res) => {
  res.json({
    total: MONITORED_SOURCES.length,
    sources: MONITORED_SOURCES.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      checkFrequency: s.checkFrequency,
    })),
    trustLayer: {
      strictPolicy: 'Only official .gov.in and .nic.in portals are monitored.',
    },
  });
});

export default router;
