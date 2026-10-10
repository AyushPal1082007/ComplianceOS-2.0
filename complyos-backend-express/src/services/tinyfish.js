import logger from '../logger.js';
import prisma from '../db.js';

const SECOND = 1000;
const GLOBAL_WINDOW_MS = 500;
const DOMAIN_WINDOW_MS = 1000;
const DEFAULT_TIMEOUT_MS = 15000;

const globalRecentTimestamps = [];
const domainRecentTimestamps = new Map();
const agentUsage = { daily: 0, resetAt: Date.now() + 24 * 60 * 60 * 1000 };

const ONE_MINUTE = 60 * 1000;

export class AgentBudgetExceeded extends Error {
  constructor(message = 'TinyFish agent budget exceeded') {
    super(message);
    this.name = 'AgentBudgetExceeded';
  }
}

function shouldRetry(error) {
  if (!error) return false;
  if (error.name === 'AbortError') return true;
  if (error.message && /429|5\d\d|ECONNRESET|ETIMEDOUT|fetch/i.test(error.message)) {
    return true;
  }
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pruneOldTimestamps(map, windowMs) {
  const cutoff = Date.now() - windowMs;
  for (const [key, timestamps] of map.entries()) {
    const filtered = timestamps.filter((ts) => ts > cutoff);
    if (filtered.length === 0) {
      map.delete(key);
    } else {
      map.set(key, filtered);
    }
  }
}

async function enforceRateLimit(url) {
  const target = new URL(url);
  const domain = target.hostname;
  const now = Date.now();

  globalRecentTimestamps.push(now);
  while (globalRecentTimestamps.length > 0 && now - globalRecentTimestamps[0] > GLOBAL_WINDOW_MS) {
    globalRecentTimestamps.shift();
  }
  if (globalRecentTimestamps.length > 2) {
    const minWait = (globalRecentTimestamps[0] + GLOBAL_WINDOW_MS) - now;
    if (minWait > 0) {
      await sleep(minWait);
    }
  }

  const domainList = domainRecentTimestamps.get(domain) || [];
  domainList.push(now);
  domainRecentTimestamps.set(domain, domainList);
  while (domainList.length > 0 && now - domainList[0] > DOMAIN_WINDOW_MS) {
    domainList.shift();
  }
  if (domainList.length > 1) {
    const minWait = (domainList[0] + DOMAIN_WINDOW_MS) - now;
    if (minWait > 0) {
      await sleep(minWait);
    }
  }
  pruneOldTimestamps(domainRecentTimestamps, DOMAIN_WINDOW_MS);
}

async function persistTinyFishCall({ endpoint, costClass, status, durationMs, sourceId = null }) {
  try {
    if (prisma && typeof prisma.tinyFishCall?.create === 'function') {
      await prisma.tinyFishCall.create({
        data: {
          endpoint,
          costClass,
          status,
          durationMs,
          sourceId,
        },
      });
    }
  } catch (error) {
    logger.warn('TinyFish call logging skipped', { error: error.message, endpoint, costClass });
  }
}

function getDailyBudget() {
  const now = Date.now();
  if (now > agentUsage.resetAt) {
    agentUsage.daily = 0;
    agentUsage.resetAt = now + 24 * 60 * 60 * 1000;
  }
  return agentUsage.daily;
}

function ensureAgentBudget() {
  const configuredCap = process.env.TINYFISH_AGENT_DAILY_CAP;
  const cap = Number.isFinite(Number(configuredCap)) ? Number(configuredCap) : 5;
  if (cap <= 0) return;

  if (getDailyBudget() >= cap) {
    throw new AgentBudgetExceeded(`TinyFish agent daily cap of ${cap} reached`);
  }

  agentUsage.daily += 1;
}

async function tinyfishRequest({
  url,
  method = 'GET',
  query = null,
  payload = null,
  headers = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
  endpointName = 'tinyfish',
  costClass = 'free',
  sourceId = null,
}) {
  await enforceRateLimit(url);

  const finalUrl = query ? `${url}${url.includes('?') ? '&' : '?'}${new URLSearchParams(query).toString()}` : url;
  const started = Date.now();

  let attempt = 0;
  while (attempt <= 2) {
    try {
      const response = await fetch(finalUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.TINYFISH_API_KEY || '',
          ...headers,
        },
        body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(payload ?? {}),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const text = await response.text();
      let jsonData = null;
      try {
        jsonData = text ? JSON.parse(text) : null;
      } catch {
        jsonData = { raw: text };
      }

      const durationMs = Date.now() - started;
      const status = response.ok ? 'SUCCESS' : 'ERROR';
      await persistTinyFishCall({ endpoint: endpointName, costClass, status, durationMs, sourceId });

      if (!response.ok) {
        const error = new Error(`TinyFish request failed (${response.status}): ${text || response.statusText}`);
        if (attempt < 2 && shouldRetry(error)) {
          attempt += 1;
          await sleep(250 * attempt);
          continue;
        }
        throw error;
      }

      return jsonData;
    } catch (error) {
      const durationMs = Date.now() - started;
      await persistTinyFishCall({ endpoint: endpointName, costClass, status: 'ERROR', durationMs, sourceId });

      if (attempt < 2 && shouldRetry(error)) {
        attempt += 1;
        await sleep(250 * attempt);
        continue;
      }

      logger.warn('TinyFish request failed', { endpoint: endpointName, error: error.message });
      throw error;
    }
  }

  throw new Error(`TinyFish request failed for ${endpointName}`);
}

export async function search(query, opts = {}) {
  const { location, language, recency_minutes, after_date, before_date, domain_type } = opts;
  const params = {
    query,
    ...(location ? { location } : {}),
    ...(language ? { language } : {}),
    ...(recency_minutes ? { recency_minutes } : {}),
    ...(after_date ? { after_date } : {}),
    ...(before_date ? { before_date } : {}),
    ...(domain_type ? { domain_type } : {}),
  };

  return tinyfishRequest({
    url: 'https://api.search.tinyfish.ai',
    query: params,
    timeoutMs: 10 * SECOND,
    endpointName: 'search',
    costClass: 'free',
  });
}

export async function fetchPages(urls, options = {}) {
  const urlList = Array.isArray(urls) ? urls : [urls];
  const normalizedUrls = urlList.filter(Boolean);

  const results = await Promise.all(
    normalizedUrls.map(async (url) => {
      const response = await tinyfishRequest({
        url: 'https://api.fetch.tinyfish.ai',
        method: 'POST',
        payload: { urls: [url], ttl: options.ttl ?? 0 },
        timeoutMs: 150 * SECOND,
        endpointName: 'fetch',
        costClass: 'free',
        sourceId: options.sourceId || null,
      });

      const item = response?.results?.[0] || response?.[0] || response || {};
      const content = item?.content || item?.text || item?.body || item?.html || '';
      const metadata = item?.metadata || {};
      return {
        url,
        text: content,
        metadata,
        ...item,
      };
    })
  );

  return results;
}

export async function runAgent({ url, goal, sourceId = null, ...options }) {
  ensureAgentBudget();
  const result = await tinyfishRequest({
    url: 'https://agent.tinyfish.ai/v1/automation/run',
    method: 'POST',
    payload: {
      url,
      goal,
      ...options,
    },
    timeoutMs: 120 * SECOND,
    endpointName: 'agent',
    costClass: 'agent',
    sourceId,
  });

  return result;
}

export function withBlockCheck(result, fallbackText = '') {
  const target = result?.result ?? result?.data ?? result ?? {};
  const rawText = typeof target === 'string' ? target : JSON.stringify(target);
  const textToSearch = `${fallbackText} ${rawText}`.toLowerCase();

  const blockedPatterns = [
    'captcha',
    'access denied',
    'blocked',
    'error page',
    'please verify you are human',
    'request denied',
  ];

  const blocked = blockedPatterns.some((pattern) => textToSearch.includes(pattern));
  return {
    ...(typeof target === 'object' && target ? target : { text: rawText }),
    blocked,
    text: typeof target === 'object' && target?.text ? target.text : fallbackText || rawText,
  };
}

export function sanitizeTinyfishError(error) {
  return error?.message || 'TinyFish processing failed';
}

export default {
  search,
  fetchPages,
  runAgent,
  withBlockCheck,
  AgentBudgetExceeded,
};
