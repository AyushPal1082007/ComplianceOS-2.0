const WORDS = new Map([
  ['zero', 0], ['shunya', 0], ['ek', 1], ['one', 1], ['do', 2], ['two', 2],
  ['teen', 3], ['three', 3], ['char', 4], ['chaar', 4], ['four', 4],
  ['paanch', 5], ['panch', 5], ['five', 5], ['chhe', 6], ['cheh', 6], ['six', 6],
  ['saat', 7], ['seven', 7], ['aath', 8], ['eight', 8], ['nau', 9], ['nine', 9],
  ['das', 10], ['ten', 10], ['gyarah', 11], ['barah', 12], ['terah', 13],
  ['chaudah', 14], ['pandrah', 15], ['solah', 16], ['satrah', 17], ['atharah', 18],
  ['unnis', 19], ['bees', 20], ['ikkis', 21], ['bais', 22], ['teis', 23], ['chaubis', 24],
  ['pachis', 25], ['chabbis', 26], ['sattais', 27], ['athais', 28], ['untis', 29],
  ['tees', 30], ['ikattis', 31], ['battis', 32], ['taintees', 33], ['chautees', 34],
  ['paintees', 35], ['chhattis', 36], ['saintis', 37], ['adtees', 38], ['untalis', 39],
  ['chalis', 40], ['pachaas', 50], ['saath', 60], ['sattar', 70], ['assi', 80],
  ['nabbe', 90], ['sau', 100], ['hundred', 100],
  ['ikkis',21],['bais',22],['teis',23],['chaubis',24],['pachis',25],['chhabbis',26],['sattais',27],['athais',28],['untis',29],
  ['ikattis',31],['battis',32],['taintis',33],['chauntis',34],['paintis',35],['chhattis',36],['saintis',37],['adtis',38],['untalis',39],
  ['iktalis',41],['bayalis',42],['taintalis',43],['chawalis',44],['paintalis',45],['chhiyalis',46],['saintalis',47],['adtalis',48],['unchaas',49],
  ['ikyavan',51],['bavan',52],['tirpan',53],['chauvan',54],['pachpan',55],['chhappan',56],['sattavan',57],['athavan',58],['unsath',59],
  ['iksath',61],['basath',62],['tirsath',63],['chaunsath',64],['painsath',65],['chhiyasath',66],['sadsath',67],['adsath',68],['unhattar',69],
  ['ikhattar',71],['bahattar',72],['tihattar',73],['chauhattar',74],['pachhattar',75],['chihattar',76],['satahattar',77],['athahattar',78],['unasi',79],
  ['ikyasi',81],['bayasi',82],['tirasi',83],['chaurasi',84],['pachasi',85],['chhiyasi',86],['sattasi',87],['athasi',88],['navasi',89],
  ['ikyanve',91],['banve',92],['tiranve',93],['chauranve',94],['panchanve',95],['chhiyanve',96],['sattanve',97],['athanve',98],['ninyanve',99],
  ['एक', 1], ['दो', 2], ['तीन', 3], ['चार', 4], ['पांच', 5], ['पाँच', 5], ['छह', 6],
  ['सात', 7], ['आठ', 8], ['नौ', 9], ['दस', 10], ['ग्यारह', 11], ['बारह', 12],
  ['पंद्रह', 15], ['बीस', 20], ['तीस', 30], ['चालीस', 40], ['पचास', 50],
  ['साठ', 60], ['सत्तर', 70], ['अस्सी', 80], ['नब्बे', 90], ['सौ', 100],
  ['इक्कीस',21],['बाईस',22],['तेईस',23],['चौबीस',24],['पच्चीस',25],['छब्बीस',26],['सत्ताईस',27],['अट्ठाईस',28],['उनतीस',29],
  ['इकतीस',31],['बत्तीस',32],['तैंतीस',33],['चौंतीस',34],['पैंतीस',35],['छत्तीस',36],['सैंतीस',37],['अड़तीस',38],['उनतालीस',39],
  ['इकतालीस',41],['बयालीस',42],['तैंतालीस',43],['चवालीस',44],['पैंतालीस',45],['छियालीस',46],['सैंतालीस',47],['अड़तालीस',48],['उनचास',49],
  ['इक्यावन',51],['बावन',52],['तिरपन',53],['चौवन',54],['पचपन',55],['छप्पन',56],['सत्तावन',57],['अट्ठावन',58],['उनसठ',59],
  ['इकसठ',61],['बासठ',62],['तिरसठ',63],['चौंसठ',64],['पैंसठ',65],['छियासठ',66],['सड़सठ',67],['अड़सठ',68],['उनहत्तर',69],
  ['इकहत्तर',71],['बहत्तर',72],['तिहत्तर',73],['चौहत्तर',74],['पचहत्तर',75],['छिहत्तर',76],['सतहत्तर',77],['अठहत्तर',78],['उनासी',79],
  ['इक्यासी',81],['बयासी',82],['तिरासी',83],['चौरासी',84],['पचासी',85],['छियासी',86],['सत्तासी',87],['अट्ठासी',88],['नवासी',89],
  ['इक्यानवे',91],['बानवे',92],['तिरानवे',93],['चौरानवे',94],['पचानवे',95],['छियानवे',96],['सत्तानवे',97],['अट्ठानवे',98],['निन्यानवे',99],
]);

const MULTIPLIERS = new Map([
  ['thousand', 1_000], ['hazaar', 1_000], ['hazar', 1_000], ['हजार', 1_000], ['हज़ार', 1_000],
  ['lakh', 100_000], ['lac', 100_000], ['लाख', 100_000],
  ['crore', 10_000_000], ['करोड़', 10_000_000], ['करोड', 10_000_000],
]);

export function parseCount(text) {
  if (Number.isInteger(text)) return text;
  if (typeof text !== 'string') return null;
  const normalized = text.normalize('NFC').toLocaleLowerCase('hi-IN').trim();
  const digits = normalized.match(/\d+/u);
  if (digits) return Number(digits[0]);
  const token = normalized.match(/[\p{L}\p{M}]+/u)?.[0];
  return WORDS.has(token) ? WORDS.get(token) : null;
}

function parseNumberPhrase(phrase) {
  const normalized = phrase.toLocaleLowerCase('hi-IN').replace(/[,_]/g, ' ').trim();
  const numeric = normalized.match(/^\d+(?:\.\d+)?$/);
  if (numeric) return Number(numeric[0]);

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  let total = 0;
  let current = 0;
  let hasNumber = false;
  for (const part of parts) {
    if (/^\d+(?:\.\d+)?$/.test(part)) {
      current += Number(part);
      hasNumber = true;
      continue;
    }
    if (WORDS.has(part)) {
      current += WORDS.get(part);
      hasNumber = true;
      continue;
    }
    if (MULTIPLIERS.has(part)) {
      if (!hasNumber) return null;
      const multiplier = MULTIPLIERS.get(part);
      total += current * multiplier;
      current = 0;
      hasNumber = false;
      continue;
    }
    return null;
  }
  return total + current;
}

/** Parse an explicit Indian amount; a bare number without a unit is ambiguous. */
export function parseIndianNumber(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const isExplicitCurrency = /₹|\brs\.?\b/i.test(text);
  const isGroupedAmount = /\d{1,3}(?:,\d{2,3})+/.test(text);
  const normalized = text.toLocaleLowerCase('hi-IN').replace(/[₹,]/g, '').replace(/\brs\.?\s*/gi, ' ').trim();
  const tokens = normalized.match(/[\d.]+|[\p{L}\p{M}]+/gu) || [];
  const unitIndex = tokens.findIndex((token) => MULTIPLIERS.has(token));
  if (unitIndex < 0) {
    const numericAmount = tokens.find((token) => /^\d+(?:\.\d+)?$/.test(token));
    if (!numericAmount || (!isExplicitCurrency && !isGroupedAmount)) return null;
    const rupees = Number(numericAmount);
    return Number.isFinite(rupees) ? { rupees, confidence: 0.9 } : null;
  }

  let numberStart = unitIndex - 1;
  while (numberStart >= 0) {
    const token = tokens[numberStart];
    if (!/^\d+(?:\.\d+)?$/.test(token) && !WORDS.has(token)) break;
    numberStart -= 1;
  }
  let phraseEnd = unitIndex + 1;
  while (phraseEnd < tokens.length && (MULTIPLIERS.has(tokens[phraseEnd]) || WORDS.has(tokens[phraseEnd]) || /^\d+(?:\.\d+)?$/.test(tokens[phraseEnd]))) phraseEnd += 1;
  const phrase = tokens.slice(numberStart + 1, phraseEnd).join(' ');
  const rupees = parseNumberPhrase(phrase);
  return Number.isFinite(rupees) && rupees >= 0 ? { rupees, confidence: 0.9 } : null;
}

/**
 * Bands use half-open intervals: <20L; [20L,40L); [40L,1.5Cr);
 * [1.5Cr,5Cr]; >5Cr. Exact thresholds go into the band beginning there.
 * TODO(owner): confirm these band boundaries with the Research owner.
 */
export function bandFromAmount(rupees) {
  if (!Number.isFinite(rupees) || rupees < 0) return null;
  if (rupees < 2_000_000) return 'lt20L';
  if (rupees < 4_000_000) return '20L_40L';
  if (rupees < 15_000_000) return '40L_1_5Cr';
  if (rupees <= 50_000_000) return '1_5_5Cr';
  return 'gt5Cr';
}

export function ageBandFromAge(age) {
  if (!Number.isInteger(age) || age < 0) return null;
  if (age < 21) return 'lt21';
  if (age <= 40) return '21_40';
  if (age <= 60) return '41_60';
  return 'gt60';
}

export function employeesBandFromCount(count) {
  if (!Number.isInteger(count) || count < 0) return null;
  if (count === 0) return '0';
  if (count <= 9) return '1_9';
  if (count <= 19) return '10_19';
  return '20plus';
}

export function yearsBandFromYears(years) {
  if (!Number.isFinite(years) || years < 0) return null;
  if (years < 1) return 'lt1';
  if (years < 3) return '1_3';
  if (years <= 10) return '3_10';
  return 'gt10';
}