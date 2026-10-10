/**
 * ARIA Question Selection - Delegated to Decision Engine
 * This file now acts as a bridge to the Akinator-style decision engine
 */

import { selectNext as decisionSelectNext, suggestOptimalPath, isProfileSufficient, getExpectedRemainingInformation } from './decisionEngine.js';
import { CORE_FIELDS, EXTENDED_FIELDS } from '../config.js';

// Re-export for backward compatibility
export { selectNext, suggestOptimalPath, isProfileFieldQuestion };

// Main entry point - delegates to decision engine
function selectNext(profile, session, options = {}) {
  return decisionSelectNext(profile, session, options);
}

function isProfileFieldQuestion(field) {
  return CORE_FIELDS.includes(field) || EXTENDED_FIELDS.includes(field);
}
