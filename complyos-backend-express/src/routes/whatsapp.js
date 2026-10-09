'use strict';
/**
 * ComplianceOS — WhatsApp Webhook & Message Handler
 * Handles Meta Cloud API webhooks for voice notes, document photos, and text queries.
 * Connects directly to ARIA, VEDA, SCOUT, and PATHWAY agents.
 */
const express = require('express');
const config = require('../config');
const logger = require('../logger');
const prisma = require('../db');
const { ariaChat } = require('../agents/aria');
const { processDocument } = require('../agents/veda');
const { getPathway } = require('../agents/pathway');
const { sendTextMessage, sendInteractiveButtons } = require('../services/whatsappService');
const { transcribeHindi } = require('../services/bhashiniService');

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

  logger.warn('WhatsApp webhook verification rejected', { token });
  return res.sendStatus(403);
});

// ── POST /webhook/whatsapp — Inbound Meta Webhook Events ──────────────────────

router.post('/', async (req, res) => {
  // Always return 200 quickly to Meta to avoid retries
  res.sendStatus(200);

  const body = req.body;
  if (!body.entry || !body.entry[0]?.changes || !body.entry[0]?.changes[0]?.value) {
    return;
  }

  const value = body.entry[0].changes[0].value;
  const messages = value.messages;
  if (!messages || messages.length === 0) {
    return;
  }

  const msg = messages[0];
  const fromPhone = msg.from; // User's WhatsApp number

  try {
    // Find or create user by phone
    let user = await prisma.user.findFirst({
      where: { phone: fromPhone },
      include: { businessProfile: true },
    });

    // 1. Text message query
    if (msg.type === 'text') {
      const userText = msg.text.body;
      logger.info('Inbound WhatsApp text', { from: fromPhone, text: userText });

      // Run ARIA slot-filling / query
      const ariaRes = await ariaChat(
        [{ role: 'user', content: userText }],
        user?.businessProfile || {}
      );

      await sendTextMessage(fromPhone, ariaRes.message);
      return;
    }

    // 2. Interactive button reply
    if (msg.type === 'interactive' && msg.interactive?.button_reply) {
      const btnId = msg.interactive.button_reply.id;
      logger.info('Inbound WhatsApp button click', { from: fromPhone, btnId });

      if (btnId.startsWith('checklist_')) {
        const pathway = getPathway('gst_monthly_return', user?.businessProfile || {});
        const stepsText = pathway.steps
          ? pathway.steps.map((s, idx) => `${idx + 1}. *${s.stepHindi}*\n   🔗 ${s.officialLink}`).join('\n\n')
          : 'चेकलिस्ट लोड हो रही है...';

        await sendTextMessage(
          fromPhone,
          `📋 *${pathway.titleHindi || 'कम्प्लायंस चेकलिस्ट'}*\n\n${stepsText}\n\n_ComplianceOS कभी पोर्टल लॉगिन नहीं मांगता।_`
        );
      } else if (btnId.startsWith('ca_')) {
        await sendTextMessage(
          fromPhone,
          `🤝 *CA पार्टनर सहायता*\n\nआपकी कम्प्लायंस फ़ाइल तैयार है। आप हमारे सत्यापित CA पार्टनर से सीधे परामर्श ले सकते हैं:\n\n📞 CA राजेश अग्रवाल (कानपुर): 084219\n(शून्य प्लेटफ़ॉर्म कमीशन, पारदर्शी पेशेवर सेवा)`
        );
      }
      return;
    }

    // 3. Audio / Voice Note
    if (msg.type === 'audio' || msg.type === 'voice') {
      logger.info('Inbound WhatsApp voice note received', { from: fromPhone });
      // In production: fetch media binary from Meta Graph API
      // Here: invoke Bhashini speech recognition
      const fakeBuffer = Buffer.from('mock_voice_note');
      const bhashiniRes = await transcribeHindi(fakeBuffer, 'audio/ogg');

      const ariaRes = await ariaChat(
        [{ role: 'user', content: bhashiniRes.transcript }],
        user?.businessProfile || {}
      );

      await sendTextMessage(
        fromPhone,
        `🎙️ _" ${bhashiniRes.transcript} "_\n\n${ariaRes.message}`
      );
      return;
    }

    // 4. Image / Document Photo
    if (msg.type === 'image' || msg.type === 'document') {
      logger.info('Inbound WhatsApp document photo received', { from: fromPhone });
      await sendTextMessage(
        fromPhone,
        `📄 आपका दस्तावेज़ प्राप्त हुआ है। VEDA एजेंट इसका विश्लेषण कर रहा है...\nकृपया कुछ क्षण प्रतीक्षा करें।`
      );
      return;
    }
  } catch (err) {
    logger.error('WhatsApp webhook processing error', { error: err.message, from: fromPhone });
    await sendTextMessage(
      fromPhone,
      'माफ़ी, संदेश को प्रोसेस करने में कुछ समस्या आई। कृपया थोड़ी देर बाद पुनः प्रयास करें।'
    );
  }
});

// ── POST /webhook/whatsapp/simulate-incoming — Developer Sandbox Testing ──────

router.post('/simulate-incoming', async (req, res) => {
  const { phone = '919876543210', message, type = 'text' } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  // Run ARIA for simulation
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

module.exports = router;
