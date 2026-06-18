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

> **REMOTE-FIRST, with a LOCAL D1 MIRROR.** Default dev connects to production D1, KV, R2, Durable Objects. A **local D1 mirror** also exists and must be kept **1:1 with remote DATA** via `bun run db:sync:local`. Scope of local mirroring is **D1 only** — KV, R2, and Durable Objects remain remote-only (no local copies).

### Backend (root)
```bash
bun run dev # Wrangler dev with REMOTE bindings (default)
bun run dev:local # Wrangler dev with LOCAL bindings (uses the local D1 mirror)
bun run db:sync:local # Pull REMOTE D1 -> LOCAL miniflare D1 (1:1 data mirror; remote read-only)
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

### Git Hooks — Two-Stage Pipeline (pre-commit / pre-push)

The repo splits safety checks into a **fast pre-commit** and a **full pre-push** so that atomic commits don't repeatedly pay for full-project type-check.

**`.husky/pre-commit`** (~20s, parallel) — fail-fast structural guards that MUST block a bad commit:
- `check-import-paths.ts` (no deep relative imports)
- `check:routes:ci` (Hono route conflict detector)
- `check:sql-raw:ci` (SQL injection regression guard)

All three run concurrently via background jobs (`&` + `wait`). Type-check and ESLint are intentionally NOT here — they live in pre-push.

**`.husky/pre-push`** (~105s warm, ~340s cold) — full correctness gate, parallel:
- `bunx tsc --noEmit` (backend, incremental via `tsBuildInfoFile`)
- `cd frontend && bunx vue-tsc --noEmit` (frontend SFCs, incremental)
- `cd frontend && bunx eslint . --cache` (ESLint with content-strategy cache)

Caches live in `node_modules/.cache/` (already gitignored). First push after `bun install` is cold; subsequent pushes hit the incremental cache and run ~3× faster.

**Why this design**:
- Atomic commits stay cheap (20s × N) instead of paying full check on each commit (80-200s × N).
- PostToolUse health-check hook already catches most type errors during the edit cycle, so a pre-commit type-check would be redundant.
- pre-push is the last line of defence before code leaves the machine; CI is the absolute final gate.

**Bypass** (NOT recommended): `git commit --no-verify` / `git push --no-verify`.

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
- **DEPLOY TARGET IS REMOTE PRODUCTION ONLY** — no staging. The local D1 mirror (below) is a dev/inspection convenience, never a deploy target.
- **KV / R2 / Durable Objects remain remote-only** — no local copies. Only D1 has a local mirror.
- DO NOT add `[env.development]` or `[env.staging]` to `wrangler.toml`
- **MANUAL DEPLOY ONLY** — CI auto-deploy is disabled (`deploy-production: if: false` in `.github/workflows/ci-cd.yml`). Push to main runs validate/test/build but never ships.
- Deploy: `bun run deploy` (Worker) / **`bun run deploy:pages` (Frontend — PREFER THIS)**
- **Frontend deploy MUST go through `bun run deploy:pages`** (`scripts/deploy-pages.ts`), never a raw `wrangler pages deploy`. Vite bakes `VITE_*` into the bundle at build time, so a missing `VITE_BACKEND_URL` silently ships a bundle that crashes on load (page stuck at "載入中..."). The script reads the expected URL from `frontend/.env.production`, builds, then **guards**: it refuses to deploy unless that URL is actually baked into `dist/`.
- `frontend/.env.production` is **required for local builds** but is gitignored (local-only). Mirror the Cloudflare Pages dashboard values; template in `frontend/.env.production.example`. Pages dashboard env vars do NOT reach the build — the build runs locally/in CI, not on Cloudflare.

---

- 預設一律使用 remote 資源（D1/KV/R2/DO 都連 production）。
- Always think hard.
- 本地有一份 **D1 鏡像**，必須與 remote 資料保持 1:1：用 `bun run db:sync:local` 同步（remote 唯讀），用 `bun run dev:local` 以本地 D1 啟動。僅限 D1，KV/R2/DO 無本地副本。
- Always check chrome-devtools docs to make sure it is up-to-date when needed for implementing new libraries or frameworks, or adding features using them.
- If you find file content exceeds maximum allowed tokens (25000), please use offset and limit parameters to read specific portions of the file, or use the GrepTool to search for specific content.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Multi-Channel-Integration-System** (57499 symbols, 92537 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Multi-Channel-Integration-System/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Multi-Channel-Integration-System/clusters` | All functional areas |
| `gitnexus://repo/Multi-Channel-Integration-System/processes` | All execution flows |
| `gitnexus://repo/Multi-Channel-Integration-System/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
