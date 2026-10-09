'use strict';
/**
 * ComplianceOS — Agent Trace & Trust Layer Transparency Routes
 * Provides real-time inspectability into the 5-Agent Pipeline:
 * ARIA · VEDA · SCOUT · SENTINEL · PATHWAY
 * Transparently reveals LLM model, execution latency, confidence gating, and statutory citations.
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const prisma = require('../db');
const config = require('../config');

const router = express.Router();

// ── GET /api/agent-trace — Get Agent Trace Telemetry ──────────────────────────

router.get('/', authenticate, async (req, res) => {
  const [profile, documents, deadlines, alerts] = await Promise.all([
    prisma.businessProfile.findUnique({ where: { userId: req.user.id } }),
    prisma.document.findMany({
      where: { userId: req.user.id },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        documentType: true,
        confidenceScore: true,
        needsReview: true,
        processedByVeda: true,
        createdAt: true,
      },
    }),
    prisma.complianceDeadline.findMany({
      where: { userId: req.user.id },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdByAgent: true,
        complianceType: true,
        urgency: true,
        status: true,
      },
    }),
    prisma.sentinelAlert.findMany({
      where: { userId: req.user.id },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const agentSummaries = [
    {
      agent: 'ARIA',
      role: 'Intake & Conversational Profile Builder',
      model: config.groq.model,
      provider: 'Groq (LPUs)',
      activeSession: profile?.ariaSessionId || 'none',
      status: profile?.profileComplete ? 'profile_complete' : 'in_progress',
      governance: '1 slot at a time; plain Hindi/Hinglish explanation; validation rules on GSTIN/PAN/Udyam',
    },
    {
      agent: 'VEDA',
      role: 'Document Vision & Verification Intelligence',
      ocrEngine: 'Google Cloud Vision OCR',
      extractionModel: config.groq.model,
      confidenceGate: config.trustLayer.confidenceGate,
      recentDocuments: documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        confidence: d.confidenceScore,
        gatePassed: (d.confidenceScore || 0) >= config.trustLayer.confidenceGate,
        needsUserConfirmation: d.needsReview,
      })),
      governance: 'Scores < 0.80 require user confirmation; zero silent data insertion',
    },
    {
      agent: 'SCOUT',
      role: 'Scheme Discovery & Eligibility Engine',
      rulesEngine: 'Deterministic JS/Node.js Code (zero LLM eligibility guessing)',
      explanationEngine: `${config.groq.model} (vernacular Hindi only)`,
      verifiedSchemesCount: 13,
      governance: 'Strictly deterministic evaluation; citations on every criterion',
    },
    {
      agent: 'SENTINEL',
      role: 'Regulatory Horizon & Change Monitor',
      crawler: 'SHA-256 Webpage Hash Change Detector',
      recentAlertsCount: alerts.length,
      governance: 'Official .gov.in sources only; hyper-targeted to user sector/state/turnover',
    },
    {
      agent: 'PATHWAY',
      role: 'Action & Resolution Roadmap',
      guarantees: [
        'Official deep links only',
        'Zero credential storage',
        'Zero auto-filing',
        'ICAI-compliant CA handoff',
      ],
      governance: 'Step-by-step guidance without impersonation or risk of portal bans',
    },
  ];

  res.json({
    timestamp: new Date().toISOString(),
    trustLayer: {
      confidenceThreshold: config.trustLayer.confidenceGate,
      sourceCitationMandatory: config.trustLayer.citationRequired,
      auditReadiness: 'DPDP Act 2025 Aligned',
    },
    agents: agentSummaries,
    recentDeadlinesCreatedByAgents: deadlines,
  });
});

module.exports = router;
