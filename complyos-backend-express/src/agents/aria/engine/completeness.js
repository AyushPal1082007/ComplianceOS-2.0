import { CORE_FIELDS, EXTENDED_FIELDS, DEFAULT_MAX_QUESTIONS } from '../config.js';

export function getProfileField(profile, key) {
  const value = profile?.[key];
  return value && typeof value === 'object' && 'status' in value ? value : { value: value ?? null, status: value == null ? 'EMPTY' : 'SELF_REPORTED' };
}

function fraction(profile, fields) {
  const complete = fields.filter((key) => ['SELF_REPORTED', 'VERIFIED'].includes(getProfileField(profile, key).status)).length;
  return fields.length ? complete / fields.length : 1;
}

export function completeness(profile) {
  const extendedFields = EXTENDED_FIELDS.filter((field) => field !== 'gstFilingFrequency' || getProfileField(profile, 'gstRegistered').value === true);
  return { core: fraction(profile, CORE_FIELDS), extended: fraction(profile, extendedFields) };
}

export function isComplete(profile, session, maxQuestions = Number(process.env.ARIA_MAX_QUESTIONS) || DEFAULT_MAX_QUESTIONS) {
  const result = completeness(profile);
  return { ...result, maxReached: session.turnCount >= maxQuestions, coreReady: result.core >= 0.8, extendedReady: result.extended >= 1 };
}
