'use strict';
/**
 * ComplianceOS — Server Entry Point
 */
const app = require('./app');
const config = require('./config');
const logger = require('./logger');
const prisma = require('./db');
const { startSentinelJob } = require('./jobs/sentinelCrawler');
const { startDeadlineReminderJob } = require('./jobs/deadlineReminder');

async function main() {
  // Test DB connection
  try {
    await prisma.$connect();
    logger.info('PostgreSQL connected via Prisma');
  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
    process.exit(1);
  }

  // Start background jobs (BullMQ)
  try {
    startSentinelJob();
    startDeadlineReminderJob();
    logger.info('Background jobs started (BullMQ)');
  } catch (err) {
    logger.warn('Background jobs failed to start (Redis may be unavailable)', { error: err.message });
  }

  // Start HTTP server
  const server = app.listen(config.port, () => {
    logger.info(`ComplianceOS API running`, {
      port: config.port,
      env: config.env,
      stack: 'PERN (PostgreSQL + Express + React + Node.js)',
    });
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Server closed, DB disconnected');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err.message });
  process.exit(1);
});
