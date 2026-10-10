# SCOUT Agent Context

## 1. Purpose

SCOUT matches the merged `BusinessProfile` supplied as `AgentInput.profile` against loaded scheme records. The matching engine is deterministic, pure code; the LLM only explains computed matches. SCOUT does not merge profiles, write profile fields, or return `profilePatch`.

## 2. Folder Map

- `complyos-backend-express/src/agents/scout/README.md`: integration notes for the backend lead.
- `complyos-backend-express/src/agents/scout/contractsPlaceholder.ts`: local graph-agent contract types and output validation schema.
- `complyos-backend-express/src/agents/scout/entry.ts`: graph-facing real/mock selector.
- `complyos-backend-express/src/agents/scout/groqPlaceholder.ts`: injectable Groq interface.
- `complyos-backend-express/src/agents/scout/index.ts`: real runner export.
- `complyos-backend-express/src/agents/scout/loadSchemes.ts`: JSON scheme loader and validation.
- `complyos-backend-express/src/agents/scout/loadSchemes.test.ts`: loader test.
- `complyos-backend-express/src/agents/scout/mock.ts`: fixture-backed mock runner.
- `complyos-backend-express/src/agents/scout/runner.ts`: real run orchestration.
- `complyos-backend-express/src/agents/scout/run.test.ts`: entry, mock, and runner tests.
- `complyos-backend-express/src/agents/scout/schemas.ts`: profile, scheme, match, explanation, verification, and evaluation types/schemas.
- `complyos-backend-express/src/agents/scout/drafts/`: runtime destination for draft JSON; currently empty; not loaded by `loadSchemes`.
- `complyos-backend-express/src/agents/scout/engine/buildMessages.ts`: localized list message builder.
- `complyos-backend-express/src/agents/scout/engine/explain.ts`: injected LLM explanation with validation, retries, cache, and fallback.
- `complyos-backend-express/src/agents/scout/engine/explain.test.ts`: explanation tests.
- `complyos-backend-express/src/agents/scout/engine/explainCheck.ts`: pure explanation validator.
- `complyos-backend-express/src/agents/scout/engine/feedback.test.ts`: ARIA feedback and teaser tests.
- `complyos-backend-express/src/agents/scout/engine/match.test.ts`: deterministic matcher tests.
- `complyos-backend-express/src/agents/scout/engine/match.ts`: pure eligibility evaluation and sorting.
- `complyos-backend-express/src/agents/scout/engine/missingFields.ts`: missing-field priority ranking.
- `complyos-backend-express/src/agents/scout/engine/teaser.ts`: core field list and teaser builder.
- `complyos-backend-express/src/agents/scout/engine/templateExplain.ts`: code-only explanation fallback.
- `complyos-backend-express/src/agents/scout/eval/`: labeled-set evaluator and CLI.
- `complyos-backend-express/src/agents/scout/eval/cli.ts`: loads profiles, labels, and selected scheme source.
- `complyos-backend-express/src/agents/scout/eval/runEval.ts`: pure metrics and report formatter.
- `complyos-backend-express/src/agents/scout/eval/runEval.test.ts`: evaluator tests and fixture schema checks.
- `complyos-backend-express/src/agents/scout/eval/data/`: synthetic evaluation data.
- `complyos-backend-express/src/agents/scout/eval/data/labels.json`: 50 null expected labels with an owner note.
- `complyos-backend-express/src/agents/scout/eval/data/profiles.json`: 10 synthetic profiles.
- `complyos-backend-express/src/agents/scout/eval/data/test-schemes.json`: five synthetic `test-` schemes using `.invalid` URLs.
- `complyos-backend-express/src/agents/scout/fixtures/`: in-memory mock fixtures.
- `complyos-backend-express/src/agents/scout/fixtures/index.ts`: three profiles and expected mock outputs.
- `complyos-backend-express/src/agents/scout/prompts/`: LLM prompt builders.
- `complyos-backend-express/src/agents/scout/prompts/explain.ts`: explanation system prompt and input builder.
- `complyos-backend-express/src/agents/scout/schemes/`: records read by `loadSchemes`.
- `complyos-backend-express/src/agents/scout/schemes/odop-up.json`: unverified placeholder record.
- `complyos-backend-express/src/agents/scout/schemes/up-cm-yuva.json`: unverified placeholder record.
- `complyos-backend-express/src/agents/scout/schemes/up-msme-policy-2022.json`: unverified placeholder record.
- `complyos-backend-express/src/agents/scout/verify/`: source verification, discovery, and draft extraction.
- `complyos-backend-express/src/agents/scout/verify/computeBaseline.ts`: injected-client baseline hash CLI/function.
- `complyos-backend-express/src/agents/scout/verify/discover.ts`: official-domain candidate discovery.
- `complyos-backend-express/src/agents/scout/verify/discovery.test.ts`: fake-client discovery/draft tests.
- `complyos-backend-express/src/agents/scout/verify/draftExtract.ts`: evidence-gated draft extraction and criteria mapping.
- `complyos-backend-express/src/agents/scout/verify/draftSchema.ts`: candidate and draft Zod schemas.
- `complyos-backend-express/src/agents/scout/verify/hash.ts`: normalized-text SHA-256 helper.
- `complyos-backend-express/src/agents/scout/verify/normalize.ts`: deterministic HTML/text normalization.
- `complyos-backend-express/src/agents/scout/verify/runDiscovery.ts`: discovery/draft orchestration and draft-only writes.
- `complyos-backend-express/src/agents/scout/verify/runVerify.ts`: sequential batch freshness verification and rate limiting.
- `complyos-backend-express/src/agents/scout/verify/tinyfishPlaceholder.ts`: injected TinyFish interfaces and block check.
- `complyos-backend-express/src/agents/scout/verify/verify.test.ts`: verification tests.
- `complyos-backend-express/src/agents/scout/verify/verifyScheme.ts`: per-record freshness comparison.

## 3. Entry Points And Events

The integration import is `complyos-backend-express/src/agents/scout/entry.ts`, exporting `run(input: AgentInput): Promise<AgentOutput>`. `SCOUT_REAL === 'true'` selects `index.ts`; every other value selects `mock.ts`. The mock returns the fixture selected by `profile.fixtureId`, defaults to the empty fixture, and does not inspect the event.

The real runner checks `input.event.type` for exactly:

- `SCHEME_REQUEST`: full displayed match list, unless fewer than four core profile fields are known; then a `NEEDS_INPUT` prompt.
- `TEASER`: teaser text only when the core-field threshold is met and at least one displayable match exists; no LLM call.
- `REFRESH`: recomputes matches and returns the full displayed list, subject to the same core-field threshold.
- Other strings: `OK`, no messages, one trace.

The graph integration and graph-to-SCOUT event mapping are not present here. `GraphEvent.type` is generic; the caller must send the exact strings above.

## 4. Data Models

`SchemeRecord` fields: `id`, `name.en`, `name.hi`, `level`, `state`, `benefit`, `criteria`, `priority`, `applyUrl`, `sourceUrl`, `retrievedOn`, `checkedBy`, `sourceHash`, `status`.

`SchemeMatch` fields: `schemeId`, `name`, `result`, `metCount`, `totalCount`, `missingFields`, `benefit`, `applyUrl`, `sourceUrl`, `lastVerified`, `stale`, `basedOn`, `priority`, optional `note`. Result values are `likely_eligible` and `possible`; `basedOn` values are `self_reported`, `verified`, `mixed`, `none`.

`DraftScheme` fields: `id`, `name.en`, `name.hi`, `level`, `state`, `benefit`, `criteria`, `priority`, `applyUrl`, `sourceUrl`, `retrievedOn`, `checkedBy`, `sourceHash`, `status`, `draft`, `unmappedConditions`, `evidence`, `costs.tinyfishAgentCalls`. Draft name/level/state/benefit/apply URL fields may be null when evidence is absent. Draft status is stale, `draft` is true, and `checkedBy` is null.

## 5. Non-Negotiable Rules

- Eligibility, criteria, and match counts come from code, never the LLM.
- Unknown criteria produce `possible`; do not describe such a match as eligible.
- Empty, missing, or `TODO(owner)` source URLs or verification dates are filtered from user-facing output.
- Every shown-scheme claim carries `sourceUrl` and `lastVerified`.
- Drafts are not loaded from `drafts/` or shown to users. A human must review a draft, set `checkedBy`, and move an approved record into `schemes/`.
- TinyFish extraction and LLM criteria mapping produce draft material only; no automatic activation or filing occurs.
- The LLM explanation validator rejects unsupported numbers and unsupported “eligible” claims for possible results. Ground-truth match counts are code-built.

## 6. Freshness And Discovery

`runVerify(schemes, client)` checks schemes sequentially, spaces same-domain requests by one second, and returns `results`, `reviewItems`, `updatedSchemes`, `degradedCount`, and `checkedAt`. A changed hash returns a copy with only `status: 'stale'` changed plus a review item. It does not write to storage. No weekly scheduler is implemented.

`computeBaseline(schemeId, client?)` uses the same normalizer/hash as verification. Its direct CLI currently has no configured TinyFish client and reports that; inject a client to fetch. `runDiscovery(query, client, groq?, options)` searches official domains, fetches pages first, and uses `runAgent` only when the fetch is unreadable and the daily cap allows it. It returns `candidates`, `drafts`, `costs.tinyfishAgentCalls`; by default it writes JSON only under `drafts/`. It never edits `schemes/`. `options.dailyAgentCap` defaults to zero. Same-domain fetch/agent calls are rate-limited with injectable sleep. Discovery itself has no scheduled job.

## 7. Injected Clients And Placeholders

The local `GroqClient` in `groqPlaceholder.ts` exposes `json<T>(schema, prompt, input): Promise<T>` and optional `getLastTokenCount()`. Replace it with the backend-owned `src/services/groq.ts` wrapper. The exported real runner does not currently receive a Groq client, so its current path uses template fallback.

The local `TinyFishClient` in `verify/tinyfishPlaceholder.ts` exposes `fetchPages(urls, { ttl })`, `search(query, { domain_type?, recency_minutes? })`, and `runAgent({ url, goal })`. Replace it with the backend-owned `src/services/tinyfish.ts` wrapper. No service or SDK is called directly from SCOUT.

Replace local contracts when `src/contracts` exists: `ProfileFieldKey`, `ProfileField`, and `BusinessProfile` in `schemas.ts`; `AgentStatus`, `GraphEvent`, `AgentInput`, `AgentOutput`, `Claim`, `TraceEvent`, and `OutboundMessage` in `contractsPlaceholder.ts`; and `CORE_PROFILE_FIELDS` in `engine/teaser.ts` with the shared constant.

## 8. How To Run

From `complyos-backend-express`:

```sh
node --test src/agents/scout/loadSchemes.test.ts src/agents/scout/engine/match.test.ts src/agents/scout/engine/feedback.test.ts src/agents/scout/engine/explain.test.ts src/agents/scout/run.test.ts src/agents/scout/verify/verify.test.ts src/agents/scout/verify/discovery.test.ts src/agents/scout/eval/runEval.test.ts
node src/agents/scout/eval/cli.ts --schemes=fixtures
node src/agents/scout/eval/cli.ts --schemes=real
```

All 50 current fixture labels are null. The eval CLI prints `NOT MEASURED: no labels provided` and exits non-zero; fixtures measure engine logic only. The TinyFish baseline and discovery CLIs have no real clients configured in this checkout; invoke their exported functions with injected clients.

## 9. Current State And TODO(owner)

Implemented: deterministic matching, missing-field ranking, teaser, explanation validation/fallback, fake-client freshness verification, official-domain discovery, evidence-gated draft extraction, draft-only persistence, mock/fixtures, and eval harness. Mocked/unwired: Groq and TinyFish services are placeholders; graph integration and scheduled jobs are absent. Unverified: every current record in `schemes/` has placeholder fields, and evaluation labels are not provided.

Open TODO(owner) items from source/data:

- Replace local contracts/profile types and the local core-field list with shared contracts.
- Confirm empty-criteria behavior; matcher currently returns `possible` with a note.
- Replace and wire the Groq placeholder into the real runner.
- Replace the TinyFish placeholder with `src/services/tinyfish.ts`.
- Verify the fields in `up-cm-yuva`, `odop-up`, and `up-msme-policy-2022`.
- Supply hand-verified eval labels; do not claim measured metrics while labels are null.
- Resolve fixture profile `TODO(owner)` fields only when supplying real synthetic values.

## 10. Safe Changes

- Add a real scheme only in `schemes/`, after verifying its fields and sources; do not promote a `drafts/` JSON directly without human review and `checkedBy`.
- To add a criterion operator, update `CriterionSchema` in `schemas.ts`, the deterministic operator evaluation in `engine/match.ts`, draft criteria validation/mapping in `verify/draftExtract.ts`, and their tests.
- To add a language, update `TeaserLanguage` and its relevant code templates in `engine/teaser.ts`, `engine/buildMessages.ts`, and `engine/templateExplain.ts`; also update prompts/tests as needed.
- To add an outbound-message field, update `OutboundMessage` and its Zod schema in `contractsPlaceholder.ts`, then `engine/buildMessages.ts` and output tests.
- Run the focused SCOUT tests above; never put LLM-derived criteria or unverified facts directly into live `schemes/` records.
