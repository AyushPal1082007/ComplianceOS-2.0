function normalizeField(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

export function matchProfiles(profiles = [], filters = {}) {
  if (!Array.isArray(profiles)) return [];

  const matches = profiles.filter((profile) => {
    if (!profile || typeof profile !== 'object') return false;

    if (filters?.states && Array.isArray(filters.states) && !filters.states.includes('all')) {
      const profileState = normalizeField(profile.state);
      const allowedStates = filters.states.map((state) => normalizeField(state));
      if (profileState && !allowedStates.includes(profileState)) return false;
      if (!profileState) return false;
    }

    if (filters?.sectors && Array.isArray(filters.sectors) && !filters.sectors.includes('all')) {
      const profileSector = normalizeField(profile.sector || profile.businessType);
      const allowedSectors = filters.sectors.map((sector) => normalizeField(sector));
      if (profileSector && !allowedSectors.includes(profileSector)) return false;
      if (!profileSector) return false;
    }

    if (filters?.gstinHolders === true && !profile.gstin) return false;
    if (filters?.udyamHolders === true && !profile.udyamNumber) return false;

    if (filters?.turnoverBand) {
      const turnover = Number(profile.annualTurnover ?? profile.annualTurnoverLakhs ?? 0);
      if (!Number.isFinite(turnover) || turnover <= 0) return false;
    }

    return true;
  });

  return matches;
}

export default {
  matchProfiles,
};
