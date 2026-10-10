# ComplianceOS 2.0 - Complete Project Tree & Architecture

> **Last Updated**: 2026-10-10  
> **Status**: Active Development (Stage B: Event Orchestration & Agent Chaining)  
> **For**: Future AI agents to understand the entire codebase structure and flow

---

## 📊 Project Overview

**ComplianceOS** is a **vernacular, WhatsApp-first compliance and scheme co-pilot for Indian MSMEs**. It employs a specialized **5-agent architecture** orchestrated via LangGraph, processes government notices via OCR (VEDA), matches eligibility for government schemes (SCOUT), monitors compliance deadlines (SENTINEL), handles conversational intake (ARIA), and computes penalty resolutions (PATHWAY).

### Key Stats
- **Languages**: Node.js/Express (ES6), React 18/Vite, Python (legacy FastAPI)
- **Database**: PostgreSQL + Prisma ORM
- **AI Engines**: Groq (Llama 3.1), Google Gemini Vision, Sarvam AI (Hindi ASR/TTS)
- **Real-time**: WebSockets (LangGraph graph events)
- **Background Jobs**: BullMQ (Redis-backed queues)
- **Architecture Phase**: Stage B (Event orchestration, agent chaining, consent/deletion gates)

---

## 🗂️ Directory Structure - Part 1: Root & Backend

```
ComplianceOS-2.0/
├── .ai/                              # AI context & documentation
│   ├── AI_CONTEXT.md                # ⭐ READ THIS FIRST
│   ├── CHANGELOG.md                 # Change history
│   ├── PROJECT_TREE.md              # This file
│   ├── file_index.json              # Full file listing
│   ├── project_graph.json           # Dependency graph
│   └── agents/
│       └── scout.md                 # SCOUT agent deep dive
│
├── complyos-backend-express/        # 🔴 PRIMARY: Node.js ES6
│   ├── src/
│   │   ├── server.js                # Express entry (ES6)
│   │   ├── app.js                   # App config
│   │   ├── db.js                    # Prisma client
│   │   ├── config.js                # Environment
│   │   ├── logger.js                # Winston logger
│   │   │
│   │   ├── middleware/              # Request handlers
│   │   │   ├── auth.js              # JWT validation
│   │   │   ├── errorHandler.js      # Error handler
│   │   │   └── safeHttpLog.js       # Query-safe logging
│   │   │
│   │   ├── routes/                  # Express endpoints
│   │   │   ├── auth.js              # /auth
│   │   │   ├── business.js          # /api/business
│   │   │   ├── compliance.js        # /api/compliance
│   │   │   ├── documents.js         # /api/documents
│   │   │   ├── schemes.js           # /api/schemes
│   │   │   ├── sentinel.js          # /api/sentinel
│   │   │   ├── ca.js                # /api/ca
│   │   │   ├── notifications.js     # /api/notifications
│   │   │   ├── payments.js          # /api/payments
│   │   │   ├── admin.js             # /api/admin
│   │   │   ├── agent-trace.js       # /api/agent-trace
│   │   │   ├── chat.js              # /chat
│   │   │   ├── whatsapp.js          # /webhook/whatsapp
│   │   │   └── health.js            # /health
│   │   │
│   │   ├── services/                # Business logic
│   │   │   ├── groq.js              # Groq LLM
│   │   │   ├── sarvamService.js     # Hindi ASR/TTS
│   │   │   ├── googleVision.js      # OCR
│   │   │   ├── whatsappService.js   # WhatsApp API
│   │   │   ├── notify.js            # Notifications
│   │   │   ├── complianceCalculators.js # Tax math
│   │   │   ├── tinyfish.js          # Verification
│   │   │   └── media.js             # Media processing
│   │   │
│   │   ├── agents/                  # 5-Agent Layer
│   │   │   ├── aria/                # ARIA: Chat
│   │   │   ├── veda/                # VEDA: OCR
│   │   │   ├── scout/               # SCOUT: Schemes
│   │   │   ├── sentinel/            # SENTINEL: Deadlines
│   │   │   ├── pathway/             # PATHWAY: Penalties
│   │   │   └── scout.js             # Scout adapter
│   │   │
│   │   ├── graph/                   # LangGraph orchestration
│   │   │   ├── runGraph.js          # Main executor
│   │   │   ├── state.js             # State schema
│   │   │   ├── router.js            # Event router
│   │   │   └── nodes/               # Graph nodes
│   │   │
│   │   ├── repos/                   # Data layer
│   │   │   ├── userRepo.js
│   │   │   ├── profileRepo.js
│   │   │   ├── documentRepo.js
│   │   │   ├── schemeRepo.js
│   │   │   ├── deadlineRepo.js
│   │   │   ├── alertRepo.js
│   │   │   ├── conversationRepo.js
│   │   │   ├── traceRepo.js
│   │   │   ├── consentRepo.js
│   │   │   ├── inboundEventRepo.js
│   │   │   └── memory/              # In-memory alternatives
│   │   │
│   │   ├── channels/                # Multi-channel
│   │   │   ├── whatsappMedia.js
│   │   │   └── schemeVerification.js
│   │   │
│   │   ├── contracts/               # Type contracts
│   │   │   ├── aria.js
│   │   │   ├── profileFields.js
│   │   │   └── common.js
│   │   │
│   │   ├── delete/                  # DPDP deletion
│   │   │   └── deleteUserData.js
│   │   │
│   │   ├── jobs/                    # BullMQ jobs
│   │   │   ├── cronJobs.js
│   │   │   └── notificationQueue.js
│   │   │
│   │   ├── orchestrator/            # Event orchestration
│   │   │   ├── eventHandler.js
│   │   │   ├── stages.js
│   │   │   └── transitions.js
│   │   │
│   │   ├── config/                  # Feature flags
│   │   │   └── flags.js
│   │   │
│   │   ├── __tests__/               # Integration tests
│   │   │   └── integration/
│   │   │
│   │   └── data/                    # Seeds
│   │       └── seed.js
│   │
│   ├── prisma/                      # Database
│   │   ├── schema.prisma
│   │   └── migrations/
│   │
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example
│   ├── tsconfig.json
│   ├── INTEGRATION.md
│   ├── FRONTEND_CONTRACT.md
│   └── RUNBOOK.md
```

