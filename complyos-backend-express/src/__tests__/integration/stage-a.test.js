import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AgentOutputBaseSchema,
  TraceEventSchema,
} from '../../contracts/common.js';
import { isReal } from '../../config/flags.js';
import { mergeProfile } from '../../profile/mergePolicy.js';
import { buildBusinessProfileProjection } from '../../profile/projection.js';
import { clearMemoryStore, memoryStore } from '../../repos/memory/store.js';
import { findOrCreateByPhone } from '../../repos/memory/userRepo.js';
import * as profileRepo from '../../repos/profileRepo.js';
import { saveFromVeda } from '../../repos/documentRepo.js';
import { getStatutoryDeadlines } from '../../rules/deadlines.js';
import { gstLateFee } from '../../rules/gstLateFee.js';
import { gstLateFee as legacyGstLateFee } from '../../utils/complianceCalculators.js';

test('shared agent output and trace contracts accept the supported agent set', () => {
  for (const agent of ['ARIA', 'VEDA', 'SCOUT', 'SENTINEL', 'PATHWAY', 'ORCHESTRATOR']) {
    assert.doesNotThrow(() => TraceEventSchema.parse({
      runId: 'run-1',
      agent,
      node: 'test',
      startedAt: new Date().toISOString(),
      durationMs: 0,
      status: 'done',
    }));
  }
  assert.doesNotThrow(() => AgentOutputBaseSchema.parse({
    status: 'OK',
    messages: [{ type: 'text', text: 'Ready' }],
    claims: [],
    trace: [],
    costs: {},
  }));
});

test('real flags require exact true and reject unset or alternate casing', () => {
  const previous = process.env.ARIA_REAL;
  try {
    for (const value of [undefined, 'TRUE', '1', 'false']) {
      if (value === undefined) delete process.env.ARIA_REAL;
      else process.env.ARIA_REAL = value;
      assert.equal(isReal('ARIA'), false);
    }
    process.env.ARIA_REAL = 'true';
    assert.equal(isReal('ARIA'), true);
  } finally {
    if (previous === undefined) delete process.env.ARIA_REAL;
    else process.env.ARIA_REAL = previous;
  }
});

test('merge policy ignores non-fields, protects verified values, and records conflicts', () => {
  const current = {
    state: { value: 'Uttar Pradesh', status: 'VERIFIED', confidence: 1, source: 'veda_doc' },
    district: { value: 'Kanpur', status: 'SELF_REPORTED', confidence: 1, source: 'aria_text' },
    preferredLanguage: 'hi',
  };

  const ariaResult = mergeProfile(current, {
    state: { value: 'Maharashtra', status: 'SELF_REPORTED', source: 'aria_text' },
    completeness: { core: 0.9, extended: 0.2 },
    preferredLanguage: 'en',
    healthScore: 1,
  }, { origin: 'aria' });
  assert.equal(ariaResult.profile.state.value, 'Uttar Pradesh');
  assert.equal(ariaResult.profile.state.status, 'NEEDS_CONFIRMATION');
  assert.equal(ariaResult.profile.completeness, undefined);
  assert.equal(ariaResult.profile.preferredLanguage, 'en');
  assert.deepEqual(ariaResult.changedKeys, ['state']);
  assert.equal(ariaResult.conflicts[0].proposedValue, 'Maharashtra');
  assert.equal(ariaResult.profile.healthScore, undefined);
  assert.equal(ariaResult.profile.state.evidence.conflict, true);

  const vedaResult = mergeProfile(current, {
    district: {
      value: 'Lucknow',
      status: 'VERIFIED',
      confidence: 0.96,
      source: 'veda_doc',
      evidence: { quote: 'District: Lucknow' },
    },
  }, { origin: 'veda_doc' });
  assert.equal(vedaResult.profile.district.value, 'Kanpur');
  assert.equal(vedaResult.profile.district.status, 'NEEDS_CONFIRMATION');
  assert.equal(vedaResult.profile.district.evidence.selfReportedValue, 'Kanpur');
  assert.equal(vedaResult.profile.district.evidence.proposedValue, 'Lucknow');
  assert.equal(vedaResult.conflicts.length, 1);

  const confirmed = mergeProfile(vedaResult.profile, {
    district: { value: 'Lucknow', status: 'SELF_REPORTED', source: 'aria_text' },
  }, { origin: 'user_confirmed' });
  assert.equal(confirmed.profile.district.value, 'Lucknow');
  assert.equal(confirmed.profile.district.status, 'VERIFIED');
  assert.equal(confirmed.profile.district.source, 'user_confirmed');
});

test('repeated ARIA conflict preserves the verified value without adding another conflict', () => {
  const original = {
    state: { value: 'Uttar Pradesh', status: 'VERIFIED', confidence: 1, source: 'veda_doc' },
  };
  const first = mergeProfile(original, {
    state: { value: 'Maharashtra', status: 'SELF_REPORTED', source: 'aria_text' },
  }, { origin: 'aria' });
  const repeated = mergeProfile(first.profile, {
    state: { value: 'Maharashtra', status: 'SELF_REPORTED', source: 'aria_text' },
  }, { origin: 'aria' });

  assert.equal(first.conflicts.length, 1);
  assert.equal(repeated.conflicts.length, 0);
  assert.equal(repeated.profile.state.value, 'Uttar Pradesh');
  assert.equal(repeated.profile.state.evidence.verifiedValue, 'Uttar Pradesh');
  assert.equal(repeated.profile.state.evidence.proposedValue, 'Maharashtra');
  assert.equal(repeated.profile.state.evidence.conflict, true);
});

test('VEDA cannot overwrite a field while its conflict is pending', () => {
  const conflicted = mergeProfile({
    district: { value: 'Kanpur', status: 'SELF_REPORTED', source: 'aria_text' },
  }, {
    district: { value: 'Lucknow', status: 'VERIFIED', source: 'veda_doc' },
  }, { origin: 'veda_doc' });
  const retried = mergeProfile(conflicted.profile, {
    district: { value: 'Agra', status: 'VERIFIED', source: 'veda_doc' },
  }, { origin: 'veda_doc' });

  assert.equal(conflicted.profile.district.evidence.conflict, true);
  assert.equal(retried.profile.district.value, 'Kanpur');
  assert.equal(retried.profile.district.evidence.proposedValue, 'Lucknow');
  assert.equal(retried.conflicts.length, 0);
  assert.deepEqual(retried.changedKeys, []);
});

test('user confirmation resolves conflicts by keeping the old value or choosing the new value', () => {
  const original = {
    state: { value: 'Uttar Pradesh', status: 'VERIFIED', source: 'veda_doc' },
    district: { value: 'Kanpur', status: 'SELF_REPORTED', source: 'aria_text' },
  };
  const conflicted = mergeProfile(original, {
    state: { value: 'Maharashtra', status: 'SELF_REPORTED' },
  }, { origin: 'aria' });
  const documentConflict = mergeProfile(conflicted.profile, {
    district: { value: 'Lucknow', status: 'VERIFIED', source: 'veda_doc' },
  }, { origin: 'veda_doc' });
  const resolved = mergeProfile(documentConflict.profile, {
    state: { value: 'Uttar Pradesh' },
    district: { value: 'Lucknow' },
  }, { origin: 'user_confirmed' });

  assert.equal(resolved.profile.state.value, 'Uttar Pradesh');
  assert.equal(resolved.profile.state.status, 'VERIFIED');
  assert.notEqual(resolved.profile.state.evidence?.conflict, true);
  assert.equal(resolved.profile.district.value, 'Lucknow');
  assert.equal(resolved.profile.district.status, 'VERIFIED');
  assert.notEqual(resolved.profile.district.evidence?.conflict, true);
});

test('identical field values do not report changes solely due to updatedAt', () => {
  const result = mergeProfile({
    sector: {
      value: 'manufacturing',
      status: 'SELF_REPORTED',
      confidence: 1,
      source: 'aria_text',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  }, {
    sector: {
      value: 'manufacturing',
      status: 'SELF_REPORTED',
      confidence: 1,
      source: 'aria_text',
      updatedAt: '2026-10-02T00:00:00.000Z',
    },
  }, { origin: 'aria' });

  assert.deepEqual(result.changedKeys, []);
});

test('ARIA ignores derived fields and only accepts supported preferred languages', () => {
  const result = mergeProfile({ preferredLanguage: 'hi' }, {
    completeness: { core: 1, extended: 1 },
    preferredLanguage: 'fr',
    healthScore: 100,
    penaltyAtRisk: 0,
    schemeHeadroom: 50,
  }, { origin: 'aria' });
  assert.equal(result.profile.completeness, undefined);
  assert.equal(result.profile.preferredLanguage, 'hi');
  assert.equal(result.profile.healthScore, undefined);
  assert.equal(result.profile.penaltyAtRisk, undefined);
  assert.equal(result.profile.schemeHeadroom, undefined);
});

test('ARIA-origin fields cannot claim document or user-confirmed provenance', () => {
  const result = mergeProfile({}, {
    sector: {
      value: 'manufacturing',
      status: 'SELF_REPORTED',
      source: 'veda_doc',
    },
    district: {
      value: 'Kanpur',
      status: 'VERIFIED',
      source: 'user_confirmed',
    },
  }, { origin: 'aria' });

  assert.equal(result.profile.sector.source, 'aria_text');
  assert.equal(result.profile.district.source, 'aria_text');
  assert.equal(result.profile.district.status, 'SELF_REPORTED');
});

test('projection maps bands without writing them into numeric legacy columns', () => {
  const projection = buildBusinessProfileProjection('user-1', {
    turnoverBand: { value: 'micro', status: 'SELF_REPORTED' },
    employeesBand: { value: '1-9', status: 'SELF_REPORTED' },
    annualTurnover: { value: 35, status: 'SELF_REPORTED' },
    employeeCount: { value: 4, status: 'SELF_REPORTED' },
    gstin: { value: 'masked', status: 'SELF_REPORTED' },
    womenLed: { value: false, status: 'VERIFIED' },
  }, 0.75);

  assert.equal(projection.turnoverBand, 'micro');
  assert.equal(projection.employeesBand, '1-9');
  assert.equal(Object.hasOwn(projection, 'annualTurnover'), false);
  assert.equal(Object.hasOwn(projection, 'employeeCount'), false);
  assert.equal(Object.hasOwn(projection, 'gstin'), false);
  assert.equal(projection.isWomenLed, false);
  assert.equal(projection.profileComplete, false);
});

test('shared deterministic rules preserve calculations and include provenance', () => {
  const input = { annualTurnoverLakhs: 50, isNilReturn: false, daysLate: 30, returnCount: 1 };
  const wrapped = gstLateFee(input);
  assert.equal(wrapped.totalFee, legacyGstLateFee(input).totalFee);
  assert.equal(wrapped.sourceUrl, wrapped.source.url);
  assert.equal(wrapped.lastVerified, wrapped.source.lastChecked);

  const [deadline] = getStatutoryDeadlines({ annualTurnoverLakhs: 50 });
  assert.ok(deadline.sourceUrl);
  assert.ok(deadline.lastVerified);
});

test('memory profile repository persists only changed fields and matches opted-in users', async () => {
  const previousDriver = process.env.REPO_DRIVER;
  process.env.REPO_DRIVER = 'memory';
  clearMemoryStore();
  try {
    const user = await findOrCreateByPhone('+1 (555) 010-1234', 'whatsapp');
    user.consentGiven = true;
    const merged = mergeProfile({}, {
      state: { value: 'Uttar Pradesh', status: 'SELF_REPORTED', source: 'aria_option' },
      turnoverBand: { value: 'micro', status: 'SELF_REPORTED', source: 'aria_option' },
    }, { origin: 'aria' });
    await profileRepo.save(user.id, merged.profile, merged.changedKeys);
    const loaded = await profileRepo.load(user.id);
    assert.equal(loaded.state.value, 'Uttar Pradesh');
    assert.equal(loaded.turnoverBand.value, 'micro');
    assert.equal(memoryStore.profiles.get(user.id).turnoverBand, 'micro');
    assert.equal(Object.hasOwn(memoryStore.profiles.get(user.id), 'annualTurnover'), false);
    assert.equal((await profileRepo.loadForMatching({ limit: 10 })).length, 1);

    const document = await saveFromVeda(user.id, {
      filename: 'sample.pdf',
      documentType: 'GST_CERTIFICATE',
      ocrText: 'PAN: ABCDE1234F; GSTIN: 22ABCDE1234F1Z5',
      extractedData: { pan: 'ABCDE1234F' },
    });
    assert.equal(document.ocrText.includes('ABCDE1234F'), false);
    assert.equal(document.extractedData.pan, '[REDACTED]');
  } finally {
    clearMemoryStore();
    if (previousDriver === undefined) delete process.env.REPO_DRIVER;
    else process.env.REPO_DRIVER = previousDriver;
  }
});
