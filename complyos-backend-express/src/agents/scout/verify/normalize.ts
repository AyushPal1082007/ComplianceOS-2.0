const namedEntities: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
  '#39': "'",
};

function decodeEntity(entity: string): string {
  const named = namedEntities[entity.toLowerCase()];
  if (named !== undefined) return named;

  const numeric = entity.match(/^#(x[\da-f]+|\d+)$/i)?.[1];
  if (!numeric) return `&${entity};`;

  const codePoint = numeric[0]?.toLowerCase() === 'x'
    ? Number.parseInt(numeric.slice(1), 16)
    : Number.parseInt(numeric, 10);
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return `&${entity};`;
  }
  return String.fromCodePoint(codePoint);
}

function decodeEntities(text: string): string {
  return text.replace(/&(#(?:x[\da-f]+|\d+)|[a-z][\da-z]+);/gi, (_whole, entity: string) => decodeEntity(entity));
}

function isNoiseLine(line: string): boolean {
  if (/last\s+(?:updated|modified)|visitor|\bhits?\b|\bcounter\b/i.test(line)) return true;

  const dateOnly = /^\s*(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\s*$/i;
  return dateOnly.test(line);
}

export function normalizeText(raw: string): string {
  const withoutHiddenContent = raw.replace(
    /<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    ' ',
  );
  const withLineBreaks = withoutHiddenContent
    .replace(/<br\b[^>]*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li|section|article|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<(?:p|div|li|section|article|tr|h[1-6])\b[^>]*>/gi, '\n');
  const plainText = decodeEntities(withLineBreaks.replace(/<[^>]*>/g, ' '));

  return plainText
    .split(/\r?\n/)
    .filter((line) => !isNoiseLine(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}