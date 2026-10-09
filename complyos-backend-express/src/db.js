import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

/**
 * ComplianceOS — Prisma Database Client (Singleton ES6 Module)
 */
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug('Prisma Query', { query: e.query, duration: `${e.duration}ms` });
  });
}

prisma.$on('error', (e) => {
  logger.error('Prisma Error', { message: e.message });
});

export default prisma;
