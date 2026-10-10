import { createHash } from 'node:crypto';
import { fetchAudio, toWav16kMono } from '../../../services/media.js';
import { transcribe } from '../../../services/sarvam.js';
import { QUESTION_BY_ID } from '../questionBank/loader.js';
import { DEFAULT_MIN_ASR_CONFIDENCE } from '../config.js';

export async function ingest(event = {}, options = {}) {
  if (event.type === 'OPTION_TAP') {
    const question = QUESTION_BY_ID.get(event.questionId);
    if (question && event.optionId === 'skip') {
      return { turn: { text: 'skip', via: 'option', confidence: 1, quoteSource: 'skip', option: { questionId: question.id, optionId: 'skip', value: null } } };
    }
    const option = question?.options.find((choice) => choice.id === event.optionId);
    if (!question || !option) throw new Error('Unknown ARIA question or option');
    return { turn: { text: String(option.value ?? option.id), via: 'option', confidence: 1, quoteSource: String(option.id), option: { questionId: question.id, optionId: option.id, value: option.value } } };
  }
  if (event.type === 'TEXT') {
    return { turn: { text: String(event.text || '').trim(), via: 'text', confidence: 1, quoteSource: String(event.text || '').trim() } };
  }
  if (event.type === 'VOICE') {
    const bytes = await (options.fetchAudio || fetchAudio)(event.audioRef || event.mediaId, options.mediaOptions);
    const wav = await (options.toWav16kMono || toWav16kMono)(bytes, event.mime || 'audio/ogg');
    const transcript = await (options.transcribe || transcribe)(wav, 'audio/wav', event.language || 'hi', { fixtureId: event.fixtureId, mock: options.sarvamMock });
    const threshold = Number(process.env.ARIA_MIN_ASR_CONFIDENCE) || DEFAULT_MIN_ASR_CONFIDENCE;
    if (!transcript.text?.trim() || (transcript.confidence ?? 0) < threshold) {
      return { needsInput: true, transcript, message: 'Awaaz saaf nahi aayi, dobara bhejein ya type karein.' };
    }
    const transcriptId = createHash('sha256').update(`${Date.now()}:${transcript.text}`).digest('hex').slice(0, 16);
    return { turn: { text: transcript.text.trim(), via: 'voice', confidence: transcript.confidence ?? 1, quoteSource: transcript.text.trim(), transcriptId }, transcript };
  }
  throw new Error(`Unsupported ARIA event type: ${event.type || 'missing'}`);
}
