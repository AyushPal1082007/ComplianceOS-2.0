# SENTINEL agent

SENTINEL watches official regulatory sources, normalizes the latest text, diffs it against the last snapshot, classifies the update, matches it against active BusinessProfile records, and only emits an alert if the change has been reviewed and the source is valid.

## Core rules
- Code decides who receives alerts; the LLM only summarizes text.
- Every alert must include a `sourceUrl` and `lastVerified` timestamp.
- Confidence under 0.80 or a missing quote triggers `NEEDS_REVIEW` and blocks delivery.
- Simulated sources are labeled in backend alert generation.
- Placeholder URLs starting with `TODO` are skipped with a warning.

## Runtime
- `src/agents/sentinel/index.js` exports `run()` and `runSentinelCrawl()`.
- `src/services/tinyfish.js` is the adapter used by the agent.
- `src/agents/sentinel/sources.json` stores the configured sources.

## Testing
This repo runs a focused verification in Node using the JS modules directly.
