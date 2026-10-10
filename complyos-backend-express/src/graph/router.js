const DELETE_PHRASE = /(?:\bremove\s+my\s+data\b|\bmera\s+data\s+hatao\b|डिलीट|मेरा\s+डेटा\s+हट(?:ाओ|ाएँ|ाएं))/iu;
const DELETE_COMMAND = /\bdelete\b/i;
const HOME_INTENTS = [
  ['scout', /\b(?:schemes?|yojana)\b|योजना/iu],
  ['deadlines', /\bdeadlines?\b|\bdue\s+dates?\b|\b(?:aakhri\s+)?tareekh\b|तारीख|समय[\s-]*सीमा/iu],
  ['upload', /\bdocuments?\b|\bphotos?\b|\bupload\b|\bdastavez\b|\btasveer\b|दस्तावेज़|दस्तावेज|फोटो|अपलोड/iu],
  ['profile', /\bprofile\b|\bmeri\s+(?:jaankari|jankari)\b|प्रोफ़ाइल|प्रोफाइल|मेरी\s+जानकारी/iu],
  ['alerts', /\balerts?\b|\b(?:soochna|suchna)\b|अलर्ट|सूचनाएँ|सूचनाएं/iu],
  ['pathway', /\bshare\b|\bsanjha\b|\bca\b|\bchecklists?\b|शेयर|साझा|सीए|चेकलिस्ट/iu],
];

export function homeIntent(text = '') {
  const value = String(text);
  return HOME_INTENTS.find(([, pattern]) => pattern.test(value))?.[0] || 'card';
}

export function isDeleteRequest(event = {}) {
  const text = String(event.text || '').trim();
  const isShortDeleteCommand = text.split(/\s+/).length <= 3 && DELETE_COMMAND.test(text);
  return (event.type === 'DELETE_CONFIRM' && !['cancel', 'no'].includes(String(event.action || event.actionId || event.card?.actionId || '').toLowerCase()))
    || DELETE_PHRASE.test(text)
    || isShortDeleteCommand
    || ['DELETE', 'DELETE_REQUEST'].includes(String(event.action || '').toUpperCase());
}

export function routeEvent(state) {
  const event = state.event || {};
  if (state.conversation?.pendingDelete || isDeleteRequest(event)) return 'deleteGuard';
  if (
    state.conversation?.phase === 'home'
    && ['TEXT', 'VOICE'].includes(event.type)
  ) return `home:${homeIntent(event.text)}`;
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
  if (event.type === 'CONFIRM_ACTION') {
    const cardId = event.card?.cardId || event.questionId || event.cardId;
    const owner = state.conversation?.outstandingCards?.[cardId];
    if (owner === 'ARIA') return 'aria';
    if (owner === 'VEDA') return 'veda';
    return 'veda';
  }
  if (event.type === 'OPTION_TAP' && state.conversation?.outstandingCards?.[event.card?.cardId] === 'VEDA') {
    return 'veda';
  }
  if (event.type === 'TEXT' || event.type === 'VOICE' || event.type === 'OPTION_TAP' || event.type === 'START') {
    return 'aria';
  }
  return 'menu';
}

export default { homeIntent, isDeleteRequest, routeEvent };
