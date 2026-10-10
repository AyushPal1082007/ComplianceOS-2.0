import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import type { ZodType } from 'zod';
import { loadSchemes } from '../loadSchemes.ts';
import type { GroqClient } from '../groqPlaceholder.ts';
import type { SchemeRecord } from '../schemas.ts';
import { discoverSchemes } from './discover.ts';
import { draftFromCandidate } from './draftExtract.ts';
import type { SchemeCandidate } from './draftSchema.ts';
import { hashNormalized } from './hash.ts';
import { normalizeText } from './normalize.ts';
import { runDiscovery } from './runDiscovery.ts';
import { verifyScheme } from './verifyScheme.ts';
import type { AgentResult, FetchResult, SearchResult, TinyFishClient } from './tinyfishPlaceholder.ts';

const scoutDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const draftsDirectory = path.join(scoutDirectory, 'drafts');
const readablePage = [
  '<html><body>',
  '<h1>TEST Scheme Alpha</h1>',
  '<p>This synthetic program supports registered businesses and applicants.</p>',
  '<p>Benefit: Support is available for registered manufacturers.</p>',
  '<p>Eligibility: Applicants must be registered manufacturers in Uttar Pradesh.</p>',
  '<a href="https://apply.example.gov.in/form">Apply online</a>',
  '</body></html>',
].join('');

function candidate(url = 'https://schemes.example.gov.in/alpha'): SchemeCandidate {
  return {
    url,
    title: 'TEST Scheme Alpha',
    snippet: 'Synthetic discovery result.',
    foundAt: '2026-10-10T00:00:00.000Z',
  };
}

function fakeClient(options: {
  results?: SearchResult[];
  page?: (url: string) => FetchResult | Promise<FetchResult>;
  agent?: (url: string, goal: string) => AgentResult | Promise<AgentResult>;
} = {}): TinyFishClient & { searchQueries: string[]; fetchCalls: string[]; agentCalls: string[] } {
  const client = {
    searchQueries: [] as string[],
    fetchCalls: [] as string[],
    agentCalls: [] as string[],
    async search(query: string): Promise<SearchResult[]> {
      client.searchQueries.push(query);
      return options.results ?? [];
    },
    async fetchPages(urls: string[]): Promise<FetchResult[]> {
      const url = urls[0] ?? '';
      client.fetchCalls.push(url);
      return [options.page ? await options.page(url) : { status: 'COMPLETED', content: readablePage, url }];
    },
    async runAgent(input: { url: string; goal: string }): Promise<AgentResult> {
      client.agentCalls.push(input.url);
      return options.agent
        ? await options.agent(input.url, input.goal)
        : { status: 'COMPLETED', content: '{}', pageText: readablePage, url: input.url };
    },
  };
  return client;
}

function fakeGroq(response: unknown): GroqClient {
  return {
    async json<T>(_schema: ZodType<T>): Promise<T> {
      return response as T;
    },
  };
}

const mappedCondition = 'Eligibility: Applicants must be registered manufacturers in Uttar Pradesh.';
const mappedGroqResponse = [{
  condition: mappedCondition,
  evidenceQuote: mappedCondition,
  criterion: { field: 'sector', eq: 'manufacturer' },
}];

test('discovery drops non-government hosts and deduplicates normalized URLs', async () => {
  const client = fakeClient({ results: [
    { url: 'https://schemes.gov.in/path#section', title: 'First title', snippet: 'First snippet' },
    { url: 'https://schemes.gov.in/path', title: 'Duplicate title', snippet: 'Duplicate snippet' },
    { url: 'https://service.nic.in/scheme', title: 'NIC scheme', snippet: 'Official' },
    { url: 'https://example.com/scheme', title: 'Not official', snippet: 'Reject' },
    { url: 'https://evilgov.in/scheme', title: 'Lookalike', snippet: 'Reject' },
  ] });
  const found = await discoverSchemes('MSME scheme Uttar Pradesh 2026', client, () => new Date('2026-10-10T00:00:00Z'));

  assert.deepEqual(found.map((item) => item.url), [
    'https://schemes.gov.in/path',
    'https://service.nic.in/scheme',
  ]);
  assert.equal(found[0].title, 'First title');
  assert.equal(found[0].foundAt, '2026-10-10T00:00:00.000Z');
});

test('readable page uses fetch and does not call runAgent', async () => {
  const client = fakeClient();
  const draft = await draftFromCandidate(
    candidate(),
    client,
    fakeGroq(mappedGroqResponse),
    { dailyCap: 2, callsUsed: 0 },
    () => new Date('2026-10-10T00:00:00Z'),
  );

  assert(draft);
  assert.equal(client.fetchCalls.length, 1);
  assert.equal(client.agentCalls.length, 0);
  assert.deepEqual(draft.criteria, [{ field: 'sector', eq: 'manufacturer' }]);
});

test('unreadable page uses runAgent, records one call, and respects daily cap', async () => {
  const extraction = JSON.stringify({
    nameEn: { value: 'TEST Scheme Alpha', evidenceQuote: 'TEST Scheme Alpha' },
    nameHi: 'NOT_FOUND',
    benefit: { value: 'Benefit: Support is available for registered manufacturers.', evidenceQuote: 'Benefit: Support is available for registered manufacturers.' },
    applyUrl: { value: 'https://apply.example.gov.in/form', evidenceQuote: 'Apply online' },
    conditions: [{ text: mappedCondition, evidenceQuote: mappedCondition }],
  });
  const client = fakeClient({
    page: (url) => ({ status: 'COMPLETED', content: 'Too short.', url }),
    agent: (url, goal) => {
      assert.match(goal, /Return JSON only/);
      assert.match(goal, /Do not guess, do not log in, do not fill any form/);
      return { status: 'COMPLETED', content: extraction, pageText: readablePage, url };
    },
  });
  const budget = { dailyCap: 1, callsUsed: 0 };
  const draft = await draftFromCandidate(candidate(), client, fakeGroq(mappedGroqResponse), budget);

  assert(draft);
  assert.equal(client.agentCalls.length, 1);
  assert.equal(draft.costs.tinyfishAgentCalls, 1);
  assert.equal(budget.callsUsed, 1);
  const capped = await draftFromCandidate(candidate('https://schemes.example.gov.in/second'), client, undefined, budget);
  assert.equal(capped, undefined);
  assert.equal(client.agentCalls.length, 1);
});

test('COMPLETED captcha or access-denied page is rejected without agent fallback', async () => {
  for (const content of [
    `captcha challenge page content ${readablePage}`,
    `Access Denied response page ${readablePage}`,
  ]) {
    const client = fakeClient({ page: (url) => ({ status: 'COMPLETED', content, url }) });
    const result = await draftFromCandidate(candidate(), client, undefined, { dailyCap: 5, callsUsed: 0 });

    assert.equal(result, undefined);
    assert.equal(client.agentCalls.length, 0);
  }
});

test('fields without verbatim evidence quotes are dropped', async () => {
  const agentExtraction = JSON.stringify({
    nameEn: { value: 'Invented scheme name', evidenceQuote: 'A quote absent from the page.' },
    nameHi: 'NOT_FOUND',
    benefit: { value: 'Invented benefit', evidenceQuote: 'Another absent quote.' },
    applyUrl: 'NOT_FOUND',
    conditions: [],
  });
  const client = fakeClient({
    page: (url) => ({ status: 'COMPLETED', content: 'short page', url }),
    agent: (url) => ({ status: 'COMPLETED', content: agentExtraction, pageText: readablePage, url }),
  });
  const draft = await draftFromCandidate(candidate(), client, undefined, { dailyCap: 1, callsUsed: 0 });

  assert(draft);
  assert.equal(draft.name.en, null);
  assert.equal(draft.benefit, null);
  assert.equal(draft.evidence.some((item) => item.fieldPath === 'name.en'), false);
  assert.equal(draft.evidence.some((item) => item.fieldPath === 'benefit'), false);
});

test('unmappable conditions remain verbatim and do not become criteria', async () => {
  const invalidMapping = [{
    condition: mappedCondition,
    evidenceQuote: mappedCondition,
    criterion: { field: 'inventedProfileField', eq: 'unknown' },
  }];
  const draft = await draftFromCandidate(
    candidate(),
    fakeClient(),
    fakeGroq(invalidMapping),
    { dailyCap: 0, callsUsed: 0 },
  );

  assert(draft);
  assert.deepEqual(draft.criteria, []);
  assert(draft.unmappedConditions.includes(mappedCondition));
});

test('draft metadata stays draft-only and hash matches verifyScheme', async () => {
  const client = fakeClient();
  const draft = await draftFromCandidate(
    candidate(),
    client,
    fakeGroq(mappedGroqResponse),
    { dailyCap: 0, callsUsed: 0 },
    () => new Date('2026-10-10T12:00:00Z'),
  );
  assert(draft);
  assert.equal(draft.draft, true);
  assert.equal(draft.checkedBy, null);
  assert.equal(draft.status, 'stale');
  assert.equal(draft.sourceUrl, candidate().url);
  assert.equal(draft.retrievedOn, '2026-10-10');
  assert.equal(draft.sourceHash, hashNormalized(normalizeText(readablePage)));

  const scheme: SchemeRecord = {
    id: 'test-hash-compare',
    name: { en: 'Test', hi: 'Test' },
    level: 'central',
    state: 'all',
    benefit: 'Test only',
    criteria: [],
    priority: 0,
    applyUrl: 'https://apply.example.gov.in/form',
    sourceUrl: candidate().url,
    retrievedOn: '2026-10-10',
    checkedBy: 'test',
    sourceHash: 'old-hash',
    status: 'active',
  };
  const verification = await verifyScheme(scheme, client);
  assert.equal(draft.sourceHash, verification.hash);
});

test('runDiscovery caps agent calls and spaces same-domain requests', async () => {
  const extraction = JSON.stringify({
    nameEn: { value: 'TEST Scheme Alpha', evidenceQuote: 'TEST Scheme Alpha' },
    nameHi: 'NOT_FOUND',
    benefit: 'NOT_FOUND',
    applyUrl: 'NOT_FOUND',
    conditions: [],
  });
  const client = fakeClient({
    results: [
      { url: 'https://batch.example.gov.in/one', title: 'TEST Scheme Alpha', snippet: '' },
      { url: 'https://batch.example.gov.in/two', title: 'TEST Scheme Alpha', snippet: '' },
    ],
    page: (url) => ({ status: 'COMPLETED', content: 'short', url }),
    agent: (url) => ({ status: 'COMPLETED', content: extraction, pageText: readablePage, url }),
  });
  let currentTime = 0;
  const waits: number[] = [];
  const report = await runDiscovery('MSME scheme Uttar Pradesh 2026', client, undefined, {
    dailyAgentCap: 1,
    persist: false,
    now: () => currentTime,
    sleep: async (milliseconds) => {
      waits.push(milliseconds);
      currentTime += milliseconds;
    },
  });

  assert.equal(report.costs.tinyfishAgentCalls, 1);
  assert.equal(client.agentCalls.length, 1);
  assert(waits.length >= 1);
  assert(waits.every((milliseconds) => milliseconds >= 1000));
});

test('loadSchemes never loads JSON drafts from the sibling drafts directory', async () => {
  const client = fakeClient({
    results: [{ url: 'https://loader-test.example.gov.in/draft', title: 'TEST Scheme Alpha', snippet: '' }],
  });
  const report = await runDiscovery('test query', client, fakeGroq(mappedGroqResponse), {
    dailyAgentCap: 0,
    now: () => Date.now(),
  });
  const writtenDraft = report.drafts[0];

  if (writtenDraft) {
    const filePath = path.join(draftsDirectory, `${writtenDraft.id}.json`);
    try {
      const loaded = await loadSchemes();
      assert.equal(loaded.some((record) => record.id === writtenDraft.id), false);
      assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), writtenDraft);
    } finally {
      await rm(filePath, { force: true });
    }
  } else {
    assert.fail('expected runDiscovery to persist its readable-page draft');
  }
});