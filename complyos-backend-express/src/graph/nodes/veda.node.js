import { run, buildVedaGraph } from '../../agents/veda/index.js';
import { mergeProfile } from '../../profile/mergePolicy.js';

export async function vedaNode(state) {
  const output = await run({
    runId: state.runId,
    userId: state.userId,
    event: state.event || {},
    profile: state.profile || {},
    locale: state.locale || 'hinglish',
  }, { checkpointer: state.checkpointer });
  const merged = mergeProfile(state.profile || {}, output.profilePatch || {}, { origin: 'veda_doc' });

  return {
    vedaOutput: output,
    profile: merged.profile,
    messages: [...(state.messages || []), ...(output.messages || [])],
    trace: [...(state.trace || []), ...(output.trace || [])],
  };
}

export { buildVedaGraph };
export default vedaNode;
