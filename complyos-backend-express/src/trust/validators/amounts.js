/**
 * Amount Validator — deterministic, no LLM
 * Handles Indian comma format (1,25,000.00), Rs./₹ prefix, and plain numbers.
 */

/**
 * Parse an Indian-format amount string to a number
 * @param {string} value
 * @returns {{ amount: number|null, reason?: string }}
 */
export function parseAmount(value) {
  if (value === null || value === undefined) {
    return { amount: null, reason: 'Amount is empty' };
  }

  // If already a number
  if (typeof value === 'number') {
    if (isNaN(value)) return { amount: null, reason: 'Amount is NaN' };
    if (value < 0) return { amount: null, reason: 'Amount cannot be negative' };
    return { amount: value };
  }

  if (typeof value !== 'string') {
    return { amount: null, reason: 'Amount is not a string or number' };
  }

  let cleaned = value.trim();

  // Remove currency symbols and prefixes
  cleaned = cleaned.replace(/^(Rs\.?|₹|INR)\s*/i, '');
  cleaned = cleaned.replace(/\s*(Rs\.?|₹|INR)\s*$/i, '');
  cleaned = cleaned.replace(/\/-$/, ''); // trailing /-

  // Remove thousands separators (Indian: 1,25,000 or Western: 125,000)
  // Keep the decimal point
  cleaned = cleaned.replace(/,/g, '');

  // Remove spaces
  cleaned = cleaned.replace(/\s/g, '');

  if (cleaned === '' || cleaned === '-') {
    return { amount: null, reason: 'Amount is empty after cleaning' };
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) {
    return { amount: null, reason: `Cannot parse "${value}" as a number` };
  }

  if (num < 0) {
    return { amount: null, reason: 'Amount cannot be negative' };
  }

  return { amount: num };
}

/**
 * Validate an amount value
 * @param {string|number} value
 * @returns {{ ok: boolean, reason?: string, parsed?: number }}
 */
export function validateAmount(value) {
  const { amount, reason } = parseAmount(value);
  if (amount === null) {
    return { ok: false, reason };
  }
  return { ok: true, parsed: amount };
}
