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
  }, { origin: 'aria' });
  assert.equal(ariaResult.profile.state.value, 'Uttar Pradesh');
  assert.equal(ariaResult.profile.state.status, 'NEEDS_CONFIRMATION');
  assert.equal(ariaResult.profile.completeness.core, 0.9);
  assert.equal(ariaResult.profile.preferredLanguage, 'en');
  assert.deepEqual(ariaResult.changedKeys, ['state']);
  assert.equal(ariaResult.conflicts[0].proposedValue, 'Maharashtra');
  assert.equal(Object.hasOwn(ariaResult.profile, 'completeness'), true);

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
  assert.equal(vedaResult.profile.district.evidence.proposedDocumentValue, 'Lucknow');
  assert.equal(vedaResult.conflicts.length, 1);

  const confirmed = mergeProfile(vedaResult.profile, {
    district: { value: 'Lucknow', status: 'SELF_REPORTED', source: 'aria_text' },
  }, { origin: 'user_confirmed' });
  assert.equal(confirmed.profile.district.value, 'Lucknow');
  assert.equal(confirmed.profile.district.status, 'VERIFIED');
  assert.equal(confirmed.profile.district.source, 'user_confirmed');
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
