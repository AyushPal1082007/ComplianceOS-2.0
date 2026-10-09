# ComplianceOS 2.0 Migration Plan

## Overview
Transitioning from **dual backend (FastAPI + Express)** to **single Express backend** with **ES6 modules** throughout.

---

## Phase 1: Express Backend → ES6 Modules ✅

### Status: Converting CommonJS to ES6
All Express backend files need conversion from `require()` to `import`/`export`.

**Files to Convert:**
- `src/server.js` - Entry point
- `src/app.js` - App configuration
- `src/config.js` - Config (partially done)
- `src/db.js` - Prisma client
- `src/logger.js` - Logging
- `src/middleware/**` - All middleware
- `src/routes/**` - All route files (12 files)
- `src/services/**` - All services
- `src/utils/**` - All utilities
- `src/jobs/**` - Background jobs

**Conversion Pattern:**
```javascript
// OLD (CommonJS)
const express = require('express');
module.exports = app;

// NEW (ES6)
import express from 'express';
export default app;
```

### Express Routes → Package.json Already Set
✅ Backend already has `"type": "module"` in package.json

---

## Phase 2: Frontend Routes Alignment ✅

### Current Frontend Routes
```
/ → Landing
/onboarding → Onboarding
/dashboard → Dashboard
/calendar → Calendar
/documents → Documents
/schemes → Schemes
/registration → Registration
/ca-connect → CA Connect
/loans → Loans
/notices → Notices
/profile → Profile
/ca-dashboard → CA Dashboard
/ca/dashboard → CA Dashboard (alias)
/ca-fraud-shield → CA Fraud Shield
/ca/fraud-shield → CA Fraud Shield (alias)
/ca/approval-requests → CA Approval Requests
```

### Express Backend Routes
```
/health → Health check
/auth → Authentication
/api/business → Business operations
/api/documents → Document processing
/api/compliance → Compliance checks
/api/schemes → Schemes management
/api/sentinel → Sentinel crawler
/api/ca → CA operations
/api/notifications → Notifications
/api/payments → Razorpay payments
/api/admin → Admin operations
/api/agent-trace → Agent trace logs
/webhook/whatsapp → WhatsApp webhook
```

### Status: ✅ Already Aligned
Frontend routes match Express backend structure. No changes needed.

---

## Phase 3: Python Backend Audit

### Routers in Python Backend
1. `auth.py` - Authentication
2. `business.py` - Business operations
3. `ca.py` - CA operations
4. `compliance.py` - Compliance checks
5. `dashboard.py` - Dashboard (⚠️ **Not in Express**)
6. `documents.py` - Document processing
7. `freelancers.py` - Freelancers (⚠️ **Not in Express**)
8. `loans.py` - Loans
9. `notifications.py` - Notifications
10. `registration.py` - Registration
11. `schemes.py` - Schemes
12. `ws_aria.py` - WebSocket ARIA agent

### Missing in Express Backend
- **`/dashboard` endpoint** - Need to implement
- **`/freelancers` endpoint** - Need to implement
- **WebSocket ARIA agent** - Need to implement
- **Sentinels/Crawlers** - Need to check implementation

### Action Required
✅ Create issues to add missing endpoints to Express backend:
1. Dashboard statistics endpoint
2. Freelancers management
3. WebSocket-based ARIA agent

---

## Phase 4: Next Steps (Priority Order)

### Sprint 1: Backend Modernization
1. **Convert Express to ES6 modules** (This task)
   - All require() → import
   - All module.exports → export
   - Update error handling for async/await
   
2. **Verify Middleware & Utilities** 
   - Auth middleware (JWT validation)
   - Error handler
   - Rate limiters
   
3. **Test Backend Integration**
   - Run all routes
   - Verify database connections
   - Test background jobs (BullMQ)

### Sprint 2: Python Backend Decommissioning
1. **Add Missing Endpoints to Express**
   - Dashboard aggregation endpoint
   - Freelancers API
   - WebSocket ARIA agent
   
2. **Migrate Special Features**
   - Python dependencies analysis (LangChain, sentence-transformers)
   - Check if needed in Express
   
3. **Delete Python Backend**
   - After all features migrated
   - Archive in git history

### Sprint 3: Frontend Refinement
1. **Environment Configuration**
   - Update `VITE_API_URL` to Express backend
   - Verify CORS headers
   
2. **API Client Updates**
   - Ensure axios calls match Express routes
   - Test end-to-end flows

3. **Testing & QA**
   - Integration tests
   - User acceptance testing

---

## Files Changed This Session

### Express Backend (ES6 Conversion)
- ✅ `complyos-backend-express/src/config.js` - Already ES6
- ⏳ `complyos-backend-express/src/server.js` - CommonJS → ES6
- ⏳ `complyos-backend-express/src/app.js` - CommonJS → ES6
- ⏳ `complyos-backend-express/src/db.js` - CommonJS → ES6
- ⏳ `complyos-backend-express/src/logger.js` - CommonJS → ES6
- ⏳ All middleware files
- ⏳ All route files
- ⏳ All service files

### Frontend (No Changes)
- ✅ Already using ES6 modules
- ✅ Routes already aligned with Express

---

## Python Backend Dependencies

**Can be migrated to Express:**
- `langchain` + `langchain-groq` → `groq-sdk` (already in Express)
- `sentence-transformers` → Use existing Groq embeddings
- `fastapi` → Express (done)
- `sqlalchemy` + `asyncpg` → Prisma (done)
- `redis` → ioredis (done)
- `celery` → BullMQ (done)

**Already in Express:**
- `dotenv`
- `pydantic` validation → Express middleware
- JWT auth → jsonwebtoken
- Email → resend
- SMS → fast2sms
- OCR → @google-cloud/vision

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Breaking API changes | HIGH | Test all routes before deletion |
| Missing features | MEDIUM | Complete audit before Python deletion |
| Database schema mismatch | MEDIUM | Use Prisma schema validation |
| Performance regression | LOW | BullMQ handles jobs same as Celery |

---

## Success Criteria

- [ ] All Express routes in ES6 modules
- [ ] All 12 Python routes replicated in Express
- [ ] Frontend tests passing
- [ ] Backend tests passing
- [ ] Python backend directory deleted
- [ ] No CommonJS in Express
- [ ] All circular dependencies resolved
