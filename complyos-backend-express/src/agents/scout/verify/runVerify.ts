import type { SchemeRecord, VerifyReport, VerifyResult } from '../schemas.ts';
import { verifyScheme } from './verifyScheme.ts';
import type { TinyFishClient } from './tinyfishPlaceholder.ts';

type Sleep = (milliseconds: number) => Promise<void>;

export type RunVerifyOptions = {
  sleep?: Sleep;
  now?: () => number;
};

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function pacedClient(
  client: TinyFishClient,
  sleep: Sleep,
  now: () => number,
): TinyFishClient {
  const lastRequestByDomain = new Map<string, number>();

  return {
    async fetchPages(urls, opts) {
      for (const url of urls) {
        const domain = new URL(url).hostname.toLowerCase();
        const lastStartedAt = lastRequestByDomain.get(domain);
        if (lastStartedAt !== undefined) {
          const waitMs = Math.max(0, 1000 - (now() - lastStartedAt));
          if (waitMs > 0) await sleep(waitMs);
        }
        lastRequestByDomain.set(domain, now());
      }

      return client.fetchPages(urls, opts);
    },
  };
}

export async function runVerify(
  schemes: SchemeRecord[],
  client: TinyFishClient,
  options: RunVerifyOptions = {},
): Promise<VerifyReport> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const paced = pacedClient(client, sleep, now);
  const results: VerifyResult[] = [];

  for (const scheme of schemes) {
    try {
      results.push(await verifyScheme(scheme, paced, () => new Date(now())));
    } catch (error) {
      results.push({
        schemeId: scheme.id,
        result: 'DEGRADED',
        scheme,
        reason: error instanceof Error ? error.message : 'Unexpected scheme verification failure.',
      });
    }
  }

  return {
    results,
    reviewItems: results.flatMap((result) => result.reviewItem ? [result.reviewItem] : []),
    updatedSchemes: results.flatMap((result) => result.result === 'CHANGED' ? [result.scheme] : []),
    degradedCount: results.filter((result) => result.result === 'DEGRADED').length,
    checkedAt: new Date(now()).toISOString(),
  };
}