'use strict';
/**
 * ComplianceOS — Express Application
 * PERN Stack: PostgreSQL + Express + React + Node.js
 * Per PDF Section 8: Architecture and Technology Stack
 */
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';

import config from './config.js';
import logger from './logger.js';
import errorHandler from './middleware/errorHandler.js';
import { safeHttpLogPath } from './middleware/safeHttpLog.js';

import authRoutes from './routes/auth.js';
import businessRoutes from './routes/business.js';
import documentRoutes from './routes/documents.js';
import complianceRoutes from './routes/compliance.js';
import schemeRoutes from './routes/schemes.js';
import sentinelRoutes from './routes/sentinel.js';
import caRoutes from './routes/ca.js';
import notificationRoutes from './routes/notifications.js';
import whatsappRoutes from './routes/whatsapp.js';
import paymentRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';
import agentTraceRoutes from './routes/agentTrace.js';
import chatRoutes from './routes/chat.js';

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
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again shortly.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit reached. Please wait a moment.' },
});

app.use(globalLimiter);

// ── Request parsing ────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── HTTP logging ─────────────────────────────────────────────────────────
morgan.token('safe-url', safeHttpLogPath);
app.use(morgan(':remote-addr :method :safe-url :status :res[content-length] - :response-time ms'));

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

// ── API Routes ──────────────────────────────────────────────────────────
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
app.use('/api/chat', aiLimiter, chatRoutes);

// WhatsApp webhook (no rate limit — Meta sends bursts)
app.use('/webhook/whatsapp', whatsappRoutes);

// ── 404 handler ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
