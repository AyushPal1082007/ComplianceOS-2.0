const DELETE_TEXT = /(?:\bdelete\b|\bremove\s+my\s+data\b|डिलीट|मेरा\s+डेटा\s+हटा(?:ओ|एँ)?)/iu;

export function isDeleteRequest(event = {}) {
  return (event.type === 'DELETE_CONFIRM' && !['cancel', 'no'].includes(String(event.action || event.actionId || event.card?.actionId || '').toLowerCase()))
    || DELETE_TEXT.test(String(event.text || ''))
    || ['DELETE', 'DELETE_REQUEST'].includes(String(event.action || '').toUpperCase());
}

export function routeEvent(state) {
  const event = state.event || {};
  if (state.conversation?.pendingDelete || isDeleteRequest(event)) return 'deleteGuard';
  if (event.type === 'DOCUMENT') return 'veda';
  if (event.type === 'MENU') return 'menu';
  if (event.type === 'OPTION_TAP' && /SCHEME_REQUEST|TEASER|REFRESH|PATHWAY|CHECKLIST|SHARE_CA/i.test(
    String(event.actionId || event.optionId || event.card?.actionId || ''),
  )) return 'menu';
  if (event.type === 'TEXT' && /ca\s+ko\s+share|check[\s-]?list/i.test(String(event.text || ''))) return 'menu';
  if (event.type === 'CONFIRM_ACTION' && state.conversation?.pendingProfileConflicts?.length) {
    return 'profileConflict';
  }
  if (event.type === 'OPTION_TAP' && event.questionId === 'profile-conflict' && state.conversation?.pendingProfileConflicts?.length) {
    return 'profileConflict';
  }
  if (event.type === 'CONFIRM_ACTION') return 'veda';
  if (event.type === 'OPTION_TAP' && state.conversation?.outstandingCards?.[event.card?.cardId] === 'VEDA') {
    return 'veda';
  }
  if (event.type === 'TEXT' || event.type === 'VOICE' || event.type === 'OPTION_TAP' || event.type === 'START') {
    return 'aria';
  }
  return 'menu';
}

export default { isDeleteRequest, routeEvent };
