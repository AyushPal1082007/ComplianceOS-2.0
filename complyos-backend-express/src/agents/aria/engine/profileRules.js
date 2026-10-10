export const PROFILE_FIELD_KEYS = new Set([
  'state', 'district', 'sector', 'subSector', 'constitution', 'turnoverBand',
  'gstRegistered', 'gstFilingFrequency', 'udyamRegistered', 'employeesBand',
  'womenLed', 'ownerAgeBand', 'socialCategory', 'hasLoan', 'yearsInBusiness',
  'isExporter', 'goal', 'gstin', 'udyamNumber',
]);

export const PROFILE_ENUMS = {
  sector: new Set(['trader', 'manufacturer', 'service', 'other']),
  constitution: new Set(['proprietorship', 'partnership', 'llp', 'pvt_ltd', 'other']),
  turnoverBand: new Set(['lt20L', '20L_40L', '40L_1_5Cr', '1_5_5Cr', 'gt5Cr']),
  gstRegistered: new Set([true, false]),
  gstFilingFrequency: new Set(['monthly', 'quarterly']),
  udyamRegistered: new Set([true, false]),
  employeesBand: new Set(['0', '1_9', '10_19', '20plus']),
  womenLed: new Set([true, false]),
  ownerAgeBand: new Set(['lt21', '21_40', '41_60', 'gt60']),
  socialCategory: new Set(['general', 'sc', 'st', 'obc', 'prefer_not']),
  hasLoan: new Set([true, false]),
  yearsInBusiness: new Set(['lt1', '1_3', '3_10', 'gt10']),
  isExporter: new Set([true, false]),
  goal: new Set(['loan', 'subsidy', 'compliance', 'notice_help']),
};
