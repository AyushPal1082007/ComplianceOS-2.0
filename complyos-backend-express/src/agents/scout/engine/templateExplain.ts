import type { SchemeMatch, SchemeRecord, TeaserLanguage } from '../schemas.ts';

const fieldLabels: Record<string, string> = {
  state: 'state',
  district: 'district',
  sector: 'sector',
  subSector: 'sub-sector',
  constitution: 'business constitution',
  turnoverBand: 'turnover band',
  gstRegistered: 'GST registration',
  gstin: 'GSTIN',
  gstFilingFrequency: 'GST filing frequency',
  udyamRegistered: 'Udyam registration',
  udyamNumber: 'Udyam number',
  employeesBand: 'employee count',
  womenLed: 'women-led status',
  ownerAgeBand: 'owner age band',
  socialCategory: 'social category',
  hasLoan: 'loan status',
  yearsInBusiness: 'years in business',
  isExporter: 'exporter status',
  goal: 'business goal',
};

function readableFields(fields: string[]): string {
  return fields.map((field) => fieldLabels[field] ?? field.replace(/([a-z])([A-Z])/g, '$1 $2')).join(', ');
}

export function templateExplain(
  match: SchemeMatch,
  scheme: SchemeRecord,
  lang: TeaserLanguage,
): string {
  const schemeName = scheme.name[lang === 'hi' ? 'hi' : 'en'];
  const missing = match.missingFields.length > 0
    ? readableFields(match.missingFields)
    : lang === 'hi' ? 'कोई जानकारी बाकी नहीं' : lang === 'en' ? 'none' : 'koi detail baaki nahi';

  if (lang === 'hi') {
    return `${schemeName}: ${match.metCount} of ${match.totalCount} मानदंड पूरे हुए। बाकी जानकारी: ${missing}। लाभ: ${scheme.benefit}`;
  }
  if (lang === 'hinglish') {
    return `${schemeName}: ${match.metCount} of ${match.totalCount} criteria met. Missing details: ${missing}. Benefit: ${scheme.benefit}`;
  }
  return `${schemeName}: ${match.metCount} of ${match.totalCount} criteria met. Missing fields: ${missing}. Benefit: ${scheme.benefit}`;
}