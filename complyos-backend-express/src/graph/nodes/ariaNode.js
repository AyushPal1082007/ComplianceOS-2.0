import { run as runAria } from '../../agents/aria/index.js';
import { mergeProfile } from '../../profile/mergePolicy.js';

export async function ariaNode(state) {
  const output = await (state.agentRunners?.aria || runAria)({
    runId: state.runId,
    userId: state.userId,
    event: state.event.type === 'OPTION_TAP'
      ? { type: 'OPTION_TAP', questionId: state.event.questionId || state.event.card?.cardId, optionId: state.event.optionId || state.event.card?.actionId }
      : state.event,
    profile: state.profile,
    locale: state.conversation.language || state.profile.preferredLanguage?.value || 'hinglish',
    session: state.conversation.ariaSession,
  }, state.services?.aria || {});

  if (output.status === 'FAILED' || output.status === 'DEGRADED') {
    return { status: output.status, messages: output.messages || [], claims: output.claims || [], trace: output.trace || [] };
  }

  const merged = mergeProfile(state.profile, output.profilePatch || {}, { origin: 'aria' });
  const conversation = {
    ...state.conversation,
    ariaSession: output.session || state.conversation.ariaSession,
    phase: output.session?.phase === 'done' ? 'home' : 'intake',
    language: output.session?.language || state.conversation.language,
  };

  return {
    status: output.status || 'OK',
    profile: merged.profile,
    conversation,
    profileChangedKeys: merged.changedKeys,
    messages: output.messages || [],
    claims: output.claims || [],
    trace: output.trace || [],
  };
}

export default ariaNode;
