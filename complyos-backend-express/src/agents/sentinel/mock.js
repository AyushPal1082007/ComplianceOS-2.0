export const mockProfile = {
  id: 'profile-1',
  user: { id: 'user-1', email: 'owner@example.com', isActive: true },
  state: 'Uttar Pradesh',
  sector: 'manufacturer',
  businessType: 'manufacturer',
  annualTurnover: 35,
  gstin: '09AAACH7409R1ZZ',
  udyamNumber: 'UDYAM-UP-28-0012345',
};

export const mockChange = {
  title: 'GST filing update',
  summary: 'GST return compliance filing deadlines were updated for manufacturing businesses.',
  quote: 'Manufacturing enterprises in Uttar Pradesh must verify the updated GST filing deadline before the next return cycle.',
  confidence: 0.92,
  affects: {
    states: ['Uttar Pradesh'],
    sectors: ['manufacturer'],
    gstinHolders: true,
    udyamHolders: true,
  },
  lastVerified: new Date().toISOString(),
  sourceUrl: 'https://simulated.local/regulations/notice',
  status: 'APPROVED',
};

export default {
  mockProfile,
  mockChange,
};
