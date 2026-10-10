/**
 * PAN Validator — deterministic, no LLM
 * Format: 5 letters + 4 digits + 1 letter
 * Also cross-checks PAN embedded in a GSTIN (chars 2-11)
 */

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * Validate a PAN string
 * @param {string} value
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validatePan(value) {
  if (!value || typeof value !== 'string') {
    return { ok: false, reason: 'PAN is empty or not a string' };
  }

  const pan = value.trim().toUpperCase();

  if (pan.length !== 10) {
    return { ok: false, reason: `PAN must be 10 characters, got ${pan.length}` };
  }

  if (!PAN_REGEX.test(pan)) {
    return { ok: false, reason: 'PAN format invalid — expected 5 letters + 4 digits + 1 letter' };
  }

  return { ok: true };
}

/**
 * Cross-validate PAN against GSTIN
 * PAN is embedded in GSTIN at positions 2-11 (0-indexed)
 * @param {string} pan
 * @param {string} gstin
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validatePanGstinMatch(pan, gstin) {
  if (!pan || !gstin) {
    return { ok: true }; // Can't cross-validate if either is missing
  }

  const panUpper = pan.trim().toUpperCase();
  const gstinUpper = gstin.trim().toUpperCase();

  if (gstinUpper.length !== 15) {
    return { ok: true }; // GSTIN itself is invalid; that's caught by its own validator
  }

  const embeddedPan = gstinUpper.substring(2, 12);
  if (panUpper !== embeddedPan) {
    return {
      ok: false,
      reason: `PAN "${panUpper}" does not match PAN embedded in GSTIN "${gstinUpper}" (expected "${embeddedPan}")`,
    };
  }

  return { ok: true };
}
