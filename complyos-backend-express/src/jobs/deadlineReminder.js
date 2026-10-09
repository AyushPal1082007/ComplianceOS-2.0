'use strict';
/**
 * ComplianceOS — Deadline Reminder Background Job
 * Uses BullMQ if Redis is available, or in-process interval fallback.
 * Checks for upcoming deadlines at 7, 3, and 1-day intervals and triggers notifications.
 */
const { Queue, Worker } = require('bullmq');
const config = require('../config');
const logger = require('../logger');
const { checkDailyDeadlines } = require('./cronJobs');

let reminderWorker = null;
let intervalId = null;

function startDeadlineReminderJob() {
  try {
    const connection = {
      url: config.redis.url,
      maxRetriesPerRequest: null,
    };

    const reminderQueue = new Queue('deadline-reminders', { connection });

    reminderQueue.add(
      'check-deadlines',
      {},
      {
        repeat: { pattern: '0 8 * * *' }, // 8:00 AM daily
        removeOnComplete: true,
      }
    ).catch(() => {});

    reminderWorker = new Worker(
      'deadline-reminders',
      async () => {
        logger.info('Executing scheduled deadline reminders via BullMQ');
        await checkDailyDeadlines();
      },
      { connection }
    );

    reminderWorker.on('failed', (job, err) => {
      logger.warn('Deadline BullMQ job failed', { error: err.message });
    });

    logger.info('Deadline Reminder BullMQ worker initialized');
  } catch (err) {
    logger.warn('BullMQ setup failed for Deadline Reminders, using interval fallback', { error: err.message });
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    intervalId = setInterval(() => {
      checkDailyDeadlines().catch((e) => logger.warn('Deadline check error', { error: e.message }));
    }, TWELVE_HOURS);
  }
}

function stopDeadlineReminderJob() {
  if (reminderWorker) reminderWorker.close();
  if (intervalId) clearInterval(intervalId);
}

module.exports = {
  startDeadlineReminderJob,
  stopDeadlineReminderJob,
};
