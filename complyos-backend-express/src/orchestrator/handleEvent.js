import crypto from 'node:crypto';
import { InboundEventSchema } from '../contracts/common.js';
import { createGraphState } from '../graph/state.js';
import { runGraph } from '../graph/runGraph.js';
import * as conversationRepo from '../repos/conversationRepo.js';
import * as inboundEventRepo from '../repos/inboundEventRepo.js';
import * as profileRepo from '../repos/profileRepo.js';
import * as traceRepo from '../repos/traceRepo.js';
import * as userRepo from '../repos/userRepo.js';
import { withUserLock } from './userLock.js';

const SAFE_ERROR_TEXT = {
  hi: 'अभी तकनीकी समस्या है। कृपया थोड़ी देर बाद फिर कोशिश करें।',
  en: 'A technical issue occurred. Please try again shortly.',
  hinglish: 'Abhi technical dikkat hai. Kripya thodi der baad phir try karein.',
};

function normalizePhone(phone = '') {
  return String(phone).replace(/\D/g, '');
}

function acceptedConsent(event) {
  const action = String(event.action || event.card?.actionId || event.actionId || '').toLowerCase();
  return event.type === 'CONSENT' && (event.accepted === true || ['accept', 'yes', 'consent', 'agree'].includes(action));
}

function privacySafe(value) {
  if (typeof value === 'string') {
    return value
      .replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/gi, '[REDACTED GSTIN]')
      .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, '[REDACTED PAN]')
      .replace(/(?:\+?91[\s-]?)?[6-9]\d(?:[\s().-]?\d){8}/g, '[REDACTED PHONE]');
  }
  if (Array.isArray(value)) return value.map(privacySafe);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, privacySafe(item)]));
}

function errorTrace(runId, error) {
  const status = error?.agentStatus === 'FAILED' ? 'FAILED' : 'error';
  return {
    runId,
    agent: error?.agentName || 'ORCHESTRATOR',
    node: error?.nodeName || 'handleEvent',
    startedAt: new Date().toISOString(),
    durationMs: 0,
    status,
    error: error instanceof Error ? error.name : 'Agent execution failed',
  };
}

function response({ status, messages = [], claims = [], trace = [], duplicate = false }) {
  return { status, messages, claims, trace: privacySafe(trace), duplicate };
}

function normalizeTrace(events, userId) {
  return privacySafe(events).map((event) => ({
    ...event,
    agent: String(event.agent || 'ORCHESTRATOR').toUpperCase(),
    userId,
  }));
}

async function findUser(event) {
  if (event.userId) return userRepo.findById(event.userId);
  if (event.phone) return userRepo.findByPhone(event.phone);
  return null;
}

export async function handleEvent(input, options = {}) {
  const event = InboundEventSchema.parse({
    ...input,
    receivedAt: input.receivedAt || new Date(),
    externalId: input.externalId || crypto.randomUUID(),
    channel: input.channel || (input.userId ? 'web' : 'whatsapp'),
  });
  const isConsentAcceptance = acceptedConsent(event);
  let user = await findUser(event);

  if (!user && isConsentAcceptance && event.phone) {
    user = await userRepo.findOrCreateByPhone(event.phone, event.channel);
  }

  if (!user) {
    if (event.type === 'CONSENT' && !isConsentAcceptance) {
      const language = event.language || 'hinglish';
      return response({
        status: 'NEEDS_INPUT',
        messages: [{
          type: 'text',
          text: language === 'en'
            ? 'Understood. No information was processed.'
            : language === 'hi'
              ? 'ठीक है। आपकी जानकारी संसाधित नहीं की गई है।'
              : 'Theek hai. Aapki jaankari process nahi ki gayi.',
        }],
      });
    }
    return response({
      status: 'NEEDS_CONFIRMATION',
      messages: [{
        type: 'confirm_card',
        id: 'consent',
        text: 'Kya aap profile aur compliance madad ke liye apni jaankari use karne ki sahmati dete hain?',
        actions: [
          { id: 'accept', label: 'Haan, sahmati hai' },
          { id: 'decline', label: 'Nahi' },
        ],
      }],
    });
  }

  const lockKey = event.phone ? `phone:${normalizePhone(event.phone)}` : `user:${user.id}`;
  return withUserLock(lockKey, async () => {
    user = await userRepo.findById(user.id);
    if (!user) throw new Error('User disappeared while handling inbound event');

    if (user.consentGiven || isConsentAcceptance) {
      const recorded = await inboundEventRepo.recordOnce({
        channel: event.channel,
        externalId: event.externalId,
        userId: user.id,
      });
      if (!recorded.created) return response({ status: 'OK', duplicate: true });
    }

    const conversationEntry = await conversationRepo.load(user.id);
    const profile = await profileRepo.load(user.id);
    const conversation = conversationEntry.state || {
      phase: user.consentGiven ? 'intake' : 'consent',
      language: event.language || user.language || 'hinglish',
      pendingProfileConflicts: [],
      outstandingCards: {},
      counters: { docsThisMonth: { month: '', count: 0 }, schemeMatchesShown: 0 },
      flags: { introduced: false, processedDocumentIds: [] },
    };
    const state = createGraphState({
      runId: crypto.randomUUID(),
      user,
      event,
      profile,
      conversation,
      agentRunners: options.agentRunners,
      services: options.services,
    });

    try {
      const result = await (options.runGraph || runGraph)(state);
      if (result.consentBlocked) return response(result);
      if (result.deleted) return response(result);

      if (['FAILED', 'DEGRADED'].includes(result.status)) {
        const trace = normalizeTrace(result.trace || [], user.id);
        await traceRepo.append(trace);
        return response({
          status: result.status,
          messages: result.messages?.length
            ? result.messages
            : [{ type: 'text', text: SAFE_ERROR_TEXT[conversation.language] || SAFE_ERROR_TEXT.hinglish }],
          claims: [],
          trace,
        });
      }

      if (result.profile && result.profileChangedKeys?.length) {
        await profileRepo.save(user.id, result.profile, result.profileChangedKeys);
      }
      if (result.conversation) {
        await conversationRepo.save(user.id, result.conversation, {
          expectedVersion: conversationEntry.version,
          lastInboundAt: event.receivedAt,
        });
      }

      const trace = normalizeTrace(result.trace || [], user.id);
      await traceRepo.append(trace);
      return response({
        status: result.status || 'OK',
        messages: result.messages || [],
        claims: result.claims || [],
        trace,
      });
    } catch (error) {
      const trace = normalizeTrace([errorTrace(state.runId, error)], user.id);
      await traceRepo.append(trace);
      return response({
        status: 'DEGRADED',
        messages: [{ type: 'text', text: SAFE_ERROR_TEXT[conversation.language] || SAFE_ERROR_TEXT.hinglish }],
        trace,
      });
    }
  });
}

export default handleEvent;
