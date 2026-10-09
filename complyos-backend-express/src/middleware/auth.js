import jwt from 'jsonwebtoken';
import config from '../config.js';
import prisma from '../db.js';

/**
 * ComplianceOS — JWT Auth Middleware (ES6 Module)
 */

/**
 * Verify JWT, attach user to req.user
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    return next(err); // handled by errorHandler
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      plan: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'User not found or inactive.' });
  }

  req.user = user;
  next();
}

/**
 * Require CA role
 */
export function requireCA(req, res, next) {
  if (req.user.role !== 'ca' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'CA access required.' });
  }
  next();
}

/**
 * Require admin role
 */
export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

export default { authenticate, requireCA, requireAdmin };
