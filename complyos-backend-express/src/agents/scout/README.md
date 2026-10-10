# SCOUT Integration Notes

## 1. What SCOUT Does

SCOUT matching is deterministic code in `engine/match.ts`; eligibility is not decided by the LLM.
The LLM is used only to explain already-computed matches, and its text is checked before use.
SCOUT consumes `input.profile` as supplied by the caller; merging ARIA/VEDA fields is upstream and not implemented here.
SCOUT does not write or return profile fields.

## 2. Entry Point

From the Express backend package, import `src/agents/scout/entry.ts`:

```ts
import { run } from "./src/agents/scout/entry.ts";
// run(input: AgentInput): Promise<AgentOutput>
```

`entry.ts` selects the real runner only when `SCOUT_REAL === 'true'`; otherwise it selects `mock.ts`. The mock returns a static fixture output selected by `profile.fixtureId`, defaulting to the empty fixture. It does not read schemes or inspect the event. The real runner is exported by `index.ts`.

## 3. Events

The real runner reads the exact string at `input.event.type`:

- `SCHEME_REQUEST`: full match list, unless fewer than four core fields are known; then `NEEDS_INPUT` with a details prompt.
- `TEASER`: teaser text only when at least four core fields are known and the count is nonzero; otherwise the under-four-fields prompt or no message when there are no matches. It never calls the explanation client.
- `REFRESH`: re-runs matching and returns a full list, subject to the same input threshold.
- Any other value: `OK`, no messages, and one trace event.

The local `GraphEvent` is only `{ type: string; ... }`; it contains no graph event-name mapping. **TODO(owner):** map graph event names to `SCHEME_REQUEST`, `TEASER`, and `REFRESH`. The graph integration and those mappings are not implemented in this tree.

## 4. Output

The local `AgentOutput` shape is:

```ts
{
  status: 'OK' | 'NEEDS_INPUT' | 'NEEDS_CONFIRMATION' | 'DEGRADED' | 'FAILED';
  messages: OutboundMessage[];
  claims: Claim[];
  trace: TraceEvent[];
  costs: { llmTokens?: number; tinyfishAgentCalls?: number };
}
```

There is no `profilePatch`. `OK` means a recognized run completed or an event was ignored. `NEEDS_INPUT` is returned when fewer than four core profile fields have known, non-null values. `DEGRADED` means explanation retries failed and fallback text was used; messages are still delivered. Validator-only rejection uses fallback without degrading. `FAILED` is the caught exception path. `NEEDS_CONFIRMATION` is defined in the type/schema but is not currently emitted by the runner.

Claims carry `sourceUrl` and `lastVerified`. The type permits `code_rule`, `verified_db`, `document`, `llm_summary`, and `live_fetch`; the runner currently emits `code_rule` or `llm_summary`. Traces contain `runId`, `agent`, `node`, start time, duration, input/output summaries, status, and optional error. Recognized runs trace load, match, and message-build steps; ignored events and failures use one trace event. Costs currently report `llmTokens` and `tinyfishAgentCalls`; TinyFish calls from `run()` are zero.

## 5. Frontend Values

- Match results are `likely_eligible` and `possible`; a `possible` match is not eligible.
- `basedOn` is `self_reported`, `verified`, `mixed`, or `none`. `none` adds no self-report label.
- `stale: true` means show the `being re-verified` tag.
- Each list row includes the literal `X of Y criteria met` and its benefit text.
- A self-reported or mixed match is tagged `based on what you told us`.
- List disclaimers are currently: Hindi `यह जानकारी केवल समझने के लिए है, पेशेवर सलाह नहीं।`; English `This information is for understanding only, not professional advice.`; Hinglish `Yeh jaankari sirf samajhne ke liye hai, professional salaah nahi.`

## 6. ARIA Helpers

Import from `engine/missingFields.ts` and `engine/teaser.ts`:

```ts
rankMissingFields(matches: SchemeMatch[]): {
  field: ProfileFieldKey;
  score: number;
  schemeIds: string[];
}[]
buildTeaser(profile: BusinessProfile, matches: SchemeMatch[], lang: 'hi' | 'en' | 'hinglish'):
  { show: boolean; text?: string; count: number }
```

`rankMissingFields` ranks only possible matches, summing priorities for each missing field; it does not choose ARIA's next question. `buildTeaser` counts possible and likely matches and shows text only with at least four known core fields and a nonzero count. `CORE_PROFILE_FIELDS` is exported from `engine/teaser.ts`: state, sector, subSector, gstRegistered, turnoverBand, udyamRegistered, employeesBand, womenLed, ownerAgeBand, goal.

## 7. Jobs

The backend lead should schedule `runVerify(schemes, client)` weekly. No scheduler/job is implemented here. It returns `results`, `reviewItems`, `updatedSchemes`, `degradedCount`, and `checkedAt`; result states are `SKIPPED_CLOSED`, `SKIPPED_NO_SOURCE`, `DEGRADED`, `BASELINE_NEEDED`, `UNCHANGED`, and `CHANGED`. The lead must persist returned stale copies and queue `reviewItems` for human review; verification itself writes nothing and does not approve changes. Changed records are returned with only `status: 'stale'` changed.

Discovery and draft extraction are implemented through `runDiscovery(query, client, groq?, options)`. Its report contains `candidates`, `drafts`, and `costs.tinyfishAgentCalls`. It writes draft JSON only under `src/agents/scout/drafts/`; it never changes `schemes/`. `options.dailyAgentCap` limits TinyFish agent calls, and `options.persist: false` disables writes. There is no scheduled discovery job in this tree. Drafts are not loaded by `loadSchemes()` and are not shown to users; a human must review a draft and move an approved record into `schemes/` before it can be loaded.

## 8. Clients To Inject

No Groq or TinyFish service file exists in this checkout. The current local interfaces are:

```ts
interface GroqClient {
  json<T>(schema: ZodType<T>, prompt: string, input: unknown): Promise<T>;
  getLastTokenCount?(): number | undefined;
}

interface TinyFishClient {
  fetchPages(urls: string[], opts: { ttl: number }): Promise<FetchResult[]>;
  search(
    query: string,
    opts: { domain_type?: string; recency_minutes?: number },
  ): Promise<SearchResult[]>;
  runAgent(input: { url: string; goal: string }): Promise<AgentResult>;
}

type FetchResult = { status: string; content: string; url?: string };
type SearchResult = { url: string; title: string; snippet: string };
type AgentResult = FetchResult & { pageText?: string };
```

`GroqClient` is in `groqPlaceholder.ts`; `TinyFishClient` is in `verify/tinyfishPlaceholder.ts`. Replace them with the backend-lead-owned `src/services/groq.ts` and `src/services/tinyfish.ts` wrappers. The exported real `run` currently receives no Groq client, so it uses code-built explanation fallback until the runner is wired to that service. TinyFish verification and discovery require an injected client passed to `runVerify` or `runDiscovery`. The placeholder's `withBlockCheck` rejects non-`COMPLETED`/`ok` statuses, blocked/captcha/access-denied content, and empty or very short content.

## 9. Contract Placeholders

Replace local contract shapes when `src/contracts` exists:

- `src/agents/scout/schemas.ts`: `ProfileFieldKey`, `ProfileField`, and `BusinessProfile`.
- `src/agents/scout/contractsPlaceholder.ts`: `AgentStatus`, `GraphEvent`, `AgentInput`, `AgentOutput`, `Claim`, `TraceEvent`, and `OutboundMessage` (plus its local output Zod schema).
- `src/agents/scout/engine/teaser.ts`: `CORE_PROFILE_FIELDS` should use the shared contract constant.

Service placeholders are listed in section 8; the TinyFish block-check helper is currently local to `verify/tinyfishPlaceholder.ts`.

## 10. Environment

The only environment variable referenced by SCOUT code is `SCOUT_REAL`. No Groq or TinyFish environment variables are read here. The TinyFish agent cap is injected as `runDiscovery`'s `options.dailyAgentCap`; it is not read from an environment variable and defaults to zero.

## 11. Tests And Evaluation

Run from `complyos-backend-express`:

```sh
node --test src/agents/scout/loadSchemes.test.ts src/agents/scout/engine/match.test.ts src/agents/scout/engine/feedback.test.ts src/agents/scout/engine/explain.test.ts src/agents/scout/run.test.ts src/agents/scout/verify/verify.test.ts src/agents/scout/verify/discovery.test.ts src/agents/scout/eval/runEval.test.ts
node src/agents/scout/eval/cli.ts --schemes=fixtures
node src/agents/scout/eval/cli.ts --schemes=real
```

The CLI also accepts `--profiles=<path>` and `--labels=<path>`. Current evaluation is **not measured**: all 50 fixture labels are null. The fixture command prints the partial/unmeasured status and exits non-zero until labels are provided. Fixture results measure engine logic only.

## 12. Known TODO(owner) Items

Collected from SCOUT source comments and data markers:

- Replace local profile/field and agent contract types with `src/contracts` imports; use the shared core-field constant.
- Map graph event names to SCOUT's `SCHEME_REQUEST`, `TEASER`, and `REFRESH` strings; graph routing is upstream.
- Confirm how empty-criteria schemes should be handled; the matcher currently marks them possible with a note.
- Replace `GroqClient` placeholder and connect it to the real runner.
- Replace `TinyFishClient` placeholder with the backend-owned service wrapper, including `search()` and `runAgent()`.
- Hand-verify all fields for `up-cm-yuva`, `odop-up`, and `up-msme-policy-2022`; their names, criteria, benefits, URLs, dates, reviewer, and hashes are still placeholders.
- Supply hand-verified expected labels in `eval/data/labels.json`; do not treat the null labels as measured results.
- Fixture profile fields with `TODO(owner)` are intentionally unknown/test data, not verified profile facts.

## 13. Scheme Data Status

All three scheme JSON records currently contain TODO placeholders and are unverified. Replace them with real `checkedBy`, `sourceUrl`, and verified record data before use. The runner hides a match when `sourceUrl` or `retrievedOn` is empty or contains `TODO(owner)`; it does **not** currently validate `checkedBy` at runtime. Discovery output is draft-only: it is never loaded or shown to users until a human reviews it and moves an approved scheme into `schemes/`. Do not treat a record as verified based only on `status: 'stale'` or schema validation.
