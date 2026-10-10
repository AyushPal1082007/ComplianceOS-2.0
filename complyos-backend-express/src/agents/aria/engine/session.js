import { AriaSessionSchema } from '../../../contracts/aria.js';

export function newSession(language = 'hinglish') {
  return AriaSessionSchema.parse({
    phase: 'welcome', askedQuestionIds: [], skippedIds: [], history: [], turnCount: 0,
    language: ['hi', 'en', 'hinglish'].includes(language) ? language : 'hinglish', retryCounts: {},
  });
}

export function snapshotSession(session) {
  return AriaSessionSchema.parse(structuredClone(session));
}

export function applyAnswer(session, questionId, field, previousValue, newValue, via) {
  const next = snapshotSession(session);
  next.phase = 'asking';
  next.lastQuestionId = questionId;
  next.turnCount += 1;
  next.history.push({ qid: questionId, field, previousValue, newValue, via, ts: new Date().toISOString() });
  if (!next.askedQuestionIds.includes(questionId)) next.askedQuestionIds.push(questionId);
  next.skippedIds = next.skippedIds.filter((id) => id !== questionId);
  return next;
}

export function undo(session) {
  const next = snapshotSession(session);
  const change = next.history.pop();
  if (!change) return { session: next, change: null };
  next.phase = 'asking';
  next.lastQuestionId = change.qid;
  next.turnCount += 1;
  return { session: next, change };
}

export function markSkipped(session, questionId) {
  const next = snapshotSession(session);
  if (!next.skippedIds.includes(questionId)) next.skippedIds.push(questionId);
  next.lastQuestionId = questionId;
  next.turnCount += 1;
  return next;
}
