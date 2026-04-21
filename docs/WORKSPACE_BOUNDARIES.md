# Workspace Boundaries

This repository intentionally keeps two Bun package roots:

- Root package: Cloudflare Workers backend, backend tests, database tooling, shared scripts.
- `frontend/` package: Vue 3 application, Vite build, frontend tests, Playwright tests.

Each package root owns its own `package.json` and `bun.lock`. Do not install dependencies with npm, yarn, or pnpm in either package root.

## Commands

Run backend and repository-wide commands from the repository root:

```powershell
bun run check
bun run check:backend
bun run test:backend:ci
bun run deploy
```

Run frontend commands from `frontend/`:

```powershell
cd frontend
bun run check:frontend
bun run build
bun run test:run
bun run test:e2e
```

The root `bun run check` command already invokes the frontend health checks through `scripts/check.ts`; use direct frontend commands only when iterating on frontend code.

## Dependency Rules

- Add backend/runtime dependencies only to the root `package.json`.
- Add Vue/Vite/browser dependencies only to `frontend/package.json`.
- Keep `packageManager` pinned to the same Bun version in both package roots.
- If a dependency must be shared across backend and frontend, document why before adding it to both package roots.
