'use strict';
/**
 * ComplianceOS — Payment & Subscription Routes (Razorpay)
 * Transparent SaaS tiers:
 * - Free: ₹0 (Capped 1 doc/mo, weekly digests)
 * - Growth: ₹249/mo (₹199 for women-led MSMEs — 20% discount)
 * - Pro: ₹649/mo (₹454 for women-led MSMEs — 30% discount)
 * - CA Lite: ₹749/mo (up to 25 clients, flat SaaS fee)
 * - CA Pro: ₹1599/mo (up to 100 clients, flat SaaS fee)
 * Strictly zero commission on CA fees per ICAI Ethics Code.
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');

const { authenticate } = require('../middleware/auth');
const prisma = require('../db');
const config = require('../config');
const {
  createOrder,
  verifyPaymentSignature,
  calculatePlanAmount,
} = require('../services/razorpayService');

const router = express.Router();

// ── GET /api/payments/plans — List all plans and rates ────────────────────────

router.get('/plans', async (req, res) => {
  res.json({
    plans: [
      {
        id: 'free',
        name: 'Free (फ़नल)',
        nameHindi: 'निःशुल्क फ़नल',
        priceINR: 0,
        billing: 'Forever Free',
        features: [
          'Hindi voice onboarding (ARIA)',
          'Business Profile & Health Score',
          '5 calendar items',
          '3 scheme matches (SCOUT)',
          '1 document/month OCR (VEDA)',
          'Weekly WhatsApp digest',
        ],
        limits: { documentsPerMonth: 1, costCapINR: config.pricing.freeUserCostCap },
      },
      {
        id: 'growth',
        name: 'Growth (ग्रोथ)',
        nameHindi: 'ग्रोथ प्लान',
        priceINR: config.pricing.growth,
        womenLedPriceINR: config.pricing.womenDiscount.growth,
        billing: 'Per Month',
        features: [
          'Unlimited document OCR & verification',
          'SENTINEL targeted regulatory alerts',
          'Full scheme matching + PATHWAY checklists',
          '7-3-1 day WhatsApp deadline alerts',
          'Read-only export link to share with CA',
        ],
      },
      {
        id: 'pro',
        name: 'Pro (प्रो)',
        nameHindi: 'प्रो प्लान',
        priceINR: config.pricing.pro,
        womenLedPriceINR: config.pricing.womenDiscount.pro,
        billing: 'Per Month',
        features: [
          'Everything in Growth',
          'Multi-user / multi-branch support',
          'Priority Bhashini voice transcription',
          'Direct CA review queue integration',
          'Dedicated compliance concierge',
        ],
      },
      {
        id: 'ca_lite',
        name: 'CA Lite (सीए पार्टनर)',
        nameHindi: 'सीए पार्टनर लाइट',
        priceINR: config.pricing.ca_lite,
        billing: 'Per Month (Flat SaaS)',
        features: [
          'Up to 25 MSME client portfolios',
          'Consolidated deadline dashboard',
          'Document verification & flagging queue',
          'ICAI-compliant flat billing (0% commission)',
        ],
      },
      {
        id: 'ca_pro',
        name: 'CA Pro (सीए प्रो)',
        nameHindi: 'सीए पार्टनर प्रो',
        priceINR: config.pricing.ca_pro,
        billing: 'Per Month (Flat SaaS)',
        features: [
          'Up to 100 MSME client portfolios',
          'Full team access for CA articled clerks',
          'Bulk notice intelligence analyzer',
          'ICAI-compliant flat billing (0% commission)',
        ],
      },
    ],
    womenLedDiscount: {
      growthDiscountPercent: 20,
      proDiscountPercent: 30,
      note: 'Women-led MSMEs receive up to 30% discount on ComplianceOS to foster inclusive industrial growth.',
    },
  });
});

// ── POST /api/payments/create-order — Create Razorpay order ───────────────────

router.post('/create-order', authenticate, async (req, res) => {
  const { plan } = req.body;

  if (!plan || !['growth', 'pro', 'ca_lite', 'ca_pro'].includes(plan)) {
    return res.status(400).json({ error: 'Valid plan is required' });
  }

  // Check if business profile is women-led
  const profile = await prisma.businessProfile.findUnique({
    where: { userId: req.user.id },
  });
  const isWomenLed = profile?.isWomenLed || false;

  const order = await createOrder({
    userId: req.user.id,
    plan,
    isWomenLed,
  });

  res.status(201).json(order);
});

// ── POST /api/payments/verify — Verify signature and activate plan ────────────

router.post('/verify', authenticate, async (req, res) => {
  const { orderId, paymentId, signature, plan } = req.body;

  if (!orderId || !paymentId) {
    return res.status(400).json({ error: 'orderId and paymentId are required' });
  }

  const isValid = verifyPaymentSignature(orderId, paymentId, signature);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid payment signature' });
  }

  // Update user subscription plan
  await prisma.user.update({
    where: { id: req.user.id },
    data: { plan: plan || 'growth' },
  });

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30); // 30-day billing cycle

  await prisma.subscription.upsert({
    where: { userId: req.user.id },
    update: {
      plan: plan || 'growth',
      status: 'active',
      currentPeriodEnd: periodEnd,
    },
    create: {
      id: uuidv4(),
      userId: req.user.id,
      plan: plan || 'growth',
      status: 'active',
      currentPeriodEnd: periodEnd,
    },
  });

  res.json({
    success: true,
    message: `Plan successfully upgraded to ${plan}!`,
    plan,
    currentPeriodEnd: periodEnd,
  });
});

// ── POST /api/payments/webhook — Razorpay Webhook ────────────────────────────

router.post('/webhook', async (req, res) => {
  res.status(200).json({ status: 'received' });
});

module.exports = router;
