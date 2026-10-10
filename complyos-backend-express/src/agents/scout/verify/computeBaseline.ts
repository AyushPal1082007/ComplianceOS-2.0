import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadSchemes } from '../loadSchemes.ts';
import { hashNormalized } from './hash.ts';
import { normalizeText } from './normalize.ts';
import { withBlockCheck, type TinyFishClient } from './tinyfishPlaceholder.ts';

type Log = (message: string) => void;

export async function computeBaseline(
  schemeId: string,
  client?: TinyFishClient,
  log: Log = console.log,
): Promise<{ normalizedLength: number; hash: string } | undefined> {
  if (!client) {
    log('No TinyFish client is configured. Pass a TinyFishClient to computeBaseline().');
    return undefined;
  }

  const schemes = await loadSchemes();
  const scheme = schemes.find((record) => record.id === schemeId);
  if (!scheme) {
    log(`No SCOUT scheme found with id: ${schemeId}`);
    return undefined;
  }
  if (!scheme.sourceUrl.trim() || /TODO\s*\(\s*owner\s*\)/i.test(scheme.sourceUrl)) {
    log(`Scheme ${schemeId} does not have a verified source URL.`);
    return undefined;
  }

  const results = await client.fetchPages([scheme.sourceUrl], { ttl: 0 });
  const checks = results.map(withBlockCheck);
  const failed = checks.find((result) => !result.ok);
  if (failed && !failed.ok) {
    log(`TinyFish verification failed: ${failed.reason}`);
    return undefined;
  }

  const normalized = normalizeText(checks
    .filter((result): result is Extract<typeof result, { ok: true }> => result.ok)
    .map((result) => result.content)
    .join('\n'));
  if (normalized.length < 20) {
    log('Normalized page content is empty or too short.');
    return undefined;
  }

  const hash = hashNormalized(normalized);
  log(`Normalized text length: ${normalized.length}`);
  log(`SHA-256: ${hash}`);
  return { normalizedLength: normalized.length, hash };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url) {
  void computeBaseline(process.argv[2] ?? '').catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown baseline computation error.';
    console.error(`Unable to compute SCOUT baseline: ${message}`);
    process.exitCode = 1;
  });
}