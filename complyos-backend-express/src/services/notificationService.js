import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';
import axios from 'axios';

import prisma from '../db.js';
import config from '../config.js';
import logger from '../logger.js';
import { sendTextMessage } from './whatsappService.js';

/**
 * ComplianceOS — Multi-channel Notification Service (ES6 Module)
 * Dispatches alerts across In-App, WhatsApp, Email (Resend), and SMS (Fast2SMS).
 */

const resend = config.resend.apiKey ? new Resend(config.resend.apiKey) : null;

/**
 * Dispatch notification across channels
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.title
 * @param {string} params.body
 * @param {Array<'in_app' | 'whatsapp' | 'email' | 'sms'>} [params.channels=['in_app']]
 * @param {Object} [params.metadata]
 */
export async function sendNotification({ userId, title, body, channels = ['in_app'], metadata = {} }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: 'User not found' };

  const results = {};

  // 1. In-App Notification (Always stored in DB)
  if (channels.includes('in_app')) {
    try {
      const inAppNotif = await prisma.notification.create({
        data: {
          id: uuidv4(),
          userId,
          title,
          body,
          channel: 'in_app',
          isRead: false,
          metadata,
        },
      });
      results.in_app = { success: true, id: inAppNotif.id };
    } catch (err) {
      logger.error('Failed to create in-app notification', { error: err.message });
      results.in_app = { success: false, error: err.message };
    }
  }

  // 2. WhatsApp Notification
  if (channels.includes('whatsapp') && user.phone) {
    try {
      const waResult = await sendTextMessage(
        user.phone,
        `🔔 *${title}*\n\n${body}\n\n_ComplianceOS Co-pilot_`
      );
      results.whatsapp = waResult;
    } catch (err) {
      results.whatsapp = { success: false, error: err.message };
    }
  }

  // 3. Email Notification (Resend)
  if (channels.includes('email') && user.email) {
    if (resend) {
      try {
        const emailRes = await resend.emails.send({
          from: config.resend.from,
          to: user.email,
          subject: title,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
              <h2 style="color: #0f172a;">${title}</h2>
              <p style="font-size: 16px; line-height: 1.5;">${body}</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #64748b;">
                ComplianceOS — भारत का MSME कम्प्लायंस को-पायलट | Build with Bharat 4.0
              </p>
            </div>
          `,
        });
        results.email = { success: true, id: emailRes.data?.id };
      } catch (err) {
        logger.error('Resend email error', { error: err.message });
        results.email = { success: false, error: err.message };
      }
    } else {
      results.email = { success: true, simulated: true };
    }
  }

  // 4. SMS Notification (Fast2SMS)
  if (channels.includes('sms') && user.phone && config.fast2sms.apiKey) {
    try {
      const cleanPhone = user.phone.replace(/[^0-9]/g, '').slice(-10);
      const smsRes = await axios.post(
        config.fast2sms.apiUrl,
        {
          route: 'q',
          message: `${title}: ${body.substring(0, 120)}`,
          language: 'english',
          flash: 0,
          numbers: cleanPhone,
        },
        {
          headers: {
            authorization: config.fast2sms.apiKey,
          },
        }
      );
      results.sms = { success: smsRes.data?.return };
    } catch (err) {
      logger.error('Fast2SMS error', { error: err.message });
      results.sms = { success: false, error: err.message };
    }
  }

  return results;
}

export default {
  sendNotification,
};
