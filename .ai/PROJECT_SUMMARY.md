# ComplianceOS 2.0 - Executive Summary for New AI Agents

> **For**: Future AI agents | **Generated**: 2026-10-10 | **Status**: Stage B (Event Orchestration)

---

## What This Project Does

**ComplianceOS** = WhatsApp-first compliance & government scheme co-pilot for Indian MSMEs.

Helps small business owners understand:
- ✅ What compliance they owe (GST, TDS, labor codes)
- ✅ What penalties they face if they miss deadlines
- ✅ What government schemes they're eligible for (loans, grants)
- ✅ What documents/data extraction they need

---

## The 5-Agent Architecture

| Agent | Purpose | Input | Output |
|-------|---------|-------|--------|
| **ARIA** 🔵 | Chat intake | Text/voice (Hindi) | Business profile fields |
| **VEDA** 🟢 | OCR documents | Image/PDF | Extracted structured data |
| **SCOUT** 🟡 | Match schemes | Business profile | Eligible government schemes |
| **SENTINEL** 🔴 | Deadline crawler | (Scheduled) | Compliance deadline alerts |
| **PATHWAY** 🟣 | Penalty calc | Document + profile | Penalty amounts & action steps |

All orchestrated via **LangGraph** (multi-step AI workflow engine).

---

## Three Codebases

### 1. complyos-backend-express (Node.js + ES6) 🔴 PRIMARY
**Location**: `/complyos-backend-express/src/`
- `agents/` - The 5 agents
- `graph/` - LangGraph orchestration
- `routes/` - API endpoints
- `repos/` - Database access
- `services/` - Groq, Google Vision, WhatsApp, etc.

### 2. complyos-frontend (React 18 + Vite) 🔵 UI
**Location**: `/complyos-frontend/src/`
- `pages/` - Dashboard, Schemes, Documents, Calendar
- `components/` - UI widgets
- `services/` - API client

### 3. complyos-backend (Python + FastAPI) 🟣 LEGACY
- **Status**: Being phased out
- Do NOT add new features here

---

## Quick Start Commands

```bash
# Backend (Node.js)
cd complyos-backend-express
npm install && npm run dev

# Frontend (React)
cd complyos-frontend
npm install && npm run dev  # localhost:5173

# Tests
npm test                    # Run all
npm run test:aria          # ARIA only
npm run test:scout         # SCOUT only
```

---

## Data Flow

```
User Message/Upload
  ↓
Express API + LangGraph Orchestrator
  ↓
Select Agent (ARIA/VEDA/SCOUT/SENTINEL)
  ↓
Run Agent (call Groq, Google Vision, etc)
  ↓
Save to PostgreSQL
  ↓
Send Response (WhatsApp/Email/HTTP)
```

---

## Database Models (Core)

```
User → BusinessProfile
     → Documents (extracted data)
     → Schemes (eligible matches)
     → Deadlines (compliance due dates)
     → Alerts (notifications)
     → Conversations (chat history)
```

---

## Key Technologies

| Tech | Purpose | Config |
|------|---------|--------|
| Groq | LLM inference | `GROQ_API_KEY` |
| Google Vision | OCR | `GOOGLE_CLOUD_API_KEY` |
| Sarvam AI | Hindi ASR/TTS | `SARVAM_API_KEY` |
| WhatsApp API | Messaging | `WHATSAPP_ACCESS_TOKEN` |
| PostgreSQL | Database | `DATABASE_URL` |
| Redis | Job queue | `REDIS_URL` |
| LangGraph | Orchestration | Via NPM package |

---

## 🚨 Critical Rules

1. **Read `.ai/AI_CONTEXT.md` FIRST** ⭐
2. **Use `.js` extensions** on imports in Express backend
3. **Use repo pattern** for all DB access
4. **Never hardcode tax rates** - use `complianceCalculators.js`
5. **Validate LLM outputs** - AI can hallucinate
6. **Update docs** after changes (`.ai/AI_CONTEXT.md` + `.ai/CHANGELOG.md`)
7. **Run tests** before committing

---

## Where to Find Things

| Need | Location |
|------|----------|
| Overall architecture | `.ai/AI_CONTEXT.md` ⭐ |
| SCOUT details | `.ai/agents/scout.md` |
| Database schema | `prisma/schema.prisma` |
| API endpoints | `src/routes/` |
| ARIA flow | `src/agents/aria/graph.js` |
| VEDA pipeline | `src/agents/veda/graph.js` |
| Recent changes | `.ai/CHANGELOG.md` |

---

## Navigation Strategy

1. Read `.ai/AI_CONTEXT.md` (10-15 min)
2. Open `src/graph/runGraph.js` (the "brain")
3. Pick one agent and trace through its code
4. Check tests for examples
5. Review a route + repo + service flow

---

## Current Status: Stage B ✅

**Implemented**:
- ✅ LangGraph orchestration
- ✅ ARIA, VEDA, SCOUT, SENTINEL agents
- ✅ WhatsApp integration
- ✅ DPDP compliance gates
- ✅ React frontend

**Next**:
- ⏳ Real LLM for SCOUT
- ⏳ Live gazette crawling
- ⏳ CA collaboration
- ⏳ PATHWAY calculator

---

## Security & Privacy

✅ DPDP compliant (user data deletion)
✅ PII masking (Aadhaar, PAN, OTP)
✅ No credential storage
✅ JWT authentication
✅ Rate limiting
✅ Safe logging

---

**Ready to start? → Read `.ai/AI_CONTEXT.md` first!**
