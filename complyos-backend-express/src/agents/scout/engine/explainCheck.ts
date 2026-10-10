import type { ExplanationPayload, SchemeMatch, SchemeRecord } from '../schemas.ts';

const devanagariDigits: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

const numberWords = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy',
  'eighty', 'ninety', 'hundred', 'thousand', 'million', 'billion', 'lakh', 'lakhs',
  'crore', 'crores', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ',
  'दस', 'सौ', 'हज़ार', 'हजार', 'लाख', 'करोड़', 'करोड़',
];

const officeWords = [
  'office', 'department', 'ministry', 'authority', 'portal', 'bank', 'board',
  'directorate', 'collectorate', 'कार्यालय', 'विभाग', 'मंत्रालय', 'प्राधिकरण', 'बैंक',
];

function normalizeDigits(value: string): string {
  return value.replace(/[०-९]/g, (digit) => devanagariDigits[digit] ?? digit);
}

function normalizedWords(value: string): Set<string> {
  return new Set(value.toLocaleLowerCase().match(/[\p{L}\p{M}]+/gu) ?? []);
}

function numericTokens(value: string): string[] {
  return (normalizeDigits(value).match(/[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?/g) ?? [])
    .map((token) => token.replace(/,/g, ''));
}

function normalizedAmount(value: string): string {
  return normalizeDigits(value)
    .toLocaleLowerCase()
    .replace(/,/g, '')
    .replace(/\s+/g, '');
}

function containsUnknownUrl(text: string, allowed: string): boolean {
  const urls = text.match(/https?:\/\/[^\s<>()]+/gi) ?? [];
  const normalizedAllowed = allowed.toLocaleLowerCase();
  return urls.some((url) => {
    const cleanUrl = url.replace(/[.,!?;:]+$/, '').toLocaleLowerCase();
    return !normalizedAllowed.includes(cleanUrl);
  });
}

function containsUnknownName(text: string, allowed: string): boolean {
  const allowedLower = allowed.toLocaleLowerCase().replace(/\s+/g, ' ');
  const capitalizedNames = text.match(/\b[A-Z][\p{L}\p{M}'’&.-]*(?:\s+[A-Z][\p{L}\p{M}'’&.-]*)+\b/gu) ?? [];
  if (capitalizedNames.some((name) => !allowedLower.includes(name.toLocaleLowerCase().replace(/\s+/g, ' ')))) {
    return true;
  }

  const words = normalizedWords(text);
  const allowedWords = normalizedWords(allowed);
  return officeWords.some((word) => words.has(word) && !allowedWords.has(word));
}

function hasUnsupportedNumbers(text: string, allowed: string): boolean {
  const candidateNumbers = numericTokens(text);
  const allowedNumbers = new Set(numericTokens(allowed));
  if (candidateNumbers.some((number) => !allowedNumbers.has(number))) return true;

  const candidateWords = normalizedWords(text);
  const allowedWords = normalizedWords(allowed);
  if (numberWords.some((word) => candidateWords.has(word) && !allowedWords.has(word))) return true;

  const amounts = text.match(/(?:₹|INR\s*)\s*[0-9०-९][0-9०-९,]*(?:\.[0-9०-९]+)?(?:\s*(?:lakh|lakhs|crore|crores|लाख|करोड़|करोड़))?/gi) ?? [];
  const normalizedAllowed = normalizedAmount(allowed);
  return amounts.some((amount) => !normalizedAllowed.includes(normalizedAmount(amount)));
}

export function explainCheck(
  explanation: ExplanationPayload,
  match: SchemeMatch,
  scheme: SchemeRecord,
): boolean {
  const allowedFacts = `${JSON.stringify(match)} ${scheme.benefit}`;
  const texts = [explanation.explanation_hi, explanation.explanation_en];

  for (const text of texts) {
    if (!text.trim() || text.length > 600) return false;
    if (match.result === 'possible' && /eligible|पात्र/i.test(text)) return false;
    if (hasUnsupportedNumbers(text, allowedFacts)) return false;
    if (containsUnknownUrl(text, allowedFacts)) return false;
    if (containsUnknownName(text, allowedFacts)) return false;
  }

  return true;
}