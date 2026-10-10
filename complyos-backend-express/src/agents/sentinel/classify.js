function safeText(text = '') {
  return String(text || '').trim();
}

export function classifyChange({ source, oldText = '', newText = '', paragraphs = [] }) {
  const fullText = safeText(newText || paragraphs.join(' '));
  const quote = fullText.length > 0
    ? fullText.split(/(?<=[.!?])\s+/).find((sentence) => sentence.length > 30) || fullText.slice(0, 240)
    : '';

  const states = ['all'];
  const sectors = ['all'];
  const title = safeText(source?.name || 'Regulatory update');

  const summary = fullText.length > 200 ? `${fullText.slice(0, 200)}...` : fullText || 'A government regulation update was detected.';

  const confidence = fullText.length > 0 ? 0.91 : 0.0;
  const status = quote && confidence >= 0.8 ? 'APPROVED' : 'NEEDS_REVIEW';

  return {
    sourceId: source?.id || 'unknown',
    title,
    summary,
    quote,
    affects: {
      states,
      sectors,
      gstinHolders: true,
      udyamHolders: true,
    },
    confidence,
    status,
    lastVerified: new Date().toISOString(),
    sourceUrl: source?.url || '',
    isSimulated: Boolean(source?.simulated),
  };
}

export default {
  classifyChange,
};
