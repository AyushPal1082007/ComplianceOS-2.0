import { runTurn } from './engine/runTurn.js';
import transcriptFixtures from './fixtures/transcripts.json' with { type: 'json' };

const FIXTURE_UPDATES = {
  'main Kanpur mein kapde ki dukaan chalata hoon, GST hai': [
    { field: 'state', value: 'Kanpur', confidence: 1, quote: 'Kanpur', via: 'text' },
    { field: 'sector', value: 'trader', confidence: 1, quote: 'dukaan chalata hoon', via: 'text' },
    { field: 'subSector', value: 'textile', confidence: 1, quote: 'kapde', via: 'text' },
    { field: 'gstRegistered', value: true, confidence: 1, quote: 'GST hai', via: 'text' },
  ],
};

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
        return { needsInput: true, transcript, message: 'Awaaz saaf nahi aayi, dobara bhejein ya type karein.' };
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
