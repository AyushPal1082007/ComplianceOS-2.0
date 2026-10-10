import { hashNormalized } from './hash.ts';
import { normalizeText } from './normalize.ts';
import { withBlockCheck, type TinyFishClient } from './tinyfishPlaceholder.ts';
import type { ReviewItem, SchemeRecord, VerifyResult } from '../schemas.ts';

type Clock = () => Date;

function isPlaceholder(value: string | undefined): boolean {
  return !value?.trim() || /TODO\s*\(\s*owner\s*\)/i.test(value);
}

function degraded(scheme: SchemeRecord, reason: string): VerifyResult {
  return { schemeId: scheme.id, result: 'DEGRADED', scheme, reason };
}

export async function verifyScheme(
  scheme: SchemeRecord,
  client: TinyFishClient,
  clock: Clock = () => new Date(),
): Promise<VerifyResult> {
  if (scheme.status === 'closed') {
    return { schemeId: scheme.id, result: 'SKIPPED_CLOSED', scheme };
  }
  if (isPlaceholder(scheme.sourceUrl)) {
    return {
      schemeId: scheme.id,
      result: 'SKIPPED_NO_SOURCE',
      scheme,
      reason: 'Scheme source URL is missing or unverified.',
    };
  }

  let normalized: string;
  try {
    const results = await client.fetchPages([scheme.sourceUrl], { ttl: 0 });
    if (!Array.isArray(results) || results.length === 0) {
      return degraded(scheme, 'TinyFish returned no page results.');
    }

    const checked = results.map(withBlockCheck);
    const failed = checked.find((result) => !result.ok);
    if (failed && !failed.ok) return degraded(scheme, failed.reason);

    normalized = checked
      .filter((result): result is Extract<typeof result, { ok: true }> => result.ok)
      .map((result) => result.content)
      .join('\n');
    normalized = normalizeText(normalized);
    if (normalized.length < 20) {
      return degraded(scheme, 'Normalized page content is empty or too short.');
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'TinyFish request failed.';
    return degraded(scheme, reason);
  }

  const hash = hashNormalized(normalized);
  if (isPlaceholder(scheme.sourceHash)) {
    return { schemeId: scheme.id, result: 'BASELINE_NEEDED', scheme, hash };
  }
  if (hash === scheme.sourceHash) {
    return { schemeId: scheme.id, result: 'UNCHANGED', scheme, hash };
  }

  const updatedScheme: SchemeRecord = { ...scheme, status: 'stale' };
  const reviewItem: ReviewItem = {
    schemeId: scheme.id,
    oldHash: scheme.sourceHash,
    newHash: hash,
    checkedAt: clock().toISOString(),
    sourceUrl: scheme.sourceUrl,
  };
  return {
    schemeId: scheme.id,
    result: 'CHANGED',
    scheme: updatedScheme,
    hash,
    reviewItem,
  };
}