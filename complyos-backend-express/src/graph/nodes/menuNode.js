const SCOUT_ACTIONS = new Set(['SCHEME_REQUEST', 'TEASER', 'REFRESH']);

function selectedAction(event = {}) {
  return String(event.action || event.card?.actionId || event.actionId || event.optionId || '').toUpperCase();
}

export function menuNode(state) {
  const action = selectedAction(state.event);
  const text = String(state.event.text || '').toLowerCase();
  if (/ca\s+ko\s+share|check[\s-]?list/.test(text)) return { route: 'pathway' };
  if (SCOUT_ACTIONS.has(action)) return { route: 'scout', scoutEvent: { type: action } };
  if (/PATHWAY|CHECKLIST|CA|SHARE/.test(action)) return { route: 'pathway' };
  return { route: 'aria' };
}

export default menuNode;
