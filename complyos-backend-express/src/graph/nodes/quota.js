const MONTHLY_DOCUMENT_LIMITS = Object.freeze({
  free: 1,
  growth: 10,
  pro: 50,
  ca_lite: 10,
  ca_pro: 50,
});

export function currentMonth(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function documentQuota(state, date = new Date()) {
  const month = currentMonth(date);
  const saved = state.conversation.counters?.docsThisMonth || { month, count: 0 };
  const count = saved.month === month ? saved.count : 0;
  const limit = MONTHLY_DOCUMENT_LIMITS[state.user.plan] ?? MONTHLY_DOCUMENT_LIMITS.free;
  return { allowed: count < limit, count, limit, month };
}

export function recordProcessedDocument(state, documentId, date = new Date()) {
  const quota = documentQuota(state, date);
  const processed = state.conversation.flags?.processedDocumentIds || [];
  if (documentId && processed.includes(documentId)) return state.conversation;

  const flags = {
    ...(state.conversation.flags || {}),
    processedDocumentIds: documentId ? [...processed, documentId] : processed,
  };
  return {
    ...state.conversation,
    counters: {
      ...(state.conversation.counters || {}),
      docsThisMonth: { month: quota.month, count: quota.count + 1 },
    },
    flags,
  };
}

export default { documentQuota, recordProcessedDocument };
