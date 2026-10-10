import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { discoverSchemes } from './discover.ts';
import { draftFromCandidate, type AgentCallBudget } from './draftExtract.ts';
import type { DraftScheme, SchemeCandidate } from './draftSchema.ts';
import type { GroqClient } from '../groqPlaceholder.ts';
import type { TinyFishClient } from './tinyfishPlaceholder.ts';

type Sleep = (milliseconds: number) => Promise<void>;

export type RunDiscoveryOptions = {
  dailyAgentCap: number;
  sleep?: Sleep;
  now?: () => number;
  persist?: boolean;
};

export type DiscoveryReport = {
  candidates: SchemeCandidate[];
  drafts: DraftScheme[];
  costs: { tinyfishAgentCalls: number };
};

const draftsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'drafts',
);

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function pacedClient(
  client: TinyFishClient,
  sleep: Sleep,
  now: () => number,
): TinyFishClient {
  const lastRequestByDomain = new Map<string, number>();
  const waitForDomain = async (url: string): Promise<void> => {
    const domain = new URL(url).hostname.toLowerCase();
    const lastStartedAt = lastRequestByDomain.get(domain);
    if (lastStartedAt !== undefined) {
      const waitMs = Math.max(0, 1000 - (now() - lastStartedAt));
      if (waitMs > 0) await sleep(waitMs);
    }
    lastRequestByDomain.set(domain, now());
  };

  return {
    search: (query, options) => client.search(query, options),
    async fetchPages(urls, options) {
      for (const url of urls) await waitForDomain(url);
      return client.fetchPages(urls, options);
    },
    async runAgent(input) {
      await waitForDomain(input.url);
      return client.runAgent(input);
    },
  };
}

export async function runDiscovery(
  query: string,
  client: TinyFishClient,
  groq?: GroqClient,
  options: RunDiscoveryOptions = { dailyAgentCap: 0 },
): Promise<DiscoveryReport> {
  const now = options.now ?? Date.now;
  const paced = pacedClient(client, options.sleep ?? defaultSleep, now);
  const candidates = await discoverSchemes(query, paced, () => new Date(now()));
  const budget: AgentCallBudget = {
    dailyCap: Math.max(0, Math.floor(options.dailyAgentCap)),
    callsUsed: 0,
  };
  const drafts: DraftScheme[] = [];

  for (const candidate of candidates) {
    try {
      const draft = await draftFromCandidate(candidate, paced, groq, budget, () => new Date(now()));
      if (draft) drafts.push(draft);
    } catch {
      continue;
    }
  }

  if (options.persist !== false && drafts.length > 0) {
    await mkdir(draftsDirectory, { recursive: true });
    for (const draft of drafts) {
      const target = path.resolve(draftsDirectory, `${draft.id}.json`);
      if (path.dirname(target) !== draftsDirectory) throw new Error('Draft path escaped SCOUT drafts directory.');
      await writeFile(target, `${JSON.stringify(draft, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    }
  }

  return {
    candidates,
    drafts,
    costs: { tinyfishAgentCalls: budget.callsUsed },
  };
}

export async function runDiscoveryCli(
  query: string,
  client?: TinyFishClient,
  groq?: GroqClient,
  options: RunDiscoveryOptions = { dailyAgentCap: 0 },
): Promise<DiscoveryReport | undefined> {
  if (!client) {
    console.error('No TinyFish client is configured. Inject a TinyFishClient into runDiscovery().');
    return undefined;
  }
  if (!query.trim()) {
    console.error('Provide a query, for example: MSME scheme Uttar Pradesh 2026.');
    return undefined;
  }

  const report = await runDiscovery(query, client, groq, options);
  console.log(`Candidates: ${report.candidates.length}`);
  console.log(`Drafts written: ${report.drafts.length}`);
  console.log(`TinyFish agent calls: ${report.costs.tinyfishAgentCalls}`);
  console.log(`Draft directory: ${draftsDirectory}`);
  return report;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url) {
  void runDiscoveryCli(process.argv.slice(2).join(' ')).then((report) => {
    if (!report) process.exitCode = 1;
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown discovery failure.';
    console.error(`SCOUT discovery failed: ${message}`);
    process.exitCode = 1;
  });
}