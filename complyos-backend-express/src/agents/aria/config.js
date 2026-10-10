export const WA_LIMITS = {
  replyButtons: 3, // TODO(verify): confirm Meta WhatsApp interactive-message limit.
  listRows: 10, // TODO(verify): confirm Meta WhatsApp list-message limit.
};

export const CORE_FIELDS = [
  'state', 'sector', 'subSector', 'gstRegistered', 'turnoverBand', 'udyamRegistered',
  'employeesBand', 'womenLed', 'ownerAgeBand', 'goal',
];

export const EXTENDED_FIELDS = [
  'constitution', 'gstFilingFrequency', 'hasLoan', 'yearsInBusiness', 'isExporter', 'district', 'socialCategory',
];

export const DEFAULT_MAX_QUESTIONS = 12;
export const DEFAULT_MIN_ASR_CONFIDENCE = 0.5;
