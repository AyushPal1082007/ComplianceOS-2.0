import { getGSTDueDates as calculateDueDates } from '../utils/complianceCalculators.js';

export function getGSTDueDates(turnoverLakhs, year) {
  const result = calculateDueDates(turnoverLakhs, year);
  return {
    ...result,
    sourceUrl: result.source.url,
    lastVerified: result.source.lastVerified,
  };
}

export function getStatutoryDeadlines({ annualTurnoverLakhs = 100 }) {
  const dueRules = getGSTDueDates(annualTurnoverLakhs);
  const now = new Date();
  const nextMonth = (now.getMonth() + 1) % 12;
  const nextYear = nextMonth === 0 ? now.getFullYear() + 1 : now.getFullYear();
  const common = {
    urgency: 'high',
    sourceUrl: dueRules.source.url,
    lastVerified: dueRules.source.lastVerified,
    description: dueRules.note,
  };

  return [
    {
      ...common,
      title: 'GSTR-1 (Outward Supplies)',
      deadlineDate: new Date(nextYear, nextMonth, dueRules.gstr1DueDay).toISOString().split('T')[0],
      category: 'GST',
    },
    {
      ...common,
      title: 'GSTR-3B (Summary Return & Tax Payment)',
      deadlineDate: new Date(nextYear, nextMonth, dueRules.gstr3bDueDay).toISOString().split('T')[0],
      category: 'GST',
    },
  ];
}

export default { getStatutoryDeadlines, getGSTDueDates };
