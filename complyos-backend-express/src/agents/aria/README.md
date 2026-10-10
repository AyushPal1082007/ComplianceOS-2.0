# ARIA per-turn intake agent

ARIA is a JavaScript ESM per-turn profile intake module. It does not import LangGraph, access Prisma, or modify the legacy `src/agents/aria.js` call sites. The parent wrapper is `src/graph/nodes/aria.node.js`; its caller owns persistence and checkpointing.

## Run offline

```powershell
$env:ARIA_REAL='false'
node --input-type=module -e "import('./src/agents/aria/index.js').then(async ({run}) => console.log(await run({runId:'demo',userId:'demo',event:{type:'START'},profile:{},locale:'hinglish'})))"
```

Tap events are deterministic. Text/voice extraction in mock mode uses supplied `event.mockUpdates` or fixture cases. Sarvam defaults to mock mode unless `SARVAM_MOCK=false`. Real Sarvam calls intentionally fail closed until the endpoint, authentication, audio formats and language codes are verified.

## Tests and evaluations

Run tests from `complyos-backend-express`:

```powershell
node --test src/agents/aria/__tests__/*.test.js
node src/agents/aria/eval/zero-llm-on-tap.js
node src/agents/aria/eval/turns-to-complete.js
node src/agents/aria/eval/slot-accuracy.js
node src/agents/aria/eval/wer.js
```

`slot-accuracy.js` requires `ARIA_REAL=true` and `GROQ_API_KEY`; it prints measured precision/recall and writes `eval/results.json`. WER skips when there is no audio corpus under `fixtures/audio/`. Evaluation outputs are generated locally and should not be treated as production metrics unless run against labeled fixtures and the configured speech service.

## Add a question

Add a `QuestionDef` to `questionBank/questions.json` with nonempty Hindi, English and Hinglish text, why text, and labels. Include an `unsure` option with a unique id. Keep sensitive fields optional and late in the bank. Set `reviewStatus` to `NEEDS_NATIVE_REVIEW` until a native speaker reviews the Hindi wording. Run the bank tests after edits. `WA_LIMITS` is centralized in `config.js`; WhatsApp limits remain marked for verification.

## Add a profile field

A new field requires a contract update in `src/contracts/aria.js`, an explicit profile rule in `engine/profileRules.js`, question bank and selection/completeness changes where applicable, and extraction schema/prompt changes if free-text extraction is supported. Keep provenance, verbatim quote verification and the `VERIFIED` merge guard. Coordinate cross-agent BusinessProfile changes through a contract PR.

## Human verification and TODOs

- `TODO(verify)`: confirm WhatsApp interactive button/list limits.
- `TODO(verify)`: verify Sarvam API endpoint, authentication, accepted audio formats, language codes, pricing, and TTS behavior.
- `TODO(verify)`: confirm WAV 16 kHz mono is Sarvam's required audio format.
- `TODO(owner)`: integrate authenticated WhatsApp media-id retrieval in the media service.
- `TODO(owner)`: validate turnover-band boundary policy with Research; current implementation uses `<20L`, `[20L,40L)`, `[40L,1.5Cr)`, `[1.5Cr,5Cr]`, and `>5Cr`.
- `NEEDS_NATIVE_REVIEW`: Hindi bank text requires review by a fluent Hindi speaker.
- Groq model is read from `GROQ_MODEL` (through central config fallback); do not assume the existing fallback model is current.
