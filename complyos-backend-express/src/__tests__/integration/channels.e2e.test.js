import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import test from 'node:test';
import app from '../../app.js';
import config from '../../config.js';
import logger from '../../logger.js';
import { safeHttpLogPath } from '../../middleware/safeHttpLog.js';
import { prepareWhatsAppMediaEvent } from '../../channels/whatsappMedia.js';
import { isOfficialSchemeSourceUrl, isVerifiedScheme } from '../../channels/schemeVerification.js';
import { decodeInteractiveId, encodeInteractiveId, parseWhatsAppWebhook, renderOutbound } from '../../channels/whatsapp.js';
import { sendRenderedMessages, downloadWhatsAppMedia } from '../../services/whatsappService.js';
import { notify, resolveWhatsAppDelivery } from '../../services/notify.js';
import { checkDailyDeadlines } from '../../jobs/cronJobs.js';
import { handleEvent } from '../../orchestrator/handleEvent.js';
import { clearMemoryStore, memoryStore } from '../../repos/memory/store.js';

process.env.REPO_DRIVER = 'memory';
process.env.ARIA_REAL = 'false';
process.env.VEDA_REAL = 'false';
process.env.SCOUT_REAL = 'false';

const phone = '919876543210';
const gstin = '09AAECP1234F1Z5';
const user = {
  id: 'channel-user',
  phone,
  email: 'channel-user@example.invalid',
  fullName: 'Channel User',
  role: 'owner',
  plan: 'free',
  language: 'en',
  isActive: true,
  consentGiven: true,
};
let server;
let baseUrl;
const token = jwt.sign({ sub: user.id }, config.jwt.secret);

test.before(async () => {
  clearMemoryStore();
  memoryStore.users.set(user.id, user);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('WhatsApp interactive ids round-trip with Devanagari ids and labels', () => {
  const encoded = encodeInteractiveId('कार्ड', 'योजना');
  assert.deepEqual(decodeInteractiveId(encoded), { cardId: 'कार्ड', actionId: 'योजना' });
  const rendered = renderOutbound([{
    type: 'option_card',
    id: 'कार्ड',
    text: 'एक विकल्प चुनें',
    options: [{ id: 'योजना', label: 'सरकारी योजना' }],
  }]);
  assert.equal(rendered[0].interactive.action.buttons[0].reply.id, encoded);
  assert.equal(rendered[0].interactive.action.buttons[0].reply.title, 'सरकारी योजना');
});

test('WhatsApp buttons over the configured limit render as a list', () => {
  const rendered = renderOutbound([{
    type: 'option_card',
    id: 'many-options',
    text: 'Choose an option',
    options: Array.from({ length: 4 }, (_, index) => ({
      id: `action-${index + 1}`,
      label: `विकल्प ${index + 1} का विवरण जो सीमा से लंबा है`,
    })),
  }]);
  assert.equal(rendered[0].interactive.type, 'list');
  assert.equal(rendered[0].interactive.action.sections[0].rows.length, 4);
  assert.ok(rendered[0].interactive.action.sections[0].rows.every((row) => row.title.length <= 24));
});

test('WhatsApp webhook parser extracts text, replies, and media metadata without downloading media', () => {
  const events = parseWhatsAppWebhook({ entry: [{ changes: [{ value: { messages: [
    { id: 'text-1', from: phone, type: 'text', text: { body: 'नमस्ते' } },
    { id: 'tap-1', from: phone, type: 'interactive', interactive: { button_reply: { id: 'कार्ड::योजना', title: 'योजना' } } },
    { id: 'voice-1', from: phone, type: 'audio', audio: { id: 'wa-media-a', mime_type: 'audio/ogg' } },
    { id: 'image-1', from: phone, type: 'image', image: { id: 'wa-media-i', mime_type: 'image/jpeg', caption: 'document' } },
    { id: 'doc-1', from: phone, type: 'document', document: { id: 'wa-media-d', mime_type: 'application/pdf', filename: 'notice.pdf' } },
  ] } }] }] });
  assert.equal(events[0].text, 'नमस्ते');
  assert.deepEqual(events[1].card, { cardId: 'कार्ड', actionId: 'योजना' });
  assert.equal(events[2].audio.mediaId, 'wa-media-a');
  assert.equal(events[2].audio.url, undefined);
  assert.equal(events[3].document.providerMediaId, 'wa-media-i');
  assert.equal(events[3].document.url, undefined);
  assert.equal(events[4].document.filename, 'notice.pdf');
});

test('WhatsApp audio and documents use downloaded provider bytes with STT and Cloudinary URL delivery', async () => {
  const audioBytes = Buffer.from([1, 2, 3, 4]);
  const documentBytes = Buffer.from([5, 6, 7, 8]);
  const downloadedIds = [];
  const uploaded = [];
  const audio = await prepareWhatsAppMediaEvent({
    channel: 'whatsapp',
    externalId: 'media-audio',
    phone,
    type: 'VOICE',
    audio: { mediaId: 'wa-audio-id', mime: 'audio/ogg' },
  }, {
    downloadMedia: async (mediaId) => {
      downloadedIds.push(mediaId);
      return audioBytes;
    },
    transcribe: async (buffer, mime) => {
      assert.equal(buffer, audioBytes);
      assert.equal(mime, 'audio/ogg');
      return { transcript: 'दस्तावेज़ की जानकारी', source: 'sarvam_live' };
    },
  });
  assert.equal(audio.type, 'TEXT');
  assert.equal(audio.text, 'दस्तावेज़ की जानकारी');
  assert.equal(audio.audio, undefined);

  const document = await prepareWhatsAppMediaEvent({
    channel: 'whatsapp',
    externalId: 'media-document',
    phone,
    type: 'DOCUMENT',
    document: {
      providerMediaId: 'wa-document-id',
      mime: 'application/pdf',
      filename: 'notice.pdf',
    },
  }, {
    downloadMedia: async (mediaId) => {
      downloadedIds.push(mediaId);
      return documentBytes;
    },
    uploadDocument: async (buffer, options) => {
      uploaded.push({ buffer, options });
      return { secure_url: 'https://res.cloudinary.com/demo/notice.pdf' };
    },
  });
  assert.deepEqual(downloadedIds, ['wa-audio-id', 'wa-document-id']);
  assert.equal(uploaded[0].buffer, documentBytes);
  assert.equal(uploaded[0].options.mimeType, 'application/pdf');
  assert.equal(document.document.url, 'https://res.cloudinary.com/demo/notice.pdf');
  assert.equal(document.document.providerMediaId, undefined);
});

test('WhatsApp media downloader obtains bytes from the authenticated provider URL', async () => {
  const bytes = Buffer.from([9, 8, 7]);
  const requests = [];
  const downloaded = await downloadWhatsAppMedia('provider-id', {
    token: 'test-only-token',
    apiUrl: 'https://graph.facebook.com/v18.0',
    get: async (url, options) => {
      requests.push({ url, options });
      return requests.length === 1
        ? { data: { url: 'https://lookaside.fbsbx.com/media/provider-id' } }
        : { data: bytes };
    },
  });
  assert.equal(downloaded.toString('hex'), bytes.toString('hex'));
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.headers.Authorization, 'Bearer test-only-token');
  assert.equal(requests[1].options.responseType, 'arraybuffer');
});

test('WhatsApp media processing rejects fabricated bytes and Cloudinary fallback URLs', async () => {
  await assert.rejects(
    prepareWhatsAppMediaEvent({
      type: 'VOICE',
      audio: { mediaId: 'provider-audio', mime: 'audio/ogg' },
    }, {
      downloadMedia: async () => new Uint8Array([1, 2, 3]),
      transcribe: async () => ({ transcript: 'must not run', source: 'sarvam_live' }),
    }),
    /non-empty Buffer/,
  );
  await assert.rejects(
    prepareWhatsAppMediaEvent({
      type: 'DOCUMENT',
      document: { providerMediaId: 'provider-document', mime: 'image/jpeg' },
    }, {
      downloadMedia: async () => Buffer.from([1, 2, 3]),
      uploadDocument: async () => ({
        secure_url: 'https://res.cloudinary.com/complianceos/mock.png',
        mockDataUri: 'mock-only',
      }),
    }),
    /Cloudinary-backed storage/,
  );
});

test('notify enforces WhatsApp session and utility-template delivery windows', async () => {
  const now = new Date('2026-10-10T12:00:00.000Z');
  const sessionCalls = [];
  const inApp = async () => ({ created: true, notification: { id: 'n1' } });
  const sessionResult = await notify({
    userId: user.id,
    user,
    title: 'Deadline reminder',
    body: 'Due soon',
    kind: 'deadline_reminder',
    now,
  }, {
    createInApp: inApp,
    loadConversation: async () => ({ lastInboundAt: new Date(now.getTime() - 23 * 60 * 60 * 1000) }),
    sendText: async (...args) => { sessionCalls.push(args); return { success: true }; },
  });
  assert.equal(sessionResult.whatsapp.mode, 'session');
  assert.equal(sessionCalls.length, 1);

  const templateCalls = [];
  const templateResult = await notify({
    userId: user.id,
    user,
    title: 'Sentinel update',
    body: 'An official change was detected.',
    kind: 'sentinel',
    inAppStored: true,
    now,
  }, {
    loadConversation: async () => ({ lastInboundAt: new Date(now.getTime() - 25 * 60 * 60 * 1000) }),
    templateMode: true,
    templateName: 'approved_utility_update',
    sendTemplate: async (...args) => { templateCalls.push(args); return { success: true }; },
  });
  assert.equal(templateResult.whatsapp.mode, 'utility_template');
  assert.equal(templateCalls[0][1], 'approved_utility_update');

  const outsideResult = await notify({
    userId: user.id,
    user,
    title: 'Reminder',
    body: 'Due soon',
    kind: 'deadline_reminder',
    inAppStored: true,
    now,
  }, {
    loadConversation: async () => ({ lastInboundAt: null }),
    templateMode: false,
    sendText: async () => assert.fail('outside-window message must not send free-form WhatsApp'),
    sendTemplate: async () => assert.fail('template mode is disabled'),
  });
  assert.equal(outsideResult.whatsapp.skipped, 'outside_window_no_approved_utility_template');
  assert.equal(resolveWhatsAppDelivery({
    lastInboundAt: null, now, templateMode: true, templateName: 'approved_utility', kind: 'marketing',
  }), 'in_app_only');
});

test('deadline reminder job is idempotent across repeated checks', async () => {
  memoryStore.notifications.clear();
  const now = new Date('2026-10-10T12:00:00.000Z');
  const deadline = {
    id: 'reminder-deadline',
    userId: user.id,
    user,
    title: 'GST filing',
    deadlineDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
  };
  const options = {
    now,
    findUpcomingDeadlines: async () => [deadline],
    notifyDependencies: {
      loadConversation: async () => ({ lastInboundAt: null }),
      templateMode: false,
    },
  };
  const first = await checkDailyDeadlines(options);
  const second = await checkDailyDeadlines(options);
  assert.deepEqual(first, { checked: 1, notified: 1, skipped: 0 });
  assert.deepEqual(second, { checked: 1, notified: 0, skipped: 1 });
  assert.equal(memoryStore.notifications.size, 1);
});

test('read-time scheme filter hides unverified and non-government sources but permits odopup.in', async () => {
  assert.equal(isVerifiedScheme({ sourceUrl: 'https://odopup.in', checkedBy: 'reviewer' }), true);
  assert.equal(isVerifiedScheme({ sourceUrl: 'https://evilgov.in', checkedBy: 'reviewer' }), false);
  assert.equal(isVerifiedScheme({ sourceUrl: 'https://example.gov.in', checkedBy: '' }), false);
  assert.equal(isOfficialSchemeSourceUrl('https://sub.odopup.in/scheme'), true);

  const response = await fetch(`${baseUrl}/api/schemes`);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert(result.schemes.some((scheme) => scheme.id === 'scheme_odop_001'));
  assert(!result.schemes.some((scheme) => scheme.id === 'scheme_up_msme_policy_001'));
  assert(result.schemes.every((scheme) => scheme.sourceUrl && scheme.checkedBy));
});

test('web chat POST and SSE endpoints return channel-neutral messages from handleEvent', async () => {
  const authorization = { Authorization: `Bearer ${token}` };
  const post = await fetch(`${baseUrl}/api/chat/event`, {
    method: 'POST',
    headers: { ...authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'TEXT', text: 'hello', externalId: 'web-post' }),
  });
  assert.equal(post.status, 200);
  const postResult = await post.json();
  assert.ok(Array.isArray(postResult.messages));
  assert.equal(typeof postResult.messages[0]?.type, 'string');

  const stream = await fetch(`${baseUrl}/api/chat/stream?type=TEXT&text=hello&externalId=web-stream`, { headers: authorization });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get('content-type'), /text\/event-stream/);
  const body = await stream.text();
  assert.match(body, /event: message/);
  assert.match(body, /event: complete/);
});

test('captured outbound logs and returned traces redact full phone numbers and GSTINs', async () => {
  const logged = [];
  const originalInfo = logger.info;
  logger.info = (...args) => logged.push(args);
  try {
    await sendRenderedMessages(phone, [{ type: 'text', text: gstin }]);
  } finally {
    logger.info = originalInfo;
  }

  const result = await handleEvent({
    userId: user.id, externalId: 'privacy-trace', channel: 'web', type: 'TEXT', text: 'privacy check',
  }, {
    runGraph: async (state) => ({
      status: 'OK',
      profile: state.profile,
      conversation: state.conversation,
      messages: [],
      claims: [],
      trace: [{
        runId: state.runId,
        agent: 'ARIA',
        node: 'test',
        startedAt: new Date().toISOString(),
        durationMs: 0,
        inputSummary: `${phone} ${gstin}`,
        status: 'done',
      }],
    }),
  });
  const output = JSON.stringify({ logged, trace: result.trace });
  assert.doesNotMatch(output, new RegExp(phone));
  assert.doesNotMatch(output, new RegExp(gstin));
});

test('chat access-log paths omit phone numbers and GSTINs from query text', () => {
  const sensitiveText = `${phone} ${gstin}`;
  const accessLog = `GET ${safeHttpLogPath({
    originalUrl: `/api/chat/stream?text=${encodeURIComponent(sensitiveText)}`,
  })} 200`;
  assert.doesNotMatch(accessLog, new RegExp(phone));
  assert.doesNotMatch(accessLog, new RegExp(gstin));
});
