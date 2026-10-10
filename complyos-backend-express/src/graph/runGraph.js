import { routeEvent } from './router.js';
import { ariaNode } from './nodes/ariaNode.js';
import { consentGateNode } from './nodes/consentGate.js';
import { deleteGuardNode } from './nodes/deleteGuard.js';
import { menuNode } from './nodes/menuNode.js';
import { pathwayStubNode } from './nodes/pathwayStubNode.js';
import { profileConflictNode } from './nodes/profileConflictNode.js';
import { scoutNode } from './nodes/scoutNode.js';
import { vedaNode } from './nodes/vedaNode.js';
import * as userRepo from '../repos/userRepo.js';

function combine(state, output) {
  const conversation = output.conversation || state.conversation;
  return {
    ...state,
    ...output,
    conversation,
    messages: [...(state.messages || []), ...(output.messages || [])],
    claims: [...(state.claims || []), ...(output.claims || [])],
    trace: [...(state.trace || []), ...(output.trace || [])],
  };
}

function isAriaFinish(event = {}) {
  const questionId = event.questionId || event.card?.cardId;
  const optionId = event.optionId || event.actionId || event.card?.actionId;
  return questionId === 'aria-reveal' && ['finish', 'confirm'].includes(String(optionId || '').toLowerCase());
}

export async function runGraph(initialState) {
  let state = initialState;
  const consent = await consentGateNode(state);
  if (consent.handled) return combine(state, consent);
  if (consent.accepted) {
    const user = await userRepo.findById(state.userId);
    state = {
      ...state,
      user,
      event: { type: 'START' },
      conversation: { ...state.conversation, phase: 'intake', language: state.event.language || state.conversation.language },
    };
  }

  const deletion = await deleteGuardNode(state, {
    removeData: state.services?.deleteUserData,
  });
  if (deletion.handled) return combine(state, deletion);
  if (deletion.cancelled) state = { ...state, conversation: deletion.conversation };
  const cancellationMessage = deletion.cancelled ? deletion.messages : [];

  const route = routeEvent(state);
  let output;
  if (route === 'aria') {
    output = await ariaNode(state);
    state = combine(state, output);
    if (output.escalate === 'DELETE_REQUEST') {
      const deletion = await deleteGuardNode({
        ...state,
        event: { ...state.event, action: 'DELETE_REQUEST' },
      }, { removeData: state.services?.deleteUserData });
      return combine(state, deletion);
    }
    if (isAriaFinish(state.event)) {
      const scout = await scoutNode({ ...state, event: { type: 'SCHEME_REQUEST' } }, 'SCHEME_REQUEST');
      state = combine(state, scout);
    }
  } else if (route === 'veda') {
    output = await vedaNode(state);
    state = combine(state, output);
  } else if (route === 'profileConflict') {
    output = await profileConflictNode(state);
    state = combine(state, output);
  } else if (route === 'menu') {
    const selection = menuNode(state);
    if (selection.route === 'scout') {
      output = await scoutNode(state, selection.scoutEvent.type);
    } else if (selection.route === 'pathway') {
      output = pathwayStubNode(state);
    } else {
      output = await ariaNode(state);
    }
    state = combine(state, output);
  } else {
    output = pathwayStubNode(state);
    state = combine(state, output);
  }

  if (cancellationMessage.length) {
    state.messages = [...cancellationMessage, ...state.messages];
  }
  return state;
}

export default runGraph;
