import { mergeProfile } from '../../profile/mergePolicy.js';
import * as profileRepo from '../../repos/profileRepo.js';

export async function profileConflictNode(state) {
  const pending = state.conversation.pendingProfileConflicts || [];
  const actionId = String(state.event.actionId || state.event.card?.actionId || state.event.optionId || '');
  const key = state.event.key || actionId.replace(/^(?:keep|use)_/, '');
  const conflict = pending.find((item) => item.key === key);
  if (!conflict) {
    return {
      status: 'NEEDS_INPUT',
      conversation: state.conversation,
      messages: [{ type: 'text', text: 'Please choose one of the values shown on the confirmation card.' }],
      trace: [],
      claims: [],
    };
  }

  const value = actionId.startsWith('keep_') ? conflict.existingValue : conflict.proposedValue;
  const merged = mergeProfile(state.profile, {
    [key]: { value, status: 'SELF_REPORTED', source: 'aria_option' },
  }, { origin: 'user_confirmed' });
  const profile = await profileRepo.save(state.userId, merged.profile, merged.changedKeys);
  const remaining = pending.filter((item) => item.key !== key);
  const conversation = { ...state.conversation, pendingProfileConflicts: remaining };
  if (!remaining.length) conversation.phase = 'home';
  return {
    status: remaining.length ? 'NEEDS_CONFIRMATION' : 'OK',
    profile,
    conversation,
    messages: remaining.length
      ? [{ type: 'text', text: 'Please confirm the remaining profile details.' }]
      : [{ type: 'text', text: 'Document details confirmed and saved.' }],
    claims: [],
    trace: [],
  };
}

export default profileConflictNode;
