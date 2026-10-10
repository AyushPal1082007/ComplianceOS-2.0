import { PROFILE_FIELD_KEYS } from '../../contracts/profileFields.js';
import { completeness } from '../../agents/aria/engine/completeness.js';
import { memoryStore } from './store.js';
import { projectProfile } from '../../profile/projection.js';

function defaultField() {
  return { value: null, status: 'EMPTY', confidence: 0, source: 'aria_text', updatedAt: new Date().toISOString() };
}

export async function load(userId) {
  const fields = memoryStore.profileFields.get(userId) || new Map();
  const profile = Object.fromEntries(PROFILE_FIELD_KEYS.map((key) => [key, structuredClone(fields.get(key) || defaultField())]));
  const user = memoryStore.users.get(userId);
  profile.preferredLanguage = user?.language === 'hi' || user?.language === 'en' ? user.language : 'hinglish';
  profile.completeness = completeness(profile);
  return profile;
}

export async function save(userId, mergedProfile, changedKeys = []) {
  let fields = memoryStore.profileFields.get(userId);
  if (!fields) {
    fields = new Map();
    memoryStore.profileFields.set(userId, fields);
  }
  for (const key of changedKeys) {
    if (PROFILE_FIELD_KEYS.includes(key) && mergedProfile[key]) {
      fields.set(key, structuredClone(mergedProfile[key]));
    }
  }
  const score = completeness(mergedProfile);
  await projectProfile(userId, mergedProfile, score.core);
  return load(userId);
}

export async function loadForMatching({ cursor = null, limit = 100 } = {}) {
  const users = [...memoryStore.users.values()]
    .filter((user) => user.consentGiven && user.isActive)
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((user) => cursor === null || user.id > cursor)
    .slice(0, limit);
  return Promise.all(users.map(async (user) => ({
    user,
    profile: await load(user.id),
    businessProfile: memoryStore.profiles.get(user.id) || null,
  })));
}

export async function removeForUser(userId) {
  const fields = memoryStore.profileFields.get(userId);
  const fieldCount = fields?.size || 0;
  memoryStore.profileFields.delete(userId);
  const hadBusinessProfile = memoryStore.profiles.delete(userId);
  return { profileFields: fieldCount, businessProfile: hadBusinessProfile ? 1 : 0 };
}

export default { load, save, loadForMatching, removeForUser };
