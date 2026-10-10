import assert from 'node:assert/strict';
import test from 'node:test';
import { hashNormalized } from './hash.ts';
import { normalizeText } from './normalize.ts';
import { runVerify } from './runVerify.ts';
import { verifyScheme } from './verifyScheme.ts';
import type { FetchResult, TinyFishClient } from './tinyfishPlaceholder.ts';
import type { SchemeRecord } from '../schemas.ts';

const pageText = 'Official scheme information for eligible small businesses and applicants.';

function scheme(overrides: Partial<SchemeRecord> = {}): SchemeRecord {
  return {
    id: 'scheme-fixture',
    name: { en: 'Scheme Fixture', hi: 'योजना उदाहरण' },
    level: 'central',
    state: 'all',
    benefit: 'TODO(owner)',
    criteria: [{ field: 'sector', eq: 'manufacturer' }],
    priority: 5,
    applyUrl: 'TODO(owner)',
    sourceUrl: 'https://schemes.example.test/source',
    retrievedOn: 'TODO(owner)',
    checkedBy: 'TODO(owner)',
    sourceHash: 'old-hash',
    status: 'active',
    ...overrides,
  };
}

function clientFor(
  contentFor: (url: string) => string | Promise<string> = () => pageText,
  status = 'COMPLETED',
): TinyFishClient & { calls: Array<{ urls: string[]; ttl: number }> } {
  const client = {
    calls: [] as Array<{ urls: string[]; ttl: number }>,
    async fetchPages(urls: string[], opts: { ttl: number }): Promise<FetchResult[]> {
      client.calls.push({ urls: [...urls], ttl: opts.ttl });
      const content = await contentFor(urls[0] ?? '');
      return [{ status, content, url: urls[0] }];
    },
  };
  return client;
}

test('normalizeText is deterministic and removes markup, counters, dates, and entities', () => {
  const raw = '<header>Ignored header</header><main><p>Scheme &amp; application details</p>' +
    '<p>Visitors: 48</p><p>Last Updated: 2025-01-01</p><p>Last Modified: Jan 2, 2025</p>' +
    '<script>ignored script</script><style>ignored style</style><nav>ignored nav</nav>' +
    '<footer>ignored footer</footer></main>';
  const normalized = normalizeText(raw);

  assert.equal(normalized, normalizeText(raw));
  assert.equal(normalized, 'Scheme & application details');
});

test('a changed visitor counter does not change the normalized hash', () => {
  const first = normalizeText(`${pageText}\nVisitor count: 123`);
  const second = normalizeText(`${pageText}\nVisitor count: 987654`);

  assert.equal(hashNormalized(first), hashNormalized(second));
});

test('a real content change changes the normalized hash', () => {
  const first = hashNormalized(normalizeText(pageText));
  const second = hashNormalized(normalizeText(`${pageText} Applications close soon.`));

  assert.notEqual(first, second);
});

test('matching content returns UNCHANGED and preserves the scheme', async () => {
  const expectedHash = hashNormalized(normalizeText(pageText));
  const record = scheme({ sourceHash: expectedHash });
  const original = structuredClone(record);
  const result = await verifyScheme(record, clientFor());

  assert.equal(result.result, 'UNCHANGED');
  assert.deepEqual(result.scheme, original);
  assert.equal(result.scheme, record);
});

test('changed content returns a stale copy and review item without mutating other fields', async () => {
  const record = scheme();
  const original = structuredClone(record);
  const result = await verifyScheme(record, clientFor(), () => new Date('2026-10-10T12:00:00.000Z'));

  assert.equal(result.result, 'CHANGED');
  assert.notEqual(result.scheme, record);
  assert.equal(result.scheme.status, 'stale');
  assert.deepEqual(result.scheme.criteria, original.criteria);
  assert.equal(result.scheme.benefit, original.benefit);
  assert.deepEqual(record, original);
  assert.deepEqual(result.reviewItem, {
    schemeId: record.id,
    oldHash: record.sourceHash,
    newHash: hashNormalized(normalizeText(pageText)),
    checkedAt: '2026-10-10T12:00:00.000Z',
    sourceUrl: record.sourceUrl,
  });
});

test('blocked COMPLETED results are DEGRADED and leave the scheme unchanged', async () => {
  for (const blockedText of [
    `The page has a CAPTCHA verification challenge. ${pageText}`,
    `Access Denied. ${pageText}`,
    `Request blocked by policy. ${pageText}`,
  ]) {
    const record = scheme();
    const original = structuredClone(record);
    const result = await verifyScheme(record, clientFor(() => blockedText));

    assert.equal(result.result, 'DEGRADED');
    assert.deepEqual(result.scheme, original);
  }
});

test('a client exception degrades one scheme without stopping later schemes', async () => {
  const failed = scheme({ id: 'failed', sourceUrl: 'https://one.example.test/source' });
  const unchangedHash = hashNormalized(normalizeText(pageText));
  const healthy = scheme({
    id: 'healthy',
    sourceUrl: 'https://two.example.test/source',
    sourceHash: unchangedHash,
  });
  const client: TinyFishClient = {
    async fetchPages(urls) {
      if (urls[0]?.includes('one.example.test')) throw new Error('client unavailable');
      return [{ status: 'COMPLETED', content: pageText }];
    },
  };
  const report = await runVerify([failed, healthy], client, {
    sleep: async () => undefined,
    now: () => Date.parse('2026-10-10T00:00:00.000Z'),
  });

  assert.deepEqual(report.results.map(({ result }) => result), ['DEGRADED', 'UNCHANGED']);
  assert.equal(report.degradedCount, 1);
});

test('placeholder source is skipped and placeholder hash needs a baseline', async () => {
  const client = clientFor();
  const noSource = await verifyScheme(scheme({ sourceUrl: 'TODO(owner)' }), client);
  const noBaseline = await verifyScheme(scheme({ sourceHash: 'TODO(owner)' }), client);

  assert.equal(noSource.result, 'SKIPPED_NO_SOURCE');
  assert.equal(noBaseline.result, 'BASELINE_NEEDED');
  assert.equal(noBaseline.hash, hashNormalized(normalizeText(pageText)));
  assert.equal(noBaseline.scheme.status, 'active');
  assert.equal(client.calls.length, 1);
});

test('closed schemes are skipped without a TinyFish request', async () => {
  const client = clientFor();
  const result = await verifyScheme(scheme({ status: 'closed' }), client);

  assert.equal(result.result, 'SKIPPED_CLOSED');
  assert.equal(client.calls.length, 0);
});

test('runVerify spaces requests to the same domain by at least one second', async () => {
  let currentTime = 0;
  const waits: number[] = [];
  const client = clientFor();
  const records = [
    scheme({ id: 'first', sourceUrl: 'https://same.example.test/one' }),
    scheme({ id: 'second', sourceUrl: 'https://same.example.test/two' }),
  ];

  await runVerify(records, client, {
    now: () => currentTime,
    sleep: async (milliseconds) => {
      waits.push(milliseconds);
      currentTime += milliseconds;
    },
  });

  assert.deepEqual(waits, [1000]);
  assert.equal(client.calls.length, 2);
});

test('runVerify collects updates, review items, and a checkedAt timestamp', async () => {
  const report = await runVerify([scheme()], clientFor(), {
    sleep: async () => undefined,
    now: () => Date.parse('2026-10-10T12:00:00.000Z'),
  });

  assert.equal(report.results[0]?.result, 'CHANGED');
  assert.equal(report.updatedSchemes[0]?.status, 'stale');
  assert.equal(report.reviewItems.length, 1);
  assert.equal(report.checkedAt, '2026-10-10T12:00:00.000Z');
});