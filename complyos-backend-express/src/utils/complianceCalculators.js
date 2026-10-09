'use strict';
/**
 * ComplianceOS — Deterministic Compliance Calculators
 * Per PDF Section 7 & Legal Map: "Deterministic calculator in code. LLM only explains."
 * Source: CGST Act Sections 47 & 50, verified FY 2026-27 [S9]
 */

/**
 * GST Late Fee Calculator — S.47 CGST Act
 * @param {object} params
 * @param {number} params.annualTurnoverLakhs  - Annual turnover in lakhs INR
 * @param {boolean} params.isNilReturn          - True if nil return
 * @param {number} params.daysLate              - Days past due date
 * @param {number} params.returnCount           - Number of returns (GSTR-1 + GSTR-3B = 2)
 * @returns {object} { feePerReturn, maxPerReturn, totalFee, interestNote, source }
 */
function gstLateFee({ annualTurnoverLakhs, isNilReturn, daysLate, returnCount = 1 }) {
  const source = {
    section: 'S.47 CGST Act + S.50 CGST Act',
    url: 'https://calcguru.in/gst-late-fee-interest-fy-2026-27-guide',
    verifiedFor: 'FY 2026-27',
    lastChecked: '2026-09-30',
  };

  if (isNilReturn) {
    // Nil return: ₹20/day (₹10 CGST + ₹10 SGST), max ₹500 per return
    const dailyFee = 20;
    const maxFee = 500;
    const feePerReturn = Math.min(daysLate * dailyFee, maxFee);
    return {
      dailyFee,
      maxPerReturn: maxFee,
      feePerReturn,
      totalFee: feePerReturn * returnCount,
      interestNote: '18% per annum on net cash tax liability (S.50 CGST Act)',
      returnType: 'nil',
      source,
    };
  }

  // Normal returns based on AATO (Annual Aggregate Turnover)
  let dailyFee = 50; // ₹25 CGST + ₹25 SGST
  let maxPerReturn;

  if (annualTurnoverLakhs <= 150) {        // Up to ₹1.5 Cr
    maxPerReturn = 2000;
  } else if (annualTurnoverLakhs <= 500) { // ₹1.5 Cr – ₹5 Cr
    maxPerReturn = 5000;
  } else {                                  // Above ₹5 Cr
    maxPerReturn = 10000;
  }

  const feePerReturn = Math.min(daysLate * dailyFee, maxPerReturn);
  const totalFee = feePerReturn * returnCount;

  // Worst-case annual: both GSTR-1 and GSTR-3B filed late every month
  // = 24 returns × maxPerReturn (per PDF: "up to ₹48,000/year for ≤₹1.5Cr turnover")
  const worstCaseAnnual = maxPerReturn * 24;

  return {
    dailyFee,
    maxPerReturn,
    feePerReturn,
    totalFee,
    worstCaseAnnual,
    interestNote: '18% per annum on net cash tax liability (S.50 CGST Act)',
    turnoverBracket: annualTurnoverLakhs <= 150 ? 'up to ₹1.5 Cr'
      : annualTurnoverLakhs <= 500 ? '₹1.5–5 Cr' : 'above ₹5 Cr',
    returnType: 'normal',
    source,
  };
}

/**
 * Health Score Calculator — Deterministic, 0–100
 * Based on profile completeness + compliance status + pending deadlines
 * @param {object} profile - BusinessProfile
 * @param {Array} deadlines - ComplianceDeadline[]
 * @returns {number} healthScore 0–100
 */
function calculateHealthScore(profile, deadlines = []) {
  let score = 100;

  // Profile completeness deductions
  if (!profile.gstin)         score -= 10;
  if (!profile.pan)           score -= 5;
  if (!profile.udyamNumber)   score -= 5;
  if (!profile.annualTurnover) score -= 5;
  if (!profile.businessName)  score -= 10;

  // Deadline penalties
  const now = new Date();
  const overdueDeadlines = deadlines.filter(d =>
    d.status === 'overdue' || (d.status === 'pending' && new Date(d.deadlineDate) < now)
  );
  const upcomingHighUrgency = deadlines.filter(d => {
    const daysUntil = (new Date(d.deadlineDate) - now) / (1000 * 60 * 60 * 24);
    return d.status === 'pending' && daysUntil <= 7 && d.urgency === 'high';
  });

  score -= overdueDeadlines.length * 15;
  score -= upcomingHighUrgency.length * 8;

  return Math.max(0, Math.min(100, score));
}

/**
 * Penalty at Risk Calculator
 * Returns estimated maximum penalty exposure in INR
 */
function calculatePenaltyAtRisk(profile, deadlines = []) {
  const now = new Date();
  let totalRisk = 0;

  for (const deadline of deadlines) {
    if (deadline.status !== 'pending' && deadline.status !== 'overdue') continue;

    const daysLate = Math.max(0, Math.floor((now - new Date(deadline.deadlineDate)) / (1000 * 60 * 60 * 24)));

    if (deadline.complianceType?.includes('gst')) {
      const calc = gstLateFee({
        annualTurnoverLakhs: profile.annualTurnover || 50,
        isNilReturn: false,
        daysLate,
        returnCount: 1,
      });
      totalRisk += calc.feePerReturn;
    }
  }

  return totalRisk;
}

/**
 * GST Return due dates reference (deterministic)
 * Per PDF [S9]: monthly filers GSTR-3B due 20th, GSTR-1 due 11th
 */
function getGSTDueDates(turnoverLakhs, year = new Date().getFullYear()) {
  const source = {
    url: 'https://gst.gov.in',
    section: 'GST Act — Return Filing Rules',
    lastVerified: '2026-09-30',
  };

  const isQuarterly = turnoverLakhs <= 500; // QRMP scheme

  if (!isQuarterly) {
    // Monthly filers
    return {
      filingFrequency: 'monthly',
      gstr1DueDay: 11,
      gstr3bDueDay: 20,
      note: 'Due on the 11th (GSTR-1) and 20th (GSTR-3B) of the following month',
      source,
    };
  }

  // Quarterly filers (QRMP) — due 22nd or 24th depending on state
  return {
    filingFrequency: 'quarterly',
    gstr1DueDay: 13, // IFF for B2B invoices
    gstr3bDueDay: 22, // Category 1 states, 24th for Category 2
    note: 'Quarterly filers: GSTR-3B due 22nd or 24th of month following quarter end',
    source,
  };
}

export { gstLateFee, calculateHealthScore, calculatePenaltyAtRisk, getGSTDueDates };
