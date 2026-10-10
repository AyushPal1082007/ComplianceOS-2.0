import { memoryStore } from './store.js';

export async function syncVerifiedFromScout() {
  return { synced: 0, skipped: 0 };
}

export async function saveMatches(userId, matches = []) {
  const profile = memoryStore.profiles.get(userId);
  if (!profile?.id) return [];
  const saved = [];
  for (const match of matches) {
    if (!match.schemeId) continue;
    const key = `${profile.id}:${match.schemeId}`;
    const row = {
      businessId: profile.id,
      schemeId: match.schemeId,
      matchScore: match.matchScore ?? match.score ?? 0,
      criteriaMetCount: match.criteriaMetCount ?? 0,
      criteriaTotalCount: match.criteriaTotalCount ?? 0,
      missingInfo: match.missingInfo || match.missingFields || undefined,
      explanationHindi: match.explanationHindi || null,
    };
    memoryStore.schemeMatches.set(key, row);
    saved.push(row);
  }
  return saved;
}

export async function removeMatchesForUser(userId) {
  const profile = memoryStore.profiles.get(userId);
  if (!profile?.id) return 0;
  let count = 0;
  for (const [key, match] of memoryStore.schemeMatches) {
    if (match.businessId === profile.id) {
      memoryStore.schemeMatches.delete(key);
      count++;
    }
  }
  return count;
}

export default { syncVerifiedFromScout, saveMatches, removeMatchesForUser };
