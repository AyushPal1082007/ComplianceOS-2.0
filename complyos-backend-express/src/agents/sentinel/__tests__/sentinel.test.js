import assert from 'node:assert/strict';
import { buildAlert } from '../buildAlert.js';
import { matchProfiles } from '../matchProfiles.js';
import { normalizeSourceText } from '../normalize.js';
import { diffText } from '../diff.js';
import { classifyChange } from '../classify.js';
import { withBlockCheck } from '../../../services/tinyfish.js';
import { loadSources, runSingleSource } from '../pipeline.js';

const validChange = {
  title: 'GST filing update',
  summary: 'Updated filing deadlines were announced for manufacturing businesses.',
  quote: 'The GST filing deadline has been revised for registered manufacturers in Uttar Pradesh.',
  confidence: 0.92,
  status: 'APPROVED',
  affects: { states: ['Uttar Pradesh'], sectors: ['manufacturer'], gstinHolders: true },
  lastVerified: new Date().toISOString(),
};

const alert = buildAlert({
  user: { id: 'owner-1' },
  source: { id: 'simulated-source', url: 'https://simulated.local/notice', simulated: true },
  change: validChange,
});

assert.ok(alert.title.startsWith('Simulated alert'));
assert.equal(alert.sourceUrl, 'https://simulated.local/notice');
assert.equal(alert.isSimulated, true);
assert.ok(alert.summary.includes('Simulated alert'));

assert.throws(() => buildAlert({
  user: { id: 'owner-1' },
  source: {},
  change: { ...validChange, sourceUrl: undefined },
}), /sourceUrl/);

assert.throws(() => buildAlert({
  user: { id: 'owner-1' },
  source: { url: 'https://simulated.local/notice' },
  change: { ...validChange, lastVerified: undefined },
}), /lastVerified/);

assert.throws(() => buildAlert({
  user: { id: 'owner-1' },
  source: { url: 'https://simulated.local/notice' },
  change: { ...validChange, quote: '   ' },
}), /valid quote/);

assert.throws(() => buildAlert({
  user: { id: 'owner-1' },
  source: { url: 'https://simulated.local/notice' },
  change: { ...validChange, confidence: 0.79, status: 'APPROVED' },
}), /confidence >= 0.80/);

const profiles = [
  { state: 'Uttar Pradesh', sector: 'manufacturer', gstin: '09AA', annualTurnover: 35 },
  { state: 'Maharashtra', sector: 'service', gstin: '27AA' },
];
const filtered = matchProfiles(profiles, { states: ['Uttar Pradesh'], sectors: ['manufacturer'], gstinHolders: true });
assert.equal(filtered.length, 1);
assert.equal(normalizeSourceText('<div>Hello <strong>world</strong></div>'), 'Hello world');

const delta = diffText('Old GST deadline.', 'New GST deadline for Uttar Pradesh.');
assert.equal(delta.hasChanged, true);
assert.ok(delta.changedParagraphs.length >= 1);

const classified = classifyChange({
  source: { id: 'gst-updates', name: 'GST portal updates', url: 'https://example.gov.in' },
  newText: 'The GST filing deadline has been revised for registered manufacturers in Uttar Pradesh.',
});
assert.equal(classified.status, 'APPROVED');
assert.ok(classified.confidence >= 0.8);

assert.equal(withBlockCheck({ text: 'captcha required' }).blocked, true);
assert.equal(withBlockCheck({ text: 'Access denied by page' }).blocked, true);

const sources = await loadSources();
assert.ok(Array.isArray(sources));
assert.equal(sources.some((source) => String(source.url).startsWith('TODO')), false);

const skipped = await runSingleSource({ id: 'placeholder', url: 'TODO_VERIFY_OFFICIAL_URL' });
assert.equal(skipped.status, 'SKIPPED');

console.log('sentinel module tests passed');
