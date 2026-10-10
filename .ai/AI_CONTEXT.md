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
- **AI & Integrations**: Google Gemini API, Groq SDK, LangGraph JS, LangChain Core, Zod, Bhashini legacy speech integration, Sarvam adapter (live API unverified), Cloudinary, Razorpay.
- **Background Tasks**: Node-cron (Express backend) and Celery workers (Python backend).

### Commands

#### Express Backend (`complyos-backend-express`)
- **Install**: `npm install`
- **Dev**: `npm run dev` (starts nodemon on `src/server.js`)
- **Start**: `npm start` (starts node on `src/server.js`)
- **Generate Prisma Client**: `npm run prisma:generate` (`npx prisma generate`)
- **Database Push**: `npx prisma db push`
- **Manual SENTINEL Run**: `npm run sentinel:run`
- **ARIA Tests**: `npm run test:aria`
- **ARIA Evals**: `npm run eval:aria:turns`, `npm run eval:aria:slots`, `npm run eval:aria:wer`, `npm run eval:aria:taps`
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
- `complyos-backend/`: Legacy FastAPI backend; do not add active features there.
- `complyos-backend-express/`: Primary ESM backend; `prisma/`, `src/`, and `tests/`.
- `src/agents/aria/`: New per-turn ARIA; legacy consumers still call `src/agents/aria.js`.
- `src/agents/veda/`: Modular VEDA; document upload still calls legacy `src/agents/veda.js` pending owner migration.
- `src/agents/sentinel/`: SENTINEL source, processing pipeline, alert helpers and tests.
- `src/routes/`, `src/middleware/`, `src/jobs/`: HTTP endpoints, middleware and scheduled jobs.
- `src/services/`: Groq, Sarvam, media, Vision, TinyFish, Cloudinary, Bhashini, WhatsApp and payment adapters.
- `src/graph/nodes/`: Thin graph adapters; `src/utils/` contains deterministic compliance calculators.
- `complyos-frontend/`: React 18 + Vite client with pages, components, hooks, services and Zustand stores.

---

## 4. Key Entry Points and Main Flows
- **Backend**: `src/server.js` initializes Express, HTTP/WebSocket, Prisma and cron jobs. Frontend starts at `complyos-frontend/src/main.jsx`.
- **ARIA**: Route callers still use legacy `src/agents/aria.js`; new per-turn `src/agents/aria/index.js` is exposed through `src/graph/nodes/aria.node.js`. Parent owns persistence.
- **VEDA**: `/api/documents/upload` still calls legacy `src/agents/veda.js`; the new subgraph is `src/agents/veda/`. Migration/persistence gaps are in `VEDA_CONTRACT_REQUESTS.md`.
- **CA**: `/api/ca/request` creates engagements consumed by CA portal pages.

---

## 5. Core Modules and Responsibilities
- **ARIA**: `src/agents/aria/` is the new pure per-turn engine, bank, mock, tests and evals; `src/contracts/aria.js` defines local schemas. Live extraction requires `ARIA_REAL=true`.
- **Speech/LLM adapters**: `src/services/groq.js`, `sarvam.js` and `media.js`; live Sarvam details remain unverified and mock mode is offline.
- **VEDA**: `src/agents/veda/` is the new LangGraph pipeline; legacy `src/agents/veda.js` remains wired to upload routes until repository-owner migration.
- **SCOUT**: `src/agents/scout.js` matches MSME schemes. **SENTINEL**: `src/agents/sentinel/` and `src/services/tinyfish.js` monitor sources and build targeted alerts.
- **PATHWAY**: `src/agents/pathway.js` builds resolution checklists. `src/utils/complianceCalculators.js` owns deterministic penalty/score math; `src/db.js` exports the Prisma singleton.
- SENTINEL separates source snapshots/changes, user alert delivery, and general notifications in Prisma.

---

## 6. Data Models and API Routes

### Environment Variable Names
- SENTINEL: `TINYFISH_API_KEY`, `TINYFISH_AGENT_DAILY_CAP`.
- ARIA: `ARIA_REAL`, `ARIA_MIN_ASR_CONFIDENCE`, `ARIA_MAX_QUESTIONS`, `ARIA_VOICE_REPLY`, `SARVAM_API_KEY`, `SARVAM_MOCK`.

### SENTINEL Safety
- Skip `TODO_VERIFY_OFFICIAL_URL` sources until official URLs are confirmed.
- Require source metadata for alerts; code chooses user targeting. Mark simulated alerts in backend output.

### Core Prisma Models
`User`, `BusinessProfile`, `Document`, `ComplianceDeadline`, `Scheme`, `SchemeMatch`, `SentinelAlert`, `RegulationSource`, `RegulationSnapshot`, `RegulationChange`, `Alert`, `TinyFishCall`, `Notification`, `Subscription`, `ARIASession`.

### Key Express Endpoints
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`.
- Business/compliance: `/api/business/profile`, `/api/compliance/status`, `/api/compliance/calendar`, `/api/compliance/calculate`.
- Documents/CA: `/api/documents/upload`, `/api/documents`, `/api/ca/directory`, `/api/ca/request`.
- Operations: `/api/notifications`, `/api/agent-trace`, `/api/admin/metrics`.

---

## 7. Dependency Graph Summary
- **Express Backend Core Dependencies**: `express`, `@prisma/client`, `@langchain/langgraph`, `@langchain/core`, `zod`, `groq-sdk`, `@google-cloud/vision`, `cors`, `dotenv`, `jsonwebtoken`, `bcryptjs`, `ws`, `node-cron`, `multer`, `cloudinary`, `razorpay`, `axios`.
- **Frontend Core Dependencies**: `react`, `react-dom`, `react-router-dom`, `zustand`, `lucide-react`, `axios`, `groq-sdk`, `tailwindcss`.
- **Legacy Python Dependencies**: `fastapi`, `uvicorn`, `sqlalchemy`, `asyncpg`, `celery`, `redis`, `pydantic`.

---

## 8. How to Make Common Changes

### Add an API Route / Endpoint
1. Create or open the relevant route file in `complyos-backend-express/src/routes/<domain>.js`.
2. Define the route:
   ```javascript
   router.get('/my-route', authenticateToken, async (req, res, next) => {
     try {
       const data = await prisma.myModel.findMany({ where: { userId: req.user.id } });
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
- **ARIA Safety**: Keep option taps deterministic; redact Aadhaar/PAN/OTP/password text before Groq; require verbatim evidence quotes; derive numeric bands in code; never overwrite `VERIFIED` fields. Do not enable live Sarvam calls until verified.
- **Protected Files**: Do not manually modify `package-lock.json` or `.prisma` client builds.

---

## 10. Agent Workflow and Context Maintenance
- Before starting work, read `.ai/AI_CONTEXT.md`. Explore only the files needed for the task; do not scan the whole repository.
- Use `.ai/file_index.json` and `.ai/project_graph.json` only for targeted `rg`/`jq` lookups; never load either file in full.
- If a task changes a route, model, module, component, command, environment variable, or dependency, update this file and add one dated line to `.ai/CHANGELOG.md` in the same change.
- Replace outdated context instead of only appending. Keep this file under approximately 4,000 tokens. Never put secrets or `.env` values here, and do not paste large code blocks.
