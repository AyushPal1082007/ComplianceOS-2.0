import { z } from 'zod';
import { json as groqJson } from '../../../services/groq.js';
import { CLASSIFY_SYSTEM_PROMPT } from '../prompts/classifyIntent.js';
import { IntentSchema } from '../../../contracts/aria.js';
import keywordBank from '../questionBank/keywords.json' with { type: 'json' };

const IntentResultSchema = z.object({ intent: IntentSchema, language: z.enum(['hi', 'en', 'hinglish']).optional() });

export function normalizeIntentText(text) {
  return String(text || '').normalize('NFC').toLocaleLowerCase('hi-IN').replace(/[!?.,;:।]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function classifyIntent(turn, options = {}) {
  if (turn.via === 'option' && turn.option) {
    const intent = turn.option.optionId === 'skip' ? 'skip'
      : turn.option.optionId === 'unsure' ? 'unsure' : 'answer';
    return { intent, language: options.language || 'hinglish', tokens: 0, source: 'option' };
  }

  const text = normalizeIntentText(turn.text);
  if (!text) return { intent: 'unsure', language: options.language || 'hinglish', tokens: 0, source: 'rule' };
  // Stop is exact-only so phrases such as "bas 5 log hain" remain answers.
  if (/^(?:bas|enough|stop|रुको|बस)$/.test(text)) {
    return { intent: 'stop', language: guessLanguage(text, options.language), tokens: 0, source: 'rule' };
  }
  if (/^(?:bas|बस)\s+\S/u.test(text)) {
    return { intent: 'answer', language: guessLanguage(text, options.language), tokens: 0, source: 'rule' };
  }
  for (const [intent, translations] of Object.entries(keywordBank)) {
    const phrases = Object.values(translations).flat();
    if (phrases.some((phrase) => text === normalizeIntentText(phrase))) {
      return { intent, language: guessLanguage(text, options.language), tokens: 0, source: 'rule' };
    }
  }
  if (/[?？]/u.test(turn.text) && /(gst|tax|notice|penalty|file|compliance|जीएसटी|टैक्स|नोटिस)/iu.test(turn.text)) {
    return { intent: 'off_topic', language: guessLanguage(text, options.language), tokens: 0, source: 'rule' };
  }

  const words = text.split(' ').filter(Boolean);
  if (words.length <= 3 || !(options.llmClassify || groqJson)) {
    return { intent: 'answer', language: guessLanguage(text, options.language), tokens: 0, source: 'rule' };
  }
  try {
    const caller = options.llmClassify || ((schema, system, input) => groqJson(schema, system, input, { maxTokens: 100 }));
    const result = await caller(IntentResultSchema, CLASSIFY_SYSTEM_PROMPT, text);
    return { ...result.data, tokens: result.tokens || 0, source: 'llm' };
  } catch {
    return { intent: 'answer', language: guessLanguage(text, options.language), tokens: 0, source: 'fallback' };
  }
}

function guessLanguage(text, fallback = 'hinglish') {
  if (/[\u0900-\u097f]/u.test(text)) return 'hi';
  if (/\b(the|which|what|business|state|yes|no)\b/i.test(text)) return 'en';
  return fallback;
}
