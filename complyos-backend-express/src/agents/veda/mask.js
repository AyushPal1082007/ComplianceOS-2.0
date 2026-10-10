/**
 * ComplianceOS — VEDA Privacy & Masking Module
 * Masks 12-digit Aadhaar-like numbers to last 4 digits (e.g. XXXX-XXXX-1234 or XXXXXXXX1234).
 * Also masks any password / OTP patterns.
 * Never stores, logs, or sends unmasked Aadhaar to LLMs.
 */

/**
 * Mask 12-digit Aadhaar numbers in a string:
 * Matches patterns:
 * - 1234 5678 9012 -> XXXX XXXX 9012
 * - 1234-5678-9012 -> XXXX-XXXX-9012
 * - 123456789012   -> XXXXXXXX9012
 *
 * @param {string} text - text to sanitize
 * @returns {string} sanitized text with Aadhaar numbers masked
 */
export function maskAadhaar(text) {
  if (!text || typeof text !== 'string') return text;

  // Spaced or hyphenated 4-4-4 digits
  let masked = text.replace(/\b(\d{4})([ -])(\d{4})([ -])(\d{4})\b/g, (match, p1, sep1, p2, sep2, p4) => {
    return `XXXX${sep1}XXXX${sep2}${p4}`;
  });

  // Continuous 12 digits (not part of longer numbers like timestamps or 15-char GSTIN/PAN)
  // Ensure word boundaries or non-alphanumeric boundaries
  masked = masked.replace(/(?<![0-9A-Za-z])\d{8}(\d{4})(?![0-9A-Za-z])/g, (match, last4) => {
    return `XXXXXXXX${last4}`;
  });

  return masked;
}

/**
 * Mask potential OTPs and passwords
 * @param {string} text
 * @returns {string}
 */
export function maskSensitiveTokens(text) {
  if (!text || typeof text !== 'string') return text;
  let masked = maskAadhaar(text);

  // OTP patterns: "OTP is 123456" or "OTP: 1234"
  masked = masked.replace(/\b(otp(?:\s+is)?\s*[:=]?\s*)\d{4,8}\b/gi, '$1******');

  // Password patterns
  masked = masked.replace(/\b(password|passwd|pwd)\s*[:=]\s*\S+/gi, '$1: [REDACTED]');

  return masked;
}

export default {
  maskAadhaar,
  maskSensitiveTokens,
};
