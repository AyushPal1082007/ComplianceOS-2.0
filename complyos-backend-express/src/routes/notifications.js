'use strict';
/**
 * ComplianceOS — Notification Routes
 * Fetches user alerts, manages read status, and tests multi-channel dispatches.
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const prisma = require('../db');
const { sendNotification } = require('../services/notificationService');

const router = express.Router();

// ── GET /api/notifications ────────────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  const { limit = 20 } = req.query;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
    }),
    prisma.notification.count({
      where: { userId: req.user.id, isRead: false },
    }),
  ]);

  res.json({
    total: notifications.length,
    unreadCount,
    notifications,
  });
});

// ── PATCH /api/notifications/:id/read ─────────────────────────────────────────

router.patch('/:id/read', authenticate, async (req, res) => {
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });

  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data: { isRead: true },
  });

  res.json(updated);
});

// ── PATCH /api/notifications/read-all ─────────────────────────────────────────

router.patch('/read-all', authenticate, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  });

  res.json({ message: 'All notifications marked as read' });
});

// ── POST /api/notifications/test ─────────────────────────────────────────────

router.post('/test', authenticate, async (req, res) => {
  const { title, body, channels = ['in_app'] } = req.body;

  const result = await sendNotification({
    userId: req.user.id,
    title: title || 'ComplianceOS टेस्ट अलर्ट',
    body: body || 'यह एक परीक्षण अधिसूचना है। आपकी समय सीमा सुरक्षित है।',
    channels,
  });

  res.json({ message: 'Test notification triggered', result });
});

module.exports = router;
