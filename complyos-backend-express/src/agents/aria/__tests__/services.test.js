import test from 'node:test';
import assert from 'node:assert/strict';
import { transcribe, SarvamBadAudio, SarvamUnavailable } from '../../../services/sarvam.js';
import { fetchAudio, toWav16kMono, MediaUnavailable, MediaConversionError } from '../../../services/media.js';

test('Sarvam mock returns deterministic fixture transcript', async () => {
  const result = await transcribe(Buffer.from('audio'), 'audio/ogg', 'hi', { mock: true, fixtureId: 'voice-hi' });
  assert.match(result.text, /कानपुर/);
  assert.equal(result.confidence, 0.91);
});

test('Sarvam mock rejects missing audio and unknown live details safely', async () => {
  await assert.rejects(() => transcribe(Buffer.alloc(0), 'audio/ogg', 'hi', { mock: true }), SarvamBadAudio);
  await assert.rejects(() => transcribe(Buffer.from('audio'), 'audio/ogg', 'hi', { mock: false }), SarvamUnavailable);
});

test('media accepts bytes, enforces HTTPS download and passes WAV through', async () => {
  const bytes = Buffer.from('wav');
  assert.equal(await fetchAudio(bytes), bytes);
  assert.equal(await toWav16kMono(bytes, 'audio/wav'), bytes);
  await assert.rejects(() => fetchAudio({ id: 'whatsapp-id' }), MediaUnavailable);
  await assert.rejects(() => fetchAudio({ url: 'http://example.test/audio.ogg' }), MediaUnavailable);
});

test('empty audio conversion fails with a typed error', async () => {
  await assert.rejects(() => toWav16kMono(Buffer.alloc(0), 'audio/ogg'), MediaConversionError);
});

test('missing ffmpeg is reported as a typed conversion error', async () => {
  await assert.rejects(
    () => toWav16kMono(Buffer.from('audio'), 'audio/ogg', { ffmpegPath: 'aria-no-such-ffmpeg' }),
    MediaConversionError,
  );
});
