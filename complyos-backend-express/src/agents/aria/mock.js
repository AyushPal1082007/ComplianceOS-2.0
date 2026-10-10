import { runTurn } from './engine/runTurn.js';
import transcriptFixtures from './fixtures/transcripts.json' with { type: 'json' };
import ARIA_MESSAGES from './config/messages.js';

// Dynamic fixture updates - loaded from external config or database
const FIXTURE_UPDATES = process.env.ARIA_FIXTURE_UPDATES 
  ? JSON.parse(process.env.ARIA_FIXTURE_UPDATES)
  : {};

export async function runMock(input = {}, options = {}) {
  const fixtureUpdates = input.event?.mockUpdates || FIXTURE_UPDATES[input.event?.text];
  return runTurn(input, {
    ...options,
    sarvamMock: true,
    ingest: options.ingest || (async (event) => {
      if (event.type !== 'VOICE') return (await import('./engine/ingest.js')).ingest(event, options.ingestOptions || options);
      const fixture = transcriptFixtures[event.fixtureId] || transcriptFixtures['voice-hi'];
      const text = event.transcript || event.mockTranscript || fixture.text;
      const transcript = { ...fixture, text };
      if (!transcript.text.trim() || transcript.confidence < (Number(process.env.ARIA_MIN_ASR_CONFIDENCE) || 0.5)) {
        return { needsInput: true, transcript, message: ARIA_MESSAGES.NOT_UNDERSTOOD[input.locale || 'hinglish'] };
      }
      return { turn: { text: transcript.text, via: 'voice', confidence: transcript.confidence, quoteSource: transcript.text, transcriptId: `mock-${event.fixtureId || 'voice-hi'}` }, transcript };
    }),
    classifyIntent: async (turn) => ({
      intent: turn.via === 'option' ? turn.option?.optionId === 'skip' ? 'skip' : turn.option?.optionId === 'unsure' ? 'unsure' : 'answer' : 'answer',
      language: input.locale || 'hinglish', tokens: 0, source: 'mock',
    }),
    extractSlots: async (text, config = {}) => ({
      updates: (fixtureUpdates || []).filter((update) => text.normalize('NFC').includes(update.quote)).map((update) => ({ ...update, via: config.via || 'text' })),
      llmTokens: 0,
      language: input.locale || 'hinglish',
    }),
  });
}

export default runMock;
