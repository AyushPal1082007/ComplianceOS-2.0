import { run } from '../../agents/aria/index.js';
import { mergeProfile } from '../../profile/mergePolicy.js';

export async function ariaNode(state) {
  const output = await run({
    runId: state.runId,
    userId: state.userId,
    event: state.event || { type: 'START' },
    profile: state.profile || {},
    locale: state.conversation?.language || state.locale || state.profile?.preferredLanguage || 'hinglish',
    session: state.conversation?.ariaSession || state.ariaSession || state.session,
  }, { mock: state.mock, ...(state.services?.aria || {}) });
  const merged = mergeProfile(state.profile || {}, output.profilePatch || {}, { origin: 'aria' });

  return {
    ariaOutput: output,
    profile: merged.profile,
    ariaSession: output.session,
    messages: [...(state.messages || []), ...(output.messages || [])],
    trace: [...(state.trace || []), ...(output.trace || [])],
  };
}

export default ariaNode;
