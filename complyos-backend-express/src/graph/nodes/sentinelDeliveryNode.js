import * as alertRepo from '../../repos/alertRepo.js';
import { buildAlert } from '../../agents/sentinel/buildAlert.js';
import { matchProfiles } from '../../agents/sentinel/matchProfiles.js';
import { notify } from '../../services/notify.js';

function missingRequiredField(profile, filters = {}) {
  const stateRequired = Array.isArray(filters.states) && !filters.states.includes('all');
  const sectorRequired = Array.isArray(filters.sectors) && !filters.sectors.includes('all');
  if (stateRequired && profile.state && !filters.states.some((value) => normalize(value) === normalize(profile.state))) return false;
  const sector = profile.sector || profile.businessType;
  if (sectorRequired && sector && !filters.sectors.some((value) => normalize(value) === normalize(sector))) return false;
  if (filters.gstinHolders === true && profile.gstin === false) return false;
  if (filters.udyamHolders === true && profile.udyamNumber === false) return false;
  if (filters.turnoverBand && profile.annualTurnover && Number(profile.annualTurnover) <= 0) return false;
  return (stateRequired && !profile.state)
    || (sectorRequired && !sector)
    || (filters.gstinHolders === true && !profile.gstin)
    || (filters.udyamHolders === true && !profile.udyamNumber)
    || (filters.turnoverBand && !(Number(profile.annualTurnover ?? profile.annualTurnoverLakhs) > 0));
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function validateSimulationLabel(alert, simulated) {
  const hasLabel = /simulated alert/i.test(`${alert.title || ''}\n${alert.summary || ''}`);
  if (simulated && !hasLabel) throw new Error('Simulated SENTINEL alerts must carry the "Simulated alert" label');
  if (!simulated && hasLabel) throw new Error('Real SENTINEL alerts must not carry a simulated label');
}

export async function deliverApprovedChange({
  source,
  change,
  changeId,
  profiles = [],
  build = buildAlert,
  alerts = alertRepo,
  notifyUser = notify,
  now = new Date(),
}) {
  if (!changeId) throw new TypeError('Approved SENTINEL delivery requires a change id');
  if (change?.status !== 'APPROVED' || !change?.quote || !change?.sourceUrl || !change?.lastVerified) {
    throw new Error('SENTINEL delivery requires an approved, fully sourced change');
  }

  const filters = change.affects || {};
  const matchingProfiles = matchProfiles(profiles, filters);
  const matchingIds = new Set(matchingProfiles.map((profile) => profile.user?.id || profile.id));
  const digestOnly = profiles.filter((profile) => (
    !matchingIds.has(profile.user?.id || profile.id) && missingRequiredField(profile, filters)
  ));
  const simulated = Boolean(change.simulated || source?.simulated);
  let sent = 0;
  let digest = 0;
  let duplicates = 0;
  let limited = 0;

  for (const profile of matchingProfiles) {
    const userId = profile.user?.id || profile.id;
    if (!userId) continue;
    if (change.severity === 'info') {
      const result = await alerts.createDigestLedger({ userId, changeId, now });
      if (result.created) digest++;
      else duplicates++;
      continue;
    }

    const alert = build({
      user: profile.user || { id: userId },
      source,
      change,
      profile,
      simulated,
    });
    validateSimulationLabel(alert, simulated);
    const result = await alerts.createSentinelAlertWithLedger({ alert, changeId, now });
    if (result.created) {
      sent++;
      await notifyUser({
        userId,
        user: profile.user,
        title: alert.title,
        body: alert.summary,
        kind: 'sentinel',
        metadata: { changeId, sourceUrl: alert.sourceUrl, isSimulated: simulated },
        dedupeKey: `sentinel:${changeId}`,
        inAppStored: true,
        now,
      });
    } else if (result.reason === 'daily_limit') {
      limited++;
      const queued = await alerts.createDigestLedger({ userId, changeId, now });
      if (queued.created) digest++;
      else duplicates++;
    } else {
      duplicates++;
    }
  }

  for (const profile of digestOnly) {
    const userId = profile.user?.id || profile.id;
    if (!userId) continue;
    const result = await alerts.createDigestLedger({ userId, changeId, now });
    if (result.created) digest++;
    else duplicates++;
  }

  return {
    status: sent ? 'ALERTED' : digest ? 'DIGEST_QUEUED' : 'NO_MATCH',
    sent,
    digest,
    duplicates,
    limited,
    matched: matchingProfiles.length,
    digestOnly: digestOnly.length,
  };
}

export async function sentinelDeliveryNode(state) {
  return deliverApprovedChange({
    source: state.event.source,
    change: state.event.change,
    changeId: state.event.changeId,
    profiles: state.event.profiles || [],
    build: state.services?.buildAlert || buildAlert,
    alerts: state.services?.alertRepo || alertRepo,
    notifyUser: state.services?.notify || notify,
    now: state.event.now ? new Date(state.event.now) : new Date(),
  });
}

export { validateSimulationLabel };
export default sentinelDeliveryNode;
