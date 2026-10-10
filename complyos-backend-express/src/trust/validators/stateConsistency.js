/**
 * State Consistency Validator — deterministic, no LLM
 * Cross-checks GSTIN state prefix against the address/state field.
 */

import { GSTIN_STATE_MAP } from './gstin.js';

/**
 * Normalize a state name for fuzzy matching
 * @param {string} name
 * @returns {string}
 */
function normalizeState(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/andhra\s*pradesh\s*\(?old\)?/, 'andhrapradesh');
}

/** Map of normalized state names to their canonical forms for matching */
const STATE_ALIASES = {
  'jammukashmir': 'jammu & kashmir',
  'jammuandkashmir': 'jammu & kashmir',
  'jk': 'jammu & kashmir',
  'hp': 'himachal pradesh',
  'himachalpradesh': 'himachal pradesh',
  'uttarpradesh': 'uttar pradesh',
  'up': 'uttar pradesh',
  'madhyapradesh': 'madhya pradesh',
  'mp': 'madhya pradesh',
  'tamilnadu': 'tamil nadu',
  'tn': 'tamil nadu',
  'westbengal': 'west bengal',
  'wb': 'west bengal',
  'andhrapradesh': 'andhra pradesh',
  'ap': 'andhra pradesh',
  'arunachalpradesh': 'arunachal pradesh',
  'chhattisgarh': 'chhattisgarh',
  'cg': 'chhattisgarh',
  'dadraandnagarhaveli': 'dadra & nagar haveli',
  'damananddiu': 'daman & diu',
  'andamanandnicobar': 'andaman & nicobar',
  'andamannicobar': 'andaman & nicobar',
  'nct': 'delhi',
  'newdelhi': 'delhi',
};

/**
 * Check if two state names refer to the same state
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function statesMatch(a, b) {
  const normA = normalizeState(a);
  const normB = normalizeState(b);

  if (normA === normB) return true;

  const resolvedA = STATE_ALIASES[normA] || normA;
  const resolvedB = STATE_ALIASES[normB] || normB;

  if (resolvedA === resolvedB) return true;

  // Check if one contains the other (e.g., "andhra pradesh" in "andhra pradesh (old)")
  if (resolvedA.includes(resolvedB) || resolvedB.includes(resolvedA)) return true;

  return false;
}

/**
 * Validate that GSTIN state prefix matches the address state
 * @param {string} gstin
 * @param {string} addressState
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateStateConsistency(gstin, addressState) {
  if (!gstin || !addressState) {
    return { ok: true }; // Can't validate if either is missing
  }

  const gstinUpper = gstin.trim().toUpperCase();
  if (gstinUpper.length < 2) {
    return { ok: true }; // Invalid GSTIN; caught by GSTIN validator
  }

  const stateCode = gstinUpper.substring(0, 2);
  const gstinStateName = GSTIN_STATE_MAP[stateCode];

  if (!gstinStateName) {
    return { ok: true }; // Unknown state code; caught by GSTIN validator
  }

  if (!statesMatch(gstinStateName, addressState)) {
    return {
      ok: false,
      reason: `GSTIN state prefix "${stateCode}" indicates "${gstinStateName}" but address says "${addressState}". Kaunsa sahi hai?`,
    };
  }

  return { ok: true };
}
