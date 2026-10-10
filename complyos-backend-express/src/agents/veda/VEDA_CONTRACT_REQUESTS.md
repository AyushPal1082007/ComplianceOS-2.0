# VEDA Contract Requests & Dependency Gap Tracker

This document records architectural requests and gaps outside VEDA's ownership zone, per team coordination policy.

---

## 1. Central Groq Service Adapter (`src/services/groq.js`)
- **Current State**: Other agent files (`aria.js`, `sentinel.js`, `scout.js`) instantiate `new Groq(...)` directly. However, Rule 6 mandates that all external LLM/API calls route through `src/services/*`.
- **Request**: Please provide a shared `src/services/groq.js` providing rate-limited JSON completions and retries.
- **Temporary Resolution**: VEDA uses `src/agents/veda/stubs/groq.stub.js` with exponential backoff and JSON repair retries.

---

## 2. Central Contracts Repository (`src/contracts/index.js`)
- **Current State**: `src/contracts` directory is absent.
- **Request**: Create shared contracts barrel exporting canonical Zod schemas for:
  - `AgentInputSchema`
  - `AgentOutputSchema`
  - `FieldSchema` & `FieldStatusSchema`
  - `ClaimSchema`
  - `TraceEventSchema`
  - `OutboundMessageSchema`
- **Temporary Resolution**: VEDA defines and validates against `src/agents/veda/stubs/contracts.stub.js`.

---

## 3. Statutory Rules Engine (`src/rules/deadlines.js`)
- **Current State**: `src/rules/` directory is absent.
- **Request**: Research+rules teammate to provide `src/rules/deadlines.js` for tax filing deadlines across GST, TDS, advance tax, and state-specific dates.
- **Temporary Resolution**: VEDA wraps `src/utils/complianceCalculators.js` via `src/agents/veda/stubs/rules.stub.js`.

---

## 4. Parent Graph Checkpointer & Session Thread ID (`src/graph/state.js`)
- **Current State**: Parent graph state is pending.
- **Request**: Backend lead to pass Postgres checkpointer and parent `runId` as `thread_id` into `vedaNode` to enable multi-turn interrupt/resume persistence across HTTP/WebSocket requests.
- **Temporary Resolution**: VEDA supports in-memory `MemorySaver` by default and accepts injected checkpointers via `buildVedaGraph({ checkpointer })`.

---

## 5. Document Route to VEDA Subgraph Integration
- **Current State**: `POST /api/documents/upload` passes a file `Buffer` to `src/agents/veda.js`, which uploads it and persists the document, extracted data, profile fields, and deadlines. The new `src/agents/veda/index.js` entry accepts a document URL or OCR text and returns the generic `AgentOutput` contract; it does not return the extracted document payload or perform those persistence operations.
- **Request**: Backend lead and document-route owner to define the migration adapter contract: who uploads the buffer through `src/services/cloudinaryService.js`, how VEDA's document type and extracted fields are exposed for persistence, how existing endpoint response fields are preserved, and how confirmation/resume is persisted across requests.
- **Blocker**: Do not replace the route's `processDocument` call with `run()` until this contract is agreed. A direct import swap would lose document persistence and change the endpoint response shape.
