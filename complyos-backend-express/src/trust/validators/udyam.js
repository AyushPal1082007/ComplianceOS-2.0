/**
 * Udyam Number Validator — deterministic, no LLM
 * Format: UDYAM-XX-00-0000000 (XX = 2-letter state code, 00 = 2 digits, 7 digits)
 */

const UDYAM_REGEX = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

/**
 * Validate an Udyam registration number
 * @param {string} value
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateUdyam(value) {
  if (!value || typeof value !== 'string') {
    return { ok: false, reason: 'Udyam number is empty or not a string' };
  }

  const udyam = value.trim().toUpperCase();

  if (!UDYAM_REGEX.test(udyam)) {
    return {
      ok: false,
      reason: `Udyam format invalid — expected UDYAM-XX-00-0000000, got "${udyam}"`,
    };
  }

  return { ok: true };
}
