import type { AgentOutput } from '../contractsPlaceholder.ts';
import type { BusinessProfile } from '../schemas.ts';

const fixtureTrace = {
  runId: 'scout-fixture',
  agent: 'scout',
  node: 'mock',
  startedAt: '2026-10-10T00:00:00.000Z',
  durationMs: 0,
  inputSummary: 'fixture profile',
  outputSummary: 'static fixture output',
};

export type ScoutFixture = {
  profile: BusinessProfile;
  expected: AgentOutput;
};

export const SCOUT_FIXTURES: Record<'empty' | 'partial' | 'complete', ScoutFixture> = {
  empty: {
    profile: { fixtureId: 'empty', preferredLanguage: 'en' },
    expected: {
      status: 'NEEDS_INPUT',
      messages: [{ type: 'text', text: 'Please share a few more details about your business.' }],
      claims: [],
      trace: [{ ...fixtureTrace, status: 'NEEDS_INPUT' }],
      costs: { llmTokens: 0, tinyfishAgentCalls: 0 },
    },
  },
  partial: {
    profile: {
      fixtureId: 'partial',
      preferredLanguage: 'hinglish',
      state: { value: 'Uttar Pradesh', status: 'SELF_REPORTED' },
      sector: { value: 'manufacturer', status: 'SELF_REPORTED' },
      subSector: { value: 'TODO(owner)', status: 'EMPTY' },
      turnoverBand: { value: 'TODO(owner)', status: 'EMPTY' },
      gstRegistered: { value: true, status: 'VERIFIED' },
      udyamRegistered: { value: false, status: 'VERIFIED' },
    },
    expected: {
      status: 'OK',
      messages: [{ type: 'text', text: 'SCOUT mock fixture response.' }],
      claims: [],
      trace: [{ ...fixtureTrace, status: 'OK' }],
      costs: { llmTokens: 0, tinyfishAgentCalls: 0 },
    },
  },
  complete: {
    profile: {
      fixtureId: 'complete',
      preferredLanguage: 'hi',
      state: { value: 'Uttar Pradesh', status: 'VERIFIED' },
      sector: { value: 'manufacturer', status: 'VERIFIED' },
      subSector: { value: 'textiles', status: 'SELF_REPORTED' },
      gstRegistered: { value: true, status: 'VERIFIED' },
      turnoverBand: { value: '20L_40L', status: 'SELF_REPORTED' },
      udyamRegistered: { value: true, status: 'VERIFIED' },
      employeesBand: { value: '1_9', status: 'VERIFIED' },
      womenLed: { value: false, status: 'SELF_REPORTED' },
      ownerAgeBand: { value: '21_40', status: 'VERIFIED' },
      goal: { value: 'scheme_support', status: 'SELF_REPORTED' },
    },
    expected: {
      status: 'OK',
      messages: [{ type: 'text', text: 'SCOUT mock fixture response.' }],
      claims: [],
      trace: [{ ...fixtureTrace, status: 'OK' }],
      costs: { llmTokens: 0, tinyfishAgentCalls: 0 },
    },
  },
};