import portals from '../../config/portals.json' with { type: 'json' };

const SAFE_PORTAL = /^https:\/\/(?:[a-z0-9-]+\.)*(?:gov\.in|nic\.in)(?:\/|$)/i;

export function pathwayStubNode(state) {
  const language = state.profile.preferredLanguage?.value || state.user.language || 'hinglish';
  const link = Object.values(portals).find((value) => (
    typeof value === 'string' && !/^TODO/i.test(value) && SAFE_PORTAL.test(value)
  ));
  const text = language === 'en'
    ? 'This pathway is coming soon. Please use the official portal directly.'
    : language === 'hi'
      ? 'PATHWAY जल्द आ रहा है। कृपया आधिकारिक पोर्टल का सीधे उपयोग करें।'
      : 'PATHWAY jald aa raha hai. Kripya official portal par seedhe jaayein.';
  return {
    status: 'OK',
    messages: [{ type: 'text', text: link ? `${text}\n${link}` : text }],
    claims: [],
    trace: [],
  };
}

export default pathwayStubNode;
