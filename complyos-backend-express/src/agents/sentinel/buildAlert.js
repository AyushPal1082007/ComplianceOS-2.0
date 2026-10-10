import crypto from 'crypto';

export function buildAlert({ user, source, change, profile, simulated = false }) {
  if (!user || !user.id) {
    throw new Error('Alert creation requires a user id');
  }

  const sourceUrl = source?.url || change?.sourceUrl;
  const lastVerified = change?.lastVerified;

  if (!sourceUrl) {
    throw new Error('Alert requires sourceUrl');
  }

  if (!lastVerified) {
    throw new Error('Alert requires lastVerified');
  }

  if (!change?.quote || !String(change.quote).trim()) {
    throw new Error('Alert requires a valid quote');
  }

  if (Number(change?.confidence || 0) < 0.8 || change?.status === 'NEEDS_REVIEW') {
    throw new Error('Alert requires a reviewed change with confidence >= 0.80');
  }

  const simulatedAlert = Boolean(simulated || source?.simulated);
  const title = `${simulatedAlert ? 'Simulated alert: ' : ''}${change?.title || 'Government update'}`;
  const summary = change?.summary || 'A statutory change was detected for your profile.';

  return {
    id: crypto.randomUUID(),
    userId: user.id,
    title,
    summary: simulatedAlert ? `Simulated alert — ${summary}` : summary,
    sourceUrl,
    lastVerified,
    isSimulated: simulatedAlert,
    affectedAttributes: change?.affects || {},
    status: 'unread',
    quote: change.quote,
    profileId: profile?.id || null,
  };
}

export default {
  buildAlert,
};
