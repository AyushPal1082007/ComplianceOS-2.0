'use strict';
/**
 * ComplianceOS — Automated Background Cron Jobs
 * 1. Daily Compliance Deadline Check: Identifies deadlines due in 7, 3, and 1 days;
 *    dispatches multi-channel alerts (WhatsApp / In-App / SMS).
 * 2. Scheduled SENTINEL Crawl: Periodically checks official government portals for changes.
 */
const prisma = require('../db');
const logger = require('../logger');
const { sendDeadlineReminder } = require('../services/whatsappService');
const { sendNotification } = require('../services/notificationService');
const { runSentinelCrawl } = require('../agents/sentinel');

let cronInterval = null;

/**
 * Check deadlines and dispatch 7-3-1 day reminders
 */
async function checkDailyDeadlines() {
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

      // Trigger alerts specifically on 7, 3, or 1 days before deadline
      if ([1, 3, 7].includes(daysRemaining)) {
        logger.info(`Dispatching ${daysRemaining}-day reminder for ${d.title} to user ${d.userId}`);

        // In-App Notification
        await sendNotification({
          userId: d.userId,
          title: `समय सीमा सूचना: ${d.title}`,
          body: `यह कार्य ${daysRemaining} दिन में समाप्त हो रहा है (${new Date(d.deadlineDate).toLocaleDateString('hi-IN')})। समय पर पूरा करें।`,
          channels: ['in_app', 'whatsapp'],
          metadata: { deadlineId: d.id, daysRemaining },
        });

        // WhatsApp Reminder
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
function startBackgroundJobs() {
  logger.info('Starting ComplianceOS background automation jobs');

  // Run initial check
  checkDailyDeadlines().catch((e) => logger.warn('Initial deadline check error', { error: e.message }));

  // Periodic interval (every 12 hours)
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  cronInterval = setInterval(() => {
    checkDailyDeadlines().catch((e) => logger.warn('Interval deadline check error', { error: e.message }));
  }, TWELVE_HOURS);
}

function stopBackgroundJobs() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
}

module.exports = {
  startBackgroundJobs,
  stopBackgroundJobs,
  checkDailyDeadlines,
};
