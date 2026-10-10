/**
 * Date Validator — deterministic, no LLM
 * Parses dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, "12 March 2025" etc.
 * Validates impossible dates and relational constraints.
 */

const MONTH_NAMES = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Parse a date string in various Indian formats
 * @param {string} value
 * @returns {{ date: Date|null, reason?: string }}
 */
export function parseDate(value) {
  if (!value || typeof value !== 'string') {
    return { date: null, reason: 'Date is empty or not a string' };
  }

  const trimmed = value.trim();

  // Try dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy
  const numericMatch = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1], 10);
    const month = parseInt(numericMatch[2], 10);
    const year = parseInt(numericMatch[3], 10);
    return validateDateParts(day, month, year);
  }

  // Try "12 March 2025" or "12th March 2025"
  const namedMatch = trimmed.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$/);
  if (namedMatch) {
    const day = parseInt(namedMatch[1], 10);
    const monthName = namedMatch[2].toLowerCase();
    const month = MONTH_NAMES[monthName];
    const year = parseInt(namedMatch[3], 10);

    if (!month) {
      return { date: null, reason: `Unknown month name "${namedMatch[2]}"` };
    }
    return validateDateParts(day, month, year);
  }

  // Try "March 12, 2025"
  const usMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (usMatch) {
    const monthName = usMatch[1].toLowerCase();
    const month = MONTH_NAMES[monthName];
    const day = parseInt(usMatch[2], 10);
    const year = parseInt(usMatch[3], 10);

    if (!month) {
      return { date: null, reason: `Unknown month name "${usMatch[1]}"` };
    }
    return validateDateParts(day, month, year);
  }

  // Try yyyy-mm-dd (ISO)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    return validateDateParts(day, month, year);
  }

  return { date: null, reason: `Could not parse date format: "${trimmed}"` };
}

/**
 * Validate date parts and construct a Date object
 * @param {number} day
 * @param {number} month
 * @param {number} year
 * @returns {{ date: Date|null, reason?: string }}
 */
function validateDateParts(day, month, year) {
  if (month < 1 || month > 12) {
    return { date: null, reason: `Invalid month ${month}` };
  }
  if (year < 1900 || year > 2100) {
    return { date: null, reason: `Year ${year} out of reasonable range (1900-2100)` };
  }

  // Construct date and verify it round-trips (catches Feb 30 etc.)
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return { date: null, reason: `Invalid date: ${day}/${month}/${year} does not exist` };
  }

  return { date };
}

/**
 * Validate a date string
 * @param {string} value
 * @returns {{ ok: boolean, reason?: string, parsed?: Date }}
 */
export function validateDate(value) {
  const { date, reason } = parseDate(value);
  if (!date) {
    return { ok: false, reason };
  }
  return { ok: true, parsed: date };
}

/**
 * Validate that date A is before date B (e.g. noticeDate before replyDueDate)
 * @param {string} dateA
 * @param {string} dateB
 * @param {string} labelA
 * @param {string} labelB
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateDateOrder(dateA, dateB, labelA = 'start', labelB = 'end') {
  const parsedA = parseDate(dateA);
  const parsedB = parseDate(dateB);

  if (!parsedA.date || !parsedB.date) {
    return { ok: true }; // Can't validate order if either is unparseable
  }

  if (parsedA.date >= parsedB.date) {
    return {
      ok: false,
      reason: `${labelA} (${dateA}) must be before ${labelB} (${dateB})`,
    };
  }

  return { ok: true };
}
