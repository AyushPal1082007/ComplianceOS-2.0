'use strict';
/**
 * ComplianceOS — Express Application
 * PERN Stack: PostgreSQL + Express + React + Node.js
 * Per PDF Section 8: Architecture and Technology Stack
 */
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');

const config = require('./config');
const logger = require('./logger');
const errorHandler = require('./middleware/errorHandler');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const businessRoutes = require('./routes/business');
const documentRoutes = require('./routes/documents');
const complianceRoutes = require('./routes/compliance');
const schemeRoutes = require('./routes/schemes');
const sentinelRoutes = require('./routes/sentinel');
const caRoutes = require('./routes/ca');
const notificationRoutes = require('./routes/notifications');
const whatsappRoutes = require('./routes/whatsapp');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin');
const agentTraceRoutes = require('./routes/agentTrace');

const app = express();

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate limiting (Groq free tier: 30 RPM max) ────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again shortly.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25, // under 30 RPM per Groq free tier
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit reached. Please wait a moment.' },
});

app.use(globalLimiter);

// ── Request parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── HTTP logging ──────────────────────────────────────────────────────────────
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

// ── Health check (no auth, no rate limit) ────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'ComplianceOS API',
    version: '2.0.0',
    stack: 'PERN',
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/documents', aiLimiter, documentRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/schemes', schemeRoutes);
app.use('/api/sentinel', sentinelRoutes);
app.use('/api/ca', caRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent-trace', agentTraceRoutes);

// WhatsApp webhook (no rate limit — Meta sends bursts)
app.use('/webhook/whatsapp', whatsappRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
