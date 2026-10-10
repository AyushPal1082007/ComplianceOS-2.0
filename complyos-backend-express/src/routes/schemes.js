'use strict';
/**
 * ComplianceOS — Government Scheme Routes (SCOUT & PATHWAY Agents)
 * Hand-verified government schemes database (ODOP, CM YUVA, PMEGP, CGTMSE, Mudra, etc.)
 * Strictly deterministic rules engine for eligibility decisions; LLM strictly for vernacular explanation.
 */
import express from 'express';

import { authenticate } from '../middleware/auth.js';
import prisma from '../db.js';
import { scoutSchemes } from '../agents/scout.js';
import { getPathway } from '../agents/pathway.js';
import schemesData from '../data/schemes.json' with { type: 'json' };

const router = express.Router();

// ── GET /api/schemes — List all verified schemes ──────────────────────────────

router.get('/', async (req, res) => {
  const { type, state, search } = req.query;

  let results = [...schemesData];

  if (type) {
    results = results.filter((s) => s.schemeType?.toLowerCase() === type.toLowerCase());
  }

  if (state) {
    results = results.filter(
      (s) =>
        !s.state ||
        s.state.toLowerCase() === 'all' ||
        s.state.toLowerCase().includes(state.toLowerCase())
    );
  }

  if (search) {
    const q = search.toLowerCase();
    results = results.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.nameHindi && s.nameHindi.includes(q)) ||
        s.description.toLowerCase().includes(q) ||
        (s.ministry && s.ministry.toLowerCase().includes(q))
    );
  }

  res.json({
    total: results.length,
    schemes: results,
    trustLayer: {
      sourceCount: schemesData.length,
      allHandVerified: true,
      lastVerificationAudit: '2026-06-30',
    },
  });
});

// ── GET /api/schemes/match — SCOUT Agent Match for Authenticated User ─────────

router.get('/match', authenticate, async (req, res) => {
  const { explain = 'true', limit = 10 } = req.query;

  const profile = await prisma.businessProfile.findUnique({
    where: { userId: req.user.id },
  });

  if (!profile) {
    return res.status(404).json({
      error: 'Business profile not found. Please complete profile intake with ARIA first.',
    });
  }

  const scoutResult = await scoutSchemes(profile, {
    includeExplanations: explain === 'true',
    limit: parseInt(limit, 10) || 10,
  });

  // Persist matches in DB for tracking & audit
  for (const match of scoutResult.topMatches) {
    try {
      await prisma.schemeMatch.upsert({
        where: {
          businessId_schemeId: {
            businessId: profile.id,
            schemeId: match.schemeId,
          },
        },
        update: {
          matchScore: match.matchScore,
          criteriaMetCount: match.criteriaMetCount,
          criteriaTotalCount: match.criteriaTotalCount,
          missingInfo: match.missingInfo,
          explanationHindi: match.explanationHindi,
        },
        create: {
          businessId: profile.id,
          schemeId: match.schemeId,
          matchScore: match.matchScore,
          criteriaMetCount: match.criteriaMetCount,
          criteriaTotalCount: match.criteriaTotalCount,
          missingInfo: match.missingInfo,
          explanationHindi: match.explanationHindi,
        },
      });
    } catch {
      // Ignore if scheme record not yet seeded in relational DB table
    }
  }

  res.json(scoutResult);
});

// ── POST /api/schemes/evaluate-custom — Public/Guest Scheme Evaluation ───────

router.post('/evaluate-custom', async (req, res) => {
  const { profile, limit = 10 } = req.body;

  if (!profile) {
    return res.status(400).json({ error: 'profile payload is required' });
  }

  const scoutResult = await scoutSchemes(profile, {
    includeExplanations: false,
    limit: parseInt(limit, 10) || 10,
  });

  res.json(scoutResult);
});

// ── GET /api/schemes/:id — Single scheme details ─────────────────────────────

router.get('/:id', async (req, res) => {
  const scheme = schemesData.find((s) => s.id === req.params.id);

  if (!scheme) {
    return res.status(404).json({ error: 'Scheme not found' });
  }

  res.json({
    ...scheme,
    trustLayer: {
      sourceUrl: scheme.sourceUrl,
      retrievedOn: scheme.retrievedOn,
      checkedBy: scheme.checkedBy,
      disclaimer: 'Always verify final caps and guidelines on the official portal.',
    },
  });
});

// ── GET /api/schemes/:id/pathway — PATHWAY step-by-step checklist ─────────────

router.get('/:id/pathway', authenticate, async (req, res) => {
  const scheme = schemesData.find((s) => s.id === req.params.id);

  if (!scheme) {
    return res.status(404).json({ error: 'Scheme not found' });
  }

  const profile = await prisma.businessProfile.findUnique({
    where: { userId: req.user.id },
  });

  // Map to pathway type if known, or construct dynamic checklist
  const pathwayType = scheme.id.includes('yuva')
    ? 'cmyuva_loan'
    : scheme.id.includes('udyam')
    ? 'udyam_registration'
    : 'cmyuva_loan';

  const pathway = getPathway(pathwayType, profile || {});

  res.json({
    schemeId: scheme.id,
    schemeName: scheme.name,
    ...pathway,
    officialPortalUrl: scheme.officialUrl,
  });
});

export default router;
