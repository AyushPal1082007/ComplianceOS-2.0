import type { SchemeMatch } from '../schemas.ts';
import type { OutboundMessage } from '../contractsPlaceholder.ts';
import type { TeaserLanguage } from '../schemas.ts';

const labels: Record<TeaserLanguage, {
  listTitle: string;
  possible: string;
  likely: string;
  selfReported: string;
  stale: string;
  benefitPending: string;
  disclaimer: string;
}> = {
  hi: {
    listTitle: 'संभावित योजनाएँ',
    possible: 'possible',
    likely: 'likely eligible',
    selfReported: 'based on what you told us',
    stale: 'being re-verified',
    benefitPending: 'लाभ की जानकारी सत्यापित की जा रही है।',
    disclaimer: 'यह जानकारी केवल समझने के लिए है, पेशेवर सलाह नहीं।',
  },
  en: {
    listTitle: 'Possible schemes',
    possible: 'possible',
    likely: 'likely eligible',
    selfReported: 'based on what you told us',
    stale: 'being re-verified',
    benefitPending: 'Benefit details are being verified.',
    disclaimer: 'This information is for understanding only, not professional advice.',
  },
  hinglish: {
    listTitle: 'Possible yojnaayein',
    possible: 'possible',
    likely: 'likely eligible',
    selfReported: 'based on what you told us',
    stale: 'being re-verified',
    benefitPending: 'Benefit details verify ki ja rahi hain.',
    disclaimer: 'Yeh jaankari sirf samajhne ke liye hai, professional salaah nahi.',
  },
};

export function buildMessages(
  matches: SchemeMatch[],
  lang: TeaserLanguage,
  explanationTexts: ReadonlyMap<string, string> = new Map(),
): OutboundMessage[] {
  if (matches.length === 0) return [];

  const copy = labels[lang];
  const items = matches.map((match) => {
    const tags = [match.result === 'possible' ? copy.possible : copy.likely];
    if (match.basedOn === 'self_reported' || match.basedOn === 'mixed') {
      tags.push(copy.selfReported);
    }
    if (match.stale) tags.push(copy.stale);

    const benefit = match.benefit.includes('TODO(owner)')
      ? copy.benefitPending
      : match.benefit;
    const explanation = match.result === 'possible' ? undefined : explanationTexts.get(match.schemeId);

    return {
      title: match.name[lang === 'hi' ? 'hi' : 'en'],
      details: [
        `${match.metCount} of ${match.totalCount} criteria met. ${benefit}`,
        explanation,
      ].filter(Boolean).join('\n'),
      tags,
      sourceUrl: match.sourceUrl,
      lastVerified: match.lastVerified,
    };
  });

  return [{
    type: 'list',
    text: `${copy.listTitle}\n${copy.disclaimer}`,
    items,
  }];
}