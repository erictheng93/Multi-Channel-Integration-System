# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the Cloudflare Workers backend, with domain code under `src/modules/`, shared services in `src/services/`, middleware in `src/middleware/`, and Durable Objects in `src/durable-objects/`. `frontend/src/` contains the Vue 3 app: `components/`, `views/`, `stores/`, `api/`, and `services/`. Backend tests live in `tests/`; frontend tests live in `frontend/tests/` and `frontend/src/**/*.test.ts`. Database migrations are in `migrations/` and `drizzle/`. Operational scripts are in `scripts/`, and architecture and process docs are in `docs/`.

## Build, Test, and Development Commands
Use Bun, not npm/yarn/pnpm.

- `bun run dev`: run the backend Worker with Wrangler remote dev.
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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Multi-Channel-Integration-System** (55578 symbols, 89424 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
