import crypto from 'crypto';
import Razorpay from 'razorpay';
import config from '../config.js';
import logger from '../logger.js';

/**
 * ComplianceOS — Razorpay Payment & Subscription Service (ES6 Module)
 * Implements transparent SaaS tiers, women-led MSME discounts (20-30%),
 * and strictly zero commission on CA professional fees per ICAI Ethics Code.
 */

let razorpayInstance = null;
if (config.razorpay.keyId && config.razorpay.keySecret && config.razorpay.keyId !== 'rzp_test_placeholder') {
  try {
    razorpayInstance = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  } catch (err) {
    logger.warn('Razorpay initialization failed', { error: err.message });
  }
}

/**
 * Calculate plan price with women-led entrepreneur discount
 * @param {string} plan - 'growth' | 'pro' | 'ca_lite' | 'ca_pro'
 * @param {boolean} isWomenLed
 * @returns {number} Amount in INR
 */
export function calculatePlanAmount(plan, isWomenLed = false) {
  if (isWomenLed && config.pricing.womenDiscount[plan]) {
    return config.pricing.womenDiscount[plan];
  }
  return config.pricing[plan] || 249;
}

/**
 * Create a new Razorpay payment order
 * @param {Object} params - { userId, plan, isWomenLed }
 * @returns {Promise<Object>}
 */
export async function createOrder({ userId, plan, isWomenLed = false }) {
  const amountInINR = calculatePlanAmount(plan, isWomenLed);
  const amountInPaise = amountInINR * 100;
  const receipt = `rcpt_${userId.substring(0, 8)}_${Date.now()}`;

  if (razorpayInstance) {
    try {
      const order = await razorpayInstance.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: { userId, plan, isWomenLed: String(isWomenLed) },
      });
      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        plan,
        amountInINR,
        keyId: config.razorpay.keyId,
      };
    } catch (err) {
      logger.error('Razorpay order creation failed', { error: err.message });
      throw err;
    }
  }

  // Demo / local sandbox order
  logger.info('[SANDBOX] Razorpay order created', { plan, amountInINR, userId });
  return {
    orderId: `order_mock_${Date.now()}`,
    amount: amountInPaise,
    currency: 'INR',
    plan,
    amountInINR,
    keyId: config.razorpay.keyId || 'rzp_test_sandbox',
    isSandbox: true,
  };
}

/**
 * Verify Razorpay payment signature
 * @param {string} orderId
 * @param {string} paymentId
 * @param {string} signature
 * @returns {boolean}
 */
export function verifyPaymentSignature(orderId, paymentId, signature) {
  if (orderId.startsWith('order_mock_')) {
    return true; // Auto-pass for sandbox testing
  }

  if (!config.razorpay.keySecret) {
    return true;
  }

  const generatedSignature = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return generatedSignature === signature;
}

/**
 * Verify webhook signature from Razorpay
 * @param {string} body - Raw body string
 * @param {string} signature - Header signature
 * @param {string} webhookSecret
 */
export function verifyWebhookSignature(body, signature, webhookSecret) {
  if (!webhookSecret) return true;
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
}

export default {
  calculatePlanAmount,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
};
