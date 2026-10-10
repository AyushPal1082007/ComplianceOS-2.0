import axios from 'axios';
import config from '../config.js';
import logger from '../logger.js';
import { renderOutbound, WA_LIMITS } from '../channels/whatsapp.js';

function maskedPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length < 4 ? '[REDACTED PHONE]' : `***${digits.slice(-4)}`;
}

async function sendPayload(toPhone, payload) {
  const cleanPhone = String(toPhone).replace(/[^0-9]/g, '');
  if (config.whatsapp.token && config.whatsapp.phoneNumberId) {
    const url = `${config.whatsapp.apiUrl}/${config.whatsapp.phoneNumberId}/messages`;
    const response = await axios.post(url, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      ...payload,
    }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.whatsapp.token}`,
      },
    });
    logger.info('WhatsApp outbound message sent', {
      to: maskedPhone(cleanPhone),
      messageId: response.data?.messages?.[0]?.id,
    });
    return response.data;
  }
  logger.info('[SIMULATION] WhatsApp message dispatched', {
    to: maskedPhone(cleanPhone),
    type: payload.type,
  });
  return { success: true, simulated: true };
}

export async function sendRenderedMessages(toPhone, messages) {
  const payloads = renderOutbound(messages);
  const results = [];
  for (const payload of payloads) results.push(await sendPayload(toPhone, payload));
  return results;
}

/**
 * ComplianceOS — WhatsApp Service (WhatsApp Cloud API / Meta Graph API, ES6 Module)
 * Primary user touchpoint for India's 8.7+ Cr MSMEs.
 * Handles 7-3-1 day deadline alerts, interactive cards, and vernacular messages.
 */

/**
 * Send a plain or markdown text message via WhatsApp
 * @param {string} toPhone - E.164 formatted phone number (e.g. 919876543210)
 * @param {string} text - Message body
 */
export async function sendTextMessage(toPhone, text) {
  const cleanPhone = toPhone.replace(/[^0-9]/g, '');

  if (config.whatsapp.token && config.whatsapp.phoneNumberId) {
    try {
      const url = `${config.whatsapp.apiUrl}/${config.whatsapp.phoneNumberId}/messages`;
      const res = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { preview_url: true, body: text },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.whatsapp.token}`,
          },
        }
      );
      logger.info('WhatsApp text message sent', { to: maskedPhone(cleanPhone), messageId: res.data?.messages?.[0]?.id });
      return res.data;
    } catch (err) {
      logger.error('WhatsApp send text failed', { error: err.message, to: maskedPhone(cleanPhone) });
      return { success: false, error: err.message };
    }
  }

  // Simulation mode
  logger.info('[SIMULATION] WhatsApp message dispatched', {
    to: maskedPhone(cleanPhone),
    length: text.length,
  });
  return { success: true, simulated: true, to: cleanPhone };
}

/**
 * Send interactive buttons message (e.g. for deadline actions or scheme cards)
 * @param {string} toPhone
 * @param {string} bodyText
 * @param {Array<{ id: string, title: string }>} buttons - Max 3 buttons
 */
export async function sendInteractiveButtons(toPhone, bodyText, buttons) {
  const cleanPhone = toPhone.replace(/[^0-9]/g, '');

  if (config.whatsapp.token && config.whatsapp.phoneNumberId) {
    try {
      const url = `${config.whatsapp.apiUrl}/${config.whatsapp.phoneNumberId}/messages`;
      const res = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: bodyText },
            action: {
              buttons: buttons.slice(0, WA_LIMITS.buttons).map((btn) => ({
                type: 'reply',
                reply: { id: btn.id, title: btn.title.substring(0, WA_LIMITS.buttonTitle) },
              })),
            },
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.whatsapp.token}`,
          },
        }
      );
      return res.data;
    } catch (err) {
      logger.error('WhatsApp interactive button send failed', { error: err.message, to: maskedPhone(cleanPhone) });
      return sendTextMessage(cleanPhone, `${bodyText}\n\n${buttons.map(b => `👉 ${b.title}`).join('\n')}`);
    }
  }

  logger.info('[SIMULATION] WhatsApp interactive buttons dispatched', {
    to: maskedPhone(cleanPhone),
    buttonCount: Math.min(buttons.length, WA_LIMITS.buttons),
  });
  return { success: true, simulated: true };
}

/**
 * Send standard 7-3-1 day compliance reminder message
 * @param {string} toPhone
 * @param {Object} deadline - { title, deadlineDate, complianceType, penaltyEstimate, daysRemaining, sourceUrl }
 */
export async function sendDeadlineReminder(toPhone, deadline) {
  const urgencyEmoji = deadline.daysRemaining <= 1 ? '🚨' : deadline.daysRemaining <= 3 ? '⚠️' : '🗓️';
  const penaltyNote = deadline.penaltyEstimate
    ? `\n*देरी की पेनल्टी (संभावित):* ₹${deadline.penaltyEstimate.toLocaleString('en-IN')}`
    : '';

  const message = `${urgencyEmoji} *ComplianceOS अलर्ट: समय सीमा सूचना*\n\n` +
    `नमस्ते! आपके व्यवसाय के लिए एक महत्वपूर्ण अनुपालन तिथि आ रही है:\n\n` +
    `📌 *कार्य:* ${deadline.title}\n` +
    `📅 *अंतिम तिथि:* ${new Date(deadline.deadlineDate).toLocaleDateString('hi-IN')}\n` +
    `⏳ *शेष दिन:* ${deadline.daysRemaining} दिन${penaltyNote}\n\n` +
    `🔗 *आधिकारिक पोर्टल:* ${deadline.sourceUrl || 'https://www.gst.gov.in'}\n\n` +
    `_ComplianceOS आपको आधिकारिक पोर्टल पर सीधे मार्गदर्शन करता है। हम कभी लॉगिन नहीं मांगते।_`;

  return sendInteractiveButtons(toPhone, message, [
    { id: `checklist_${deadline.id || 'default'}`, title: 'चेकलिस्ट देखें' },
    { id: `ca_${deadline.id || 'default'}`, title: 'CA से शेयर करें' },
  ]);
}

export default {
  sendTextMessage,
  sendInteractiveButtons,
  sendDeadlineReminder,
  sendRenderedMessages,
};
