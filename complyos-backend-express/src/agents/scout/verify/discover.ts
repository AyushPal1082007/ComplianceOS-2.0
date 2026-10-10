import { SchemeCandidateSchema, type SchemeCandidate } from './draftSchema.ts';
import type { TinyFishClient } from './tinyfishPlaceholder.ts';

function officialUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (!hostname.endsWith('.gov.in') && !hostname.endsWith('.nic.in')) return undefined;
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

export async function discoverSchemes(
  query: string,
  client: TinyFishClient,
  clock: () => Date = () => new Date(),
): Promise<SchemeCandidate[]> {
  const foundAt = clock().toISOString();
  const results = await client.search(query, { domain_type: 'web' });
  const candidates = new Map<string, SchemeCandidate>();

  for (const result of results) {
    const url = officialUrl(result.url);
    if (!url || candidates.has(url)) continue;

    const candidate = SchemeCandidateSchema.parse({
      url,
      title: result.title ?? '',
      snippet: result.snippet ?? '',
      foundAt,
    });
    candidates.set(url, candidate);
  }

  return [...candidates.values()];
}