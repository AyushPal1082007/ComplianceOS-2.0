import { run as runScout } from '../../agents/scout/entry.ts';

const FREE_PLAN_CARD_LIMIT = 3;

export async function scoutNode(state, requestedType) {
  const eventType = requestedType || (
    state.event.type === 'MENU'
      ? String(state.event.action || state.event.card?.actionId || state.event.actionId || '').toUpperCase()
      : state.event.type
  );
  if (!['SCHEME_REQUEST', 'TEASER', 'REFRESH'].includes(eventType)) {
    throw new TypeError(`Unsupported SCOUT event: ${eventType}`);
  }

  const profile = Object.fromEntries(Object.entries(state.profile).map(([key, field]) => [key, field]));
  profile.profileId = state.userId;
  const output = await (state.agentRunners?.scout || runScout)({
    runId: state.runId,
    userId: state.userId,
    event: { type: eventType },
    profile,
    locale: state.conversation.language,
  }, state.services?.scout || {});

  const itemsLimit = state.user.plan === 'free' ? FREE_PLAN_CARD_LIMIT : Number.POSITIVE_INFINITY;
  const messages = (output.messages || []).map((message) => {
    if (message.type !== 'list' || !Array.isArray(message.items)) return message;
    return { ...message, items: message.items.slice(0, itemsLimit) };
  });
  const hasFactWithoutSource = (output.claims || []).some((claim) => !claim.sourceUrl || !claim.lastVerified);
  const emptySuccess = output.status === 'OK' && messages.length === 0 && (output.claims || []).length === 0;
  const status = output.status === 'OK' && (hasFactWithoutSource || emptySuccess) ? 'FAILED' : output.status;

  return {
    status,
    messages: status === 'FAILED' && output.status === 'OK'
      ? [{ type: 'text', text: 'SCOUT could not provide a verified scheme result. Please try again later.' }]
      : messages,
    claims: hasFactWithoutSource ? [] : output.claims || [],
    trace: output.trace || [],
  };
}

export default scoutNode;
