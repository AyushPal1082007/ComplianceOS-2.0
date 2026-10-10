import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export class SarvamUnavailable extends Error {
  constructor(message = 'Sarvam speech API is unavailable or not configured') {
    super(message);
    this.name = 'SarvamUnavailable';
  }
}

export class SarvamBadAudio extends Error {
  constructor(message = 'Audio could not be transcribed') {
    super(message);
    this.name = 'SarvamBadAudio';
  }
}

const mockTranscripts = new Map([
  ['demo-hi', { text: 'मैं कानपुर में कपड़े की दुकान चलाता हूँ, GST है।', language: 'hi', confidence: 0.92 }],
  ['demo-hinglish', { text: 'Main Kanpur mein kapde ki dukaan chalata hoon, GST hai.', language: 'hinglish', confidence: 0.91 }],
  ['low-confidence', { text: 'मेरा कारोबार...', language: 'hi', confidence: 0.2 }],
]);

export async function transcribe(buffer, mime, langHint = 'hi', options = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new SarvamBadAudio('No audio bytes provided');
  const mockMode = options.mock ?? (process.env.SARVAM_MOCK !== 'false');
  if (mockMode) {
    const fixtureId = options.fixtureId || 'demo-hi';
    if (mockTranscripts.has(fixtureId)) return structuredClone(mockTranscripts.get(fixtureId));
    const fixturePath = fileURLToPath(new URL('../agents/aria/fixtures/transcripts.json', import.meta.url));
    const fixtureData = JSON.parse(await readFile(fixturePath, 'utf8'));
    const fixture = fixtureData[fixtureId];
    if (!fixture) throw new SarvamBadAudio(`No mock transcript fixture named ${fixtureId}`);
    return structuredClone(fixture);
  }

  // TODO(verify): confirm Sarvam endpoint, auth, audio format and language codes before enabling live requests.
  throw new SarvamUnavailable('Sarvam live API details are awaiting verification');
}

export async function speak() {
  // TODO(verify): Sarvam TTS contract has not been verified; voice replies stay disabled.
  throw new SarvamUnavailable('Sarvam TTS is not enabled');
}
