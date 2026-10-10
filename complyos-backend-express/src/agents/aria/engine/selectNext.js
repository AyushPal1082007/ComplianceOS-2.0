import { QUESTIONS } from '../questionBank/loader.js';
import weights from '../questionBank/weights.json' with { type: 'json' };
import { CORE_FIELDS, EXTENDED_FIELDS } from '../config.js';
import { getProfileField } from './completeness.js';

function valueAt(profile, field) {
  return getProfileField(profile, field).value;
}

function candidateAllowed(question, profile, session, phase) {
  const current = getProfileField(profile, question.field);
  if (!['EMPTY', 'NEEDS_CONFIRMATION'].includes(current.status)) return false;
  if (session.skippedIds.includes(question.id)) return false;
  if (question.askOnlyIf && valueAt(profile, question.askOnlyIf.field) !== question.askOnlyIf.eq) return false;
  if (question.tier === 'extended' && phase !== 'extended' && phase !== 'editing') return false;
  if (question.sensitivity === 2) {
    const otherRemaining = QUESTIONS.some((other) => other.id !== question.id && other.sensitivity < 2 && candidateAllowed(other, profile, session, 'extended'));
    if (otherRemaining) return false;
  }
  return true;
}

export function selectNext(profile, session, options = {}) {
  const phase = options.phase || session.phase;
  const candidates = QUESTIONS.filter((question) => candidateAllowed(question, profile, session, phase));
  const scored = candidates.map((question) => {
    const core = CORE_FIELDS.includes(question.field);
    const recencyPenalty = session.askedQuestionIds.slice(-2).includes(question.id) ? 2 : 0;
    const schemeGain = typeof options.schemeGain === 'function' ? Number(options.schemeGain(question.field)) || 0 : 0;
    return { question, score: (weights[question.field] || 1) * (core ? 1.5 : 1) + schemeGain - 3 * question.sensitivity - recencyPenalty };
  });
  scored.sort((left, right) => right.score - left.score || Number(CORE_FIELDS.includes(right.question.field)) - Number(CORE_FIELDS.includes(left.question.field)) || QUESTIONS.indexOf(left.question) - QUESTIONS.indexOf(right.question));
  return scored[0]?.question || null;
}

export function isProfileFieldQuestion(field) {
  return CORE_FIELDS.includes(field) || EXTENDED_FIELDS.includes(field);
}
