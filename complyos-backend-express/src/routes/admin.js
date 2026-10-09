'use strict';
/**
 * ComplianceOS — Admin & Operational Telemetry Routes
 * System monitoring, MSME metrics, and administrative controls.
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const prisma = require('../db');
const { runSentinelCrawl } = require('../agents/sentinel');

const router = express.Router();

// Middleware: restrict to admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  next();
};

// ── GET /api/admin/stats — Overall platform telemetry ─────────────────────────

router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  const [
    totalUsers,
    totalProfiles,
    totalDocuments,
    totalDeadlines,
    overdueDeadlines,
    totalAlerts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.businessProfile.count(),
    prisma.document.count(),
    prisma.complianceDeadline.count(),
    prisma.complianceDeadline.count({ where: { status: 'overdue' } }),
    prisma.sentinelAlert.count(),
  ]);

  const profilesWithScores = await prisma.businessProfile.findMany({
    where: { healthScore: { not: null } },
    select: { healthScore: true },
  });

  const avgHealthScore =
    profilesWithScores.length > 0
      ? Math.round(
          profilesWithScores.reduce((acc, p) => acc + (p.healthScore || 0), 0) /
            profilesWithScores.length
        )
      : 82;

  res.json({
    users: {
      total: totalUsers,
      msmeProfiles: totalProfiles,
    },
    documents: {
      totalProcessed: totalDocuments,
    },
    compliance: {
      totalDeadlines,
      overdueCount: overdueDeadlines,
      averageHealthScore: avgHealthScore,
    },
    sentinel: {
      totalAlertsGenerated: totalAlerts,
    },
    infrastructure: {
      stack: 'PERN (PostgreSQL + Express + React + Node.js)',
      activeLlm: 'Groq Llama 3.1 70B',
      visionOcr: 'Google Cloud Vision',
      speechAsr: 'Digital India Bhashini',
    },
  });
});

// ── GET /api/admin/users — List platform users ────────────────────────────────

router.get('/users', authenticate, requireAdmin, async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: parseInt(limit, 10),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        plan: true,
        language: true,
        createdAt: true,
        businessProfile: {
          select: {
            businessName: true,
            healthScore: true,
            state: true,
            annualTurnover: true,
          },
        },
      },
    }),
    prisma.user.count(),
  ]);

  res.json({ total, page: parseInt(page, 10), users });
});

// ── POST /api/admin/trigger-crawler — Run SENTINEL crawler ───────────────────

router.post('/trigger-crawler', authenticate, requireAdmin, async (req, res) => {
  const results = await runSentinelCrawl();
  res.json({ message: 'SENTINEL crawler finished', results });
});

module.exports = router;
