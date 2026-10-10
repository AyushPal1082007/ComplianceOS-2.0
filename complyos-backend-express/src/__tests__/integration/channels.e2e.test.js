import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import test from 'node:test';
import app from '../../app.js';
import config from '../../config.js';
import logger from '../../logger.js';
import { safeHttpLogPath } from '../../middleware/safeHttpLog.js';
import { decodeInteractiveId, encodeInteractiveId, parseWhatsAppWebhook, renderOutbound } from '../../channels/whatsapp.js';
import { sendRenderedMessages } from '../../services/whatsappService.js';
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
