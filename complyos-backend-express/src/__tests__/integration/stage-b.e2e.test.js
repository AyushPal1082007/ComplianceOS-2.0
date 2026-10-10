import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { handleEvent } from '../../orchestrator/handleEvent.js';
import { withUserLock } from '../../orchestrator/userLock.js';
import { run as runAria } from '../../agents/aria/index.js';
import { deliverApprovedChange } from '../../graph/nodes/sentinelDeliveryNode.js';
import { vedaNode } from '../../graph/nodes/vedaNode.js';
import { homeIntent, isDeleteRequest, routeEvent } from '../../graph/router.js';
import * as consentRepo from '../../repos/consentRepo.js';
import * as conversationRepo from '../../repos/conversationRepo.js';
import * as profileRepo from '../../repos/profileRepo.js';
import { deleteUserData } from '../../delete/deleteUserData.js';
import { clearMemoryStore, memoryStore } from '../../repos/memory/store.js';
import { findOrCreateByPhone } from '../../repos/memory/userRepo.js';

process.env.REPO_DRIVER = 'memory';
process.env.ARIA_REAL = 'false';
process.env.VEDA_REAL = 'false';
process.env.SCOUT_REAL = 'false';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sensitive = {
  gstin: '09AAECP1234F1Z5',
  pan: 'ABCDE1234F',
  phone: '919876543210',
};

function reset() {
  clearMemoryStore();
}

function createUser({ id = 'user-1', phone = '9876543210', plan = 'free', consentGiven = true } = {}) {
  const user = {
    id,
    phone,
    email: `${id}@example.invalid`,
    fullName: 'Test User',
    passwordHash: 'disabled:test',
    role: 'owner',
    plan,
    language: 'hinglish',
    isActive: true,
    consentGiven,
    consentAt: consentGiven ? new Date() : null,
  };
  memoryStore.users.set(id, user);
  return user;
}

function sourcedClaim(text = 'A verified fact') {
  return {
    text,
    sourceUrl: 'https://services.gst.gov.in/',
    lastVerified: '2026-10-10',
    basis: 'document',
    confidence: 0.99,
  };
}

function mockExternalServices(calls = {}) {
  return {
    groq: { json: async () => { calls.groq = (calls.groq || 0) + 1; return { data: {} }; } },
    sarvam: { transcribe: async () => { calls.sarvam = (calls.sarvam || 0) + 1; return { text: '', confidence: 0 }; } },
    tinyfish: { runAgent: async () => { calls.tinyfish = (calls.tinyfish || 0) + 1; return {}; } },
    whatsapp: { sendTextMessage: async () => { calls.whatsapp = (calls.whatsapp || 0) + 1; return { success: true }; } },
    cloudinary: { deleteFile: async () => { calls.cloudinary = (calls.cloudinary || 0) + 1; return { result: 'ok' }; } },
    vision: { extractTextFromUrl: async () => { calls.vision = (calls.vision || 0) + 1; return ''; } },
  };
}

function scoutRunner(calls, output = {}) {
  return async (input) => {
    calls.scout = [...(calls.scout || []), input.event.type];
    return {
      status: 'OK',
      messages: output.messages || [{
        type: 'list',
        text: 'Possible schemes',
        items: Array.from({ length: 5 }, (_, index) => ({
          title: `Scheme ${index + 1}`,
          details: 'possible based on recorded criteria',
          tags: ['possible'],
          sourceUrl: `https://scheme.gov.in/${index + 1}`,
          lastVerified: '2026-10-10',
        })),
      }],
      claims: output.claims || [],
      trace: [],
    };
  };
}

test('S10 home routing selects deterministic intents for English, Roman Hindi, and Devanagari', () => {
  const cases = [
    ['scout', ['government schemes', 'sarkari yojana', 'सरकारी योजना']],
    ['deadlines', ['due date', 'aakhri tareekh', 'आखिरी तारीख']],
    ['upload', ['upload document', 'dastavez bhejna', 'दस्तावेज़ अपलोड']],
    ['profile', ['profile', 'meri jaankari badlein', 'मेरी प्रोफ़ाइल']],
    ['alerts', ['recent alerts', 'soochna dikhao', 'अलर्ट दिखाओ']],
    ['pathway', ['checklist', 'CA ko share karein', 'सीए को साझा करें']],
  ];
  for (const [intent, phrases] of cases) {
    for (const [index, text] of phrases.entries()) {
      assert.equal(homeIntent(text), intent, `${text} should route to ${intent}`);
      assert.equal(routeEvent({
        event: { type: index === 1 ? 'VOICE' : 'TEXT', text },
        conversation: { phase: 'home' },
      }), `home:${intent}`);
    }
  }
  assert.equal(routeEvent({ event: { type: 'TEXT', text: 'hello' }, conversation: { phase: 'home' } }), 'home:card');
});

test('S10 profile home intent opens ARIA profile editing', async () => {
  reset();
  const user = createUser();
  await conversationRepo.save(user.id, {
    phase: 'home',
    language: 'en',
    ariaSession: { phase: 'done', language: 'en' },
    outstandingCards: {},
    pendingProfileConflicts: [],
  });
  let routedEvent;
  const result = await handleEvent({
    userId: user.id, externalId: 's10-profile-edit', type: 'TEXT', text: 'profile',
  }, {
    agentRunners: {
      aria: async (input) => {
        routedEvent = input.event;
        return {
          status: 'OK',
          profilePatch: {},
          session: { phase: 'editing', language: 'en' },
          messages: [{ type: 'list', id: 'aria-edit-list', text: 'Which detail should we change?', rows: [] }],
          claims: [],
          trace: [],
        };
      },
    },
  });
  assert.deepEqual(routedEvent, { type: 'OPTION_TAP', questionId: 'aria-reveal', optionId: 'edit' });
  assert.equal(result.messages[0].id, 'aria-edit-list');
});

test('delete request phrases match without intercepting unrelated invoice questions', () => {
  for (const text of ['mera data hatao', 'डिलीट', 'मेरा डेटा हटाओ', 'मेरा डेटा हटाएँ', 'मेरा डेटा हटाएं']) {
    assert.equal(isDeleteRequest({ type: 'TEXT', text }), true, `${text} should request deletion`);
  }
  assert.equal(isDeleteRequest({ type: 'TEXT', text: 'delete' }), true);
  assert.equal(isDeleteRequest({ type: 'TEXT', text: 'remove my data' }), true);
  assert.equal(isDeleteRequest({ type: 'TEXT', text: 'how do I delete a GST invoice' }), false);
});

test('ARIA reveal-card confirmation is routed to ARIA using its recorded owner', async () => {
  reset();
  const user = createUser();
  let ariaCalls = 0;
  let vedaCalls = 0;
  const aria = async () => {
    ariaCalls++;
    return {
      status: 'OK',
      profilePatch: {},
      session: { phase: 'done', language: 'hinglish' },
      messages: [{ type: 'text', text: 'Done.' }],
      claims: [],
      trace: [],
    };
  };
  const first = await handleEvent({
    userId: user.id, externalId: 'router-aria-reveal', type: 'TEXT', text: 'hello',
  }, {
    agentRunners: {
      aria: async () => ({
        status: 'NEEDS_CONFIRMATION',
        profilePatch: {},
        session: { phase: 'reveal', language: 'hinglish' },
        messages: [{ type: 'confirm_card', id: 'aria-reveal', text: 'Confirm?', actions: [{ id: 'finish', label: 'Finish' }] }],
        claims: [],
        trace: [],
      }),
    },
  });
  assert.equal(first.status, 'NEEDS_CONFIRMATION');
  assert.equal((await conversationRepo.load(user.id)).state.outstandingCards['aria-reveal'], 'ARIA');

  const confirmed = await handleEvent({
    userId: user.id, externalId: 'router-aria-confirm', type: 'CONFIRM_ACTION',
    card: { cardId: 'aria-reveal', actionId: 'finish' },
  }, {
    agentRunners: {
      aria,
      veda: async () => { vedaCalls++; throw new Error('ARIA card was routed to VEDA'); },
      scout: async () => ({ status: 'OK', messages: [{ type: 'text', text: 'No results.' }], claims: [], trace: [] }),
    },
  });
  assert.equal(confirmed.status, 'OK');
  assert.equal(ariaCalls, 1);
  assert.equal(vedaCalls, 0);
  assert.equal(routeEvent({
    event: { type: 'CONFIRM_ACTION', card: { cardId: 'untracked', actionId: 'confirm' } },
    conversation: { outstandingCards: {} },
  }), 'veda');
});

test('ARIA voice DELETE_REQUEST escalation is handed to the delete guard', async () => {
  reset();
  const user = createUser();
  const result = await handleEvent({
    userId: user.id,
    externalId: 'router-voice-delete',
    type: 'VOICE',
    text: 'delete',
    audio: { mime: 'audio/wav' },
  }, {
    agentRunners: {
      aria: async () => ({
        status: 'NEEDS_CONFIRMATION',
        escalate: 'DELETE_REQUEST',
        profilePatch: {},
        messages: [],
        claims: [],
        trace: [{
          runId: 'voice-delete',
          agent: 'ARIA',
          node: 'classify',
          startedAt: new Date().toISOString(),
          durationMs: 0,
          inputSummary: 'voice request',
          outputSummary: { escalate: 'DELETE_REQUEST' },
          status: 'NEEDS_CONFIRMATION',
        }],
      }),
    },
  });
  assert.equal(result.status, 'NEEDS_CONFIRMATION');
  assert.equal(result.messages[0]?.id, 'delete-confirm');
  assert.equal((await conversationRepo.load(user.id)).state.pendingDelete, true);
});

test('replacing an ARIA card removes its stale card id from outstanding ownership', async () => {
  reset();
  const user = createUser();
  let ariaCalls = 0;
  const aria = async () => {
    ariaCalls++;
    const cardId = ariaCalls === 1 ? 'aria-question-one' : 'aria-question-two';
    return {
      status: 'NEEDS_INPUT',
      profilePatch: {},
      session: { phase: 'asking', language: 'hinglish' },
      messages: [{ type: 'option_card', id: cardId, text: 'Choose?', options: [{ id: 'next', label: 'Next' }] }],
      claims: [],
      trace: [],
    };
  };
  await handleEvent({
    userId: user.id, externalId: 'router-card-one', type: 'TEXT', text: 'hello',
  }, { agentRunners: { aria } });
  assert.equal((await conversationRepo.load(user.id)).state.outstandingCards['aria-question-one'], 'ARIA');

  await handleEvent({
    userId: user.id, externalId: 'router-card-two', type: 'OPTION_TAP',
    card: { cardId: 'aria-question-one', actionId: 'next' },
  }, { agentRunners: { aria } });
  const outstanding = (await conversationRepo.load(user.id)).state.outstandingCards;
  assert.equal(outstanding['aria-question-one'], undefined);
  assert.equal(outstanding['aria-question-two'], 'ARIA');
});

test('S1: first inbound is consent-only; acceptance records consent before ARIA starts', async () => {
  reset();
  const services = mockExternalServices();
  const first = await handleEvent({
    channel: 'whatsapp', phone: '9876543210', externalId: 's1-first', type: 'TEXT', text: 'hello',
  }, { services });
  assert.equal(first.messages.length, 1);
  assert.equal(first.messages[0].type, 'confirm_card');
  assert.equal(memoryStore.users.size, 0);
  assert.equal(memoryStore.conversations.size, 0);
  assert.equal(memoryStore.inboundEvents.size, 0);
  assert.equal(memoryStore.consentLogs.length, 0);

  const accepted = await handleEvent({
    channel: 'whatsapp', phone: '9876543210', externalId: 's1-consent', type: 'CONSENT',
    action: 'accept', language: 'en',
  }, { services });
  assert.ok(accepted.messages.some((message) => message.text));
  const user = [...memoryStore.users.values()][0];
  assert.equal(user.consentGiven, true);
  assert.ok(user.consentAt);
  assert.equal(memoryStore.consentLogs.length, 1);

  reset();
  const declined = await handleEvent({
    channel: 'whatsapp', phone: '9876543210', externalId: 's1-decline', type: 'CONSENT', action: 'decline',
  }, { services });
  assert.equal(declined.status, 'NEEDS_INPUT');
  assert.equal(memoryStore.users.size, 0);
  assert.equal(memoryStore.consentLogs.length, 0);
  assert.equal(memoryStore.inboundEvents.size, 0);
});

test('S2: tap-only ARIA flow reaches reveal and SCOUT is capped at three sourced possible cards without LLM calls', async () => {
  reset();
  const user = createUser();
  const calls = { groq: 0 };
  const services = mockExternalServices(calls);
  let ariaSession;
  let tapCount = 0;
  const realAriaTapRunner = async (input) => {
    const output = await runAria(input, { mock: true, groqJson: async () => { calls.groq++; throw new Error('unexpected LLM'); } });
    ariaSession = output.session;
    if (input.event.type === 'OPTION_TAP') tapCount++;
    return output;
  };
  const agents = { aria: realAriaTapRunner, scout: scoutRunner(calls) };
  let result = await handleEvent({
    userId: user.id, externalId: 's2-start', type: 'START',
  }, { services, agentRunners: agents });
  for (let index = 0; index < 30 && ariaSession?.phase !== 'reveal'; index++) {
    const card = result.messages.find((message) => ['option_card', 'list'].includes(message.type));
    assert.ok(card, 'ARIA should render an option card during tap-only intake');
    const options = card.options || card.rows;
    const option = options.find((item) => item.id !== 'unsure') || options[0];
    result = await handleEvent({
      userId: user.id,
      externalId: `s2-tap-${index}`,
      type: 'OPTION_TAP',
      questionId: card.id,
      optionId: option.id,
    }, { services, agentRunners: agents });
  }
  assert.equal(ariaSession.phase, 'reveal');
  const revealCard = result.messages.find((message) => message.type === 'confirm_card' && message.id === 'aria-reveal');
  assert.ok(revealCard);
  result = await handleEvent({
    userId: user.id, externalId: 's2-confirm', type: 'OPTION_TAP',
    questionId: 'aria-reveal', optionId: 'finish',
  }, { services, agentRunners: agents });

  const list = result.messages.find((message) => message.type === 'list');
  assert.ok(list);
  assert.equal(list.items.length, 3);
  for (const item of list.items) {
    assert.ok(item.sourceUrl);
    assert.ok(item.lastVerified);
    assert.ok(item.tags.includes('possible'));
    assert.doesNotMatch(item.details, /eligible/i);
  }
  assert.deepEqual(calls.scout, ['SCHEME_REQUEST']);
  assert.equal(calls.groq, 0);
  assert.equal(tapCount > 0, true);
  assert.equal(calls.sarvam || 0, 0);
});

test('S3: VEDA confirmation resumes the original thread, saves sourced fields/deadlines, and replays idempotently', async () => {
  reset();
  const user = createUser();
  let vedaCalls = 0;
  let savedThread;
  const agents = {
    veda: async (input) => {
      vedaCalls++;
      savedThread = input.runId;
      if (input.event.url) {
        return {
          status: 'NEEDS_CONFIRMATION',
          profilePatch: {},
          messages: [{ type: 'confirm_card', id: 'veda-confirm', text: 'Confirm the document?' }],
          claims: [sourcedClaim()],
          trace: [],
        };
      }
      assert.equal(input.runId, savedThread);
      assert.equal(input.event.action, 'resume');
      return {
        status: 'OK',
        profilePatch: {
          state: { value: 'Uttar Pradesh', status: 'VERIFIED', source: 'veda_doc', confidence: 0.99 },
        },
        calendarItems: [{
          title: 'GSTR-1', deadlineDate: '2026-11-11', category: 'GST',
          sourceUrl: 'https://www.gst.gov.in/', lastVerified: '2026-10-10',
        }],
        claims: [sourcedClaim()],
        trace: [],
      };
    },
    scout: scoutRunner({}),
  };
  const documentEvent = {
    userId: user.id, externalId: 's3-doc', type: 'DOCUMENT',
    document: { url: 'https://res.cloudinary.com/demo/doc.pdf', cloudinaryId: 'doc-1', filename: 'gst.pdf', mime: 'application/pdf' },
  };
  const pending = await handleEvent(documentEvent, { agentRunners: agents, services: mockExternalServices() });
  const stored = (await conversationRepo.load(user.id)).state;
  assert.match(stored.pendingVeda.threadId, new RegExp(`^veda:${user.id}:`));
  assert.equal(stored.pendingVeda.cardId, 'veda-confirm');
  assert.equal(pending.status, 'NEEDS_CONFIRMATION');

  const confirmed = await handleEvent({
    userId: user.id, externalId: 's3-confirm', type: 'CONFIRM_ACTION',
    card: { cardId: 'veda-confirm', actionId: 'confirm_gstin' },
    action: 'confirm', key: 'gstin',
  }, { agentRunners: agents, services: mockExternalServices() });
  assert.equal(confirmed.status, 'OK', JSON.stringify(confirmed.trace));
  assert.equal((await profileRepo.load(user.id)).state.value, 'Uttar Pradesh');
  assert.equal(memoryStore.documents.size, 1);
  assert.equal(memoryStore.deadlines.size, 1);

  await handleEvent({ ...documentEvent, externalId: 's3-doc-replay' }, { agentRunners: {
    ...agents,
    veda: async () => ({
      status: 'OK', profilePatch: {}, calendarItems: [{
        title: 'GSTR-1', deadlineDate: '2026-11-11', category: 'GST',
        sourceUrl: 'https://www.gst.gov.in/', lastVerified: '2026-10-10',
      }], claims: [sourcedClaim()], trace: [],
    }),
  }, services: mockExternalServices() });
  assert.equal(memoryStore.documents.size, 1);
  assert.equal(memoryStore.deadlines.size, 1);
  assert.deepEqual(agents.scout && (await profileRepo.load(user.id)).state.status, 'VERIFIED');
});

test('S4: document/self-report conflicts preserve both values until an explicit user choice', async () => {
  reset();
  const user = createUser();
  await profileRepo.save(user.id, {
    state: { value: 'State A', status: 'SELF_REPORTED', confidence: 1, source: 'aria_text' },
  }, ['state']);
  const conflictResponse = await handleEvent({
    userId: user.id, externalId: 's4-doc', type: 'DOCUMENT',
    document: { url: 'https://res.cloudinary.com/demo/doc.pdf', mime: 'application/pdf' },
  }, {
    agentRunners: { veda: async () => ({
      status: 'OK',
      profilePatch: { state: { value: 'State B', status: 'VERIFIED', confidence: 0.99, source: 'veda_doc' } },
      claims: [sourcedClaim()], trace: [],
    }) },
    services: mockExternalServices(),
  });
  assert.equal(conflictResponse.status, 'NEEDS_CONFIRMATION', JSON.stringify(conflictResponse.trace));
  const field = (await profileRepo.load(user.id)).state;
  assert.equal(field.value, 'State A');
  assert.equal(field.status, 'NEEDS_CONFIRMATION');
  assert.equal(field.evidence.selfReportedValue, 'State A');
  assert.equal(field.evidence.proposedValue, 'State B');
  assert.equal(field.evidence.conflict, true);
  assert.equal(conflictResponse.messages[0].type, 'confirm_card');

  const resolved = await handleEvent({
    userId: user.id, externalId: 's4-choice', type: 'OPTION_TAP',
    questionId: 'profile-conflict', optionId: 'use_state',
  }, { services: mockExternalServices() });
  assert.equal(resolved.status, 'OK');
  const confirmed = (await profileRepo.load(user.id)).state;
  assert.equal(confirmed.value, 'State B');
  assert.equal(confirmed.status, 'VERIFIED');
  assert.notEqual(confirmed.evidence?.conflict, true);
});

test('S5: SENTINEL targets matches, digests unknowns, enforces labels, deduplication, and daily cap', async () => {
  reset();
  const profiles = Array.from({ length: 10 }, (_, index) => ({
    id: `sentinel-user-${index}`,
    user: { id: `sentinel-user-${index}` },
    state: index < 3 ? 'Uttar Pradesh' : index === 3 ? null : 'Maharashtra',
    sector: index < 3 ? 'manufacturer' : index === 3 ? null : 'service',
    gstin: index < 3 ? true : index === 3 ? undefined : false,
    udyamNumber: index < 3 ? true : index === 3 ? undefined : false,
  }));
  const source = { url: 'https://gst.gov.in/notice', simulated: true };
  const simulatedChange = {
    status: 'APPROVED', title: 'Filing update', summary: 'Review the change',
    quote: 'The government filing window was changed for registered manufacturers.',
    sourceUrl: source.url, lastVerified: '2026-10-10', confidence: 0.95,
    affects: { states: ['Uttar Pradesh'], sectors: ['manufacturer'], gstinHolders: true, udyamHolders: true },
  };
  const first = await deliverApprovedChange({
    source, change: simulatedChange, changeId: 'change-1', profiles, now: new Date('2026-10-10T10:00:00Z'),
  });
  assert.equal(first.sent, 3);
  assert.equal(first.digestOnly, 1);
  for (const alert of memoryStore.sentinelAlerts.values()) {
    assert.match(alert.title, /Simulated alert/);
    assert.match(alert.summary, /Simulated alert/);
    assert.ok(alert.sourceUrl);
    assert.ok(alert.lastVerified);
  }
  assert.equal([...memoryStore.regulationAlerts.values()].filter((row) => row.isDigest).length, 1);

  const duplicate = await deliverApprovedChange({
    source, change: simulatedChange, changeId: 'change-1', profiles, now: new Date('2026-10-10T10:05:00Z'),
  });
  assert.equal(duplicate.sent, 0);
  assert.equal(duplicate.duplicates, 4);

  await assert.rejects(() => deliverApprovedChange({
    source,
    change: simulatedChange,
    changeId: 'change-bad-label',
    profiles: [profiles[0]],
    build: () => ({ userId: profiles[0].id, title: 'Notice', summary: 'No simulated label' }),
  }), /Simulated SENTINEL alerts must carry/);

  const real = await deliverApprovedChange({
    source: { url: source.url, simulated: false },
    change: { ...simulatedChange, title: 'Real update', simulated: false },
    changeId: 'change-real', profiles: [profiles[0]],
    now: new Date('2026-10-11T10:00:00Z'),
  });
  assert.equal(real.sent, 1);
  const realAlert = [...memoryStore.sentinelAlerts.values()].find((item) => item.changeId === 'change-real');
  assert.doesNotMatch(realAlert.title, /Simulated alert/i);

  const limited = await deliverApprovedChange({
    source: { url: source.url, simulated: false },
    change: { ...simulatedChange, title: 'Next real update', simulated: false },
    changeId: 'change-next', profiles: [profiles[0]],
    now: new Date('2026-10-11T11:00:00Z'),
  });
  assert.equal(limited.sent, 0);
  assert.equal(limited.limited, 1);
  assert.equal(limited.digest, 1);

  const info = await deliverApprovedChange({
    source: { url: source.url, simulated: false },
    change: { ...simulatedChange, severity: 'info', simulated: false },
    changeId: 'change-info', profiles: [profiles[0]],
  });
  assert.equal(info.sent, 0);
  assert.equal(info.digest, 1);
});

test('S6: deletion clears each personal table, deletes Cloudinary media, and retains consent/subscription/payment', async () => {
  reset();
  const user = createUser({ id: 'delete-user' });
  memoryStore.profiles.set(user.id, { id: 'business-delete' });
  memoryStore.profileFields.set(user.id, new Map([['state', { value: 'UP', status: 'VERIFIED' }]]));
  memoryStore.conversations.set(user.id, { userId: user.id, state: { phase: 'home' }, version: 1 });
  memoryStore.documents.set('document-delete', { id: 'document-delete', userId: user.id, cloudinaryId: 'cloud-doc-1' });
  memoryStore.deadlines.set('deadline-delete', { id: 'deadline-delete', userId: user.id });
  memoryStore.schemeMatches.set('match-delete', { id: 'match-delete', businessId: 'business-delete' });
  memoryStore.sentinelAlerts.set('alert-delete', { id: 'alert-delete', userId: user.id });
  memoryStore.regulationAlerts.set(`${user.id}:change-delete`, { id: 'ledger-delete', userId: user.id, changeId: 'change-delete' });
  memoryStore.notifications.set('notification-delete', { id: 'notification-delete', userId: user.id });
  memoryStore.ariaSessions.set('aria-delete', { id: 'aria-delete', userId: user.id });
  memoryStore.traces.push({ id: 'trace-delete', userId: user.id, agent: 'ARIA' });
  memoryStore.inboundEvents.set('web:inbound-delete', { id: 'inbound-delete', userId: user.id });
  memoryStore.consentLogs.push({ id: 'consent-retain', userId: user.id });
  memoryStore.subscriptions.set('subscription-retain', { id: 'subscription-retain', userId: user.id });
  memoryStore.payments.set('payment-retain', { id: 'payment-retain', userId: user.id });

  const calls = { cloudinary: 0 };
  const result = await deleteUserData(user.id, { cloudinary: mockExternalServices(calls).cloudinary });
  assert.equal(calls.cloudinary, 1);
  assert.equal(result.removed.profile.profileFields, 1);
  assert.equal(result.removed.conversation, true);
  assert.equal(result.removed.documents, 1);
  assert.equal(result.removed.deadlines, 1);
  assert.equal(result.removed.alerts.sentinelAlerts, 1);
  assert.equal(result.removed.alerts.regulationAlerts, 1);
  assert.equal(memoryStore.profiles.has(user.id), false);
  assert.equal(memoryStore.schemeMatches.size, 0);
  assert.equal(memoryStore.documents.size, 0);
  assert.equal(memoryStore.deadlines.size, 0);
  assert.equal(memoryStore.sentinelAlerts.size, 0);
  assert.equal(memoryStore.regulationAlerts.size, 0);
  assert.equal(memoryStore.notifications.size, 0);
  assert.equal(memoryStore.ariaSessions.size, 0);
  assert.equal(memoryStore.traces.length, 0);
  assert.equal(memoryStore.inboundEvents.size, 0);
  assert.equal(memoryStore.consentLogs.length, 1);
  assert.equal(memoryStore.subscriptions.size, 1);
  assert.equal(memoryStore.payments.size, 1);
  const anonymized = memoryStore.users.get(user.id);
  assert.equal(anonymized.email, `deleted-${user.id}@users.complianceos.invalid`);
  assert.equal(anonymized.phone, null);
  assert.equal(anonymized.fullName, 'Deleted user');
  assert.equal(anonymized.isActive, false);
  assert.equal(anonymized.consentGiven, false);

  const pending = await handleEvent({ userId: user.id, type: 'TEXT', externalId: 's6-restart', text: 'hi' });
  assert.equal(pending.messages[0].type, 'confirm_card');
  assert.equal(pending.status, 'NEEDS_CONFIRMATION');
});

test('S7: free-tier document quota counts only successful VEDA processing', async () => {
  reset();
  const user = createUser();
  let vedaCalls = 0;
  const agents = { veda: async () => {
    vedaCalls++;
    return { status: 'OK', profilePatch: {}, claims: [sourcedClaim()], calendarItems: [], trace: [] };
  } };
  const failed = await handleEvent({
    userId: user.id, externalId: 's7-doc-failed', type: 'DOCUMENT',
    document: { url: 'https://res.cloudinary.com/demo/fail.pdf', mime: 'application/pdf' },
  }, { agentRunners: { veda: async () => ({ status: 'FAILED', messages: [], claims: [], trace: [] }) } });
  assert.equal(failed.status, 'FAILED');
  assert.equal((await conversationRepo.load(user.id)).state?.counters.docsThisMonth.count || 0, 0);

  const first = await handleEvent({
    userId: user.id, externalId: 's7-doc-1', type: 'DOCUMENT',
    document: { url: 'https://res.cloudinary.com/demo/one.pdf', mime: 'application/pdf' },
  }, { agentRunners: agents });
  assert.equal(first.status, 'OK', JSON.stringify(first.trace));
  assert.equal(vedaCalls, 1);
  assert.equal((await conversationRepo.load(user.id)).state.counters.docsThisMonth.count, 1);

  const callsBeforeQuotaBlock = vedaCalls;
  const limited = await handleEvent({
    userId: user.id, externalId: 's7-doc-2', type: 'DOCUMENT',
    document: { url: 'https://res.cloudinary.com/demo/two.pdf', mime: 'application/pdf' },
  }, { agentRunners: agents });
  assert.match(limited.messages[0].text, /monthly document limit/);
  assert.equal(vedaCalls, callsBeforeQuotaBlock, 'VEDA must not run for the quota-blocked second document');
});

test('S8: thrown agent returns safe apology, retains profile/state and records a privacy-safe error trace', async () => {
  reset();
  const user = createUser();
  await profileRepo.save(user.id, {
    state: { value: 'Uttar Pradesh', status: 'VERIFIED', confidence: 1, source: 'veda_doc' },
  }, ['state']);
  const beforeProfile = await profileRepo.load(user.id);
  const result = await handleEvent({
    userId: user.id, externalId: 's8-throw', type: 'TEXT',
    text: `${sensitive.gstin} ${sensitive.pan} ${sensitive.phone}`,
  }, { agentRunners: { aria: async () => { throw new Error(`sensitive ${sensitive.gstin} ${sensitive.pan} ${sensitive.phone}`); } } });
  assert.equal(result.status, 'DEGRADED');
  assert.match(result.messages[0].text, /technical/i);
  assert.deepEqual((await profileRepo.load(user.id)).state, beforeProfile.state);
  assert.equal((await conversationRepo.load(user.id)).state, null);
  assert.ok(result.trace.some((entry) => entry.status === 'error'));
  assert.doesNotMatch(JSON.stringify(result.trace), new RegExp(sensitive.gstin));
  assert.doesNotMatch(JSON.stringify(result.trace), new RegExp(sensitive.pan));
  assert.doesNotMatch(JSON.stringify(result.trace), new RegExp(sensitive.phone));
});

test('S9: unknown and expired VEDA threads clear pending state with the re-upload instruction', async () => {
  reset();
  const user = createUser();
  await conversationRepo.save(user.id, {
    phase: 'home',
    language: 'hinglish',
    pendingVeda: { threadId: `veda:${user.id}:old`, cardId: 'confirm', startedAt: new Date().toISOString() },
    outstandingCards: {},
  });
  let called = 0;
  const unknown = await handleEvent({
    userId: user.id, externalId: 's9-unknown', type: 'CONFIRM_ACTION',
    threadId: `veda:${user.id}:not-known`, action: 'confirm',
  }, { agentRunners: { veda: async () => { called++; return {}; } } });
  assert.equal(unknown.messages[0].text, 'Confirmation expire ho gaya, kripya document dobara bhejein.');
  assert.equal(called, 0);
  assert.equal((await conversationRepo.load(user.id)).state.pendingVeda, undefined);

  const previousTtl = process.env.VEDA_PENDING_TTL_MIN;
  process.env.VEDA_PENDING_TTL_MIN = '60';
  try {
    await conversationRepo.save(user.id, {
      phase: 'home',
      language: 'hinglish',
      pendingVeda: {
        threadId: `veda:${user.id}:expired`,
        cardId: 'confirm',
        startedAt: new Date(Date.now() - 61 * 60_000).toISOString(),
      },
      outstandingCards: {},
    });
    const expired = await handleEvent({
      userId: user.id, externalId: 's9-expired', type: 'CONFIRM_ACTION', action: 'confirm',
    }, { agentRunners: { veda: async () => { called++; return {}; } } });
    assert.equal(expired.messages[0].text, 'Confirmation expire ho gaya, kripya document dobara bhejein.');
    assert.equal(called, 0);
  } finally {
    if (previousTtl === undefined) delete process.env.VEDA_PENDING_TTL_MIN;
    else process.env.VEDA_PENDING_TTL_MIN = previousTtl;
  }
});

test('S11: PATHWAY requests return only the official portal and coming-soon stub', async () => {
  reset();
  const user = createUser();
  const result = await handleEvent({
    userId: user.id, externalId: 's11-pathway', type: 'TEXT', text: 'CA ko share karein',
  });
  assert.match(result.messages[0].text, /jald aa raha hai/i);
  assert.match(result.messages[0].text, /https:\/\/www\.gst\.gov\.in/);
  assert.equal(result.messages.some((message) => /share link/i.test(message.text)), false);
});

test('cross-cutting: graph and orchestrator contain no raw profile spreads', async () => {
  const forbidden = /\.\.\.\s*state\.profile|\.\.\.\s*profile\s*,/;
  for (const folder of ['graph', 'orchestrator']) {
    const directory = path.join(ROOT, 'src', folder);
    const files = [];
    async function collect(current) {
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const target = path.join(current, entry.name);
        if (entry.isDirectory()) await collect(target);
        else if (entry.isFile() && target.endsWith('.js')) files.push(target);
      }
    }
    await collect(directory);
    for (const file of files) {
      const content = await readFile(file, 'utf8');
      assert.equal(forbidden.test(content), false, `${path.relative(ROOT, file)} contains a prohibited raw profile spread`);
    }
  }
});

test('cross-cutting: orchestrator does not invoke LLM services and serializes each user', async () => {
  reset();
  const user = createUser();
  const calls = {};
  const services = mockExternalServices(calls);
  let active = 0;
  let maxActive = 0;
  const agentRunners = { aria: async () => {
    active++;
    maxActive = Math.max(active, maxActive);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    return { status: 'OK', messages: [], claims: [], profilePatch: {}, trace: [], session: { phase: 'asking', language: 'en' } };
  } };
  const inputs = ['lock-1', 'lock-2'].map((externalId) => handleEvent({
    userId: user.id, externalId, type: 'TEXT', text: 'hello',
  }, { services, agentRunners }));
  await Promise.all(inputs);
  assert.equal(maxActive, 1);
  assert.equal(calls.groq || 0, 0);
  assert.equal(calls.sarvam || 0, 0);
  assert.equal(calls.tinyfish || 0, 0);
  assert.equal(calls.whatsapp || 0, 0);
  await assert.rejects(() => withUserLock('', async () => {}), /lock key/);
});

test('cross-cutting: ARIA option taps use no LLM and SCOUT keeps possible claims explicitly possible', async () => {
  reset();
  const user = createUser();
  let llmCalls = 0;
  const session = (await runAria({
    runId: 'tap-no-llm', userId: user.id, event: { type: 'START' }, profile: {}, locale: 'en',
  }, { mock: true })).session;
  const firstQuestion = (await runAria({
    runId: 'tap-no-llm', userId: user.id, event: { type: 'START' }, profile: {}, locale: 'en', session,
  }, { mock: true })).messages.find((message) => ['option_card', 'list'].includes(message.type));
  const firstOptions = firstQuestion.options || firstQuestion.rows;
  await runAria({
    runId: 'tap-no-llm',
    userId: user.id,
    event: { type: 'OPTION_TAP', questionId: firstQuestion.id, optionId: firstOptions[0].id },
    profile: {},
    locale: 'en',
    session,
  }, {
    mock: false,
    groqJson: async () => { llmCalls++; throw new Error('LLM called on option tap'); },
  });
  assert.equal(llmCalls, 0);

  const profiles = await import('../../agents/scout/runner.ts');
  const scheme = {
    id: 'possible-only',
    name: { en: 'Possible Scheme', hi: 'संभावित योजना' },
    level: 'central', state: 'all', benefit: 'Benefit', criteria: [],
    priority: 1, applyUrl: 'https://scheme.gov.in/apply', sourceUrl: 'https://scheme.gov.in',
    retrievedOn: '2026-10-10', checkedBy: 'official', sourceHash: 'hash', status: 'active',
  };
  const profile = Object.fromEntries(['state', 'sector', 'subSector', 'gstRegistered', 'turnoverBand'].map((key) => [
    key, { value: 'known', status: 'SELF_REPORTED' },
  ]));
  const output = await profiles.createScoutRunner(async () => [scheme])({
    runId: 'possible-test', userId: user.id, event: { type: 'SCHEME_REQUEST' }, profile, locale: 'en',
  });
  assert.ok(output.messages.every((message) => message.type !== 'list' || message.items.every((item) => (
    item.tags.includes('possible') && !/eligible/i.test(item.details)
  ))));
  for (const claim of output.claims) {
    assert.ok(claim.sourceUrl);
    assert.ok(claim.lastVerified);
  }
});
