# AI Context: ComplianceOS 2.0

> Regulatory compliance management and multi-agent intelligence platform for Indian MSMEs. Read this document before exploring source code.

---

## 1. Project Overview

ComplianceOS is an automated compliance copilot engineered for Indian MSMEs (Micro, Small, and Medium Enterprises). It calculates defensible compliance health scores, monitors statutory tax and regulatory filing deadlines (GST, TDS, Advance Tax, Annual Filings), scans notices via OCR, discovers MSME government subsidy and loan schemes, and orchestrates client-to-Chartered Accountant (CA) collaboration.

The platform is driven by a specialized 5-agent AI architecture:

- **ARIA**: Conversational intake and natural language interface (WebSockets + LLM).
- **VEDA**: Document vision and OCR intelligence agent (extracts notices, challans, financial data).
- **SCOUT**: Government scheme discovery and eligibility matching engine.
- **SENTINEL**: Regulatory horizon monitor and deadline notification crawler.
- **PATHWAY**: Action planning and statutory penalty resolution calculator.

The repository is currently undergoing a phased migration from a legacy Python/FastAPI backend (`complyos-backend`) to a modern Node.js/Express ES6 backend (`complyos-backend-express`) with Prisma ORM, serving a unified React 18 + Vite frontend (`complyos-frontend`).

---

## 2. Stack and Commands

### Technology Stack

- **Primary Backend**: Node.js (ES6 Modules, `"type": "module"`), Express.js, Prisma ORM, PostgreSQL.
- **Frontend**: React 18, Vite, Tailwind CSS, Zustand, Lucide React, Axios.
- **Legacy Backend**: Python 3.10+, FastAPI, SQLAlchemy, asyncpg, Celery, Redis, Pydantic.
- **AI & Integrations**: Google Gemini API, Groq SDK, Sarvam AI (Indian sovereign speech/NLP — replaces Bhashini), Cloudinary, Razorpay.
- **Background Tasks**: Node-cron (Express backend) and Celery workers (Python backend).

### Commands

#### Express Backend (`complyos-backend-express`)

- **Install**: `npm install`
- **Dev**: `npm run dev` (starts nodemon on `src/server.js`)
- **Start**: `npm start` (starts node on `src/server.js`)
- **Generate Prisma Client**: `npm run prisma:generate` (`npx prisma generate`)
- **Database Push**: `npx prisma db push`
- **Manual SENTINEL Run**: `npm run sentinel:run`
- **Seed DB**: `node src/data/seed.js`
- **Run Tests**: `npm test` (`node tests/testSuite.js && node src/agents/sentinel/__tests__/sentinel.test.js`)

#### Frontend (`complyos-frontend`)

- **Install**: `npm install`
- **Dev**: `npm run dev` (starts Vite dev server)
- **Build**: `npm run build` (production Vite build)
- **Lint**: `npm run lint` (`eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0`)
- **Preview**: `npm run preview`

#### Legacy Python Backend (`complyos-backend`)

- **Install**: `pip install -r requirements.txt`
- **Dev**: `uvicorn app.main:app --reload --port 8000`
- **Docker**: `docker-compose up --build`
- **Celery Worker**: `celery -A app.tasks.celery_app worker --loglevel=info`

---

## 3. Directory Map

- `complyos-backend/`: Legacy FastAPI backend (models, routers, agents, services, Celery tasks).
- `complyos-backend/app/agents/`: Python implementations of ARIA, VEDA, SCOUT, SENTINEL, PATHWAY.
- `complyos-backend/app/models/`: SQLAlchemy database entity models.
- `complyos-backend/app/routers/`: FastAPI endpoint routers.
- `complyos-backend/app/services/`: OCR, R2 storage, RAG, and notification integration services.
- `complyos-backend/app/tasks/`: Celery asynchronous worker tasks.
- `complyos-backend-express/`: Primary Node.js/Express ES6 backend.
- `complyos-backend-express/prisma/`: Prisma schema definition (`schema.prisma`) for PostgreSQL.
- `complyos-backend-express/src/agents/`: JavaScript multi-agent modules (ARIA, VEDA, SCOUT, SENTINEL, PATHWAY).
- `complyos-backend-express/src/agents/sentinel/`: SENTINEL source config, fetch, normalize, diff, classify, matcher, alert builder, review and test fixtures.
- `complyos-backend-express/src/agents/scout/`: TypeScript SCOUT matcher, runner, schemas, mock, and fixtures.
- `complyos-backend-express/src/agents/scout/engine/`: deterministic matching, ARIA feedback, messages, and checked explanations.
- `complyos-backend-express/src/agents/scout/schemes/`: scheme records loaded by SCOUT.
- `complyos-backend-express/src/agents/scout/drafts/`: runtime-only draft output, excluded from scheme loading.
- `complyos-backend-express/src/agents/scout/verify/`: injected TinyFish freshness, discovery, and draft extraction.
- `complyos-backend-express/src/agents/scout/eval/`: matching evaluation harness and synthetic evaluation data.
- `complyos-backend-express/src/agents/scout/fixtures/`: static SCOUT profiles and mock outputs.
- `complyos-backend-express/src/agents/scout/prompts/`: SCOUT explanation prompts.
- `complyos-backend-express/src/data/`: Static MSME scheme database (`schemes.json`) and seeder script (`seed.js`).
- `complyos-backend-express/src/jobs/`: Scheduled cron jobs (`cronJobs.js`, `deadlineReminder.js`, `sentinelCrawler.js`).
- `complyos-backend-express/src/middleware/`: Express middleware (`auth.js` for JWT, `errorHandler.js`).
- `complyos-backend-express/src/routes/`: Domain route handlers (`auth.js`, `business.js`, `compliance.js`, etc.).
- `complyos-backend-express/src/services/`: External integrations (Cloudinary, Razorpay, WhatsApp, Sarvam AI, TinyFish). `bhashiniService.js` is retained but no longer used in active routes.
- `complyos-backend-express/src/services/sarvamService.js`: Sarvam AI adapter for Hindi ASR (`saarika:v1`), TTS (`bulbul:v1`), and translation (`mayura:v1`). Graceful demo-fallback when `SARVAM_API_KEY` is unset.
- `complyos-backend-express/src/services/tinyfish.js`: TinyFish adapter for search/fetch/agent calls with rate limits and block detection.
- `complyos-backend-express/src/utils/`: Deterministic compliance score and penalty formulas (`complianceCalculators.js`).
- `complyos-backend-express/tests/`: Integration test suite (`testSuite.js`).
- `complyos-frontend/`: React 18 + Vite client application.
- `complyos-frontend/src/components/agents/`: Agent UI cards and drawers (`SCOUTResults`, `VEDAUploader`, `SENTINELAlert`).
- `complyos-frontend/src/components/aria/`: Chat UI components (`ARIAInput`, `ChatBubble`, `QuickReply`).
- `complyos-frontend/src/components/layout/`: Common navigation layout (`Sidebar`, `Topbar`, `DashboardLayout`, `CASidebar`).
- `complyos-frontend/src/components/ui/`: Atomic cards, badges, modal dialogs, and progress bars.
- `complyos-frontend/src/hooks/`: Custom React hooks (`useARIA`, `useSCOUT`, `useVEDA`).
- `complyos-frontend/src/pages/`: Primary app views (Dashboard, Documents, Calendar, Notices, Loans, CAConnect).
- `complyos-frontend/src/pages/ca/`: Dedicated CA portal views (CADashboard, CAApprovalRequests, CAFraudShield).
- `complyos-frontend/src/services/`: Client network layer (`api.js`, `ariaSocket.js`, `groqService.js`).
- `complyos-frontend/src/store/`: Zustand state slices (`authStore.js`, `businessStore.js`, `notificationStore.js`).
- `complyos-frontend/src/utils/`: Formatters, mock directories, and constants (`caDirectory.js`, `constants.js`, `helpers.js`).

---

## 4. Key Entry Points and Main Flows

- **Express Backend Entry (`complyos-backend-express/src/server.js`)**: Imports `app.js`, initializes HTTP and WebSocket servers, connects to Prisma via `db.js`, starts cron jobs via `cronJobs.js`, and binds port 5000.
- **Frontend Entry (`complyos-frontend/src/main.jsx`)**: Mounts `App.jsx`, providing routing via React Router and wrapping views with layout components and Zustand store state.
- **Intake & Chat Flow**:
  1. User triggers ARIA chat via `ComplianceChatbot.jsx` or `/onboarding`.
  2. Frontend connects to WebSocket (`ariaSocket.js`) or calls `/api/aria`.
  3. `aria.js` processes input with Gemini/Groq prompt constraints and returns structured onboarding or compliance recommendations.
- **Document & OCR Flow**:
  1. User drops document in `VEDAUploader.jsx` (`/documents`).
  2. File uploads to `/api/documents/upload`, persisted to Cloudinary/storage.
  3. `veda.js` performs vision extraction (extracting GSTIN, period, tax demand, penalty).
  4. Extracted data updates `Document` and `ComplianceRecord` in Prisma, updating the compliance score.
- **CA Workflow**:
  1. Business user requests CA review via `/api/ca/request`.
  2. CA views queue in `CAApprovalRequests.jsx` and runs audit checks using `CAFraudShield.jsx`.

---

## 5. Core Modules and Responsibilities

- **`complyos-backend-express/src/agents/aria.js`**: Conversational intake logic, interactive onboarding, intent parsing.
- **`complyos-backend-express/src/agents/veda.js`**: OCR extraction, document type recognition, notice parser.
- **`complyos-backend-express/src/agents/scout.js`**: MSME scheme matcher comparing business turnover/sector against eligibility criteria.
- **`complyos-backend-express/src/agents/scout/entry.ts`**: SCOUT graph-facing runner selector; uses mock unless `SCOUT_REAL === 'true'`.
- **`complyos-backend-express/src/agents/scout/engine/match.ts`**: Pure deterministic criteria matching; unknown criteria remain `possible`.
- **`complyos-backend-express/src/agents/scout/verify/runVerify.ts`**: Injected-client freshness checks returning stale copies and review items without persistence.
- **`complyos-backend-express/src/agents/scout/verify/runDiscovery.ts`**: Injected discovery/draft pipeline; persists generated JSON only under SCOUT `drafts/`.
- **`complyos-backend-express/src/agents/sentinel.js`**: High-level sentinel wrapper and trigger entry point.
- **`complyos-backend-express/src/agents/sentinel/*`**: Source config, fetch, normalize, diff, classify, profile matching, alert building, review queue helpers, and tests.
- **`complyos-backend-express/src/services/sarvamService.js`**: Sarvam AI — Hindi/Indic speech-to-text, TTS, and translation. Used by `routes/business.js` `/aria/voice` endpoint. Key: `SARVAM_API_KEY`. No separate npm package — calls `api.sarvam.ai` via axios.
- **`complyos-backend-express/src/services/tinyfish.js`**: Search/fetch/agent adapter with block checks, retry logic, rate limits, and daily agent cap control.

### Prisma Data Models: Alert Routing

- **`SentinelAlert`**: User-facing alert model—stores displayed regulatory alerts with title, summary, source URL, simulated label. Written by SENTINEL pipeline for UI rendering and user notifications.
- **`RegulationAlert`**: Delivery tracking model—links a (user, regulation change) pair; tracks whether a user was alerted for a specific change. Used for deduplication and audit.
- **`Notification`**: Generic in-app system notification model—stores general (non-regulation) messages, reminders, and broadcasts.
- **`complyos-backend-express/src/agents/pathway.js`**: Step-by-step resolution pathways for pending tax demands and notice replies.
- **`complyos-backend-express/src/utils/complianceCalculators.js`**: Ground-truth mathematical engine for compliance scores and penalty deductions.
- **`complyos-backend-express/src/db.js`**: Singleton PrismaClient connection pool.

---

## 6. Data Models and API Routes

### Environment Variable Names

- `TINYFISH_API_KEY`
- `TINYFISH_AGENT_DAILY_CAP`
- `SARVAM_API_KEY` — Sarvam AI subscription key (get from dashboard.sarvam.ai). Used in `sarvamService.js` for ASR/TTS/translate. Omitting activates demo fallback.

### SENTINEL Flow

1. Trigger: manual `npm run sentinel:run` or API route that calls `runSentinelCrawl()`.
2. `src/agents/sentinel/sources.json` defines each source and skips entries whose URL starts with `TODO_VERIFY_OFFICIAL_URL`.
3. TinyFish fetches and validates the page; blocked/captcha/error pages are rejected.
4. Text is normalized and compared to the last stored snapshot using diff logic.
5. A change is classified, then reviewed for confidence and quote validity.
6. `matchProfiles()` decides which active profiles are in scope, based on explicit fields only.
7. `buildAlert()` creates the alert only when sourceUrl, lastVerified, quote, and confidence gates pass.

### Safety Warnings

- No alert without `sourceUrl` and `lastVerified`.
- `TODO_VERIFY_OFFICIAL_URL` placeholders are skipped; no live source calls are attempted while placeholders remain.
- The LLM never decides user targeting; code in `matchProfiles.js` and `buildAlert.js` decides that.
- Only official sources are allowed in production; simulated alerts must be labeled as such.
- Simulated alerts are labeled in backend code, not frontend.

### How to Add a New Regulation Source

1. Edit `complyos-backend-express/src/agents/sentinel/sources.json`.
2. Verify the official URL first before enabling it.
3. Use the same `id`, `url`, `type`, `stateScope`, `fetchVia`, `checkEvery`, and `simulated` fields.
4. Do not use or keep a `TODO_VERIFY_OFFICIAL_URL` entry for live monitoring.

### Prisma Relational Models

| Model                | Key Fields                                               | Purpose                                  |
| -------------------- | -------------------------------------------------------- | ---------------------------------------- |
| `User`               | `id, email, phone, passwordHash, fullName`               | Relational entity for user               |
| `BusinessProfile`    | `id, userId, businessName, gstin, pan`                   | Relational entity for businessprofile    |
| `Document`           | `id, userId, filename, cloudinaryUrl, cloudinaryId`      | Relational entity for document           |
| `ComplianceDeadline` | `id, userId, title, description, deadlineDate`           | Relational entity for compliancedeadline |
| `Scheme`             | `id, name, nameHindi, description, descriptionHindi`     | Relational entity for scheme             |
| `SchemeMatch`        | `id, businessId, schemeId, matchScore, criteriaMetCount` | Relational entity for schemematch        |
| `SentinelAlert`      | `id, userId, title, titleHindi, summary`                 | Relational entity for sentinelalert      |
| `CAClientMap`        | `id, caId, clientId, addedAt, ca`                        | Relational entity for caclientmap        |
| `Notification`       | `id, userId, title, body, channel`                       | Relational entity for notification       |
| `Subscription`       | `id, userId, plan, razorpaySubId, razorpayCustomerId`    | Relational entity for subscription       |
| `ARIASession`        | `id, userId, sessionId, messages`                        | Relational entity for ariasession        |

### Key Express Endpoints

| Method | Route                         | Source                    | Description                                |
| ------ | ----------------------------- | ------------------------- | ------------------------------------------ |
| `POST` | `/api/auth/register`          | `routes/auth.js`          | Register new user and business profile     |
| `POST` | `/api/auth/login`             | `routes/auth.js`          | User login and JWT token issuance          |
| `GET`  | `/api/auth/me`                | `routes/auth.js`          | Get authenticated user session details     |
| `GET`  | `/api/business/profile`       | `routes/business.js`      | Retrieve business details and GSTIN/PAN    |
| `PUT`  | `/api/business/profile`       | `routes/business.js`      | Update business profile details            |
| `GET`  | `/api/compliance/status`      | `routes/compliance.js`    | Get compliance checklist and score         |
| `GET`  | `/api/compliance/calendar`    | `routes/compliance.js`    | Upcoming statutory deadlines (GST/TDS)     |
| `POST` | `/api/compliance/calculate`   | `routes/compliance.js`    | Trigger compliance penalty calculation     |
| `POST` | `/api/documents/upload`       | `routes/documents.js`     | Upload tax/statutory document (Cloudinary) |
| `GET`  | `/api/documents`              | `routes/documents.js`     | List uploaded documents and OCR status     |
| `GET`  | `/api/documents/:id/ocr`      | `routes/documents.js`     | Fetch VEDA OCR extracted metadata          |
| `GET`  | `/api/ca/directory`           | `routes/ca.js`            | List verified Chartered Accountants        |
| `POST` | `/api/ca/request`             | `routes/ca.js`            | Create engagement request with a CA        |
| `GET`  | `/api/notifications`          | `routes/notifications.js` | Fetch notifications and alerts             |
| `PUT`  | `/api/notifications/:id/read` | `routes/notifications.js` | Mark notification as read                  |
| `GET`  | `/api/agent-trace`            | `routes/agentTrace.js`    | Multi-agent execution log stream           |
| `GET`  | `/api/admin/metrics`          | `routes/admin.js`         | System performance and user metrics        |

---

## 7. Dependency Graph Summary

- **Express Backend Core Dependencies**: `express`, `@prisma/client`, `cors`, `dotenv`, `jsonwebtoken`, `bcryptjs`, `ws`, `node-cron`, `multer`, `@google/genai`, `cloudinary`, `razorpay`, `axios`.
- **Sarvam AI**: No separate npm package needed — API calls made via `axios` to `https://api.sarvam.ai`. Auth via `api-subscription-key` header.
- **Frontend Core Dependencies**: `react`, `react-dom`, `react-router-dom`, `zustand`, `lucide-react`, `axios`, `groq-sdk`, `tailwindcss`.
- **Legacy Python Dependencies**: `fastapi`, `uvicorn`, `sqlalchemy`, `asyncpg`, `celery`, `redis`, `pydantic`.

---

## 8. How to Make Common Changes

### Add an API Route / Endpoint

1. Create or open the relevant route file in `complyos-backend-express/src/routes/<domain>.js`.
2. Define the route:
   ```javascript
   router.get("/my-route", authenticateToken, async (req, res, next) => {
     try {
       const data = await prisma.myModel.findMany({
         where: { userId: req.user.id },
       });
       res.json({ success: true, data });
     } catch (err) {
       next(err);
     }
   });
   ```
3. If creating a new router, mount it in `complyos-backend-express/src/app.js`:
   `app.use('/api/<domain>', <domain>Routes);`
4. Expose the client method in `complyos-frontend/src/services/api.js`.

### Add a UI Page / Component

1. Create the page file: `complyos-frontend/src/pages/<PageName>.jsx`.
2. Register the route in `complyos-frontend/src/App.jsx` inside the `<Routes>` block.
3. If part of the dashboard sidebar, add an entry to `complyos-frontend/src/components/layout/Sidebar.jsx`.

### Add a Database Model / Field

1. Edit `complyos-backend-express/prisma/schema.prisma`.
2. Run `npm run prisma:generate` inside `complyos-backend-express`.
3. Apply migration: `npx prisma db push` (or `npx prisma migrate dev`).

### Update Environment Configuration

1. Add the variable key name to `complyos-backend-express/.env.example`.
2. Export the setting in `complyos-backend-express/src/config.js`.
3. Never commit credentials or real keys.

---

## 9. Conventions, Gotchas, and Warnings

- **ES6 Imports Required**: `complyos-backend-express` uses ES6 modules (`"type": "module"`). All relative imports must have the `.js` extension (e.g. `import db from './db.js';`). Omitting the `.js` causes runtime crashes.
- **Migration Status**: Follow `MIGRATION_PLAN.md`. All active development must happen in `complyos-backend-express`. Do not add new features to `complyos-backend` (Python).
- **Prisma Generation**: Always run `npm run prisma:generate` after updating `schema.prisma`.
- **Ground Truth Numbers**: AI agents must never hallucinate tax penalties or interest calculations. Always delegate math to `complianceCalculators.js`.
- **Protected Files**: Do not manually modify `package-lock.json` or `.prisma` client builds.
- SCOUT hides schemes with missing or placeholder source data from user-facing output.
- SCOUT matching is code-owned; never call a `possible` match eligible when criteria are unknown.
- SCOUT discovery output is draft-only and requires human review before moving into `schemes/`.
- SCOUT contract, Groq, and TinyFish placeholders remain until shared contracts and services are available.

---

## 10. How Future Agents Should Use This File

Read this file first. Do not scan the whole repo. Use `.ai/file_index.json` and `.ai/project_graph.json` only via grep/jq lookups, never load them in full. Open source files only when needed for the task. After major changes (new routes, models, modules, commands), update this file.

SCOUT details: .ai/agents/scout.md
