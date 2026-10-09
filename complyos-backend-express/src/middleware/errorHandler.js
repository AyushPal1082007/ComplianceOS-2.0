import logger from '../logger.js';

/**
 * ComplianceOS — Global Error Handler Middleware (ES6 Module)
 */
export default function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Duplicate entry — this record already exists.',
      field: err.meta?.target,
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found.' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired. Please log in again.' });
  }

  // Validation / app errors
  if (err.status || err.statusCode) {
    return res.status(err.status || err.statusCode).json({
      error: err.message,
    });
  }

  // Fallback 500
  res.status(500).json({
    error: 'Internal server error. Our team has been notified.',
  });
}
