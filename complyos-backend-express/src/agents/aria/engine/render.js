import { WA_LIMITS } from '../config.js';
import tone from '../questionBank/tone.json' with { type: 'json' };
import { buildReveal } from './reveal.js';

const SKIP_ROW = { id: 'skip', label: { hi: 'छोड़ें', en: 'Skip', hinglish: 'Skip' } };

export function renderQuestion(question, session, options = {}) {
  const language = session.language;
  const progress = { done: options.done || 0, total: options.total || 10 };
  const text = `${question.text[language]}\n${language === 'hi' ? 'सवाल' : language === 'en' ? 'Question' : 'Sawaal'} ${session.askedQuestionIds.length + 1}/${progress.total}`;
  const rows = [...question.options.map((option) => ({ id: option.id, label: option.label[language], ...(option.emoji ? { emoji: option.emoji } : {}) })), { ...SKIP_ROW, label: SKIP_ROW.label[language] }];
  if (rows.length <= WA_LIMITS.replyButtons) {
    return { type: 'option_card', id: question.id, text, options: rows, progress, allowFreeText: true };
  }
  return { type: 'list', id: question.id, text, rows: rows.slice(0, WA_LIMITS.listRows), allowFreeText: true };
}

export function renderReveal(profile, session) {
  return buildReveal(profile, session.language);
}

export function renderWhy(question, language) {
  return { type: 'text', text: question.why[language] };
}

export function renderWelcome(language = 'hinglish') {
  return { type: 'text', text: tone.welcome[language] || tone.welcome.hinglish };
}

export function renderNotUnderstood(question, language) {
  const text = language === 'en' ? 'I did not quite understand. You can answer in your own words or choose an option.'
    : language === 'hi' ? 'मैं ठीक से समझ नहीं पाई। आप अपने शब्दों में बताएं या एक विकल्प चुनें।'
      : 'Samajh nahi aaya. Aap apne words mein bata sakte hain ya option choose karein.';
  return { type: 'text', text, questionId: question.id };
}
