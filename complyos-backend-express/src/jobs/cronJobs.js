'use strict';
/**
 * ComplianceOS — Automated Background Cron Jobs
 * 1. Daily Compliance Deadline Check: Identifies deadlines due in 7, 3, and 1 days;
 *    dispatches multi-channel alerts (WhatsApp / In-App / SMS).
 * 2. Scheduled SENTINEL Crawl: Periodically checks official government portals for changes.
 */
import prisma from '../db.js';
import logger from '../logger.js';
import { notify } from '../services/notify.js';
import { runSentinelCrawl } from '../agents/sentinel.js';

let cronInterval = null;

/**
 * Check deadlines and dispatch 7-3-1 day reminders
 */
export async function checkDailyDeadlines({
  now = new Date(),
  findUpcomingDeadlines,
  notifyUser = notify,
  notifyDependencies,
} = {}) {
  logger.info('Running daily compliance deadline check');
  const next7Days = new Date(now);
  next7Days.setDate(now.getDate() + 8);
  const queryUpcomingDeadlines = findUpcomingDeadlines || (() => prisma.complianceDeadline.findMany({
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
    }));
  const upcomingDeadlines = await queryUpcomingDeadlines({
    now,
    next7Days,
  });

  let notified = 0;
  let skipped = 0;
  for (const deadline of upcomingDeadlines) {
    const diffTime = new Date(deadline.deadlineDate) - now;
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (![1, 3, 7].includes(daysRemaining)) continue;

    const dateKey = new Date(deadline.deadlineDate).toISOString().slice(0, 10);
    const result = await notifyUser({
      userId: deadline.userId,
      user: deadline.user,
      title: `समय सीमा सूचना: ${deadline.title}`,
      body: `यह कार्य ${daysRemaining} दिन में समाप्त हो रहा है (${new Date(deadline.deadlineDate).toLocaleDateString('hi-IN')})। समय पर कार्य करें।`,
      kind: 'deadline_reminder',
      metadata: { deadlineId: deadline.id, daysRemaining },
      dedupeKey: `deadline-reminder:${deadline.id}:${dateKey}:${daysRemaining}`,
      now,
    }, notifyDependencies);
    if (result?.in_app?.duplicate) skipped++;
    else notified++;
  }
  return { checked: upcomingDeadlines.length, notified, skipped };
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
