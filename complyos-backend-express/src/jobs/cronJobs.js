'use strict';
/**
 * ComplianceOS — Automated Background Cron Jobs
 * 1. Daily Compliance Deadline Check: Identifies deadlines due in 7, 3, and 1 days;
 *    dispatches multi-channel alerts (WhatsApp / In-App / SMS).
 * 2. Scheduled SENTINEL Crawl: Periodically checks official government portals for changes.
 */
import prisma from '../db.js';
import logger from '../logger.js';
import { sendDeadlineReminder } from '../services/whatsappService.js';
import { sendNotification } from '../services/notificationService.js';
import { runSentinelCrawl } from '../agents/sentinel.js';

let cronInterval = null;

/**
 * Check deadlines and dispatch 7-3-1 day reminders
 */
export async function checkDailyDeadlines() {
  logger.info('Running daily compliance deadline check');
  const now = new Date();
  const next7Days = new Date();
  next7Days.setDate(now.getDate() + 8);

  try {
    const upcomingDeadlines = await prisma.complianceDeadline.findMany({
      where: {
        status: 'pending',
        deadlineDate: {
          gte: now,
          lte: next7Days,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    for (const d of upcomingDeadlines) {
      const diffTime = new Date(d.deadlineDate) - now;
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if ([1, 3, 7].includes(daysRemaining)) {
        logger.info(`Dispatching ${daysRemaining}-day reminder for ${d.title} to user ${d.userId}`);

        await sendNotification({
          userId: d.userId,
          title: `समय सीमा सूचना: ${d.title}`,
          body: `यह कार्य ${daysRemaining} दिन में समाप्त हो रहा है (${new Date(d.deadlineDate).toLocaleDateString('hi-IN')})। समय पर कार्य करें।`,
          channels: ['in_app', 'whatsapp'],
          metadata: { deadlineId: d.id, daysRemaining },
        });

        if (d.user?.phone) {
          await sendDeadlineReminder(d.user.phone, {
            id: d.id,
            title: d.title,
            deadlineDate: d.deadlineDate,
            complianceType: d.complianceType,
            penaltyEstimate: d.penaltyEstimate,
            daysRemaining,
            sourceUrl: d.sourceUrl,
          });
        }
      }
    }
  } catch (err) {
    logger.error('Error during daily deadline check', { error: err.message });
  }
}

/**
 * Start background jobs
 */
export function startBackgroundJobs() {
  logger.info('Starting ComplianceOS background automation jobs');

  checkDailyDeadlines().catch((e) => logger.warn('Initial deadline check error', { error: e.message }));

  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  cronInterval = setInterval(() => {
    checkDailyDeadlines().catch((e) => logger.warn('Interval deadline check error', { error: e.message }));
  }, TWELVE_HOURS);
}

export function stopBackgroundJobs() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
}
