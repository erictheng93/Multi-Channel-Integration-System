# Technical Debt Audit - 2026-04-21

## Scope

This audit covers the backend Worker under `src/`, the Vue frontend under
`frontend/src/`, tests, scripts, package configuration, CI, and local developer
tooling. The review was based on static scans and repository configuration, then
followed by an attempted Bun-based verification run.

## Executive Summary

The project has meaningful technical debt in five areas:

1. Local verification environment drift.
2. Bun-only policy conflicts with lingering npm/npx commands.
3. Loose typing and suppression debt despite strict TypeScript settings.
4. Runtime debug logging and stub code in production paths.
5. Multi-package version drift and large, high-churn files.

The most immediate risk is not a single code defect. It is that quality gates are
hard to reproduce consistently across local, CI, and deployment environments.

## Verification Notes

- Repository requirement: Bun only.
- Declared package manager: `bun@1.3.9`.
- Detected local Bun: `1.3.13` via `C:\Users\Administrator\.bun\bin\bun.exe`.
- Initial `bun` lookup through PATH failed, so commands should either fix PATH
  or use the full Bun path until the shell environment is normalized.
- `bun run check` initially failed because `bash` was not available through the
  Bun script environment. Running the check through Git Bash with Bun added to
  PATH worked.
- `bun install --frozen-lockfile` succeeded for both root and `frontend/`.
- Root install emitted a Bun warning: nested `overrides` are not currently
  supported. The affected configuration is the nested override under
  `@esbuild-kit/core-utils`.
- Worktree was already dirty before this audit:
  - `AGENTS.md` modified.
  - `RTK.md` untracked.

## Check Results

### P0 Reproducibility Update

P0 has been executed on 2026-04-21.

Changes made:

- Added `scripts/check.ts` as the cross-platform canonical health check runner.
- Updated root `package.json` check scripts to call the Bun runner directly:
  - `bun run check`
  - `bun run check:backend`
  - `bun run check:frontend`
- Removed the package-script dependency on `bash scripts/check.sh`, avoiding the
  Windows ambiguity where `bash` can resolve to the WSL launcher instead of Git
  Bash.
- The legacy `scripts/check.sh` remains available for manual shell use, but it
  is no longer the root package health-check entrypoint.

Verification results after the change:

- `bun run check`: passed, 6 checks passed, 0 failed, 0 errors.
- `bun run check:backend`: passed, 3 checks passed, 0 failed, 0 errors.
- `bun run check:frontend`: passed, 3 checks passed, 0 failed, 0 errors.
- `bun run test:backend:ci`: passed.
- `cd frontend && bun run test:run`: passed.

Remaining P0 note:

- This repository now has a cross-platform check entrypoint, but developer
  machines still need Bun available on PATH to run package scripts directly.

Follow-up:

- Added `scripts/setup-bun-path.ps1` as a Windows bootstrap helper. It is a dry
  run by default and only updates the current user's PATH when called with
  `-Apply`.
- Updated `docs/guides/BUN_MIGRATION_GUIDE.md` with the dry-run and explicit
  apply workflow.

Command shape used on Windows:

```powershell
bun run check
```

Result:

- Backend `tsc --noEmit`: passed.
- Backend import path check: passed.
- Route conflict check: passed.
- Frontend `vue-tsc --noEmit`: passed after fixing the stale
  `MessageInput.vue` file input template ref binding.
- Frontend ESLint: passed.
- Frontend scoped `.btn` guard: passed.

Initial blocking error found during the first run:

```text
src/components/conversation/MessageInput.vue(218,9): error TS6133:
'fileInputRef' is declared but its value is never read.
```

Follow-up fix:

- Replaced the string template ref alias with a typed Vue function ref.
- Re-ran the full check successfully.

Final result:

- Passed: 6.
- Failed: 0.
- Errors: 0.

## Key Findings

### 1. Local Verification Environment Drift

The project scripts assume `bun` is available on PATH, but the shell used during
the audit could not resolve `bun` directly. Bun exists under the user profile,
but the environment path is not reliable for automated shell execution.

Evidence:

- `package.json` declares `bun@1.3.9`.
- Local Bun executable exists and reports `1.3.13`.
- Direct `rtk bun ...` failed because `bun` was not resolved through PATH.

Impact:

- Developers and agents may falsely report that checks cannot run.
- Pre-commit hooks and scripts may behave differently depending on shell setup.
- CI may pass while local verification fails, or vice versa.
- On Windows, the canonical `bun run check` also depends on Git Bash being
  available through PATH because `package.json` delegates to
  `bash scripts/check.sh`.

Recommended actions:

- Add Bun to the effective PATH for PowerShell, Git Bash, and CI-like shells.
- Add Git Bash to PATH or replace `scripts/check.sh` with a cross-platform Bun
  or TypeScript check runner.
- Document the Windows Bun path in local setup docs.
- Consider a small `scripts/run-bun.ps1` wrapper if Windows agents are common.

### 2. Bun-Only Policy Conflicts With npm/npx Residue

The repository explicitly says to use Bun, but scripts and docs still contain a
large number of npm/npx references.

Static scan counts:

- `npm run`: about 1002 occurrences.
- `npx`: about 288 occurrences.
- scripts/package scope: 188 occurrences.
- docs/readme scope: 1283 occurrences.

Examples:

- `package.json` uses `npx only-allow bun` in `preinstall`.
- Several deployment and migration scripts still mention `npm run` or `npx`.
- Historical docs contain many npm-based command examples.

Impact:

- New contributors may follow stale commands.
- Automation may install with the wrong package manager.
- Lockfile and dependency resolution drift become more likely.
- The nested `overrides` warning means at least one intended dependency override
  may not be applied by Bun as written.

Recommended actions:

- Convert active scripts from npm/npx to Bun.
- Flatten or otherwise replace unsupported nested `overrides`.
- Move historical docs under an explicit archive disclaimer, or annotate them as
  non-authoritative.
- Keep one canonical "how to run checks" document and link to it from README,
  AGENTS, CLAUDE, and deployment docs.

### 3. Loose Typing and Suppression Debt

The codebase enables strict TypeScript, but the implementation still contains a
large amount of `any` and type escape hatches.

Static scan counts:

- `any`: 1599 occurrences.
- `as any`: 1088 occurrences.
- `Record<string, any>`: 181 occurrences.
- `unknown as`: 86 occurrences.
- Total loose-type signals: 2954.

Configuration notes:

- Backend and frontend both set `strict: true`.
- Frontend ESLint treats `@typescript-eslint/no-explicit-any` as a warning.
- Test and script overrides disable explicit-any enforcement in several areas.

Impact:

- Strict mode provides less practical protection than expected.
- Integration boundaries, API clients, and test mocks may hide real shape
  mismatches.
- Refactors become harder because unsafe casts erase compiler feedback.

Recommended actions:

- Start with production code only; leave test cleanup as a separate track.
- Raise `no-explicit-any` to error for `src/` and `frontend/src/` after an
  allowlist is created.
- Replace broad API response types with Zod-derived or shared contract types.
- Track `as any` count as a metric in CI and prevent increases.

### 4. Runtime Debug Logging and Stub Code

The scan found 2521 `console.log` occurrences. Many are in frontend runtime
paths, stores, composables, service workers, and application startup code.

Relevant configuration:

- `no-console` is off outside production and only warning-level in production.
- `no-debugger` follows the same pattern.

Examples of runtime/debug debt:

- `frontend/src/main.ts` contains app startup and PWA logging.
- `frontend/src/utils/i18nFixer.ts` exports stub functions.
- `frontend/src/utils/i18nDebug.ts` exports stub/debug functions.
- `src/modules/agents/services/agent-crud.ts` contains multiple methods that
  throw "Method not implemented".

Impact:

- Production logs can expose noisy internal state.
- Stub utilities can be imported accidentally and give false confidence.
- Not-implemented methods are runtime traps if callers reach them.

Recommended actions:

- Route runtime logs through a central logger with environment-aware levels.
- Make production `console.log` an ESLint error for frontend runtime code.
- Delete or quarantine debug utilities behind dev-only imports.
- Replace not-implemented service methods with explicit interfaces or remove
  them from the public surface.

### 5. TODOs in Security, Access Control, and Delivery Paths

Important TODOs remain in areas that affect production behavior.

Examples:

- Rate limiting TODOs in reports/session middleware.
- Session settings and WebSocket integration TODOs.
- Conversation access check TODO in messaging auth middleware.
- Delayed message service TODO for sending to real platforms.
- File statistics TODO for user-specific stats.

Impact:

- Authorization and rate limiting gaps may be easy to miss because the handlers
  exist and may return successful responses.
- Delayed messaging may appear feature-complete while still lacking platform
  delivery.
- Operational behavior depends on comments rather than enforceable checks.

Recommended actions:

- Convert security-sensitive TODOs into tracked issues with owners.
- Fail or hide incomplete endpoints instead of returning partial success.
- Add tests that assert incomplete paths are either implemented or explicitly
  unavailable.

### 6. Test Coverage and Environment Fragility

The repository has substantial tests:

- Production source files scanned: 1121.
- Test/spec files found: 291.

However, some E2E tests skip at runtime when seed data is absent.

Example:

- `frontend/tests/e2e/playwright/tags/conversations.spec.ts` has 9
  `test.skip(true, 'No tags found in this environment')` calls.

Impact:

- A missing fixture can silently remove meaningful E2E coverage.
- Passing E2E runs may not prove the intended flows were tested.

Recommended actions:

- Seed required E2E fixtures as part of test setup.
- Replace unconditional runtime skips with explicit fixture creation or a single
  suite-level precondition failure.
- Track skipped test count in CI.

### 7. Large Files and Modularity Debt

Several files are large enough to increase review and regression risk.

Largest examples found:

- `frontend/src/utils/extended-emoji-map.ts`: 2145 lines.
- `src/modules/reports/types/report-data-types.ts`: 1204 lines.
- `frontend/src/components/icons/index.ts`: 1021 lines.
- `frontend/src/views/ChannelManagement.vue`: 898 lines.
- `frontend/src/views/PlatformIntegration.vue`: 890 lines.
- `frontend/src/components/channels/ChannelConfigDialog.vue`: 874 lines.
- `frontend/src/components/conversation/ConversationHeader.vue`: 798 lines.
- `frontend/src/components/conversation/MessageInput.vue`: 760 lines.

Impact:

- Higher merge conflict probability.
- Harder component-level testing.
- More accidental coupling between UI state, API calls, and rendering.

Recommended actions:

- Split large Vue files by workflow: container, form state, API operations,
  presentational subcomponents.
- Move generated/static maps into data files or generated artifacts.
- Prioritize files that change often and contain user-facing workflows.

### 8. Multi-Package Version Drift

The repo contains multiple package roots:

- root `package.json`
- `frontend/package.json`
- `tests/package.json`
- `web-installer/backend/package.json`
- `web-installer/frontend/package.json`

These packages do not all use the same TypeScript, Vitest, Vue, and related
tooling versions.

Impact:

- Bugs may reproduce in one subproject but not another.
- CI cost and maintenance burden increase.
- Dependency update policy becomes unclear.

Recommended actions:

- Decide whether this is a formal Bun workspace.
- Centralize shared dev dependency versions where practical.
- Add a dependency drift check for key tools: TypeScript, Vitest, Vite, Vue,
  Wrangler, ESLint.

## Priority Plan

### P0 - Make Verification Reproducible

Status: completed on 2026-04-21.

- Fixed the root health-check entrypoint by replacing the Bash package-script
  dependency with `scripts/check.ts`.
- Removed the need for Git Bash from `bun run check`.
- Re-ran `bun run check` until green.
- Ran backend and frontend CI test scripts.

### P1 - Reduce Production Risk

Status: completed on 2026-04-21.

Changes made:

- Added a frontend production lint entrypoint:
  - `cd frontend && bun run lint:production`
  - production `console.log` is an ESLint error while `console.warn` and `console.error` remain allowed.
  - production `debugger` is an ESLint error.
- Replaced session update agent bypass with DB-backed session/team access checks.
- Replaced messaging agent scope TODO with DB-backed team/conversation scope and deny-by-default behavior for non-global message access.
- Added KV-backed system route rate limiting for authenticated system middleware callers.
- Removed unreferenced i18n stub/debug utility files.
- Added delayed-message Durable Object platform delivery tests for LINE and Facebook payload/endpoint routing.

Verification:

- `bun run check`: passed, 6 checks passed, 0 failed, 0 errors.
- Focused session and delayed-message tests passed: 64 tests.
- Messaging/conversation focused tests passed: 96 tests.
- Security/access-control/rate TODO scan returned no matches.

Remaining note:

- `cd frontend && bun run lint:production` is intentionally stricter than the default health check and currently reports the existing frontend `console.log` backlog. The production gate is now available; removing the existing log backlog should be handled as a separate cleanup batch before wiring this stricter command into the default check.

### P2 - Tighten Type Safety

Status: completed on 2026-04-21.

Changes made:

- Added `scripts/type-debt-allowlist.json` to snapshot existing production `any` and `as any` usage.
- Added `scripts/check-type-debt.ts` and `bun run check:type-debt` to fail when production code increases explicit `any` or `as any` counts.
- Wired the type-debt allowlist into `bun run check:backend`, so the default full health check also prevents new production type debt.
- Replaced the frontend paginated API response cast in `frontend/src/api/modern-client.ts` with a typed response handler contract.

Verification:

- `bun run check:type-debt`: passed, 234 allowlisted files, 1023 `any` keywords, 245 `as any` assertions, no increases.
- `bun run check:backend`: passed, 4 checks passed, 0 failed, 0 errors.
- `bun run check:frontend`: passed, 3 checks passed, 0 failed, 0 errors.

### P3 - Lower Maintenance Cost

Status: completed on 2026-04-21.

Changes made:

- Split `frontend/src/views/ChannelManagement.vue` into:
  - `frontend/src/components/channels/ChannelDetailsModal.vue`
  - `frontend/src/composables/useChannelManagement.ts`
- Reduced `ChannelManagement.vue` from 1017 lines to 688 lines.
- Formalized the root/frontend package boundary in `docs/WORKSPACE_BOUNDARIES.md` and linked it from `README.md`.
- Kept both package roots on Bun 1.3.9 and documented that root and `frontend/` intentionally own separate `bun.lock` files.
- Replaced visible `npx only-allow bun` preinstall commands with `bunx only-allow bun`.
- Removed the obsolete `scripts/switch-to-npm.ps1` workflow script.

Verification:

- Largest targeted Vue file after split: `frontend/src/views/ChannelManagement.vue` at 688 lines.
- `bun run check`: passed, 7 checks passed, 0 failed, 0 errors.

## Suggested Tracking Metrics

- Count of production `console.log`.
- Count of production `as any`.
- Count of `@ts-ignore`, `@ts-expect-error`, and `eslint-disable`.
- Count of skipped tests in CI.
- Number of files over 750 lines.
- Number of active scripts/docs using npm/npx.

## Commands Used During Audit

Representative commands:

```powershell
rtk rg -n "TODO|FIXME|HACK|XXX|DEPRECATED|@ts-ignore|@ts-expect-error|eslint-disable|console\.log|debugger|skip\(|\.only\(" src frontend/src tests frontend/tests scripts
rtk rg -o --no-filename "\bany\b|unknown as|as any|Record<string, any>" src frontend/src tests frontend/tests
rtk rg -n "npm run|npm |npx |yarn|pnpm" scripts docs README.md CLAUDE.md package.json frontend/package.json
rtk powershell -NoProfile -Command "& ([System.IO.Path]::Combine($env:USERPROFILE, '.bun', 'bin', 'bun.exe')) --version"
```
