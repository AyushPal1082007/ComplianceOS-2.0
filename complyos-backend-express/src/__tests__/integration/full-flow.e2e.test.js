import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.REPO_DRIVER = 'memory';
process.env.ARIA_REAL = 'true';
process.env.SCOUT_REAL = 'true';
process.env.VEDA_REAL = 'false';
process.env.SARVAM_MOCK = 'true';
process.env.GROQ_API_KEY = '';
process.env.SARVAM_API_KEY = '';
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.GOOGLE_APPLICATION_CREDENTIALS = '';

globalThis.__integrationProviderCalls = {
  groq: 0,
  sarvam: 0,
  cloudinary: 0,
  vision: 0,
};

const vedaMock = `
const claim = {
  text: 'The uploaded registration document was reviewed.',
  sourceUrl: 'https://services.gst.gov.in/services/searchtp',
  lastVerified: '2026-10-10',
  basis: 'document',
  confidence: 0.99,
};
const calendarItems = [{
  id: 'e2e-gstr-3b',
  title: 'GSTR-3B',
  deadlineDate: '2026-11-20',
  urgency: 'high',
  category: 'GST',
  status: 'pending',
  description: 'Monthly summary return and tax payment',
  sourceUrl: 'https://gst.gov.in',
  lastVerified: '2026-10-10',
}];
const profilePatch = {
  gstin: {
    value: '09AAECP1234F1Z5',
    status: 'VERIFIED',
    confidence: 0.99,
    source: 'veda_doc',
    evidence: { quote: 'Registration details reviewed' },
    updatedAt: '2026-10-10T00:00:00.000Z',
  },
  constitution: {
    value: 'Private Limited Company',
    status: 'VERIFIED',
    confidence: 0.99,
    source: 'veda_doc',
    evidence: { quote: 'Constitution reviewed' },
    updatedAt: '2026-10-10T00:00:00.000Z',
  },
};
export async function run(input = {}) {
  const resumed = input.event?.action === 'resume';
  return {
    status: resumed ? 'OK' : 'NEEDS_CONFIRMATION',
    profilePatch,
    messages: resumed
      ? [{ type: 'text', text: 'Document details confirmed and saved.' }]
      : [{
        type: 'confirm_card',
        id: 'veda-document-confirm',
        text: 'Confirm the verified document details?',
        actions: [{ id: 'confirm', label: 'Confirm' }, { id: 'cancel', label: 'Cancel' }],
      }],
    claims: [claim],
    calendarItems,
    trace: [{
      runId: input.runId || 'veda-e2e',
      agent: 'VEDA',
      node: 'mock',
      startedAt: '2026-10-10T00:00:00.000Z',
      durationMs: 0,
      status: 'done',
    }],
    costs: { llmTokens: 0, tinyfishAgentCalls: 0 },
  };
}
export default { run };
`;

const moduleMocks = new Map([
  [new URL('../../agents/veda/index.js', import.meta.url).href, vedaMock],
  [new URL('../../agents/scout/entry.ts', import.meta.url).href, `
    export async function run(input = {}) {
      return {
        status: 'NEEDS_INPUT',
        messages: [{ type: 'text', text: 'No verified schemes are currently available.' }],
        claims: [],
        trace: [{
          runId: input.runId || 'scout-e2e',
          agent: 'SCOUT',
          node: 'verified-source-filter',
          startedAt: '2026-10-10T00:00:00.000Z',
          durationMs: 0,
          status: 'NEEDS_INPUT',
        }],
        costs: { llmTokens: 0, tinyfishAgentCalls: 0 },
      };
    }
  `],
  [new URL('../../services/sarvamService.js', import.meta.url).href, `
    export async function transcribeHindi() {
      globalThis.__integrationProviderCalls.sarvam += 1;
      return { transcript: 'mock transcript', confidence: 1 };
    }
    export async function synthesizeHindi() {
      globalThis.__integrationProviderCalls.sarvam += 1;
      return { audioBase64: '', format: 'wav' };
    }
    export async function translateText(text) { return text; }
    export default { transcribeHindi, synthesizeHindi, translateText };
  `],
  [new URL('../../services/sarvam.js', import.meta.url).href, `
    export class SarvamUnavailable extends Error {}
    export class SarvamBadAudio extends Error {}
    export async function transcribe() {
      globalThis.__integrationProviderCalls.sarvam += 1;
      return { text: 'mock transcript', confidence: 1 };
    }
    export async function speak() { return { audioBase64: '', format: 'wav' }; }
  `],
  [new URL('../../services/cloudinaryService.js', import.meta.url).href, `
    export async function uploadBuffer() {
      globalThis.__integrationProviderCalls.cloudinary += 1;
      return { secure_url: 'https://res.cloudinary.com/test/mock.pdf', public_id: 'mock' };
    }
    export async function deleteFile() {
      globalThis.__integrationProviderCalls.cloudinary += 1;
      return { result: 'ok' };
    }
    export default { uploadBuffer, deleteFile };
  `],
  [new URL('../../services/vision.js', import.meta.url).href, `
    export async function ocr() {
      globalThis.__integrationProviderCalls.vision += 1;
      return { text: 'mock vision output' };
    }
    export default { ocr };
  `],
]);

const packageMocks = new Map([
  ['groq-sdk', `
    export default class Groq {
      constructor() {
        this.chat = { completions: { create: async () => {
          globalThis.__integrationProviderCalls.groq += 1;
          return { choices: [{ message: { content: '{}' } }] };
        } } };
      }
    }
  `],
  ['cloudinary', `
    export const v2 = {
      config() {},
      uploader: {
        upload_stream(_options, callback) {
          return { end() { callback(null, { secure_url: 'https://res.cloudinary.com/test/mock', public_id: 'mock' }); } };
        },
        async destroy() { return { result: 'ok' }; },
      },
    };
    export default { v2 };
  `],
  ['@google-cloud/vision', `
    export class ImageAnnotatorClient {
      async textDetection() {
        globalThis.__integrationProviderCalls.vision += 1;
        return [{ fullTextAnnotation: { text: 'mock vision output' } }];
      }
    }
    const vision = { ImageAnnotatorClient };
    export default vision;
  `],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const source = packageMocks.get(specifier);
    if (source) {
      return {
        url: `data:text/javascript,${encodeURIComponent(source)}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const source = moduleMocks.get(url);
    if (source) return { format: 'module', shortCircuit: true, source };
    return nextLoad(url, context);
  },
});

const [
  { default: app },
  jwtModule,
  configModule,
  storeModule,
  profileRepoModule,
  deadlineRepoModule,
  alertRepoModule,
  sentinelDeliveryModule,
] = await Promise.all([
  import('../../app.js'),
  import('jsonwebtoken'),
  import('../../config.js'),
  import('../../repos/memory/store.js'),
  import('../../repos/profileRepo.js'),
  import('../../repos/deadlineRepo.js'),
  import('../../repos/memory/alertRepo.js'),
  import('../../graph/nodes/sentinelDeliveryNode.js'),
]);

const jwt = jwtModule.default;
const config = configModule.default;
const { clearMemoryStore, memoryStore } = storeModule;
const { listUpcomingForUser } = deadlineRepoModule;
const { createSentinelAlertWithLedger } = alertRepoModule;
const { deliverApprovedChange } = sentinelDeliveryModule;

function startServer() {
  const server = app.listen(0, '127.0.0.1');
  return new Promise((resolve, reject) => {
    server.once('listening', () => resolve(server));
    server.once('error', reject);
  });
}

async function closeServer(server) {
  const closed = new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  server.closeAllConnections?.();
  await closed;
}

test('memory-mode app imports, starts, answers health, and shuts down cleanly', async () => {
  const server = await startServer();
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'operational');
  } finally {
    await closeServer(server);
  }
});

test('authenticated chat event flow covers consent, ARIA, SCOUT, VEDA, SENTINEL, and deletion', async () => {
  clearMemoryStore();
  const phone = '919876543210';
  const gstin = '09AAECP1234F1Z5';
  const pan = 'ABCDE1234F';
  const user = {
    id: 'full-flow-user',
    phone,
    email: 'full-flow@example.invalid',
    fullName: 'Integration User',
    passwordHash: 'disabled:test',
    role: 'owner',
    plan: 'free',
    language: 'en',
    isActive: true,
    consentGiven: false,
    consentAt: null,
  };
  memoryStore.users.set(user.id, user);
  const token = jwt.sign({ sub: user.id }, config.jwt.secret);
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const traces = [];
  const persistedTraces = [];
  const logs = [];
  const stdoutWrite = process.stdout.write;
  const stderrWrite = process.stderr.write;
  process.stdout.write = function captureStdout(chunk, ...args) {
    logs.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
    return stdoutWrite.call(this, chunk, ...args);
  };
  process.stderr.write = function captureStderr(chunk, ...args) {
    logs.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
    return stderrWrite.call(this, chunk, ...args);
  };

  async function postEvent(externalId, event) {
    const response = await fetch(`${baseUrl}/api/chat/event`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...event, externalId }),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    traces.push(...(result.trace || []));
    persistedTraces.push(...structuredClone(memoryStore.traces));
    return result;
  }

  try {
    globalThis.__integrationProviderCalls = { groq: 0, sarvam: 0, cloudinary: 0, vision: 0 };

    const first = await postEvent('flow-start', { type: 'START', language: 'en' });
    assert.equal(first.status, 'NEEDS_CONFIRMATION');
    assert.equal(first.messages.length, 1);
    assert.equal(first.messages[0].type, 'confirm_card');
    assert.equal(first.messages[0].id, 'consent');

    const accepted = await postEvent('flow-consent', {
      type: 'CONSENT',
      accepted: true,
      language: 'en',
    });
    assert.equal(accepted.status, 'OK');
    assert(accepted.messages.some((message) => message.type === 'text'));
    let question = accepted.messages.find((message) => ['option_card', 'list'].includes(message.type));
    assert(question, 'consent acceptance should begin ARIA intake with its first question');

    const forcedOptions = { state: 'delhi', gstRegistered: 'no' };
    let reachedReveal = false;
    for (let index = 0; index < 16; index += 1) {
      const rows = question.options || question.rows || [];
      const preferred = forcedOptions[question.id];
      const selected = rows.find((row) => row.id === preferred)
        || rows.find((row) => row.id !== 'unsure' && row.id !== 'skip');
      assert(selected, `expected a selectable option for ARIA question ${question.id}`);

      const tapped = await postEvent(`flow-tap-${index}`, {
        type: 'OPTION_TAP',
        questionId: question.id,
        optionId: selected.id,
        language: 'en',
      });
      assert.equal(globalThis.__integrationProviderCalls.groq, 0, 'option taps must not call Groq');
      assert(!tapped.trace?.some((entry) => /groq|llm/i.test(`${entry.node} ${entry.outputSummary || ''}`)));

      const reveal = tapped.messages.find((message) => (
        message.type === 'confirm_card' && message.id === 'aria-reveal'
      ));
      if (reveal) {
        reachedReveal = true;
        break;
      }
      question = tapped.messages.find((message) => ['option_card', 'list'].includes(message.type));
      assert(question, 'ARIA should continue with another intake option or reveal confirmation');
    }
    assert.equal(reachedReveal, true, 'tap-only answers should reach the ARIA reveal card');

    const scout = await postEvent('flow-aria-finish', {
      type: 'OPTION_TAP',
      questionId: 'aria-reveal',
      optionId: 'finish',
      language: 'en',
    });
    assert.equal(scout.status, 'NEEDS_INPUT');
    assert.deepEqual(scout.claims, []);
    assert(!scout.messages.some((message) => message.type === 'list'));
    assert.match(JSON.stringify(scout.messages), /no verified schemes/i);
    assert.doesNotMatch(JSON.stringify(scout.messages), /eligible/i);
    assert(scout.claims.every((claim) => claim.sourceUrl && claim.lastVerified));

    const veda = await postEvent('flow-document', {
      type: 'DOCUMENT',
      document: {
        url: 'https://res.cloudinary.com/test/registration.pdf',
        mime: 'application/pdf',
        filename: 'registration.pdf',
      },
      language: 'en',
    });
    assert.equal(veda.status, 'NEEDS_CONFIRMATION');
    assert(veda.messages.some((message) => (
      message.type === 'confirm_card' && message.id === 'veda-document-confirm'
    )));
    assert(veda.claims.every((claim) => claim.sourceUrl && claim.lastVerified));

    const confirmed = await postEvent('flow-document-confirm', {
      type: 'CONFIRM_ACTION',
      card: { cardId: 'veda-document-confirm', actionId: 'confirm' },
      actionId: 'confirm',
      language: 'en',
    });
    assert.equal(confirmed.status, 'OK');
    assert(confirmed.messages.some((message) => /confirmed and saved/i.test(message.text || '')));
    assert(confirmed.claims.every((claim) => claim.sourceUrl && claim.lastVerified));

    const profile = await profileRepoModule.load(user.id);
    assert.equal(profile.gstin?.value, gstin);
    assert.equal(profile.gstin?.status, 'VERIFIED');
    assert.equal(profile.constitution?.status, 'VERIFIED');
    const deadlines = await listUpcomingForUser(user.id);
    assert(deadlines.some((deadline) => deadline.title === 'GSTR-3B'));
    assert(deadlines.every((deadline) => deadline.sourceUrl && deadline.lastVerifiedAt));

    const sentinelDelivery = await deliverApprovedChange({
      source: {
        id: 'integration-simulated-source',
        name: 'Simulated official-source fixture',
        url: 'https://gst.gov.in/notifications',
        simulated: true,
      },
      change: {
        status: 'APPROVED',
        title: 'GST filing window update',
        summary: 'A simulated filing-window change for integration verification.',
        quote: 'A simulated quoted regulatory change.',
        sourceUrl: 'https://gst.gov.in/notifications',
        lastVerified: '2026-10-10',
        confidence: 0.99,
        severity: 'high',
        affects: { states: ['all'], sectors: ['all'] },
      },
      changeId: 'integration-simulated-change',
      profiles: [{
        id: user.id,
        user,
        state: 'Uttar Pradesh',
        sector: 'trader',
      }],
      alerts: { createSentinelAlertWithLedger, createDigestLedger: async () => ({ created: true }) },
      notifyUser: async () => ({ in_app: { success: true }, whatsapp: { success: true, skipped: 'test mock' } }),
      now: new Date('2026-10-10T12:00:00.000Z'),
    });
    assert.equal(sentinelDelivery.status, 'ALERTED');
    const storedAlert = [...memoryStore.sentinelAlerts.values()].find((alert) => alert.userId === user.id);
    assert(storedAlert);
    assert.match(`${storedAlert.title} ${storedAlert.summary}`, /simulated alert/i);
    assert(storedAlert.sourceUrl && storedAlert.lastVerified);

    const recentAlerts = await postEvent('flow-home-alerts', {
      type: 'TEXT',
      text: 'alerts',
      language: 'en',
    });
    assert(recentAlerts.messages.some((message) => (
      message.type === 'list'
      && message.items?.some((item) => /simulated alert/i.test(item.title))
    )));
    const alertItems = recentAlerts.messages.flatMap((message) => message.items || []);
    assert(alertItems.every((item) => item.sourceUrl));

    const deleteRequest = await postEvent('flow-delete-request', {
      type: 'TEXT',
      text: 'delete',
      language: 'en',
    });
    assert.equal(deleteRequest.status, 'NEEDS_CONFIRMATION');
    assert(deleteRequest.messages.some((message) => message.type === 'confirm_card'));

    const deleted = await postEvent('flow-delete-confirm', {
      type: 'CONFIRM_ACTION',
      card: { cardId: 'delete-confirm', actionId: 'confirm' },
      actionId: 'confirm',
      language: 'en',
    });
    assert.equal(deleted.status, 'OK');
    const anonymizedUser = memoryStore.users.get(user.id);
    assert.equal(anonymizedUser.phone, null);
    assert.equal(anonymizedUser.fullName, 'Deleted user');
    assert.equal(anonymizedUser.isActive, false);

    const completeTrace = JSON.stringify(traces);
    const completePersistedTrace = JSON.stringify(persistedTraces);
    const completeLogs = logs.join('');
    for (const sensitiveValue of [phone, gstin, pan]) {
      assert(!completeTrace.includes(sensitiveValue), 'sensitive identifiers must not appear in traces');
      assert(!completePersistedTrace.includes(sensitiveValue), 'sensitive identifiers must not appear in persisted traces');
      assert(!completeLogs.includes(sensitiveValue), 'sensitive identifiers must not appear in logs');
    }
    assert.deepEqual(globalThis.__integrationProviderCalls, {
      groq: 0,
      sarvam: 0,
      cloudinary: 0,
      vision: 0,
    });
    assert(traces.every((entry) => !/groq|llm/i.test(`${entry.node} ${JSON.stringify(entry.inputSummary)} ${JSON.stringify(entry.outputSummary)}`)));
  } finally {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
    await closeServer(server);
  }
});
