# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Multi-Channel Customer Support System (LINE OA + Facebook Messenger) built with **Cloudflare Workers (Hono) + Vue 3 (Composition API) + TypeScript strict mode**. Real-time via WebSocket Durable Objects. Database: D1 + Drizzle ORM. Storage: R2. Cache: KV. Queue: Cloudflare Queues.

## Architecture

```
Backend:  src/index.ts → Hono routes → src/modules/{auth,conversations,messaging,teams,tags,websocket,customer,system,delayed-message}/
Frontend: frontend/src/main.ts → Vue 3 + Pinia stores + Vue Router
```

- **Backend modules**: `src/modules/<domain>/handlers/` (routes) + `services/` (logic) + `types/`
- **10 Durable Objects** (binding names per `wrangler.toml`):
  - In `src/durable-objects/`: `ConversationRoom`, `UserConnection`, `MessageBroadcaster`, `LatestMessageCacheCoordinator`, `CustomerConversationDO`, `CustomerMessageDO`, `RateLimiterDO`, `MetricsCollectorDO`
  - Aliased: `DelayedMessageBuffer` → exports `DelayedMessageScheduler` from `durable-objects/DelayedMessageScheduler.ts` (see `src/index.ts:846`)
  - Outside DO folder: `LockCoordinator` lives in `src/services/distributed-lock-service.ts`
- **Frontend stores**: `frontend/src/stores/` (Pinia)
- **Frontend services**: `frontend/src/services/` (WebSocket client, conversation sync)
- **Schema**: `src/db/schema.ts`
- **Auth middleware**: `src/middleware/auth.ts` (JWT + team role enforcement)
- **CORS**: `src/config/cors.ts` (single source of truth)
- **Web Installer**: `web-installer/` (self-hosted deployment, see `docs/claude/WEB_INSTALLER.md`)

## Development Commands

>  **REMOTE RESOURCES ONLY** — all dev connects to production D1, KV, R2, Durable Objects. No local environment.

### Backend (root)
```bash
bun run dev # Wrangler dev with REMOTE bindings
bun run build # TypeScript compilation check
bun run deploy # Deploy to production
bun run db:migrate # Apply migrations to REMOTE D1
bun run db:generate # Generate Drizzle migrations
bun run db:studio # Open Drizzle Studio for REMOTE DB
bun run health:check:all # Check system + WebSocket health
```

### Frontend (frontend/)
```bash
bun run dev # Vite dev server (port 5173)
bun run build # Production build
bun run test # Run all Vitest tests
bun run test:coverage # Coverage report
bun run lint # ESLint with auto-fix
bun run type-check # Vue TypeScript checking
```

## Package Manager

**Bun only.** `bun install`, `bun run <script>`, `bunx <pkg>`. Lock file: `bun.lock` (never `package-lock.json`).

## Important File Locations

| Category | Path |
|----------|------|
| Worker entry | `src/index.ts` |
| DB schema | `src/db/schema.ts` |
| Auth middleware | `src/middleware/auth.ts` |
| CORS config | `src/config/cors.ts` |
| Runtime config (BE) | `src/config/runtime.ts` |
| Runtime config (FE) | `frontend/src/config/runtime.ts` |
| Worker bindings | `wrangler.toml` |
| FE env vars | `frontend/.env.development`, `.env.production` |
| BE env vars | `.dev.vars` |
| Constants | `src/constants/` (durable-objects.ts, limits.ts) |
| Env type defs | `frontend/src/vite-env.d.ts` |

## Environment Configuration

**Pattern:** env vars → runtime config → business logic (3-layer)

```typescript
import { getBackendUrl, getWebSocketUrl } from '@/config/runtime';
// Never hardcode URLs — always use runtime config functions
```

See `docs/claude/ENVIRONMENT_CONFIG.md` for details.

## UI/UX Design System

**All frontend design work MUST follow the "Apple-Native Soft Minimalism" design system** documented in `docs/UIUX-Design-System.md`. Key rules:

- Bento Grid modular card layout, page padding 20px, card gap 16px
- Cards: white + large rounded corners (rounded-2xl~3xl) + soft shadow `shadow-[0_4px_16px_rgb(0,0,0,0.06)]`
- No hard 1px borders — use shadow + background color difference
- Buttons/tags: capsule shape (rounded-full)
- Page background: `#F2F2F7` (iOS system gray), cards: `#FFFFFF`
- Text: never pure black — primary `#1C1C1E`, secondary `#8E8E93`
- Accent colors: Blue `#007AFF`, Green `#34C759`, Orange `#FF9500`, Red `#FF3B30`
- Pastel accents for tags/categories (low saturation, high brightness)
- Navigation bars: frosted glass `bg-white/80 backdrop-blur-xl`
- Icons: SF Symbols / Lucide Icons (outline/filled toggle)
- Animations: 200-350ms, ease-out, smooth and non-intrusive

**Before outputting any UI, run through the design checklist in Section 15 of the design doc.**

### Button System (Canonical Source)

The global button system lives **only** in `frontend/src/style.css` (Apple-native: flat iOS system colors, no glow shadows, no layout-shifting hovers, `rounded-xl` 12px radius).

**NEVER redefine these classes in component `<style>` blocks:**
`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-success`, `.btn-warning`, `.btn-ghost`, `.btn-sm`, `.btn-lg`

Component-level redefinitions cause a "flash of wrong styles" (scoped loads first, global loads second, they conflict). A lint guard (`bun run lint:scoped-btn`) enforces this — it runs automatically in the PostToolUse health-check hook and in `scripts/check.sh`.

**Allowed:** contextual descendants (`.modal-footer .btn { margin: 0 }`), compound selectors (`.btn.is-loading`), and `@media` responsive/accessibility overrides.

## Development Rules

### Route Registration Order ( Critical)

In Hono, route registration order = routing priority. Routes registered later **cannot override** earlier catch-all routes.

**Priority Levels in `src/index.ts`:**
1. **P1 (HIGHEST)**: Public endpoints — register BEFORE unified route system
2. **P2**: Explicit auth endpoints (with jwtAuth middleware)
3. **P3**: Unified route system (RouteRegistry batch registration)
4. **P4**: Fine-grained individual routes

```typescript
// BAD: Register after unified route system — will be intercepted
routeGroups.forEach(group => routeRegistry.registerGroup(group));
app.route('/api/myendpoint', myHandler); // TOO LATE

// GOOD: Pre-register BEFORE unified route system
app.route('/api/myendpoint', myHandler); // PRIORITY
routeGroups.forEach(group => routeRegistry.registerGroup(group));
```

See `docs/claude/ROUTE_REGISTRATION.md` for full guide.

### Auto Health Check (PostToolUse Hook)

A PostToolUse hook runs TypeScript type-check + ESLint after every Edit/Write on `.ts`/`.vue` files.

- **Backend file** (`src/`): runs `tsc --noEmit`
- **Frontend file** (`frontend/`): runs `vue-tsc --noEmit` + `eslint --fix`
- Skips non-TS/Vue files, test files, and generated files

**When health check reports errors: FIX THEM IMMEDIATELY without asking the user.** Read the error output, identify the root cause, and apply the fix. Do not ask for permission — just fix it.

```bash
bash scripts/check.sh # Full check (backend + frontend)
bash scripts/check.sh backend # Backend only
bash scripts/check.sh frontend # Frontend only
```

Config: `.claude/hooks/health-check.sh`, `.claude/settings.local.json`

### Code Style
- **TypeScript strict mode** — all code must be type-safe
- **No `any` types** except in test files
- **Vue 3 Composition API** preferred over Options API
- **ESLint + Prettier** for formatting

### Type-Check Toolchain (NEVER mix up `tsc` and `vue-tsc`)

| Subproject | Correct tool | Reason |
|------------|--------------|--------|
| Backend (`src/`) | `tsc --noEmit` | No `.vue` SFCs |
| Frontend (`frontend/`) | `vue-tsc --noEmit` (via `bun run type-check`) | Needs Volar to read `<script setup>` named exports |
| `web-installer/backend/` | `tsc --noEmit` | No `.vue` SFCs |
| `web-installer/frontend/` | `vue-tsc --noEmit` | SFC project |

**Rule:** Never run plain `tsc` against `frontend/` — it cannot see named type exports inside `<script setup lang="ts">` blocks (the `*.vue` shim from `vite/client` only declares the default component export). It will produce phantom `TS2614 Module '"*.vue"' has no exported member 'X'` errors that do not exist under `vue-tsc`. Always use `bun run type-check` (or `bunx vue-tsc --noEmit`).

CI (`bun run lint:check`), pre-commit (`.husky/pre-commit`), and the PostToolUse health-check hook all already route to the correct tool — this rule is for ad-hoc manual invocations.

### Database Operations
- Use **Drizzle ORM** for all DB operations
- **Soft Delete**: use `deletedAt` column instead of hard delete (teams, agents, customers, conversations, messages, tags)
- **Channel Integrations**: JSON columns (`config`, `credentials`, `webhookConfig`, `stats`) — no schema changes for new platforms
- **Credentials**: encrypted via AES-256-GCM in `encryption-service.ts`
- Use **distributed locks** (Durable Objects) for race condition prevention
- Integrate DB writes with **WebSocket event broadcasting**

### Authentication
- JWT managed in `src/utils/auth.ts`
- Session persistence via KV
- Route protection: `frontend/src/middleware/authGuard.ts`
- **Dual roles**: System (Admin/Agent) + Team (Member→Lead→Supervisor)
- JWT caches `allowedTeamIds[]` and `teamRoles{}` for multi-team support

### Deployment Policy
- **REMOTE PRODUCTION ONLY** — no local D1/KV/R2, no staging
- DO NOT add `[env.development]` or `[env.staging]` to `wrangler.toml`
- Deploy: `bun run deploy` (Worker) / `bun run deploy:pages` (Frontend)

---

- API 用 API 呼叫，不要用 local
- Always think hard.
- local 環境不存在，一律使用 remote
- Always check chrome-devtools docs to make sure it is up-to-date when needed for implementing new libraries or frameworks, or adding features using them.
- If you find file content exceeds maximum allowed tokens (25000), please use offset and limit parameters to read specific portions of the file, or use the GrepTool to search for specific content.
