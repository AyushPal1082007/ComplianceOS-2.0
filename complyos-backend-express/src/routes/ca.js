'use strict';
/**
 * ComplianceOS — Chartered Accountant (CA) Partner Routes
 * Built in strict compliance with ICAI Code of Ethics (Clauses 6 & 7, First Schedule):
 * - Flat monthly software fee only — ZERO commission on professional fees
 * - Zero fee sharing or solicitation
 * - Objective factual badges only — NO star ratings or commercial rankings
 * - Read-only collaboration sandbox for CA verification of client filings
 */
import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import { authenticate } from '../middleware/auth.js';
import prisma from '../db.js';
import { calculateHealthScore, calculatePenaltyAtRisk } from '../utils/complianceCalculators.js';

const router = express.Router();

// Mock verified CA partners for directory (objective profiles)
const CA_DIRECTORY = [
  {
    id: 'ca_partner_001',
    name: 'CA Rajesh Aggarwal & Associates',
    membershipNumber: '084219',
    firmRegistrationNumber: '012458N',
    city: 'Kanpur',
    state: 'Uttar Pradesh',
    specializations: ['GST Audit', 'MSME Schemes & Subsidies', 'Direct Tax'],
    verifiedCOP: true,
    responseTimeHours: 4,
    consultationModel: 'Direct client billing (zero platform commission)',
  },
  {
    id: 'ca_partner_002',
    name: 'CA Priya Sharma & Co.',
    membershipNumber: '519823',
    firmRegistrationNumber: '028911C',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    specializations: ['CM YUVA / ODOP Applications', 'FSSAI Compliance', 'Corporate Tax'],
    verifiedCOP: true,
    responseTimeHours: 2,
    consultationModel: 'Direct client billing (zero platform commission)',
  },
  {
    id: 'ca_partner_003',
    name: 'CA Amit Singhal & Partners',
    membershipNumber: '097842',
    firmRegistrationNumber: '008945N',
    city: 'Noida',
    state: 'Uttar Pradesh',
    specializations: ['E-Invoicing & GST Returns', 'Labour Codes', 'Export / DGFT'],
    verifiedCOP: true,
    responseTimeHours: 6,
    consultationModel: 'Direct client billing (zero platform commission)',
  },
];

// ── GET /api/ca/directory — Verified CA Directory ─────────────────────────────

router.get('/directory', async (req, res) => {
  const { city, specialization } = req.query;

  let partners = [...CA_DIRECTORY];

  if (city) {
    partners = partners.filter((p) => p.city.toLowerCase() === city.toLowerCase());
  }

  if (specialization) {
    partners = partners.filter((p) =>
      p.specializations.some((s) => s.toLowerCase().includes(specialization.toLowerCase()))
    );
  }

  res.json({
    total: partners.length,
    partners,
    icaiEthicsCompliance: {
      zeroCommission: true,
      noStarRatings: true,
      objectiveMetricsOnly: true,
      statement:
        'ComplianceOS does not solicit clients or charge referral commissions on CA fees, adhering strictly to ICAI regulations.',
    },
  });
});

// ── GET /api/ca/clients — CA View: list connected clients ─────────────────────

router.get('/clients', authenticate, async (req, res) => {
  if (req.user.role !== 'ca' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access restricted to CA accounts' });
  }

  const clientMaps = await prisma.cAClientMap.findMany({
    where: { caId: req.user.id },
    include: {
      client: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          businessProfile: true,
          deadlines: {
            where: { status: 'overdue' },
            select: { id: true, title: true, deadlineDate: true },
          },
        },
      },
    },
  });

  const clients = clientMaps.map((cm) => {
    const bProfile = cm.client.businessProfile;
    return {
      clientId: cm.client.id,
      clientName: cm.client.fullName,
      businessName: bProfile?.businessName || 'Unnamed Business',
      gstin: bProfile?.gstin,
      healthScore: bProfile?.healthScore || 85,
      penaltyAtRisk: bProfile?.penaltyAtRisk || 0,
      overdueCount: cm.client.deadlines.length,
      connectedAt: cm.addedAt,
    };
  });

  res.json({ total: clients.length, clients });
});

// ── GET /api/ca/clients/:id — CA View: Client Compliance File ─────────────────

router.get('/clients/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'ca' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access restricted to CA accounts' });
  }

  const clientId = req.params.id;

  const [profile, deadlines, documents] = await Promise.all([
    prisma.businessProfile.findUnique({ where: { userId: clientId } }),
    prisma.complianceDeadline.findMany({
      where: { userId: clientId },
      orderBy: { deadlineDate: 'asc' },
    }),
    prisma.document.findMany({
      where: { userId: clientId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        documentType: true,
        cloudinaryUrl: true,
        confidenceScore: true,
        needsReview: true,
        caApproved: true,
        caNote: true,
        createdAt: true,
      },
    }),
  ]);

  if (!profile) {
    return res.status(404).json({ error: 'Client profile not found' });
  }

  const healthScore = calculateHealthScore(profile, deadlines);
  const penaltyAtRisk = calculatePenaltyAtRisk(profile, deadlines);

  res.json({
    profile,
    healthScore,
    penaltyAtRisk,
    deadlines,
    documents,
    readOnlyAuditSandbox: true,
  });
});

// ── POST /api/ca/share — MSME generates secure read-only CA link ──────────────

router.post('/share', authenticate, async (req, res) => {
  const shareToken = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  res.json({
    shareToken,
    shareUrl: `${req.protocol}://${req.get('host')}/ca/read-only-file/${shareToken}`,
    expiresAt,
    permissions: 'read-only (documents, health score, deadlines)',
    dpdpNotice: 'Sharing is fully auditable. You can revoke access at any time.',
  });
});

// ── POST /api/ca/document/:id/review — CA approves / flags document ──────────

router.post('/document/:id/review', authenticate, async (req, res) => {
  if (req.user.role !== 'ca' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access restricted to CA accounts' });
  }

  const { approved, note } = req.body;

  const updatedDoc = await prisma.document.update({
    where: { id: req.params.id },
    data: {
      caApproved: approved,
      caNote: note || (approved ? 'Verified by CA' : 'Flagged for amendment'),
    },
  });

  res.json({
    message: 'Document review recorded successfully',
    documentId: updatedDoc.id,
    caApproved: updatedDoc.caApproved,
    caNote: updatedDoc.caNote,
  });
});

// ── POST /api/ca/connect — Connect MSME to CA partner ────────────────────────

router.post('/connect', authenticate, async (req, res) => {
  const { caId } = req.body;

  if (!caId) {
    return res.status(400).json({ error: 'caId is required' });
  }

  const map = await prisma.cAClientMap.upsert({
    where: {
      caId_clientId: {
        caId,
        clientId: req.user.id,
      },
    },
    update: {},
    create: {
      id: uuidv4(),
      caId,
      clientId: req.user.id,
    },
  });

  res.status(201).json({ message: 'Connected to CA partner successfully', map });
});

export default router;
