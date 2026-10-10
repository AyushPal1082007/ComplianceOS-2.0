export const memoryStore = {
  users: new Map(),
  profiles: new Map(),
  profileFields: new Map(),
  inboundEvents: new Map(),
  conversations: new Map(),
  consentLogs: [],
  documents: new Map(),
  deadlines: new Map(),
  schemes: new Map(),
  schemeMatches: new Map(),
  sentinelAlerts: new Map(),
  regulationAlerts: new Map(),
  traces: [],
};

export function clearMemoryStore() {
  memoryStore.users.clear();
  memoryStore.profiles.clear();
  memoryStore.profileFields.clear();
  memoryStore.conversations.clear();
  memoryStore.consentLogs.length = 0;
  memoryStore.inboundEvents.clear();
  memoryStore.documents.clear();
  memoryStore.deadlines.clear();
  memoryStore.schemes.clear();
  memoryStore.schemeMatches.clear();
  memoryStore.sentinelAlerts.clear();
  memoryStore.regulationAlerts.clear();
  memoryStore.traces.length = 0;
}

export function usesMemoryRepository() {
  return process.env.REPO_DRIVER === 'memory';
}
