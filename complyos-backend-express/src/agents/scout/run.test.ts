import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentOutputSchema, type AgentInput } from './contractsPlaceholder.ts';
import { run as runReal } from './index.ts';
import { run as runMock } from './mock.ts';
import { createScoutRunner } from './runner.ts';
import { selectScoutRunner } from './entry.ts';
import { SCOUT_FIXTURES } from './fixtures/index.ts';
import type { GroqClient } from './groqPlaceholder.ts';
import type { SchemeRecord } from './schemas.ts';

function profile(fieldCount = 10, preferredLanguage = 'en'): AgentInput['profile'] {
  const fields = [
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
  ];
  const values = Object.fromEntries(fields.slice(0, fieldCount).map((key) => [key, {
    value: key === 'state' ? 'Uttar Pradesh' : key === 'sector' ? 'manufacturer' : true,
    status: 'VERIFIED',
  }]));
  return { ...values, preferredLanguage };
}

function input(
  eventType: string,
  profileFields: AgentInput['profile'] = profile(),
  preferredLanguage?: string,
): AgentInput {
  return {
    runId: `run-${eventType.toLowerCase()}`,
    userId: 'fixture-user',
    event: { type: eventType },
    profile: preferredLanguage
      ? { ...profileFields, preferredLanguage }
      : profileFields,
    locale: 'en',
  };
}

function scheme(overrides: Partial<SchemeRecord> = {}): SchemeRecord {
  return {
    id: 'verified-scheme',
    name: { en: 'Verified Scheme', hi: 'सत्यापित योजना' },
    level: 'state',
    state: 'Uttar Pradesh',
    benefit: 'Verified benefit information',
    criteria: [{ field: 'state', eq: 'Uttar Pradesh' }],
    priority: 8,
    applyUrl: 'https://example.test/apply',
    sourceUrl: 'https://example.test/source',
    retrievedOn: '2026-10-10T00:00:00.000Z',
    checkedBy: 'human reviewer',
    sourceHash: 'fixture-hash',
    status: 'active',
    ...overrides,
  };
}

function fakeGroqClient(onCall: () => void = () => undefined, tokenCount = 4): GroqClient {
  return {
    async json<T>(): Promise<T> {
      onCall();
      return {
        explanation_hi: 'दिए गए मानदंड इस योजना से मेल खाते हैं।',
        explanation_en: 'The recorded criteria match this scheme.',
      } as T;
    },
    getLastTokenCount: () => tokenCount,
  };
}

test('SCHEME_REQUEST returns a list and one claim per displayed scheme', async () => {
  const run = createScoutRunner(async () => [scheme()]);
  const output = await run(input('SCHEME_REQUEST'));

  assert.equal(output.status, 'OK');
  assert.equal(output.messages[0]?.type, 'list');
  if (output.messages[0]?.type !== 'list') assert.fail('expected a list message');
  assert.equal(output.claims.length, output.messages[0].items.length);
});

test('empty profile returns NEEDS_INPUT', async () => {
  const output = await createScoutRunner(async () => [scheme()])(
    input('SCHEME_REQUEST', {}),
  );

  assert.equal(output.status, 'NEEDS_INPUT');
  assert.equal(output.messages[0]?.type, 'text');
});

test('TEASER returns one text message and never an eligible claim', async () => {
  let llmCalls = 0;
  const output = await createScoutRunner(async () => [scheme()], fakeGroqClient(() => { llmCalls++; }))(
    input('TEASER', profile(4)),
  );

  assert.equal(output.messages.length, 1);
  assert.equal(output.messages[0]?.type, 'text');
  assert.doesNotMatch(output.messages[0]?.type === 'text' ? output.messages[0].text : '', /eligible/i);
  assert.equal(llmCalls, 0);
});

test('scheme with placeholder sourceUrl is not displayed or claimed', async () => {
  const output = await createScoutRunner(async () => [scheme({ sourceUrl: 'TODO(owner)' })])(
    input('SCHEME_REQUEST'),
  );

  assert.equal(output.status, 'FAILED');
  assert.equal(output.messages.length, 1);
  assert.doesNotMatch(output.messages[0]?.type === 'text' ? output.messages[0].text : '', /TODO|scheme/i);
  assert.deepEqual(output.claims, []);
});

test('scheme without checker metadata is not displayed or claimed', async () => {
  const output = await createScoutRunner(async () => [scheme({ checkedBy: '' })])(
    input('SCHEME_REQUEST'),
  );

  assert.equal(output.status, 'FAILED');
  assert.deepEqual(output.claims, []);
  assert.doesNotMatch(JSON.stringify(output.messages), /Verified Scheme/);
});

test('stale scheme is tagged as being re-verified', async () => {
  const output = await createScoutRunner(async () => [scheme({ status: 'stale' })])(
    input('SCHEME_REQUEST'),
  );

  assert.equal(output.messages[0]?.type, 'list');
  if (output.messages[0]?.type !== 'list') assert.fail('expected a list message');
  assert(output.messages[0].items[0].tags.includes('being re-verified'));
});

test('loader exception returns FAILED without throwing', async () => {
  const output = await createScoutRunner(async () => {
    throw new Error('fixture loader failed');
  })(input('SCHEME_REQUEST'));

  assert.equal(output.status, 'FAILED');
  assert.equal(output.trace[0]?.error, 'fixture loader failed');
});

test('Hindi, English, and Hinglish all render localized list messages', async () => {
  const run = createScoutRunner(async () => [scheme()]);

  for (const lang of ['hi', 'en', 'hinglish'] as const) {
    const output = await run(input('SCHEME_REQUEST', profile(10), lang));
    assert.equal(output.messages[0]?.type, 'list');
    if (output.messages[0]?.type !== 'list') assert.fail('expected a list message');
    assert(output.messages[0].text.length > 0);
  }
});

test('real output validates against AgentOutput schema', async () => {
  const output = await createScoutRunner(async () => [scheme()])(
    input('SCHEME_REQUEST'),
  );

  assert.doesNotThrow(() => AgentOutputSchema.parse(output));
});

test('mock and real runs return the AgentOutput shape', async () => {
  const fixtureInput = input('SCHEME_REQUEST', {
    ...SCOUT_FIXTURES.complete.profile,
    fixtureId: 'complete',
  });
  const mockOutput = await runMock(fixtureInput);
  const realOutput = await createScoutRunner(async () => [scheme()])(
    input('SCHEME_REQUEST'),
  );

  assert.doesNotThrow(() => AgentOutputSchema.parse(mockOutput));
  assert.doesNotThrow(() => AgentOutputSchema.parse(realOutput));
});

test('SCOUT_REAL selects the real runner only when set to true', () => {
  const realRunner = async (_input: AgentInput) => AgentOutputSchema.parse({
    status: 'OK', messages: [], claims: [], trace: [], costs: {},
  });
  const mockRunner = async (_input: AgentInput) => AgentOutputSchema.parse({
    status: 'OK', messages: [], claims: [], trace: [], costs: {},
  });

  assert.equal(selectScoutRunner('true', realRunner, mockRunner), realRunner);
  assert.equal(selectScoutRunner('false', realRunner, mockRunner), mockRunner);
  assert.equal(selectScoutRunner(undefined, realRunner, mockRunner), mockRunner);
});

test('mock returns the fixture output for its profile id and defaults safely', async () => {
  const fixtureInput = input('SCHEME_REQUEST', {
    ...SCOUT_FIXTURES.partial.profile,
    fixtureId: 'partial',
  });
  const output = await runMock(fixtureInput);
  const defaultOutput = await runMock(input('SCHEME_REQUEST', {}));

  assert.deepEqual(output, SCOUT_FIXTURES.partial.expected);
  assert.deepEqual(defaultOutput, SCOUT_FIXTURES.empty.expected);
});

test('only the top three matches invoke the explanation client', async () => {
  let llmCalls = 0;
  const schemes = Array.from({ length: 5 }, (_, index) => scheme({
    id: `top-three-${index}`,
    name: { en: `Scheme ${index}`, hi: `योजना ${index}` },
  }));
  const output = await createScoutRunner(
    async () => schemes,
    fakeGroqClient(() => { llmCalls++; }),
  )(input('SCHEME_REQUEST'));

  assert.equal(llmCalls, 3);
  assert.equal(output.messages[0]?.type, 'list');
});

test('client failure degrades status while still delivering messages', async () => {
  const client: GroqClient = {
    async json<T>(): Promise<T> {
      throw new Error('temporary Groq outage');
    },
  };
  const output = await createScoutRunner(
    async () => [scheme({ id: 'degraded-run' })],
    client,
    async () => undefined,
  )(input('SCHEME_REQUEST'));

  assert.equal(output.status, 'DEGRADED');
  assert.equal(output.messages[0]?.type, 'list');
});

test('LLM explanation claim retains source provenance', async () => {
  const output = await createScoutRunner(
    async () => [scheme({ id: 'llm-claim' })],
    fakeGroqClient(),
  )(input('SCHEME_REQUEST'));

  assert.equal(output.claims[0]?.basis, 'llm_summary');
  assert.equal(output.claims[0]?.sourceUrl, 'https://example.test/source');
  assert.equal(output.claims[0]?.lastVerified, '2026-10-10T00:00:00.000Z');
  assert.equal(output.costs.llmTokens, 4);
});