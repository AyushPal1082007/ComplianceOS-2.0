export function normalizeSourceText(rawText = '') {
  if (!rawText || typeof rawText !== 'string') return '';

  return rawText
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default {
  normalizeSourceText,
};
