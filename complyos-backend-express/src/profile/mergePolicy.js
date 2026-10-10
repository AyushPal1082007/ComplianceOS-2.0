import { PROFILE_FIELD_KEYS } from '../contracts/profileFields.js';

const FIELD_KEYS = new Set(PROFILE_FIELD_KEYS);
const NON_FIELD_KEYS = new Set([
  'completeness',
  'preferredLanguage',
  'healthScore',
  'penaltyAtRisk',
  'schemeHeadroom',
]);

function asField(value) {
  if (value && typeof value === 'object' && 'status' in value) {
    return {
      value: value.value ?? null,
      status: value.status || 'EMPTY',
      confidence: Number.isFinite(value.confidence) ? value.confidence : 0,
      source: value.source || 'aria_text',
      evidence: value.evidence,
      updatedAt: value.updatedAt || new Date().toISOString(),
    };
  }
  return {
    value: value ?? null,
    status: value === null || value === undefined ? 'EMPTY' : 'SELF_REPORTED',
    confidence: value === null || value === undefined ? 0 : 1,
    source: 'aria_text',
    updatedAt: new Date().toISOString(),
  };
}

function equalValues(left, right) {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || left === undefined || right === undefined) return false;
  return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
}

export function mergeProfile(current = {}, patch = {}, { origin = 'aria' } = {}) {
  const profile = {};
  for (const key of FIELD_KEYS) {
    profile[key] = asField(current[key]);
  }

  for (const key of NON_FIELD_KEYS) {
    if (Object.hasOwn(current, key)) profile[key] = current[key];
  }

  const changedKeys = [];
  const conflicts = [];
  const now = new Date().toISOString();

  for (const [key, candidate] of Object.entries(patch || {})) {
    if (NON_FIELD_KEYS.has(key)) {
      profile[key] = candidate;
      continue;
    }
    if (!FIELD_KEYS.has(key) || !candidate || typeof candidate !== 'object' || !('value' in candidate)) {
      continue;
    }

    const existing = profile[key];
    const incoming = asField(candidate);
    if (incoming.value === null || incoming.value === undefined) continue;
    if (origin !== 'veda_doc' && origin !== 'user_confirmed' && existing.status === 'VERIFIED') {
      if (!equalValues(existing.value, incoming.value)) {
        const question = `Aapne ${key} ke liye alag value di hai. Kaunsa sahi hai?`;
        profile[key] = {
          ...existing,
          status: 'NEEDS_CONFIRMATION',
          evidence: {
            ...(existing.evidence || {}),
            verifiedValue: existing.value,
            proposedValue: incoming.value,
          },
          updatedAt: now,
        };
        conflicts.push({ key, existingValue: existing.value, proposedValue: incoming.value, question });
        changedKeys.push(key);
      }
      continue;
    }

    if (origin === 'veda_doc' && existing.status === 'VERIFIED' && !equalValues(existing.value, incoming.value)) {
      const question = `Aapke verified ${key} aur document ki value alag hai. Kaunsa sahi hai?`;
      profile[key] = {
        ...existing,
        status: 'NEEDS_CONFIRMATION',
        evidence: {
          ...(existing.evidence || {}),
          verifiedValue: existing.value,
          proposedValue: incoming.value,
          documentEvidence: incoming.evidence,
        },
        updatedAt: now,
      };
      conflicts.push({ key, existingValue: existing.value, proposedValue: incoming.value, question });
      changedKeys.push(key);
      continue;
    }

    if (origin === 'veda_doc' && existing.status === 'SELF_REPORTED' && !equalValues(existing.value, incoming.value)) {
      const question = `Aapne ${existing.value} bataya tha, document mein ${incoming.value} hai. Kaunsa sahi hai?`;
      profile[key] = {
        ...existing,
        status: 'NEEDS_CONFIRMATION',
        evidence: {
          ...(existing.evidence || {}),
          selfReportedValue: existing.value,
          proposedDocumentValue: incoming.value,
          documentEvidence: incoming.evidence,
        },
        updatedAt: now,
      };
      conflicts.push({ key, existingValue: existing.value, proposedValue: incoming.value, question });
      changedKeys.push(key);
      continue;
    }

    if (equalValues(existing.value, incoming.value) && existing.status === 'VERIFIED' && origin !== 'user_confirmed') {
      continue;
    }

    const nextStatus = origin === 'user_confirmed'
      ? 'VERIFIED'
      : origin === 'veda_doc' && incoming.status === 'VERIFIED'
        ? 'VERIFIED'
        : incoming.status === 'VERIFIED'
          ? 'SELF_REPORTED'
          : incoming.status;
    const next = {
      ...incoming,
      status: nextStatus,
      source: origin === 'user_confirmed' ? 'user_confirmed' : origin === 'veda_doc' ? 'veda_doc' : incoming.source,
      updatedAt: now,
    };
    if (JSON.stringify(existing) !== JSON.stringify(next)) {
      profile[key] = next;
      changedKeys.push(key);
    }
  }

  return { profile, changedKeys: [...new Set(changedKeys)], conflicts };
}

export default { mergeProfile };
