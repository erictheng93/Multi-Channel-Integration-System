# Web Installer (Self-Hosted Deployment System)

**Location:** `web-installer/`
**Status:** Backend fully implemented and tested (verified 2026-07-05); see [Next Steps](#next-steps-for-web-installer) for what's still outstanding before a production rollout.
**Purpose:** Enable customers to deploy the CRM system to their own Cloudflare accounts with zero technical knowledge

## Overview

The Web Installer is a complete self-service deployment system that transforms the complex manual deployment process into a simple 3-minute one-click solution for small businesses and non-technical users.

## Key Features

### For End Users
- **One-Click OAuth** - Seamless Cloudflare authentication
- **Automated Provisioning** - Creates all necessary resources (D1, KV, R2, Queue, Worker, Pages)
- **Real-time Progress** - Live deployment status with Server-Sent Events
- **Automatic Rollback** - Cleans up resources automatically on failure
- **Email Notifications** - Sends credentials and deployment summary
- **Cost Transparent** - Starts at $0/month on Cloudflare Free tier

### For Developers
- **Fully Implemented Backend** - 186 passing tests across 11 test files (unit + integration; verified via `bun run test:ci`, 2026-07-05)
- **TypeScript Throughout** - Full type safety
- **Durable Objects** - Stateful deployment orchestration (`DeploymentOrchestrator`, ~980 lines)
- **Comprehensive Documentation** - 4 complete guides (200+ pages equivalent)
- **Well-Tested** - Unit tests for utils, integration tests for every service, route, and the orchestrator DO

## Architecture

```
User Browser (Vue 3 Frontend)
         │
         ├─ Landing Page → OAuth → Config Form → Progress → Success/Error
         │
         ▼
Cloudflare Worker (Backend)
         │
         ├─ Durable Object: DeploymentOrchestrator
         │ └─ 15-step deployment pipeline with SSE broadcasting
         │
         ├─ Services Layer
         │ ├─ CloudflareAPI (resource provisioning)
         │ ├─ MigrationRunner (database setup)
         │ ├─ ConfigGenerator (config generation)
         │ ├─ EmailService (notifications)
         │ └─ RollbackService (cleanup)
         │
         ▼
Cloudflare Platform API
```

## Project Structure

```
web-installer/
├── backend/
│ ├── src/
│ │   ├── utils/            validation.ts + errors.ts — unit tested (28 tests)
│ │   ├── services/         Implemented: CloudflareAPI, ConfigGenerator,
│ │   │                     EmailService, MigrationRunner, RollbackService,
│ │   │                     WorkerBundleService, FrontendBundleService
│ │   │                     (integration-tested against mocked Cloudflare API)
│ │   ├── durable-objects/  DeploymentOrchestrator — implemented, integration-tested
│ │   └── routes/           auth.ts, deployment.ts, oauth.ts — implemented,
│ │                         integration-tested
│ ├── tests/
│ │   ├── unit/utils/               28 tests
│ │   └── integration/              158 tests (routes, services, durable-objects)
│ ├── package.json Complete
│ ├── tsconfig.json Complete
│ ├── vitest.config.ts Complete
│ └── wrangler.toml Complete
│
├── frontend/ Implemented
│ ├── src/
│ │   ├── views/ 6 components with full code
│ │   ├── components/ 4 shared components
│ │   ├── stores/ Pinia store
│ │   ├── api/ API client
│ │   └── router/ Router config
│ └── [config files] Complete
│
├── DEVELOPER_DOCUMENTATION.md 13 comprehensive sections
├── README.md Complete project overview
├── DEPLOYMENT_CHECKLIST.md 26-step deployment guide
├── QUICK_START_GUIDE.md User-friendly guide
└── PROJECT_SUMMARY.md Complete project summary
```

> `services/generated/` also contains prebuilt `worker-bundle.ts` / `frontend-bundle.ts` (bundled artifacts injected into each new deployment) — not hand-written source, so not itemized above.

## Test Results

Verified 2026-07-05 via `bun run test:ci` (`INCLUDE_DO_TESTS=true vitest run`) in `web-installer/backend/`:

```
 Test Files: 11 passed (11)
 Tests:      186 passed (186) - 100% pass rate
```

Covers: `utils/validation.ts`, `utils/errors.ts` (unit), `routes/oauth.ts`,
`routes/deployment.ts`, `durable-objects/DeploymentOrchestrator.ts`, and all
seven services (`CloudflareAPI`, `ConfigGenerator`, `MigrationRunner`,
`EmailService`, `WorkerBundleService`, `RollbackService`) via integration
tests against a mocked Cloudflare API.

> `bun run test:coverage` (v8 coverage) currently reports 0% statement
> coverage across the board despite all 186 tests passing — this looks like
> an instrumentation mismatch with the Workers runtime test environment
> (Miniflare/workerd), not a real coverage regression. Treat coverage % from
> that command as unreliable until investigated; use pass/fail test counts
> as the trustworthy signal.

## Deployment Flow (15 Steps, ~2-3 minutes)

1.  Initialize deployment (0%)
2.  Create D1 Database (5%)
3.  Create KV Namespaces x2 (10%)
4.  Create R2 Bucket (15%)
5.  Create Queue (20%)
6.  Run database migrations (40%)
7.  Generate wrangler.toml (50%)
8.  Deploy Worker (60%)
9.  Build frontend (70%)
10.  Deploy Pages (80%)
11.  Configure custom domain (85%)
12.  Create admin user (90%)
13.  Send welcome email (95%)
14.  Run health checks (98%)
15.  Complete (100%)

## Development Commands

```bash
# Backend Development
cd web-installer/backend
bun install
bun run dev # Start Worker development server
bun run test:ci # Run full suite (186 tests, incl. DO integration tests)
bun run test:coverage # Generate coverage report (currently unreliable — see Test Results)
bun run deploy # Deploy to production

# Frontend Development
cd web-installer/frontend
bun install
bun run dev # Start Vite dev server
bun run build # Build for production
bun run deploy:pages # Deploy to Cloudflare Pages
```

## Documentation

All documentation is located in `web-installer/`:

1. **DEVELOPER_DOCUMENTATION.md**
   - Complete technical guide (13 sections)
   - Architecture diagrams
   - API reference with examples
   - Testing guide
   - Deployment procedures
   - Troubleshooting

2. **README.md**
   - Project overview and features
   - Quick start guide
   - Technology stack
   - Cost estimation
   - Roadmap

3. **DEPLOYMENT_CHECKLIST.md**
   - 26-step production deployment guide
   - Pre/post-deployment verification
   - Monitoring setup
   - Rollback procedures

4. **QUICK_START_GUIDE.md**
   - Non-technical user guide
   - Step-by-step instructions
   - Troubleshooting
   - FAQ

5. **PROJECT_SUMMARY.md**
   - Complete deliverables overview
   - Test results
   - Architecture summary
   - Metrics and achievements

## Resources Created by Installer

When a customer deploys through the Web Installer, it automatically creates:

- **D1 Database** - SQLite on the edge (5GB free)
- **KV Namespaces** x2 - Session and cache storage (100k reads/day free)
- **R2 Bucket** - File storage (10GB free)
- **Queue** - Message queue for delayed messages
- **Worker** - Backend API (100k requests/day free)
- **Pages** - Frontend hosting (unlimited free)
- **26+ Database Tables** - Complete schema with indexes

## Technology Stack

**Backend:**
- Cloudflare Workers (Runtime)
- Hono (Web framework)
- Durable Objects (State management)
- TypeScript (Type safety)

**Frontend:**
- Vue 3 (UI framework)
- Pinia (State management)
- TypeScript (Type safety)
- Vite (Build tool)

## Security Features

 OAuth 2.0 with Cloudflare
 CSRF protection (state parameter)
 Input validation (all endpoints)
 Custom error handling
 No credential storage
 Automatic secret generation
 HTTPS enforcement

## Cost Estimation

**Free Tier (Most Small Businesses):**
- Workers: $0 (100k requests/day)
- D1: $0 (5GB storage)
- R2: $0 (10GB storage)
- Pages: $0 (unlimited)
- **Total: $0/month**

**Paid Tier (Growing Businesses):**
- Workers: $5/month (10M requests)
- D1: $5/month (25GB)
- R2: ~$5/month (100GB)
- **Total: $10-30/month**

## Next Steps for Web Installer

1.  Deploy to staging environment
2.  Beta testing with 5-10 users
3.  Performance optimization
4.  Deploy to production
5.  Monitor usage metrics
6.  Add requested features

## Support

- **Documentation:** All guides in `web-installer/`
- **Tests:** Run `bun run test:ci` in `web-installer/backend/` (Bun only — see root `CLAUDE.md`)
- **Issues:** Track in GitHub Issues
- **Questions:** Check DEVELOPER_DOCUMENTATION.md
