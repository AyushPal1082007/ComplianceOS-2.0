import logger from '../../../logger.js';
import { AgentOutputSchema } from '../../../contracts/aria.js';
import { QUESTIONS, QUESTION_BY_ID } from '../questionBank/loader.js';
import { CORE_FIELDS, EXTENDED_FIELDS, DEFAULT_MAX_QUESTIONS } from '../config.js';
import { ingest } from './ingest.js';
import { classifyIntent, normalizeIntentText } from './classifyIntent.js';
import { extractSlots } from './extractSlots.js';
import { applyUpdates } from './applyUpdates.js';
import { completeness, getProfileField } from './completeness.js';
import { selectNext } from './selectNext.js';
import { applyAnswer, markSkipped, newSession, snapshotSession, undo } from './session.js';
import { renderQuestion, renderReveal, renderWelcome, renderWhy, renderNotUnderstood } from './render.js';
import { quoteExists } from './update-utils.js';

const OFF_TOPIC = {
  hi: 'मैं अभी सिर्फ आपकी जानकारी समझ रही हूँ। पहले प्रोफ़ाइल पूरी कर लें, फिर आपके सवाल पर मदद मिलेगी।',
  en: 'I am collecting your business profile right now. Let us finish that first, then I can help route your question.',
  hinglish: 'Main abhi sirf aapki jaankari samajh rahi hoon. Pehle profile poori kar lein, phir aapke sawaal par madad milegi.',
};
const SAFE_ERROR = {
  hi: 'अभी तकनीकी दिक्कत है। कृपया थोड़ी देर बाद फिर कोशिश करें।',
  en: 'A technical issue occurred. Please try again shortly.',
  hinglish: 'Abhi technical dikkat hai. Thodi der baad phir try karein.',
};
const DISCLAIMER = {
  hi: 'यह जानकारी केवल समझने के लिए है, पेशेवर सलाह नहीं।',
  en: 'This information is for understanding only, not professional advice.',
  hinglish: 'Yeh jaankari sirf samajhne ke liye hai, professional salaah nahi.',
};

function trace(runId, node, startedAt, inputSummary, outputSummary, status = 'done', error) {
  return {
    runId, agent: 'ARIA', node, startedAt: new Date(startedAt).toISOString(), durationMs: Math.max(0, Date.now() - startedAt),
    inputSummary, outputSummary, status, ...(error ? { error } : {}),
  };
}

function makeOutput({ status = 'OK', profilePatch = {}, messages = [], trace: traceEvents = [], costs = { llmTokens: 0 }, session, escalate }) {
  const requiredStages = ['ingest', 'classify', 'extract', 'apply', 'select', 'render'];
  const completeTrace = [...traceEvents];
  for (const stage of requiredStages) {
    if (!completeTrace.some((entry) => entry.node === stage)) {
      const now = new Date().toISOString();
      completeTrace.push({ runId: completeTrace[0]?.runId || 'aria_unknown', agent: 'ARIA', node: stage, startedAt: now, durationMs: 0, inputSummary: {}, outputSummary: { reason: 'not needed for this turn' }, status: 'skipped' });
    }
  }
  const output = { status, profilePatch, messages, claims: [], trace: completeTrace, costs, session, ...(escalate ? { escalate } : {}) };
  return AgentOutputSchema.parse(output);
}

function statusForPatch(profilePatch) {
  return Object.values(profilePatch).some((field) => field?.status === 'NEEDS_CONFIRMATION') ? 'NEEDS_CONFIRMATION' : 'OK';
}

function currentQuestion(session, profile) {
  if (session.reasking && session.lastQuestionId && QUESTION_BY_ID.has(session.lastQuestionId)) return QUESTION_BY_ID.get(session.lastQuestionId);
  if (session.editingField) return QUESTIONS.find((question) => question.field === session.editingField) || null;
  if (session.lastQuestionId && QUESTION_BY_ID.has(session.lastQuestionId)) return QUESTION_BY_ID.get(session.lastQuestionId);
  return selectNext(profile, session, { phase: session.phase === 'extended' ? 'extended' : 'asking' });
}

function profileSummary(profile) {
  return Object.fromEntries([...CORE_FIELDS, ...EXTENDED_FIELDS].map((field) => [field, getProfileField(profile, field).value]));
}

function fieldListCard(profile, language) {
  const rows = [...CORE_FIELDS, ...EXTENDED_FIELDS].filter((field) => getProfileField(profile, field).value !== null)
    .map((field) => ({ id: field, label: `${field}: ${String(getProfileField(profile, field).value)}` }));
  return { type: 'list', id: 'aria-edit-list', text: language === 'en' ? 'Which detail should we change?' : language === 'hi' ? 'कौन-सी जानकारी बदलनी है?' : 'Kaunsi jaankari badalni hai?', rows: rows.slice(0, 10) };
}

function languageFrom(text, fallback) {
  const normalized = normalizeIntentText(text);
  if (/(?:english mein|in english|अंग्रेज़ी में)/u.test(normalized)) return 'en';
  if (/(?:hindi mein|हिंदी में)/u.test(normalized)) return 'hi';
  if (/(?:hinglish mein|hinglish)/u.test(normalized)) return 'hinglish';
  return fallback;
}

function profilePatchForUndo(profile, previous) {
  if (previous && typeof previous === 'object' && 'status' in previous) return previous;
  if (previous === null || previous === undefined) {
    return { value: null, status: 'EMPTY', confidence: 0, source: 'aria_text', updatedAt: new Date().toISOString() };
  }
  return { value: previous, status: 'SELF_REPORTED', confidence: 1, source: 'aria_text', updatedAt: new Date().toISOString() };
}

function profileUpdateFromTap(turn) {
  return {
    field: QUESTIONS.find((question) => question.id === turn.option.questionId)?.field,
    value: turn.option.value,
    confidence: 1,
    quote: turn.option.optionId,
    via: 'option',
  };
}

function renderQuestionWithIntro(question, session, messages, profile) {
  if (!question) {
    session.phase = 'done';
    messages.push({ type: 'text', text: session.language === 'en' ? 'Thanks. You can update your profile any time.' : session.language === 'hi' ? 'धन्यवाद। आप कभी भी अपनी जानकारी बदल सकते हैं।' : 'Shukriya. Aap kabhi bhi apni profile update kar sakte hain.' });
    return;
  }
  const done = [...CORE_FIELDS, ...EXTENDED_FIELDS].filter((field) => ['SELF_REPORTED', 'VERIFIED'].includes(getProfileField(profile, field).status)).length;
  messages.push(renderQuestion(question, session, { done, total: CORE_FIELDS.length + EXTENDED_FIELDS.length }));
  session.lastQuestionId = question.id;
  if (!session.askedQuestionIds.includes(question.id)) session.askedQuestionIds.push(question.id);
}

export async function runTurn(input = {}, options = {}) {
  const runId = input.runId || `aria_${Date.now()}`;
  const userId = input.userId || 'user_default';
  const language = input.locale || input.profile?.preferredLanguage || 'hinglish';
  const previousSession = input.session ? snapshotSession(input.session) : newSession(language);
  let session = snapshotSession(previousSession);
  const originalProfile = input.profile || {};
  let profile = { ...originalProfile };
  const patch = {};
  const messages = [];
  const traces = [];
  let llmTokens = 0;
  const event = input.event || {};
  const record = (node, start, inSummary, outSummary, status, error) => traces.push(trace(runId, node, start, inSummary, outSummary, status, error));

  try {
    if (!event.type || event.type === 'START') {
      const started = Date.now();
      session.phase = session.phase === 'welcome' ? 'asking' : session.phase;
      messages.push(renderWelcome(session.language));
      record('render', started, { phase: previousSession.phase }, { welcome: true }, 'done');
      renderQuestionWithIntro(selectNext(profile, session), session, messages, profile);
      record('select', started, { phase: session.phase }, { questionId: session.lastQuestionId }, 'done');
      return makeOutput({ profilePatch: {}, messages, trace: traces, costs: { llmTokens }, session });
    }

    if (event.type === 'OPTION_TAP' && event.questionId === 'aria-restart') {
      const started = Date.now();
      if (event.optionId === 'cancel') {
        messages.push({ type: 'text', text: session.language === 'en' ? 'Your answers were kept.' : session.language === 'hi' ? 'आपके जवाब वैसे ही रखे गए हैं।' : 'Aapke answers waise hi rakhe hain.' });
      } else if (event.optionId === 'confirm') {
        for (const [field, value] of Object.entries(profile)) {
          if (value && typeof value === 'object' && value.status === 'SELF_REPORTED') {
            patch[field] = { ...value, value: null, status: 'EMPTY', confidence: 0, updatedAt: new Date().toISOString() };
          }
        }
        profile = { ...profile, ...patch };
        session = newSession(session.language);
        session.phase = 'asking';
        messages.push(renderWelcome(session.language));
      }
      record('render', started, { action: 'restart' }, { confirmed: event.optionId === 'confirm' }, 'done');
      renderQuestionWithIntro(selectNext(profile, session), session, messages, profile);
      return makeOutput({ profilePatch: patch, messages, trace: traces, costs: { llmTokens }, session });
    }

    if (event.type === 'OPTION_TAP' && event.questionId === 'aria-edit-list') {
      const question = QUESTIONS.find((item) => item.field === event.optionId);
      if (!question) throw new Error('Unknown editable ARIA profile field');
      session.phase = 'editing';
      session.editingField = question.field;
      const started = Date.now();
      renderQuestionWithIntro(question, session, messages, profile);
      record('select', started, { editField: event.optionId }, { questionId: question.id }, 'done');
      return makeOutput({ messages, trace: traces, costs: { llmTokens }, session });
    }

    if (event.type === 'OPTION_TAP' && event.questionId === 'aria-reveal') {
      const started = Date.now();
      if (event.optionId === 'continue') session.phase = 'extended';
      else if (event.optionId === 'finish') session.phase = 'done';
      else if (event.optionId === 'edit') {
        session.phase = 'editing';
        messages.push(fieldListCard(profile, session.language));
      }
      record('classify', started, { action: event.optionId }, { phase: session.phase }, 'done');
      if (session.phase === 'done') messages.push({ type: 'text', text: `Agar GST ya Udyam certificate ki photo bhejein, to main sab verify kar dungi.\n${DISCLAIMER[session.language]}` });
      else if (session.phase !== 'editing') renderQuestionWithIntro(selectNext(profile, session, { phase: 'extended' }), session, messages, profile);
      return makeOutput({ messages, trace: traces, costs: { llmTokens }, session });
    }

    if (event.type === 'OPTION_TAP' && event.questionId === 'aria-restart-confirm') {
      return runTurn({ ...input, event: { type: 'OPTION_TAP', questionId: 'aria-restart', optionId: event.optionId }, session }, options);
    }

    const ingestStarted = Date.now();
    const ingested = await (options.ingest || ingest)(event, options.ingestOptions || options);
    record('ingest', ingestStarted, { type: event.type }, { needsInput: Boolean(ingested.needsInput), via: ingested.turn?.via, ...(ingested.transcript?.text ? { transcript: ingested.transcript.text } : {}) }, 'done');
    if (ingested.needsInput) {
      messages.push({ type: 'text', text: `${ingested.message}\n${DISCLAIMER[session.language]}` });
      if (ingested.transcript?.text) traces.push(trace(runId, 'ingest', ingestStarted, { type: event.type }, { transcript: ingested.transcript.text }, 'done'));
      return makeOutput({ status: 'NEEDS_INPUT', messages, trace: traces, costs: { llmTokens }, session: previousSession });
    }
    const turn = ingested.turn;
    if (turn.via === 'voice') messages.push({ type: 'text', text: `${session.language === 'en' ? 'I heard:' : session.language === 'hi' ? 'मैंने सुना:' : 'Maine suna:'} ${turn.text}` });

    const classifyStarted = Date.now();
    const classified = await (options.classifyIntent || classifyIntent)(turn, { language: session.language, llmClassify: options.llmClassify });
    llmTokens += classified.tokens || 0;
    record('classify', classifyStarted, { via: turn.via, textLength: turn.text.length }, { intent: classified.intent, source: classified.source }, 'done');
    if (classified.language) session.language = classified.language;
    if (classified.intent === 'change_language') session.language = languageFrom(turn.text, session.language);
    if (session.language !== (originalProfile.preferredLanguage || language)) {
      patch.preferredLanguage = session.language;
    }

    const question = currentQuestion(session, profile);
    if (classified.intent === 'delete') {
      record('apply', Date.now(), { intent: 'delete' }, { escalate: 'DELETE_REQUEST' }, 'done');
      return makeOutput({ messages: [], trace: traces, costs: { llmTokens }, session, escalate: 'DELETE_REQUEST' });
    }
    if (classified.intent === 'off_topic') {
      messages.push({ type: 'text', text: OFF_TOPIC[session.language] || OFF_TOPIC.hinglish });
    } else if (classified.intent === 'why') {
      if (question) messages.push(renderWhy(question, session.language));
    } else if (classified.intent === 'back') {
      const result = undo(session);
      session = result.session;
      if (result.change) {
        const previous = profilePatchForUndo(originalProfile[result.change.field], result.change.previousValue);
        patch[result.change.field] = previous;
        profile[result.change.field] = previous;
        session.reasking = true;
      }
    } else if (classified.intent === 'restart') {
      messages.push({ type: 'confirm_card', id: 'aria-restart-confirm', text: session.language === 'en' ? 'Clear your self-reported answers and restart?' : session.language === 'hi' ? 'क्या आपके बताए जवाब मिटाकर फिर से शुरू करूँ?' : 'Kya aapke bataye answers hata kar dobara shuru karun?', actions: [{ id: 'confirm', label: session.language === 'en' ? 'Yes, restart' : 'Haan, dobara shuru karein' }, { id: 'cancel', label: session.language === 'en' ? 'Cancel' : 'Nahi, rehne dein' }] });
    } else if (classified.intent === 'confirm_edit' && session.phase === 'reveal') {
      session.phase = 'editing';
      messages.push(fieldListCard(profile, session.language));
    } else if (classified.intent === 'confirm_yes' && session.phase === 'reveal') {
      session.phase = 'extended';
    } else if (classified.intent === 'stop') {
      session.phase = 'reveal';
    } else if (classified.intent === 'skip' || classified.intent === 'unsure') {
      if (question) session = markSkipped(session, question.id);
    } else if (classified.intent === 'answer') {
      const extractStarted = Date.now();
      let updates;
      if (turn.via === 'option') {
        const update = profileUpdateFromTap(turn);
        updates = update.field ? [update] : [];
      } else {
        const extracted = await (options.extractSlots || extractSlots)(turn.text, {
          via: turn.via, asrConfidence: turn.confidence, language: session.language,
          groqJson: options.groqJson,
        });
        updates = extracted.updates.map((update) => ({ ...update, via: turn.via, transcriptId: turn.transcriptId }));
        llmTokens += extracted.llmTokens || 0;
      }
      record('extract', extractStarted, { via: turn.via, textLength: turn.text.length }, { updateCount: updates.length }, 'done');
      const applyStarted = Date.now();
      const applied = applyUpdates(profile, session, updates, {
        requireQuote: turn.via !== 'option', sourceText: turn.quoteSource, quoteCheck: quoteExists,
        questionByField: new Map(QUESTIONS.map((item) => [item.field, item])),
      });
      profile = applied.profile;
      Object.assign(patch, applied.profilePatch);
      session = applied.session;
      session.turnCount = previousSession.turnCount + 1;
      if (session.reasking && question && applied.applied.some((item) => item.field === question.field)) {
        session.reasking = false;
      }
      if (session.editingField && applied.applied.some((item) => item.field === session.editingField)) {
        session.phase = 'reveal';
        delete session.editingField;
      }
      record('apply', applyStarted, { candidateCount: updates.length }, { appliedCount: applied.applied.length }, 'done');
      if (!applied.applied.length && question) {
        const retries = session.retryCounts[question.id] || 0;
        session.retryCounts[question.id] = retries + 1;
        if (retries === 0) {
          const simpler = {
            hi: `कृपया ${question.text.hi} अपने शब्दों में बताएं।`,
            en: `Could you answer this in your own words? ${question.text.en}`,
            hinglish: `Aap apne words mein batayein: ${question.text.hinglish}`,
          };
          messages.push({ type: 'text', text: simpler[session.language] || simpler.hinglish });
        } else {
          messages.push(renderNotUnderstood(question, session.language));
        }
      }
    }

    const values = completeness(profile);
    const updatedCompleteness = { core: values.core, extended: values.extended };
    const hasProfileFieldChanges = Object.keys(patch).some((field) => field !== 'completeness');
    if (hasProfileFieldChanges && JSON.stringify(originalProfile.completeness || {}) !== JSON.stringify(updatedCompleteness)) {
      patch.completeness = updatedCompleteness;
    }
    const maxQuestions = Number(process.env.ARIA_MAX_QUESTIONS) || DEFAULT_MAX_QUESTIONS;
    const turnCap = session.turnCount >= maxQuestions;
    const coreReady = values.core >= 0.8;
    if ((coreReady || turnCap) && session.phase === 'asking') session.phase = 'reveal';
    if (session.phase === 'extended' && (values.extended >= 1 || turnCap)) session.phase = 'done';

    const selectStarted = Date.now();
    if (session.phase === 'reveal') {
      messages.push(renderReveal(profileSummary(profile), session));
    } else if (session.phase === 'done') {
      messages.push({ type: 'text', text: `Agar GST ya Udyam certificate ki photo bhejein, to main sab verify kar dungi.\n${DISCLAIMER[session.language]}` });
    } else if (session.reasking) {
      const redoQuestion = currentQuestion(session, profile);
      renderQuestionWithIntro(redoQuestion, session, messages, profile);
      session.reasking = true;
    } else if (session.phase === 'editing' && session.editingField) {
      renderQuestionWithIntro(QUESTIONS.find((item) => item.field === session.editingField), session, messages, profile);
    } else {
      const phase = session.phase === 'extended' ? 'extended' : 'asking';
      const nextQuestion = selectNext(profile, session, { phase, schemeGain: options.schemeGain });
      const askedCoreCount = session.askedQuestionIds.filter((id) => QUESTIONS.find((q) => q.id === id)?.tier === 'core').length;
      if (phase === 'asking' && askedCoreCount >= 4 && !session.teaserShown) {
        session.teaserShown = true;
        try {
          let count;
          if (options.schemeCount) {
            count = await options.schemeCount(profile);
          } else {
            const { scoutSchemes } = await import('../../../scout.js');
            const scoutProfile = {
              state: getProfileField(profile, 'state').value,
              businessType: getProfileField(profile, 'sector').value,
              isWomenLed: getProfileField(profile, 'womenLed').value,
              udyamNumber: getProfileField(profile, 'udyamNumber').value,
            };
            const scoutResult = await scoutSchemes(scoutProfile, { includeExplanations: false, limit: 0 });
            count = scoutResult.eligibleSchemesFound;
          }
          if (Number.isFinite(count)) messages.push({ type: 'text', text: (session.language === 'en' ? `${count} schemes may be possible for you.` : session.language === 'hi' ? `अब तक ${count} योजनाएँ आपके लिए possible हो सकती हैं।` : `Abhi tak ${count} yojnaayein aapke liye possible ho sakti hain.`) });
        } catch {
          // SCOUT is optional for ARIA; omit the teaser when its matcher is unavailable.
        }
      }
      renderQuestionWithIntro(nextQuestion, session, messages, profile);
    }
    record('select', selectStarted, { phase: session.phase }, { questionId: session.lastQuestionId || null }, 'done');
    const renderStarted = Date.now();
    record('render', renderStarted, { phase: session.phase }, { messageCount: messages.length }, 'done');
    return makeOutput({ status: statusForPatch(patch), profilePatch: patch, messages, trace: traces, costs: { llmTokens }, session });
  } catch (error) {
    logger.warn('ARIA per-turn processing failed', { runId, error: error.name || 'Error' });
    const failedTrace = [...traces, trace(runId, 'error', Date.now(), { userId }, {}, 'error', error.message)];
    return makeOutput({ status: 'DEGRADED', profilePatch: {}, messages: [{ type: 'text', text: SAFE_ERROR[previousSession.language] || SAFE_ERROR.hinglish }], trace: failedTrace, costs: { llmTokens }, session: previousSession });
  }
}
