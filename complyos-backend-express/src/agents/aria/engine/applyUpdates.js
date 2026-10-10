import { PROFILE_FIELD_KEYS, PROFILE_ENUMS } from './profileRules.js';
import { applyAnswer } from './session.js';

function fieldValue(field) {
  return field && typeof field === 'object' && 'status' in field ? field.value : field ?? null;
}

function fieldStatus(field) {
  return field && typeof field === 'object' && 'status' in field ? field.status : field == null ? 'EMPTY' : 'SELF_REPORTED';
}

function isAllowed(field, value) {
  if (!PROFILE_FIELD_KEYS.has(field) || value === null || value === undefined) return false;
  if (field === 'state' || field === 'district' || field === 'subSector') return typeof value === 'string' && value.trim().length > 0;
  if (field === 'gstin' || field === 'udyamNumber') return typeof value === 'string' && value.length > 0;
  return PROFILE_ENUMS[field]?.has(value) || false;
}

export function applyUpdates(profile = {}, session, updates = [], options = {}) {
  const nextProfile = { ...profile };
  const profilePatch = {};
  let nextSession = session;
  const applied = [];

  for (const update of updates) {
    if (!isAllowed(update.field, update.value)) continue;
    if (options.requireQuote && (!update.quote || !options.sourceText || !options.quoteCheck?.(options.sourceText, update.quote))) continue;
    const key = update.field;
    const current = profile[key];
    const oldValue = fieldValue(current);
    const oldStatus = fieldStatus(current);
    const conflictsWithVerified = oldStatus === 'VERIFIED' && JSON.stringify(oldValue) !== JSON.stringify(update.value);
    if (oldStatus === 'VERIFIED' && !conflictsWithVerified) continue;
    const confidence = update.via === 'option' ? 1 : update.confidence;
    const source = update.via === 'option' ? 'aria_option' : update.via === 'voice' ? 'aria_voice' : 'aria_text';
    const status = conflictsWithVerified ? 'NEEDS_CONFIRMATION'
      : key === 'gstin' || key === 'udyamNumber' ? 'NEEDS_CONFIRMATION'
        : confidence >= 0.8 ? 'SELF_REPORTED' : 'NEEDS_CONFIRMATION';
    const evidence = {
      ...(update.quote ? { quote: update.quote } : {}),
      ...(update.transcriptId ? { transcriptId: update.transcriptId } : {}),
      ...(conflictsWithVerified ? { verifiedValue: oldValue, verifiedEvidence: current.evidence } : {}),
    };
    const field = {
      value: conflictsWithVerified ? oldValue : update.value,
      status,
      confidence,
      source,
      ...(Object.keys(evidence).length ? { evidence } : {}),
      updatedAt: new Date().toISOString(),
    };
    nextProfile[key] = field;
    profilePatch[key] = field;
    applied.push({ field: key, value: field.value, status });

    const questionId = options.questionByField?.get(key)?.id || key;
    nextSession = applyAnswer(nextSession, questionId, key, current ?? null, update.value, update.via || 'text');
  }

  return { profile: nextProfile, profilePatch, session: nextSession, applied };
}
