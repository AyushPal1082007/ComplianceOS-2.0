/**
 * GSTIN Validator — deterministic, no LLM
 * Format: 2-digit state + 10-char PAN + 1 entity + Z + 1 checksum
 * Regex + state-code + mod-36 checksum (chars 0-9 → 0-9, A-Z → 10-35)
 */

/** Valid state codes (first 2 digits of GSTIN) */
const VALID_STATE_CODES = new Set([
  '01','02','03','04','05','06','07','08','09','10',
  '11','12','13','14','15','16','17','18','19','20',
  '21','22','23','24','25','26','27','28','29','30',
  '31','32','33','34','35','36','37','38',
  // Union territories and special codes
  '96','97',
]);

/** Map for GSTIN state code → state name */
export const GSTIN_STATE_MAP = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra', '28': 'Andhra Pradesh (old)',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman & Nicobar', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh',
  '96': 'Foreign Country', '97': 'Other Territory',
};

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/**
 * Compute GSTIN checksum character (15th position)
 * @param {string} gstin14 - first 14 characters of GSTIN
 * @returns {string} expected 15th character
 */
function computeChecksum(gstin14) {
  const charValue = (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 48 && code <= 57) return code - 48;       // '0'-'9' → 0-9
    if (code >= 65 && code <= 90) return code - 65 + 10;   // 'A'-'Z' → 10-35
    return -1;
  };

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = charValue(gstin14[i]);
    if (value < 0) return null;
    const factor = (i % 2 === 0) ? 1 : 2;
    const product = value * factor;
    const term = Math.floor(product / 36) + (product % 36);
    sum += term;
  }

  const checkValue = (36 - (sum % 36)) % 36;
  if (checkValue < 10) return String(checkValue);
  return String.fromCharCode(65 + checkValue - 10);
}

/**
 * Extract the embedded PAN from a GSTIN (characters at index 2–11)
 * @param {string} gstin
 * @returns {string}
 */
export function extractPanFromGstin(gstin) {
  return gstin.substring(2, 12);
}

/**
 * Get state name from GSTIN
 * @param {string} gstin
 * @returns {string|null}
 */
export function getStateFromGstin(gstin) {
  const code = gstin.substring(0, 2);
  return GSTIN_STATE_MAP[code] || null;
}

/**
 * Validate a GSTIN string
 * @param {string} value
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateGstin(value) {
  if (!value || typeof value !== 'string') {
    return { ok: false, reason: 'GSTIN is empty or not a string' };
  }

  const gstin = value.trim().toUpperCase();

  if (gstin.length !== 15) {
    return { ok: false, reason: `GSTIN must be 15 characters, got ${gstin.length}` };
  }

  if (!GSTIN_REGEX.test(gstin)) {
    return { ok: false, reason: 'GSTIN format invalid — expected pattern: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric' };
  }

  const stateCode = gstin.substring(0, 2);
  if (!VALID_STATE_CODES.has(stateCode)) {
    return { ok: false, reason: `Invalid state code "${stateCode}" in GSTIN` };
  }

  const expected = computeChecksum(gstin.substring(0, 14));
  if (expected === null) {
    return { ok: false, reason: 'GSTIN contains invalid characters for checksum computation' };
  }
  if (gstin[14] !== expected) {
    return { ok: false, reason: `GSTIN checksum mismatch: expected "${expected}" at position 15, got "${gstin[14]}"` };
  }

  return { ok: true };
}
