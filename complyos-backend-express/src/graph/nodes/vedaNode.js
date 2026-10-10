import crypto from 'node:crypto';
import { run as runVeda } from '../../agents/veda/index.js';
import { mergeProfile } from '../../profile/mergePolicy.js';
import * as deadlineRepo from '../../repos/deadlineRepo.js';
import * as documentRepo from '../../repos/documentRepo.js';
import { scoutNode } from './scoutNode.js';
import { documentQuota, recordProcessedDocument } from './quota.js';

const EXPIRED_TEXT = 'Confirmation expire ho gaya, kripya document dobara bhejein.';
function pendingTtlMinutes() {
  const configured = Number.parseInt(process.env.VEDA_PENDING_TTL_MIN || '60', 10);
  return Number.isInteger(configured) && configured >= 0 ? configured : 60;
}
const SCOUT_PROFILE_FIELDS = new Set([
  'state', 'sector', 'subSector', 'gstRegistered', 'turnoverBand',
  'udyamRegistered', 'employeesBand', 'womenLed', 'ownerAgeBand', 'goal',
  'district', 'annualTurnover', 'employeeCount', 'udyamNumber',
]);

function actionDetails(event = {}) {
  const actionId = String(event.actionId || event.card?.actionId || event.optionId || '');
  const key = event.key || actionId.replace(/^(?:confirm|edit)_/, '');
  const action = event.action || (actionId.startsWith('edit_') ? 'edit' : 'confirm');
  return { key, action, value: event.value };
}

function isExpired(pending, now = Date.now()) {
  const started = Date.parse(pending?.startedAt || '');
  return !Number.isFinite(started) || now - started > pendingTtlMinutes() * 60_000;
}

function expirationResult(state) {
  return {
    status: 'NEEDS_INPUT',
    conversation: { ...state.conversation, pendingVeda: undefined },
    messages: [{ type: 'text', text: EXPIRED_TEXT }],
    claims: [],
    trace: [],
  };
}

function vedaDocumentEvent(event) {
  const document = event.document || {};
  return {
    ...event,
    url: document.url || event.url || event.imageUrl || event.fileUrl || '',
    mime: document.mime || event.mime || event.mimeType || 'image/jpeg',
    filename: document.filename || event.filename || 'compliance-document',
  };
}

function stableDocumentId(userId, event) {
  const document = event.document || {};
  const source = document.cloudinaryId
    || document.url
    || event.url
    || (document.buffer instanceof Uint8Array ? crypto.createHash('sha256').update(document.buffer).digest('hex') : '')
    || event.externalId;
  const hex = crypto.createHash('sha256').update(`${userId}:${source}`).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function isCheckpointFailure(output) {
  return (output.trace || []).some((entry) => (
    entry.status === 'error' && /checkpoint|thread[_ ]id|resume/i.test(String(entry.error || ''))
  ));
}

export async function vedaNode(state, { now = () => Date.now() } = {}) {
  const event = state.event;
  const isResume = event.type === 'CONFIRM_ACTION'
    || (event.type === 'OPTION_TAP' && state.conversation.outstandingCards?.[event.card?.cardId] === 'VEDA');
  const pending = state.conversation.pendingVeda;
  let threadId;
  let startedAt;
  let documentId;
  let documentUrl;
  let cloudinaryId;
  let filename;
  let confirmChoice;
  let vedaEvent;

  if (isResume) {
    if (
      !pending
      || isExpired(pending, now())
      || (event.threadId && event.threadId !== pending.threadId)
      || (event.card?.cardId && pending.cardId !== event.card.cardId)
    ) return expirationResult(state);

    threadId = pending.threadId;
    startedAt = pending.startedAt;
    documentId = pending.documentId;
    documentUrl = pending.documentUrl;
    cloudinaryId = pending.cloudinaryId;
    filename = pending.filename;
    const action = actionDetails(event);
    if (
      (action.action === 'keep' || action.action === 'use')
      && (state.conversation.pendingProfileConflicts || []).some((conflict) => conflict.key === action.key)
    ) {
      confirmChoice = { key: action.key, value: action.action === 'keep'
        ? state.profile[action.key]?.evidence?.verifiedValue ?? state.profile[action.key]?.evidence?.selfReportedValue
        : state.profile[action.key]?.evidence?.proposedValue };
    }
    if (confirmChoice) {
      vedaEvent = { action: 'resume', payload: { key: action.key, action: 'confirm', value: confirmChoice.value } };
    } else {
      vedaEvent = {
        action: 'resume',
        payload: {
          key: action.key,
          action: action.action,
          ...(action.value !== undefined ? { value: action.value } : {}),
        },
      };
    }
  } else {
    const quota = documentQuota(state, new Date(now()));
    if (!quota.allowed) {
      return {
        status: 'NEEDS_INPUT',
        messages: [{ type: 'text', text: 'Aapke free plan ki monthly document limit poori ho gayi hai.' }],
        claims: [],
        trace: [],
      };
    }
    threadId = `veda:${state.userId}:${crypto.randomUUID()}`;
    startedAt = new Date(now()).toISOString();
    documentId = stableDocumentId(state.userId, event);
    const document = event.document || {};
    documentUrl = document.url || event.url || event.imageUrl || undefined;
    cloudinaryId = document.cloudinaryId || event.cloudinaryId || undefined;
    filename = document.filename || event.filename || 'compliance-document';
    vedaEvent = { ...vedaDocumentEvent(event), docId: documentId };
  }

  const output = await (state.agentRunners?.veda || runVeda)({
    runId: threadId,
    userId: state.userId,
    event: vedaEvent,
    profile: state.profile,
    locale: state.conversation.language || 'hinglish',
  }, state.services?.veda || {});

  if (isResume && output.status === 'FAILED' && isCheckpointFailure(output)) {
    return expirationResult(state);
  }
  if ((output.claims || []).some((claim) => !claim.sourceUrl || !claim.lastVerified)) {
    return {
      status: 'FAILED',
      messages: [{ type: 'text', text: 'VEDA could not verify the source details for this document.' }],
      claims: [],
      trace: [{
        runId: state.runId,
        agent: 'VEDA',
        node: 'source-check',
        startedAt: new Date(now()).toISOString(),
        durationMs: 0,
        status: 'error',
        error: 'Claim missing sourceUrl or lastVerified',
      }],
    };
  }
  if (output.status === 'FAILED' || output.status === 'DEGRADED') {
    return { status: output.status, messages: output.messages || [], claims: output.claims || [], trace: output.trace || [] };
  }

  const profilePatch = confirmChoice
    ? { [confirmChoice.key]: { value: confirmChoice.value, status: 'SELF_REPORTED', source: 'aria_option' } }
    : output.profilePatch || {};
  const merged = mergeProfile(state.profile, profilePatch, { origin: isResume ? 'user_confirmed' : 'veda_doc' });
  const profile = merged.profile;
  const conversation = { ...state.conversation };
  let messages = output.messages || [];
  let status = output.status || 'OK';

  if (merged.conflicts.length) {
    conversation.pendingProfileConflicts = merged.conflicts.map((conflict) => ({
      key: conflict.key,
      existingValue: conflict.existingValue,
      proposedValue: conflict.proposedValue,
    }));
    const conflict = merged.conflicts[0];
    messages = [{
      type: 'confirm_card',
      id: 'profile-conflict',
      text: conflict.question,
      actions: [
        { id: `keep_${conflict.key}`, label: `Keep ${String(conflict.existingValue)}` },
        { id: `use_${conflict.key}`, label: `Use ${String(conflict.proposedValue)}` },
      ],
    }];
    status = 'NEEDS_CONFIRMATION';
  } else if (confirmChoice) {
    conversation.pendingProfileConflicts = (conversation.pendingProfileConflicts || [])
      .filter((item) => item.key !== confirmChoice.key);
    conversation.pendingVeda = undefined;
    status = conversation.pendingProfileConflicts.length ? 'NEEDS_CONFIRMATION' : 'OK';
    messages = conversation.pendingProfileConflicts.length
      ? [{ type: 'text', text: 'Please confirm the remaining profile details.' }]
      : [{ type: 'text', text: 'Document details confirmed and saved.' }];
  }

  if (merged.conflicts.length) {
    conversation.pendingVeda = undefined;
  } else if (status === 'NEEDS_INPUT' || status === 'NEEDS_CONFIRMATION') {
    const card = messages.find((message) => ['confirm_card', 'option_card'].includes(message.type));
    const cardId = card?.id || 'veda-confirm';
    conversation.pendingVeda = {
      threadId,
      cardId,
      startedAt,
      ...(documentId ? { documentId } : {}),
      ...(documentUrl ? { documentUrl } : {}),
      ...(cloudinaryId ? { cloudinaryId } : {}),
      ...(filename ? { filename } : {}),
    };
    conversation.outstandingCards = { ...conversation.outstandingCards, [cardId]: 'VEDA' };
  } else if (status === 'OK') {
    conversation.pendingVeda = undefined;
  }

  const documentCompleted = output.status === 'OK';
  const shouldRefreshScout = documentCompleted
    && merged.conflicts.length === 0
    && merged.changedKeys.some((key) => SCOUT_PROFILE_FIELDS.has(key));
  const scoutOutput = shouldRefreshScout
    ? await scoutNode({
      ...state,
      event: { type: 'REFRESH' },
      profile,
      conversation,
    }, 'REFRESH')
    : null;
  if (scoutOutput?.status === 'FAILED') {
    return {
      status: 'FAILED',
      messages: scoutOutput.messages,
      claims: [],
      trace: [...(output.trace || []), ...(scoutOutput.trace || [])],
    };
  }

  if (documentCompleted) {
    const savedDocument = await documentRepo.saveFromVeda(state.userId, {
      id: documentId || stableDocumentId(state.userId, event),
      filename: filename || 'compliance-document',
      cloudinaryUrl: documentUrl || null,
      cloudinaryId: cloudinaryId || null,
      documentType: output.documentType || null,
      extractedData: output.profilePatch || undefined,
    });
    const calendarItems = (output.calendarItems || []).map((item) => ({
      ...item,
      sourceDocumentId: savedDocument.id,
      createdByAgent: 'VEDA',
    }));
    if (calendarItems.length) await deadlineRepo.upsertFromCalendarItems(state.userId, calendarItems);
    const processed = recordProcessedDocument({ ...state, conversation }, savedDocument.id, new Date(now()));
    conversation.counters = processed.counters;
    conversation.flags = processed.flags;
  }

  return {
    status,
    profile,
    conversation,
    profileChangedKeys: merged.changedKeys,
    messages: [...messages, ...(scoutOutput?.messages || [])],
    claims: [...(output.claims || []), ...(scoutOutput?.claims || [])],
    trace: [...(output.trace || []), ...(scoutOutput?.trace || [])],
    scoutOutput,
  };
}

export { EXPIRED_TEXT, pendingTtlMinutes };
export default vedaNode;
