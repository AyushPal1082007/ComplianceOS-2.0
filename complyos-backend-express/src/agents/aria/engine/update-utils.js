export function normalizeQuote(value) {
  return String(value || '').normalize('NFC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('hi-IN');
}
export function quoteExists(text, quote) {
  const normalizedQuote = normalizeQuote(quote);
  return !!normalizedQuote && normalizeQuote(text).includes(normalizedQuote);
}
