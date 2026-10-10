import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

/**
 * ComplianceOS — Prisma Database Client (Singleton ES6 Module)
 */
const prisma = new PrismaClient({
  log: [
    { level: 'error' },
    { level: 'warn' },
  ],
});

prisma.$on('error', (e) => {
  logger.error('Prisma Error', { message: e.message });
});

export default prisma;
