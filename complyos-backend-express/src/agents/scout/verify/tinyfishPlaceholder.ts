// TODO(owner): replace with src/services/tinyfish.ts (leader owns it).
export type FetchResult = {
  status: string;
  content: string;
  url?: string;
};

export type SearchResult = {
  url: string;
  title: string;
  snippet: string;
};

export type AgentResult = FetchResult & {
  pageText?: string;
};

export interface TinyFishClient {
  fetchPages(urls: string[], opts: { ttl: number }): Promise<FetchResult[]>;
  search(
    query: string,
    opts: { domain_type?: string; recency_minutes?: number },
  ): Promise<SearchResult[]>;
  runAgent(input: { url: string; goal: string }): Promise<AgentResult>;
}

export type BlockCheck =
  | { ok: true; content: string }
  | { ok: false; reason: string };

export function withBlockCheck(result: FetchResult): BlockCheck {
  const status = result.status.trim().toLowerCase();
  if (status !== 'completed' && status !== 'ok') {
    return { ok: false, reason: `Fetch status was ${result.status || 'empty'}.` };
  }

  const content = result.content ?? '';
  if (/captcha|blocked|access denied/i.test(content)) {
    return { ok: false, reason: 'Fetched page indicates a block or access challenge.' };
  }
  if (content.trim().length < 20) {
    return { ok: false, reason: 'Fetched page content is empty or too short.' };
  }

  return { ok: true, content };
}