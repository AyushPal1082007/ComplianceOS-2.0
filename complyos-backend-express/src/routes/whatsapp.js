'use strict';
/**
 * ComplianceOS — WhatsApp Webhook & Message Handler
 * Handles Meta Cloud API webhooks for voice notes, document photos, and text queries.
 * Connects directly to ARIA, VEDA, SCOUT, and PATHWAY agents.
 */
import express from 'express';

import config from '../config.js';
import logger from '../logger.js';
import { ariaChat } from '../agents/aria.js';
import { handleEvent } from '../orchestrator/handleEvent.js';
import { parseWhatsAppWebhook } from '../channels/whatsapp.js';
import { prepareWhatsAppMediaEvent } from '../channels/whatsappMedia.js';
import { sendRenderedMessages, sendTextMessage } from '../services/whatsappService.js';

const router = express.Router();

// ── GET /webhook/whatsapp — Meta Webhook Verification ─────────────────────────

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.webhookVerifyToken) {
    logger.info('WhatsApp webhook verified successfully');
    return res.status(200).send(challenge);
  }

  logger.warn('WhatsApp webhook verification rejected');
  return res.sendStatus(403);
});

// ── POST /webhook/whatsapp — Inbound Meta Webhook Events ──────────────────────

router.post('/', async (req, res) => {
  res.sendStatus(200);
  const events = parseWhatsAppWebhook(req.body);
  for (const event of events) {
    void (async () => {
      try {
        const preparedEvent = await prepareWhatsAppMediaEvent(event);
        const result = await handleEvent(preparedEvent);
        await sendRenderedMessages(event.phone, result.messages || []);
      } catch (error) {
        logger.error('WhatsApp webhook processing failed', { error: error instanceof Error ? error.name : 'UnknownError' });
        await sendTextMessage(event.phone, 'माफ़ी, संदेश को प्रोसेस करने में कुछ समस्या आई।');
      }
    })();
  }
});

// ── POST /webhook/whatsapp/simulate-incoming — Developer Sandbox Testing ──────

router.post('/simulate-incoming', async (req, res) => {
  const { phone = '919876543210', message, type = 'text' } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const ariaRes = await ariaChat([{ role: 'user', content: message }], {});

  res.json({
    status: 'simulated_incoming_processed',
    phone,
    input: message,
    agentResponse: ariaRes.message,
    extractedSlots: ariaRes.extracted,
    profileComplete: ariaRes.profile_complete,
  });
});

export default router;
