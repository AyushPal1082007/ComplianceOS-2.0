# Agent Integration Audit (Phase 0)

Read-only reconnaissance completed 2026-10-10 before implementation. No application code, agent code, schemas, source data, or tests were changed during Phase 0. Baseline tests used local fixtures and did not contact external services.

## Runtime and existing wiring

- `package.json`: ES modules (`"type": "module"`), Node `>=24`; scripts include `start`, `dev`, `prisma:generate`, `sentinel:run`, `test`, `test:aria`, and ARIA eval commands. Runtime dependencies include `@langchain/core`, `@langchain/langgraph`, `zod`, `bullmq`, and `ioredis`; `tsx` and `vitest` are not declared. SCOUT is TypeScript and the project’s Node engine floor is intended to run its `.ts` files natively.
- `npm test` runs `node tests/testSuite.js` and then `src/agents/sentinel/__tests__/sentinel.test.js`. `test:aria` runs Node's built-in test runner against ARIA's `*.test.js`.
- `src/app.js` mounts the existing auth, business, document, compliance, scheme, sentinel, CA, notification, payment, admin, agent-trace, and WhatsApp webhook routers. It applies Helmet, CORS, global and document rate limits, and JSON/urlencoded request parsing. There is no chat route or shared event orchestrator.
- `src/server.js` connects Prisma, starts the SENTINEL and deadline reminder jobs, then listens. It statically imports `jobs/sentinelCrawler.js`, which currently uses CommonJS `require`/`module.exports` despite the ESM package type; this is a startup compatibility blocker unless changed or wrapped.
- `src/config.js` loads dotenv and provides the current app/integration configuration. `src/db.js` exports a singleton `PrismaClient`; development query logging includes SQL query text.
- `src/middleware/auth.js` exports `authenticate`, `requireCA`, and `requireAdmin`; `authenticate` verifies the bearer JWT and reloads the active user.
- Existing Prisma profile data is flat: `BusinessProfile` has scalar columns and no field-level provenance. `gstin` is unique; `SchemeMatch.businessId` references `BusinessProfile.id`; `User.email` and `User.passwordHash` are required.

## Agent public APIs and payloads

### ARIA

- Entry: `src/agents/aria/index.js` exports `run(input = {}, options = {})`, `AgentInputSchema`, `AgentOutputSchema`, and `runTurn`; default export is `{ run }`. Live mode is selected only when `ARIA_REAL === 'true'` and mock mode is not requested.
- `src/agents/aria/engine/runTurn.js` exports `runTurn(input = {}, options = {})`. Supported event forms include `START`, `TEXT` with `text`, `OPTION_TAP` with `questionId` and `optionId`, and `VOICE`.
- Voice ingestion in `engine/ingest.js` takes `audioRef` or `mediaId`, optional `mime` (default `audio/ogg`), `language` (default `hi`), or `fixtureId`; it fetches/converts audio to 16 kHz mono WAV and transcribes it. Low/empty confidence returns `NEEDS_INPUT`.
- `engine/render.js` uses a question ID as a card/list ID and bank option IDs as action IDs. `config.js` defines `WA_LIMITS.replyButtons = 3` and `listRows = 10`; the limits are marked TODO(verify). Reveal cards use ID `aria-reveal` and actions `continue`, `finish`, `edit`.
- Session phases are `welcome`, `asking`, `reveal`, `editing`, `extended`, and `done`. `run()` returns status, messages, claims, trace, costs, session, profilePatch, and optional escalation. `contracts/aria.js` constrains the trace agent to literal `ARIA`.
- `engine/applyUpdates.js` validates updates and protects `VERIFIED` values; conflicting ARIA updates preserve the prior verified value and request confirmation. `completeness.js` counts `SELF_REPORTED` and `VERIFIED` fields.
- Parent node: `src/graph/nodes/aria.node.js` exports `ariaNode(state)`. It currently shallow-merges the profile patch and state profile, so it can bypass the agent-local verified-value guard; ARIA patches can also contain `completeness` and `preferredLanguage`.

### VEDA

- Entry: `src/agents/veda/index.js` exports `run(input = {}, options = {})` and `buildVedaGraph`. The graph runs intake → OCR → masking → classification → extraction → evidence check → validation → gate → confirmation → commit → response.
- Intake accepts `url`, `imageUrl`, or `fileUrl`, or supplied OCR text; the current API does not accept/process a `Buffer`. OCR receives URL/text state.
- A new run uses `runId` as LangGraph `thread_id`; resume requires that same ID. Resume events are `action: 'resume'` or `'CONFIRM_ACTION'`, with `payload` forwarded as LangGraph `Command.resume`.
- Confirmation actions use `confirm_<key>` and `edit_<key>` IDs; resume payloads carry `{ key, action: 'confirm'|'edit', value? }`. Unknown document type selection is also interruptible.
- `buildVedaGraph({ checkpointer } = {})` accepts a checkpointer; absent one, `run()` uses an in-memory `MemorySaver`. `src/graph/nodes/veda.node.js` reads a parent `state.checkpointer`, which is not set in the parent graph and should not be state-serialized. The VEDA graph cache does not reliably retain a default compiled graph; pending interrupts do not survive process restart with the memory saver.
- `mergeProfileFields(existingProfile = {}, mappedDocFields = {}, context = {})` returns `{ patch, conflicts }`. `commitDocumentResults({...})` returns profile patch, calendar items, claims, messages, penalty, and health score; these are outputs, not database persistence.
- Other exports: `mapDocFieldsToProfile(docType, gatedFields)`, `buildConfirmCard(pending = [], locale = 'hinglish')`, `buildAskDocTypeCard(locale = 'hinglish')`, `applyUserAction(actionPayload, pendingList = [])`, `maskAadhaar(text)`, `maskSensitiveTokens(text)`, and `getTextMessage(key, locale = 'hinglish', arg)`.
- Stubs exist at `stubs/contracts.stub.js`, `stubs/groq.stub.js`, and `stubs/rules.stub.js`. `VEDA_CONTRACT_REQUESTS.md` identifies shared-contract/Groq/rules integration and persistent-thread concerns; it also warns against replacing the existing document route before the input/persistence adapter is agreed.
- VEDA's tests cover contracts, evidence, confidence gate, graph interrupt/resume, handoff, masking, merge, mock mode, pipeline, and validators.

### SCOUT

- TypeScript entry: `src/agents/scout/index.ts` re-exports `run`; `entry.ts` exports `selectScoutRunner(realFlag, realRunner?, mockRunner?)` and `run`. `SCOUT_REAL === 'true'` selects real mode; otherwise mock.
- `run(input)` expects `{ runId, userId, event: { type, ... }, profile, locale }`. The output contract is `{ status, messages, claims, trace, costs }`; messages are `text` or `list`. Recognized events are `SCHEME_REQUEST`, `TEASER`, and `REFRESH`; unsupported event types currently return an empty successful result.
- The runner loads scheme JSON files from the agent's own `schemes/` directory, deterministically matches criteria, and returns `NEEDS_INPUT` when fewer than four core fields are known. It builds list messages and explanations for at most three displayed matches. Its default runner has no Groq client injected, so it uses fallback explanations.
- `schemas.ts` defines profile, criterion, scheme, and match validation; match labels are `likely_eligible` or `possible`. `engine/match.ts` is deterministic; unknown criteria remain possible. `buildTeaser()` returns `{ show, text?, count }`; `buildMessages()` builds list messages; `rankMissingFields()` returns prioritized missing fields and scheme IDs.
- `contractsPlaceholder.ts`, `groqPlaceholder.ts`, and `verify/tinyfishPlaceholder.ts` are local placeholders/interfaces, not shared adapters. Discovery and freshness code use injected clients; generated draft JSON is stored under `drafts/`, separate from verified scheme records.
- The agent's verified `schemes/*.json` data coexists with the top-level `data/schemes.json` used to seed the database. The latter includes legacy entries whose verification/source metadata requires audit before public exposure.

### SENTINEL

- Entry: `src/agents/sentinel/index.js` exports `run(input = {})`, `injectSimulatedAlert(userId, options = {})`, and re-exports `buildAlert`, `runSentinelCrawl`, `runSingleSource`, and `loadSources`.
- `run()` accepts `input.source` (or uses a manual example source) and returns `{ status, messages, claims, trace, costs }`; its messages use `{ role, text }`, unlike the SCOUT message contract.
- Canonical pipeline: `pipeline.js` imports the root `normalize.js`, `diff.js`, `classify.js`, `matchProfiles.js`, and `buildAlert.js`. `runSingleSource(source)` returns statuses including `SKIPPED`, `BLOCKED`, `EMPTY`, `BASELINE_STORED`, `NO_CHANGE`, `NEEDS_REVIEW`, `ALERTED`, `NO_MATCH`, and `FAILED`; `runSentinelCrawl()` processes loaded sources serially.
- `loadSources()` skips URLs beginning with `TODO`. The pipeline performs fetch/block checks, normalization, hashing/diffing, classification, profile matching, alert construction, and snapshot persistence.
- **Confirmed break:** after a sufficiently confident content change, `pipeline.js` references `profiles` without defining/loading it before `matchProfiles(profiles || [], ...)`; this raises `ReferenceError` and is caught as `FAILED`. This is one of the clearly broken findings for a later implementation phase.
- Root `matchProfiles(profiles = [], filters = {})` filters by state, sector, GSTIN/Udyam flags, and turnover. Root `buildAlert({ user, source, change, profile, simulated = false })` requires a user ID, source URL, `lastVerified`, nonempty quote, confidence ≥0.80, and rejects `NEEDS_REVIEW`.
- `injectSimulatedAlert()` writes directly to `SentinelAlert`. The existing `RegulationAlert` schema is a separate per-change delivery ledger; it is not currently used by the pipeline.
- Nested `alerts/buildAlert.js`, `matcher/matchProfiles.js`, and `review/reviewQueue.js` are wrappers/re-exports of root implementations. Pipeline imports root files. `alerts/deliver.js`, `alerts/digest.js`, root `reviewQueue.js`, and the nested wrappers are not called by the pipeline; no deletion is proposed in Phase 0.
- README describes review behavior, but pipeline does not invoke a review queue; builder confidence/quote checks alone do not establish human review.

### PATHWAY

- `src/agents/pathway.js` is present and used by the existing schemes route. The requested project facts describe it as not yet built as an integrated subgraph; no shared orchestrator node exists.

## Integration conflicts confirmed

1. `contracts/aria.js` has an ARIA-only trace agent literal. There is no shared contract module; VEDA and SCOUT use their own contract stubs/placeholders.
2. Both parent graph nodes use shallow profile spreads; this can overwrite `VERIFIED` fields, and ARIA has non-field patch keys.
3. ARIA is real only for exact `ARIA_REAL === 'true'`; VEDA is currently real unless explicitly set to `'false'`; SCOUT is real only for exact `SCOUT_REAL === 'true'`.
4. VEDA resume depends on preserving the original `runId` thread; parent state obtains a checkpointer incorrectly; memory checkpoints are not restart-persistent.
5. SENTINEL API/message shape differs from a channel-neutral outbound contract; canonical root files coexist with nested wrappers/dead helpers. Pipeline also has the undefined `profiles` reference described above.
6. SCOUT uses TypeScript and separate local JSON data; placeholders remain for shared services/contracts. The top-level seeded `Scheme` database data can diverge from SCOUT's verified records.
7. The relational profile is flat and has no provenance/status per field. Turnover/employee bands have no matching columns; GSTIN uniqueness can reject duplicates; User requires email/password fields even for phone-first onboarding.
8. No shared event router/orchestrator, persisted conversation state, consent gate, delete flow, quotas, inbound idempotency, per-user lock, WhatsApp outbound renderer, SSE chat route, shared `rules/`, or consent policy module was found.
9. WhatsApp interactive replies provide the selected action ID; preserving card identity requires encoded IDs and stored outstanding-card ownership.
10. Legacy and nested agents/services are wired inconsistently; current routes continue to call legacy single-file agents.

## Routes, jobs, services, and data

- Routes preserve legacy frontend shapes and are mounted in `src/app.js`. `routes/whatsapp.js` verifies webhook GET and processes POST; current voice handling supplies a fake audio buffer, while inbound image/document handling acknowledges receipt rather than processing the file. `routes/documents.js` handles authenticated upload/list/detail/confirm/delete and uses legacy VEDA. `routes/schemes.js` exposes public scheme listing/detail and authenticated matching/pathway. `routes/sentinel.js` lists/updates alerts, simulates alerts, and crawls; source listing is public. Other audited routes: `agentTrace.js`, `business.js`, `compliance.js`, and `ca.js`.
- Existing ESM deadline job exports `startDeadlineReminderJob()` / `stopDeadlineReminderJob()`; `cronJobs.js` exports `checkDailyDeadlines`, `startBackgroundJobs`, and `stopBackgroundJobs`. The server starts the BullMQ deadline wrapper and SENTINEL job, not the cron interval starters.
- Service exports/signatures inspected:
  - Groq: `json(schema, systemPrompt, userInput, options = {})`, `text(...)`, `clearCache()`.
  - TinyFish: `search(query, opts = {})`, `fetchPages(urls, options = {})`, `runAgent({ url, goal, sourceId = null, ...options })`, plus block/error helpers.
  - WhatsApp: text/button/list/template and media operations in `whatsappService.js`.
  - Cloudinary: upload and delete helpers in `cloudinaryService.js`.
  - Vision: OCR from URL/buffer; media: download/convert helpers (conversion invokes external `ffmpeg`).
  - Sarvam `sarvam.js`: `transcribe(buffer, mime, langHint = 'hi', options = {})`, `speak(...)`. `sarvamService.js` separately exports transcribe/synthesize/translate and is used by the business voice route. WhatsApp imports `bhashiniService.js`; that service is retained but its config is missing from `config.js`, so it falls through to demo/pass-through behavior.
  - Notifications: `sendNotification({ userId, title, body, channels = ['in_app'], metadata = {} })`.
- `utils/complianceCalculators.js` exports `gstLateFee({ annualTurnoverLakhs, isNilReturn, daysLate, returnCount = 1 })`, `calculateHealthScore(profile, deadlines = [])`, `calculatePenaltyAtRisk(profile, deadlines = [])`, and `getGSTDueDates(turnoverLakhs, year = currentYear)`. Existing source/citation and statutory assumptions require verification before reuse; Phase 0 does not change them.
- `trust/confidenceGate.js` exports `confidenceGate(confidence, validatorResults = [])` and `getConfidenceThreshold()`. `trust/validators/index.js` exports GSTIN, PAN, Udyam, date, amount, and state validators.
- `data/schemes.json` is the legacy seed source; `data/seed.js` seeds the database and includes a sample SENTINEL alert. At least one legacy scheme cites a third-party tax guidance URL while being labeled verified, so public exposure needs a verification decision.

## Legacy import map

| Caller(s) | Legacy module | Existing nested/replacement path |
| --- | --- | --- |
| `routes/business.js`, `routes/whatsapp.js`, jobs/admin callsites | `src/agents/aria.js` | `src/agents/aria/index.js` and `src/graph/nodes/aria.node.js` |
| `routes/documents.js` | `src/agents/veda.js` | `src/agents/veda/index.js`; route migration is blocked on file-input/persistence contract |
| `routes/schemes.js` | `src/agents/scout.js` | `src/agents/scout/index.ts` |
| `routes/sentinel.js`, `jobs/sentinelCrawler.js` | `src/agents/sentinel.js` | `src/agents/sentinel/index.js` |
| `routes/schemes.js` | `src/agents/pathway.js` | No nested replacement; retain legacy implementation |

Other active service wiring is mixed-generation: business voice uses `sarvamService`, WhatsApp uses BhashiniService, and nested ARIA/VEDA/SENTINEL modules use newer Groq/media/Sarvam/TinyFish/Vision integrations. Neither `bhashiniService.js` nor `sarvamService.js` should be deleted as part of integration.

## Baseline tests (before integration changes)

All baseline suites passed:

| Suite | Command | Result |
| --- | --- | --- |
| Shared backend + SENTINEL | `npm test` | Shared suite 9/9; SENTINEL module tests passed |
| ARIA | `npm run test:aria` | 32/32 |
| VEDA | `node --test src/agents/veda/__tests__/*.test.js` | 62/62 |
| SCOUT | `find src/agents/scout -type f -name '*.test.ts' -print0 \| xargs -0 node --test` | 68/68 |

The complete SCOUT command is recorded because the shell glob form omits top-level SCOUT test files. No integration tests exist yet. The tests are local fixture/mock tests; baseline pass does not certify live external integrations or runtime startup.

## Read-only phase decisions / open items

- Do not enable the current legacy scheme list as verified until each `sourceUrl` and `checkedBy` has been checked; filter out entries without those fields.
- Approved for subsequent implementation: phone-first accounts use a placeholder email and unusable password hash; deletion anonymizes the User row and retains ConsentLog plus subscription/payment records.
- Keep PATHWAY as a stub in the future orchestrator; do not create share links.
- Verify WhatsApp limits and template policy, VEDA checkpointer API/connection behavior, and native Node `.ts` runtime behavior on the deployment runtime.
- Existing VEDA behavior defaults to real mode unless `VEDA_REAL=false`; changing it to opt-in real mode requires an explicit compatibility decision.
- No integration implementation or migration has been performed in Phase 0.

## Stage A implementation note

After approval of this audit, Stage A added shared contracts and exact-`true` agent flags, deterministic rule wrappers, Prisma profile/conversation/consent/inbound/trace foundations, memory and Prisma repository implementations, and merge/projection policy. The unapplied additive migration is `prisma/migrations/20261010202000_agent_integration_foundations/migration.sql`; it only adds the new foundation tables, approved nullable columns, and missing phone index. It has not been applied to any database. The legacy schemes deactivation SQL is provided separately for review and is not included in the migration. It deactivates (never deletes) rows with absent/TODO verification metadata or non-government source hosts. Stage A added test scripts and memory/profile-policy tests. Validation completed: Prisma schema valid; ARIA 32/32, VEDA 62/62, SCOUT 68/68, Stage A integration 6/6, shared tests 9/9, and SENTINEL tests passed. No migration was applied.
