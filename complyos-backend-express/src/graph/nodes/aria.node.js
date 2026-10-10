import { run } from '../../agents/aria/index.js';

/** Thin parent-graph adapter; ARIA has no LangGraph imports or persistence logic. */
export async function ariaNode(state) {
  const output = await run({
    runId: state.runId,
    userId: state.userId,
    event: state.event || { type: 'START' },
    profile: state.profile || {},
    locale: state.locale || state.profile?.preferredLanguage || 'hinglish',
    session: state.ariaSession || state.session,
  }, { mock: state.mock });

  return {
    ariaOutput: output,
    profile: { ...(state.profile || {}), ...(output.profilePatch || {}) },
    ariaSession: output.session,
    messages: [...(state.messages || []), ...output.messages],
    trace: [...(state.trace || []), ...output.trace],
  };
}

export default ariaNode;
