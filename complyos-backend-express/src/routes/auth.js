'use strict';
/**
 * ComplianceOS — Auth Routes
 * POST /auth/register
 * POST /auth/login
 * GET  /auth/me
 * POST /auth/consent   — DPDP consent capture (first message)
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import config from '../config.js';
import prisma from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function signToken(userId) {
  return jwt.sign({ sub: userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ── POST /auth/register ───────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  const { email, password, fullName, phone, role = 'owner' } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'email, password and fullName are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      id: uuidv4(),
      email,
      fullName,
      phone: phone || null,
      passwordHash,
      role: ['owner', 'ca'].includes(role) ? role : 'owner',
      plan: 'free',
    },
  });

  // Auto-create empty business profile for owners
  if (user.role === 'owner') {
    await prisma.businessProfile.create({
      data: { id: uuidv4(), userId: user.id },
    });
  }

  const token = signToken(user.id);

  res.status(201).json({
    token,
    user: safeUser(user),
  });
});

// ── POST /auth/login ──────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const token = signToken(user.id);

  res.json({
    token,
    user: safeUser(user),
  });
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      businessProfile: true,
      subscription: true,
    },
  });

  const { passwordHash, ...safe } = user;
  res.json(safe);
});

// ── POST /auth/consent — DPDP Rules 2025 consent capture ─────────────────────

router.post('/consent', authenticate, async (req, res) => {
  const { consentGiven } = req.body;

  if (consentGiven !== true) {
    return res.status(400).json({ error: 'consentGiven must be true.' });
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      consentGiven: true,
      consentAt: new Date(),
    },
  });

  res.json({ message: 'Consent recorded. Welcome to ComplianceOS!' });
});

// ── DELETE /auth/account — DPDP right to erasure ─────────────────────────────

router.delete('/account', authenticate, async (req, res) => {
  // Cascade deletes all related data per DPDP data minimisation
  await prisma.user.delete({ where: { id: req.user.id } });
  res.json({ message: 'Your account and all associated data have been permanently deleted.' });
});

export default router;
