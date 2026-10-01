# ComplianceOS (भारत) 🇮🇳

> **A vernacular, WhatsApp-first compliance and scheme co-pilot for India's 8.7+ crore small businesses.**  
> *"Tell them in their own language what is due, what a miss will cost, and what money they are leaving unclaimed — then get them to the next actionable step."*

---

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.111-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React_18_+_Vite-61DAFB.svg?style=flat&logo=react)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Styling-TailwindCSS_3.4-38B2AC.svg?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_+_SQLAlchemy-336791.svg?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![MongoDB](https://img.shields.io/badge/Vault-MongoDB_Motor-47A248.svg?style=flat&logo=mongodb)](https://www.mongodb.com/)
[![Groq](https://img.shields.io/badge/Inference-Groq_Llama_3.1-F55036.svg?style=flat)](https://groq.com/)
[![DPDP Ready](https://img.shields.io/badge/Privacy-DPDP_Act_2025_Aligned-blue.svg)](#legal-regulatory-and-safety-map)
[![License](https://img.shields.io/badge/License-Proprietary_/_Hackathon-lightgrey.svg)](#)

---

## 📌 Table of Contents
1. [Executive Summary & The Mission](#-executive-summary--the-mission)
2. [The Problem: Ground Truth & Defensible Numbers](#-the-problem-ground-truth--defensible-numbers)
3. [The 5-Agent Architecture](#-the-5-agent-architecture)
4. [The Trust Layer (The Core Differentiator)](#-the-trust-layer-the-core-differentiator)
5. [Compliance Health Score Engine](#-compliance-health-score-engine)
6. [Current Phase vs. Build Blueprint](#-current-phase-vs-build-blueprint)
7. [Repository Structure](#-repository-structure)
8. [Technology Stack](#-technology-stack)
9. [Getting Started & Local Setup](#-getting-started--local-setup)
10. [Environment Variables](#-environment-variables)
11. [Business Model & Unit Economics](#-business-model--unit-economics)
12. [Legal, Regulatory & Safety Guardrails](#-legal-regulatory--safety-guardrails)
13. [Evaluation Plan & Benchmark Targets](#-evaluation-plan--benchmark-targets)
14. [Sources & Verification Matrix](#-sources--verification-matrix)

---

## 🎯 Executive Summary & The Mission

India is home to **8.7 crore registered MSMEs** across Udyam and Udyam Assist (as of June 2026), contributing **31.1% of India's GDP**, **35.4% of manufacturing output**, and **48.58% of exports**. Over **99%** of these enterprises are micro-units. 

Despite their massive economic footprint, small business owners operate in regulatory blindness:
- Fragmented portals: GST, Udyam, FSSAI, EPFO, ESIC, Income Tax/TRACES, and state-level municipal trade bodies — each with separate logins, legalese, and English-only notifications.
- Constant statutory movement: Introduction of GST 2.0, e-invoicing thresholds reduced to ₹5 Cr, and the rollout of the 4 Labour Codes.
- Massive credit & subsidy under-utilization: Out of an estimated ₹25–80 Lakh Crore MSME credit demand, only ~19% is met through formal banking. Lucrative state and central schemes (e.g., UP ODOP, CM YUVA, PMEGP, CGTMSE) remain unclaimed due to low awareness and documentation anxiety.

**ComplianceOS** bridges this chasm as a **vernacular, WhatsApp-first compliance and scheme co-pilot**. Business owners simply send a voice note in Hindi or upload a smartphone photo of a government notice or certificate. An orchestrated pipeline of **5 specialized agents** extracts deadlines, computes deterministic penalties, and matches tailored government subsidies — backed by an uncompromised **Trust Layer**.

> **The Honest Reframing**: ~90% of active GST filers already file GSTR-3B by month end. Therefore, late GST filing is not the primary wedge. The true crisis is the **unserved long tail**: non-GST licences, labour codes, notice responses, and undiscovered government schemes. **We position as an awareness and next-action layer, not an auto-filing tool.**

---

## 📊 The Problem: Ground Truth & Defensible Numbers

| Sourced Reality | Statistic / Finding | Statutory Citation / Source |
|:---|:---|:---|
| **MSME Base** | **8.7 Crore** Udyam + Udyam Assist registrations | Ministry of MSME, Jun 2026 `[S1]` |
| **Micro Dominance** | **>99%** of all registrations are Micro units (6.11 of 6.19 Cr) | MSME Gazette / Policy Circle `[S4]` |
| **Active GST Filers** | **1.67 Crore** active GST registrations | GSTN Data, Jul 2026 `[S7]` |
| **Credit Gap** | Only **19%** formal credit demand met; **₹25L–80L Cr** unmet credit gap | NITI Aayog / IFC / Deloitte `[S5][S6]` |
| **GST Penalty Caps** | Fixed daily late fee: **₹50/day** (₹20/day Nil), capped by turnover brackets | Section 47 CGST Act `[S9]` |
| **GST Interest** | **18% per annum** on late tax payments | Section 50 CGST Act `[S9]` |
| **Statutory Worst Case** | A small trader (< ₹1.5 Cr turnover) filing GSTR-1 & 3B late monthly incurs up to **₹48,000/yr** in late fees alone | Statutory Calculation `[S9]` |

---

## 🤖 The 5-Agent Architecture

All agents operate over a single, unified **Business Profile** JSON entity.

```
                              [ User Touchpoints ]
                   WhatsApp Cloud API  |  Web PWA (Desktop/Mobile)
                                      │
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │       ORCHESTRATOR & VERIFICATION GATE           │
             │   Citations · Confidence Gate · DPDP Consent     │
             └────────────────────────┬─────────────────────────┘
                                      │
        ┌───────────────┬─────────────┼───────────────┬────────────────┐
        ▼               ▼             ▼               ▼                ▼
   ┌─────────┐    ┌──────────┐  ┌───────────┐  ┌─────────────┐  ┌─────────────┐
   │  ARIA   │    │   VEDA   │  │   SCOUT   │  │  SENTINEL   │  │   PATHWAY   │
   │ Intake  │    │ Document │  │  Scheme   │  │ Regulatory  │  │   Action    │
   │ & Voice │    │ & Vision │  │  Engine   │  │   Crawler   │  │  Checklist  │
   └────┬────┘    └─────┬────┘  └─────┬─────┘  └──────┬──────┘  └──────┬──────┘
        │               │             │               │                │
        └───────────────┼─────────────┴───────────────┼────────────────┘
                        ▼                             ▼
            [ PostgreSQL DB ]                 [ MongoDB Vault ]
          Relational Profiles,             Unstructured OCR Snippets,
        Deadlines & Audit Logs            Document JSON & Audit Events
```

### 1. ARIA (Conversational Intake Agent)
* **Input**: Hindi/Hinglish voice notes or chat messages.
* **Core Logic**: Speech-to-Text (Sarvam / Bhashini / Whisper) $\rightarrow$ LLM slot-filling into a standardized 12-field Business Profile. Asks exactly **one** missing field at a time with plain-language justification.
* **Output**: Validated `BusinessProfile` JSON schema.

### 2. VEDA (Document & Vision Intelligence Agent)
* **Input**: Smartphone photos or PDFs of GST Certificates, Notices, Invoices, Challans, and Licences.
* **Core Logic**: Vision LLM + OCR extraction yielding JSON with verbatim evidence quotes and per-field confidence scores ($0.0 - 1.0$).
* **Post-Processing (Deterministic)**: GSTIN checksum validation (mod 36 algorithm), PAN regex verification, date sanity verification.
* **Confidence Gate**: Any field score $< 0.80$ triggers an interactive *"Please Confirm"* card; unverified data is never written silently.
* **Output**: Calibrated deadlines, extracted registrations, and compliance entries.

### 3. SCOUT (Scheme Discovery & Eligibility Engine)
* **Input**: Business Profile + verified extracted facts.
* **Core Logic**: **Deterministic Python rules engine** evaluating hand-verified government schemes (UP ODOP, CM YUVA, PMEGP, CGTMSE, Mudra). LLM is used **strictly for vernacular explanation**, never for eligibility determination.
* **Output**: Transparent breakdown: *"X of Y criteria met"*, missing requirements checklist, and direct official portal links.

### 4. SENTINEL (Regulatory Horizon & Change Monitor)
* **Input**: Scheduled ingestion of official gazettes, CBIC notifications, GSTN advisories, and Labour Ministry portals.
* **Core Logic**: Ingest $\rightarrow$ SHA-256 deduplication $\rightarrow$ LLM attribute tagging (State, Industry, Turnover threshold) $\rightarrow$ match against business cohort.
* **Output**: Hyper-targeted, plain-Hindi alerts on upcoming rule changes (e.g., e-invoicing limits, Labour Code updates).

### 5. PATHWAY (Action & Resolution Engine)
* **Input**: Overdue compliance item, notice response, or matched scheme.
* **Core Logic**: Step-by-step resolution checklist with required documents, official deep links, and a secure *"Share with my CA"* handoff.
* **Safety Mandate**: **Zero credential storage, zero auto-filing.** Users are guided, never impersonated.

---

## 🛡️ The Trust Layer (The Core Differentiator)

In regulated enterprise compliance, hallucination is fatal. The **Trust Layer** enforces safety across every agent:

1. **Source Citations on Every Claim**: Every deadline, statutory late fee, and scheme criterion explicitly links to the official government source URL with a `last_verified` timestamp.
2. **Confidence Gate (< 0.80)**: Extracted fields with $< 80\%$ confidence or failed algorithmic checks require user tap-to-confirm.
3. **Deterministic Math**:
   - GST Section 47 Late Fees: Computed strictly in code based on days late and turnover slabs.
   - GST Section 50 Interest: Computed deterministically at $18\%$ per annum.
4. **Human-in-the-Loop CA Review**: High-stakes items (scrutiny notice responses, scheme submissions) include direct read-only export to a practising CA.
5. **DPDP Act 2025 Architecture**:
   - Explicit granular opt-in on message 1.
   - Purpose limitation and data minimization.
   - Zero retention of banking passwords, OTPs, or Aadhaar credentials.
   - One-tap data deletion with India-region encrypted storage.

---

## 🧮 Compliance Health Score Engine

The headline metric gives MSMEs an immediate, explainable, and tunable score:

$$\text{Health Score} = \max\left(0, 100 - \sum \text{Penalties}\right)$$

### Penalty Deductions:
- **Overdue Critical Item** (GST Return, Expired Statutory Licence): $-15$ each (capped at $-45$)
- **Overdue Standard Item**: $-8$ each (capped at $-24$)
- **Due within 7 Days**: $-4$ each (capped at $-12$)
- **Mandatory Registration Missing** (e.g., GST above statutory turnover threshold): $-10$
- **Document Missing Verification**: $-2$ each (capped at $-6$)

### Monetary Aggregates:
- **Penalty at Risk (₹)**: $\sum (\text{GST Late Fee} + \text{Statutory Interest})$ across open items *(deterministic, citing s.47 & s.50)*.
- **Scheme Headroom (₹)**: $\sum (\text{Max Benefit})$ across eligible/possible schemes *(clearly labeled "Up to ₹X", not a guaranteed payout)*.

---

## 🚦 Current Phase vs. Build Blueprint

| Milestone | Target Deliverable | Status |
|:---|:---|:---|
| **Phase 1: Foundation** | Full frontend UI suite (Dashboard, Documents, Calendar, Schemes, Notices, CA Connect, Onboarding, Loans) + FastAPI backend boilerplate + Docker Compose + Dual DB config | ✅ **Completed** |
| **Phase 2: MVP Vertical Slice** | Integration of VEDA OCR + Groq extraction; PostgreSQL schema setup; MongoDB document vault; GSTIN/PAN validator implementation | 🟡 **Active Phase (Current)** |
| **Phase 3: Agent Hardening** | Deterministic SCOUT Scheme Rule Evaluator (30–50 verified schemes); Hindi voice intake (Sarvam/Bhashini STT); Section 47/50 penalty calculation engine | 🔄 **In Progress** |
| **Phase 4: Trust & Verification** | SENTINEL regulatory scraper; Agent Trace Panel; CA read-only dashboard; DPDP consent and deletion flows | ⏳ **Upcoming** |
| **Phase 5: Field Pilot** | 25-business pilot in Uttar Pradesh (ODOP/CM YUVA focus); CA partner onboarding; Measured accuracy benchmarks | 📅 **Roadmap** |

---

## 📁 Repository Structure

```
complianceOS_bharat/
├── complianceOS/
│   ├── complyos-backend/              # FastAPI Python Backend
│   │   ├── app/
│   │   │   ├── agents/                # AI Agent Implementations
│   │   │   │   ├── aria.py            # Conversational Onboarding Agent
│   │   │   │   ├── veda.py            # Document Intelligence & Vision Agent
│   │   │   │   ├── scout.py           # Scheme Compatibility Engine
│   │   │   │   ├── sentinel.py        # Regulatory Change & Risk Alerter
│   │   │   │   └── pathway.py         # Action Roadmap & Step-by-Step Checklists
│   │   │   ├── models/                # SQLAlchemy & Database Models
│   │   │   │   ├── user.py            # Auth & User Account Entity
│   │   │   │   ├── business.py        # Central Business Profile
│   │   │   │   ├── compliance.py      # Deadlines & Penalties
│   │   │   │   ├── document.py        # Vault Document Records
│   │   │   │   ├── scheme.py          # Scheme Metadata & Criteria
│   │   │   │   └── ca.py              # Chartered Accountant Partner Directory
│   │   │   ├── routers/               # Modular REST & WebSocket Endpoints
│   │   │   │   ├── auth.py            # JWT Auth & Registration
│   │   │   │   ├── documents.py       # Upload & OCR Ingestion Pipeline
│   │   │   │   ├── compliance.py      # Deadlines & Penalty Queries
│   │   │   │   ├── schemes.py         # Scheme Matching API
│   │   │   │   ├── business.py        # Profile Management
│   │   │   │   ├── ca.py              # CA Collaboration & Dashboard
│   │   │   │   ├── ws_aria.py         # Real-time WebSocket for Voice/Chat
│   │   │   │   └── ...
│   │   │   ├── services/              # External Integrations
│   │   │   │   ├── ocr_service.py     # PyTesseract / Vision Preprocessing
│   │   │   │   ├── r2_service.py      # Cloudflare R2 / S3 Encrypted Storage
│   │   │   │   └── rag_service.py     # Embeddings & Scheme Retrieval
│   │   │   ├── config.py              # Pydantic Settings & Environment
│   │   │   ├── database.py            # Async PostgreSQL + Motor MongoDB Connections
│   │   │   └── main.py                # FastAPI Application Factory
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml         # Containerized Postgres, Mongo, Redis, Backend
│   │   └── requirements.txt
│   │
│   ├── complyos-frontend/             # React + Vite + Tailwind Frontend
│   │   ├── src/
│   │   │   ├── components/            # Reusable UI & Agent Components
│   │   │   │   ├── agents/            # VEDAUploader, SENTINELAlert, SCOUTResults
│   │   │   │   ├── layout/            # Navbar, Sidebar, DashboardLayout
│   │   │   │   └── ui/                # MetricCard, ProgressBar, Common Buttons
│   │   │   ├── pages/                 # Full Application Workflows
│   │   │   │   ├── Landing.jsx        # Public Product Showcase & Pricing
│   │   │   │   ├── Dashboard.jsx      # Core MSME Hub & Health Score
│   │   │   │   ├── Documents.jsx      # Compliance Vault & Verification UI
│   │   │   │   ├── Calendar.jsx       # Interactive Deadline Scheduler
│   │   │   │   ├── Schemes.jsx        # Scheme Matching & Filtering
│   │   │   │   ├── Notices.jsx        # Notice Intelligence & Resolution
│   │   │   │   ├── CAConnect.jsx      # CA Collaboration Directory
│   │   │   │   ├── Onboarding.jsx     # Business Setup Flow
│   │   │   │   └── Loans.jsx          # Credit & Subsidy Explorer
│   │   │   ├── services/              # API Clients & Groq Service
│   │   │   └── App.jsx                # React Router Navigation
│   │   ├── package.json
│   │   └── vite.config.js
│   │
│   └── ComplianceOS_Project_Report.pdf # Comprehensive 23-Page Technical & GTM Report
└── README.md
```

---

## 🛠️ Technology Stack

| Component | Technology | Rationale |
|:---|:---|:---|
| **Frontend Framework** | **React 18 + Vite** | Blazing-fast SPA performance with modular component architecture |
| **Styling & Icons** | **Tailwind CSS + Lucide React** | Consistent, modern vernacular design system |
| **Animation & Viz** | **Framer Motion + Recharts** | Micro-interactions and explainable compliance analytics |
| **Backend API** | **FastAPI (Python 3.11+)** | High-concurrency async ASGI server with native Pydantic typing |
| **Primary Relational DB**| **PostgreSQL (asyncpg + SQLAlchemy)** | ACID transactions for user profiles, calendar events, and audit logs |
| **Document Vault DB** | **MongoDB (Motor)** | Flexible schema for unstructured OCR text, raw metadata, and JSON extracts |
| **Cache & Task Queue** | **Redis + Celery** | Asynchronous document processing and scheduled regulatory scraping |
| **AI Inference** | **Groq (Llama 3.1 70B / Mixtral)** | Ultra-low latency LLM inference for real-time vernacular extraction |
| **Voice & Speech** | **Sarvam AI / Bhashini** | Best-in-class Hindi-English code-mixing (Hinglish) speech recognition |
| **Encrypted Storage** | **Cloudflare R2 (S3 API)** | Cost-effective, DPDP-compliant encrypted object storage |

---

## 🚀 Getting Started & Local Setup

### Prerequisites
- **Python 3.11+**
- **Node.js 18+ & npm**
- **Docker & Docker Compose** (recommended for databases)
- **Tesseract OCR** (`sudo apt-get install tesseract-ocr`)

---

### Option A: Running with Docker (Recommended)

1. **Start all infrastructure services** (PostgreSQL, MongoDB, Redis, Backend):
   ```bash
   cd complianceOS/complyos-backend
   docker-compose up -d
   ```

2. **Verify services**:
   - Backend API: `http://localhost:8000`
   - Interactive Swagger Docs: `http://localhost:8000/docs`
   - MongoDB: `localhost:27017`
   - Redis: `localhost:6379`

3. **Start the Frontend**:
   ```bash
   cd ../complyos-frontend
   npm install
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

---

### Option B: Manual Local Setup

#### 1. Backend Setup
```bash
cd complianceOS/complyos-backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env   # Adjust values in .env

# Run FastAPI development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend Setup
```bash
cd complianceOS/complyos-frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

---

## ⚙️ Environment Variables

Create `.env` in `complianceOS/complyos-backend/`:

```env
# Application
APP_NAME=ComplianceOS
SECRET_KEY=generate-a-secure-random-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
FRONTEND_URL=http://localhost:5173

# Databases
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/complyos_db
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB=complyos_docs
REDIS_URL=redis://localhost:6379/0

# LLM & AI Services
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.1-70b-versatile

# Cloudflare R2 / S3 Storage (Optional for local test)
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=complyos-vault
R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
```

---

## 💼 Business Model & Unit Economics

### Subscription Tiers (Simplified & ICAI-Compliant)

Judges and compliance regulators reward ethical focus. We charge zero commission on CA fees and run zero ads on the compliance platform:

| Plan | Price | Target Audience | What is Included |
|:---|:---|:---|:---|
| **Free (Funnel)** | **₹0** | Micro businesses & unregistered artisans | Hindi voice onboarding, Business Profile, Health Score, 5 calendar items, 3 scheme matches, 1 document/month, weekly digest |
| **Growth** | **₹299 / mo** *(₹239 for women-led)* | GST-registered MSMEs & small manufacturers | Unlimited documents, SENTINEL targeted alerts, full scheme matching with checklists, 7-3-1 day reminders, CA share link |
| **CA Partner** | **₹999 / mo** (up to 25 clients)<br>**₹2,499 / mo** (up to 100 clients) | Practising CAs & Tax Advocates | Client dashboard, consolidated calendar, document review queue, verify/flag actions *(Flat SaaS fee; zero cut of professional fees)* |

### Unit Economics per Paying User (₹299 Plan)
- **WhatsApp Utility Reminders (30)**: ₹4.07
- **WhatsApp Marketing Digests (3)**: ₹3.06
- **WhatsApp Service Replies (100)**: ₹13.57
- **Speech-to-Text (6 minutes via Sarvam)**: ₹10.62
- **Document OCR + Vision LLM**: ₹12.00
- **Chat LLM (ARIA)**: ₹10.00
- **Cloud Infrastructure & Storage**: ₹4.00
- **Payment Gateway (2%)**: ₹5.98
- **Total Variable Cost**: **₹63.30**
- **Gross Margin**: **79%**

> **Free Tier Capping Mandate**: An uncapped free user costs ~₹41/month, which erodes blended margin at low conversion. Capping free users to 1 document/month and weekly WhatsApp digests reduces per-user cost to **₹16/month**, securing positive blended margins even at 5–8% conversion.

---

## ⚖️ Legal, Regulatory & Safety Guardrails

| Legal Dimension | Statutory Context | Risk | ComplianceOS Architectural Safeguard |
|:---|:---|:---|:---|
| **ICAI Professional Ethics** | Clause 6 & 7 (Part I, First Schedule) bar solicitation, advertising, and fee-sharing with non-members `[S18]` | Treating CA consultation fee cuts as illegal fee-sharing | **Flat monthly subscription for CAs only.** Zero commission on CA fees. Objective metrics (response time, verification badges) instead of subjective star reviews. |
| **Portal Automation & Liability** | GSTN / IT portals utilize OTPs and strict terms of service | Account suspension, liability for unauthorized filing | **Zero auto-filing. Zero credential storage.** We provide step-by-step checklists and official deep links only. |
| **DPDP Act 2025** | Digital Personal Data Protection Rules notified Nov 2025; penalties up to ₹250 Cr `[S19]` | Handling PAN, GSTIN, payroll, and proprietary documents | Granular consent on first interaction, purpose limitation, zero retention of Aadhaar/passwords, India-hosted encrypted storage, one-tap data wipe. |
| **AI Advice vs. Legal Liability** | High risk of hallucinated filing deadlines or tax rates | Tax miscalculations leading to fines | Citations with `last_verified` dates; deterministic Python calculators for Section 47/50 penalties; prominent disclaimer: *"Informational assistance; not professional legal or tax advice."* |

---

## 🧪 Evaluation Plan & Benchmark Targets

The platform is evaluated against rigorous, measurable benchmarks:

| Component | Test Dataset | Success Metric |
|:---|:---|:---|
| **VEDA Document Extraction** | 30 diverse Indian documents (10 GST certificates, 10 notices/challans, 10 invoices/licences; including phone captures and Hindi scripts) | **Field-level exact match $\ge 88\%$**; $100\%$ of extraction errors flagged as low-confidence. |
| **ARIA Speech-to-Text** | 20 Hindi and Hinglish voice clips from 5 speakers across noisy shopfloor environments | **Word Error Rate (WER) $< 18\%$**; Profile slot-completion rate $\ge 90\%$ within 5 conversational turns. |
| **SCOUT Scheme Engine** | 10 synthetic MSME profiles evaluated against hand-labeled ground-truth schemes | **Precision $\ge 95\%$**, Recall $\ge 90\%$, Zero false-positive hallucinated schemes. |
| **SENTINEL Alert Precision** | 10 official gazette circulars matched against test business database | **Relevance Precision $\ge 90\%$**; False-alert rate $< 5\%$. |

---

## 📚 Sources & Verification Matrix

All metrics, statutory rules, and market assumptions are grounded in verified documentation (cut-off: September 2026):

- `[S1]` **Ministry of MSME** (UNI Press Release, 27 Jun 2026) — 8.7 Cr registrations, 31.1% GDP contribution, 48.58% export share.
- `[S4]` **MSME Sizing & Funding Gap** (Policy Circle, Apr 2025) — 99%+ registrations are micro-enterprises.
- `[S5]` **NITI Aayog / IFC MSME Report** (PIB) — Only 19% of MSME credit demand formally met; awareness limits scheme uptake.
- `[S7]` **GSTN Data via A2Z Taxcorp** (Jul 2026) — 1.67 Cr active GST registrations; Uttar Pradesh leads new registrations.
- `[S9]` **CGST Act 2017**: Section 47 (Late Fees) & Section 50 (Interest on delayed tax payment).
- `[S11][S13]` **Labour Codes Tracker** (DLA Piper / LKS Law, May 2026) — Central rules notified under all 4 Labour Codes.
- `[S18]` **ICAI Code of Ethics** — Clauses 2, 6, and 7 guidelines on advertising and non-member fee splitting.
- `[S19]` **DPDP Act 2023 & DPDP Rules 2025** — Data fiduciary obligations, consent framework, and storage limitations.
- `[S20]` **Meta WhatsApp Business Platform** — Utility vs. Marketing conversation rate cards.
- `[S23]` **Uttar Pradesh MSME Promotion Policy 2022 & CM YUVA** — 0% interest project loans up to ₹5 Lakh, ODOP subsidies across all 75 districts.

---

<p align="center">
  <b>ComplianceOS (भारत)</b> — Empowering India's small businesses with compliance clarity and financial freedom.
</p>