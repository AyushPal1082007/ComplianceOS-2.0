import crypto from 'node:crypto';
import config from '../config.js';
import { TEMPLATE_MODE } from '../config/flags.js';
import prisma from '../db.js';
import logger from '../logger.js';
import * as conversationRepo from '../repos/conversationRepo.js';
import * as userRepo from '../repos/userRepo.js';
import { memoryStore, usesMemoryRepository } from '../repos/memory/store.js';
import { sendTextMessage, sendWhatsAppUtilityTemplate } from './whatsappService.js';

const WINDOW_MS = 24 * 60 * 60 * 1000;
const UTILITY_KINDS = new Set(['deadline_reminder', 'sentinel']);

function maskedPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length < 4 ? '[REDACTED PHONE]' : `***${digits.slice(-4)}`;
}

export function resolveWhatsAppDelivery({
  lastInboundAt,
  now = new Date(),
  templateMode = TEMPLATE_MODE,
  templateName = config.whatsapp.sentinelTemplateName,
  kind,
}) {
  const inboundTime = lastInboundAt ? new Date(lastInboundAt).getTime() : NaN;
  const age = now.getTime() - inboundTime;
  if (Number.isFinite(age) && age >= 0 && age < WINDOW_MS) return 'session';
  if (templateMode && templateName?.trim() && UTILITY_KINDS.has(kind)) return 'utility_template';
  return 'in_app_only';
}

async function createInAppOnce({ userId, title, body, metadata, dedupeKey }) {
  if (usesMemoryRepository()) {
    if (dedupeKey) {
      const existing = [...memoryStore.notifications.values()].find((item) => (
        item.userId === userId && item.metadata?.dedupeKey === dedupeKey
      ));
      if (existing) return { created: false, notification: existing };
    }
    const notification = {
      id: crypto.randomUUID(),
      userId,
      title,
      body,
      channel: 'in_app',
      isRead: false,
      metadata,
      createdAt: new Date(),
    };
    memoryStore.notifications.set(notification.id, notification);
    return { created: true, notification };
  }

  const createNotification = async (client) => {
    if (dedupeKey) {
      const existing = await client.notification.findFirst({
        where: {
          userId,
          channel: 'in_app',
          metadata: { path: ['dedupeKey'], equals: dedupeKey },
        },
      });
      if (existing) return { created: false, notification: existing };
    }
    const notification = await client.notification.create({
      data: {
        userId,
        title,
        body,
        channel: 'in_app',
        isRead: false,
        metadata,
      },
    });
    return { created: true, notification };
  };

  if (!dedupeKey) return createNotification(prisma);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${dedupeKey}, 0))`;
    return createNotification(tx);
  });
}

export async function notify({
  userId,
  user: suppliedUser,
  title,
  body,
  metadata = {},
  dedupeKey,
  kind,
  inAppStored = false,
  whatsapp = true,
  now = new Date(),
}, dependencies = {}) {
  if (!userId || !title || !body) throw new TypeError('Notification requires userId, title, and body');
  const user = suppliedUser || await (dependencies.findUser || userRepo.findById)(userId);
  if (!user) throw new Error(`Cannot notify unknown user ${userId}`);

  let inAppResult = { success: true, storedElsewhere: true };
  if (!inAppStored) {
    const stored = await (dependencies.createInApp || createInAppOnce)({
      userId,
      title,
      body,
      metadata: { ...metadata, ...(dedupeKey ? { dedupeKey } : {}) },
      dedupeKey,
    });
    inAppResult = { success: true, id: stored.notification.id, duplicate: !stored.created };
    if (!stored.created) return { in_app: inAppResult, whatsapp: { success: true, skipped: 'duplicate' } };
  }

  if (!whatsapp || !user.phone) {
    return { in_app: inAppResult, whatsapp: { success: true, skipped: 'unavailable' } };
  }

  const conversation = await (dependencies.loadConversation || conversationRepo.load)(userId);
  const mode = resolveWhatsAppDelivery({
    lastInboundAt: conversation.lastInboundAt,
    now,
    templateMode: dependencies.templateMode ?? TEMPLATE_MODE,
    templateName: dependencies.templateName ?? config.whatsapp.sentinelTemplateName,
    kind,
  });
  if (mode === 'in_app_only') {
    return { in_app: inAppResult, whatsapp: { success: true, skipped: 'outside_window_no_approved_utility_template' } };
  }

  try {
    const result = mode === 'session'
      ? await (dependencies.sendText || sendTextMessage)(user.phone, `🔔 *${title}*\n\n${body}\n\n_ComplianceOS_`)
      : await (dependencies.sendTemplate || sendWhatsAppUtilityTemplate)(
        user.phone,
        dependencies.templateName ?? config.whatsapp.sentinelTemplateName,
        { title, body },
      );
    if (result?.success === false) {
      logger.warn('Notification channel delivery failed', { kind, mode, to: maskedPhone(user.phone) });
      return { in_app: inAppResult, whatsapp: { success: false, mode } };
    }
    return { in_app: inAppResult, whatsapp: { success: true, mode } };
  } catch (error) {
    logger.warn('Notification channel delivery failed', {
      kind,
      mode,
      to: maskedPhone(user.phone),
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return { in_app: inAppResult, whatsapp: { success: false, mode } };
  }
}

export default { notify, resolveWhatsAppDelivery };
