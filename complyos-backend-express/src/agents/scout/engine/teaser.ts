import type {
  BusinessProfile,
  ProfileFieldKey,
  SchemeMatch,
  TeaserLanguage,
  TeaserResult,
} from '../schemas.ts';

// TODO(owner): replace with the shared contract constant when contracts exist.
export const CORE_PROFILE_FIELDS = [
  'state',
  'sector',
  'subSector',
  'gstRegistered',
  'turnoverBand',
  'udyamRegistered',
  'employeesBand',
  'womenLed',
  'ownerAgeBand',
  'goal',
] as const satisfies readonly ProfileFieldKey[];

const teaserTemplates: Record<TeaserLanguage, (count: number) => string> = {
  hi: (count) => `अभी तक ${count} योजनाएँ possible लग रही हैं`,
  en: (count) => `So far, ${count} schemes seem possible.`,
  hinglish: (count) => `Abhi tak ${count} yojnaayein possible lag rahi hain`,
};

export function buildTeaser(
  profile: BusinessProfile,
  matches: SchemeMatch[],
  lang: TeaserLanguage,
): TeaserResult {
  const knownCoreFields = CORE_PROFILE_FIELDS.filter((key) => {
    const field = profile[key];
    return Boolean(
      field &&
        typeof field === 'object' &&
        field.value !== null &&
        (field.status === 'VERIFIED' || field.status === 'SELF_REPORTED'),
    );
  }).length;
  const count = matches.filter(
    (match) => match.result === 'possible' || match.result === 'likely_eligible',
  ).length;

  if (knownCoreFields < 4 || count === 0) {
    return { show: false, count };
  }

  return {
    show: true,
    text: teaserTemplates[lang](count),
    count,
  };
}