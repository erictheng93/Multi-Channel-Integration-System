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

