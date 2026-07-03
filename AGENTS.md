# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the Cloudflare Workers backend, with domain code under `src/modules/`, shared services in `src/services/`, middleware in `src/middleware/`, and Durable Objects in `src/durable-objects/`. `frontend/src/` contains the Vue 3 app: `components/`, `views/`, `stores/`, `api/`, and `services/`. Backend tests live in `tests/`; frontend tests live in `frontend/tests/` and `frontend/src/**/*.test.ts`. Database migrations are in `migrations/` and `drizzle/`. Operational scripts are in `scripts/`, and architecture and process docs are in `docs/`.

## Build, Test, and Development Commands
Use Bun, not npm/yarn/pnpm.

- `bun run dev`: run the backend Worker with Wrangler remote dev (default; connects to production D1/KV/R2/DO).
- `bun run dev:local`: run the backend Worker with Wrangler local bindings, using the local D1 mirror.
- `bun run db:sync:local`: pull remote D1 down into the local miniflare D1 so it is a 1:1 data mirror (remote export is read-only). D1 only — KV/R2/DO are not mirrored locally.
- `cd frontend && bun run dev`: run the Vite frontend on port `5173`.
- `bun run build`: backend TypeScript check.
- `cd frontend && bun run build`: frontend type-check and production build.
- `bun run check`: run the main health check script for backend and frontend.
- `bun run check:backend` / `bun run check:frontend`: scoped checks.
- `bun run test:backend:ci`: full backend Vitest suite.
- `cd frontend && bun run test:run`: frontend unit/integration tests.
- `cd frontend && bun run test:e2e`: Playwright end-to-end tests.

## Coding Style & Naming Conventions
TypeScript is the default across backend and frontend. Follow the existing Prettier settings in `frontend/prettier.config.ts`: 2-space indentation, single quotes, no semicolons, 100-character line width. Use `PascalCase` for Vue component filenames, `camelCase` for variables/functions, and `snake_case` only when matching database or API fields. Prefer path aliases such as `@/` and `@modules/` where already configured.

## Encoding Safety
Preserve UTF-8 when editing files, especially Vue SFCs and files containing Chinese text. Avoid PowerShell write operations that can change encoding or corrupt non-ASCII content; prefer `apply_patch` for manual edits. If a scripted write is unavoidable, explicitly use UTF-8 and inspect for mojibake or literal escape artifacts such as `` `r`n `` before reporting completion. This prevents Vite compile failures caused by Windows encoding drift.

## Testing Guidelines
Backend and frontend both use Vitest; the frontend also uses Playwright for browser flows. Name tests `*.test.ts` or `*.spec.ts` and colocate them near the feature when practical, otherwise place them under `tests/` or `frontend/tests/`. Before opening a PR, run the smallest relevant suite plus `bun run check`.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit style, for example `fix(conversations): ...`, `refactor(files): ...`, and `chore(web-installer): ...`. Keep the scope specific to the module you changed. PRs should include a short summary, linked issue or task, affected areas, and screenshots for UI changes. Call out migration, env, or Cloudflare configuration impact explicitly.

## Security & Agent Notes
Do not commit `.env*` secrets or production credentials. Validate route and config changes with `bun run validate:all` when touching routing or runtime config. For Codex shell usage in this repo, prefix commands with `rtk` per the local tooling guide.

## RTK Command Preference
When invoking external CLI commands from Codex for this repository, prefer the `rtk` prefix for tools such as `php`, `composer`, `npm`, `git`, and `bash`.

Examples:
- `rtk php artisan test`
- `rtk composer install`
- `rtk npm run build`

PowerShell builtins and simple read-only inspection commands do not need the `rtk` prefix.

<!-- codebase-memory-mcp:start -->
# Codebase Knowledge Graph (codebase-memory-mcp)

This project uses codebase-memory-mcp as the canonical code intelligence graph.

## Priority Order
1. `search_code` — find code patterns and enrich matches with graph context.
2. `get_code_snippet` — read specific function/class source code.
3. `get_architecture` — high-level project summary.
4. `index_status` — check whether the current project index is ready.
5. `detect_changes` — detect code changes and graph-level impact.

Use project name `Users-eric-Documents-Code-Multi-Channel-Integration-System`
with codebase-memory MCP tools.

## When to fall back to grep/glob
- Searching for string literals, error messages, config values.
- Searching non-code files such as docs, Dockerfiles, shell scripts, and configs.
- When MCP tools return insufficient results.

## Required checks
- Before broad code edits, use codebase-memory search/trace tools to understand the target.
- Before committing, run `detect_changes` to verify the affected scope is expected.
<!-- codebase-memory-mcp:end -->
