import type { MissingFieldRank, SchemeMatch } from '../schemas.ts';

export function rankMissingFields(matches: SchemeMatch[]): MissingFieldRank[] {
  const rankings = new Map<string, MissingFieldRank>();

  for (const match of matches) {
    if (match.result !== 'possible') continue;

    for (const field of new Set(match.missingFields)) {
      const ranking = rankings.get(field);
      if (ranking) {
        ranking.score += match.priority;
        ranking.schemeIds.push(match.schemeId);
      } else {
        rankings.set(field, {
          field,
          score: match.priority,
          schemeIds: [match.schemeId],
        });
      }
    }
  }

  return [...rankings.values()].sort((left, right) => {
    if (left.score !== right.score) return right.score - left.score;
    return left.field < right.field ? -1 : left.field > right.field ? 1 : 0;
  });
}