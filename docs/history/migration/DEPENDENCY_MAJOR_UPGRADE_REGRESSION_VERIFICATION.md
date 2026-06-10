# Dependency Major Upgrade — Regression Verification Report

**Date:** 2026-06-10
**Scope:** TypeScript 6.0.3 / Vue Router 5.1.0 / Vitest 4.1.8 (major version upgrades)
**Verified on:** `main` @ `07fef9da` (clean working tree)

## Background

The repository upgraded three major dependency versions:

| Dependency | Version | Where |
|------------|---------|-------|
| TypeScript | ^6.0.3 | root + frontend |
| Vue Router | ^5.1.0 | frontend |
| Vitest | ^4.1.8 | root + frontend |

Follow-up fix commits landed during the upgrade window
(`07fef9da`, `ffc03cfd`, `806ce66e` — Vitest 4 mock constructibility and
cookie-based auth alignment), but no consolidated regression verification
record existed. This report closes that gap.

## Verification Matrix

All checks executed locally on 2026-06-10:

| Check | Command | Result |
|-------|---------|--------|
| Backend type check | `bunx tsc --noEmit` | ✅ 0 errors |
| Backend test suite | `bunx vitest run tests/unit tests/modules tests/edge-cases tests/contract tests/validation tests/integration tests/database tests/smoke tests/api-documentation-consistency.test.ts` | ✅ 123 files / 2610 tests passed |
| Frontend type check | `bunx vue-tsc --noEmit` | ✅ 0 errors |
| Frontend test suite | `cd frontend && bunx vitest run` | ✅ 193 files / 4009 tests passed |

Backend suite duration: ~949s. Frontend suite duration: ~722s.

## Conclusion

- **TypeScript 6**: both `tsc` (backend) and `vue-tsc` (frontend) compile with
  zero errors under strict mode.
- **Vitest 4**: full backend (2610) and frontend (4009) test suites pass — the
  mock-constructibility migration is complete.
- **Vue Router 5**: frontend type check and all router-dependent component
  tests pass; no runtime API regressions detected by the suite.

No regressions found. The major-version upgrades are considered verified.

## Notes

- Known non-blocking warnings: Vitest emits
  `vi.fn() mock did not use 'function' or 'class'` advisories in
  `tests/unit/modules/auto-reply/services/rule-merging.test.ts` (stderr noise
  from intentional error-path tests; does not affect results).
- An interim per-project summary during the frontend run reports
  44 files / 691 tests (+1 intentional pre-existing skip); the consolidated
  final summary is 193 files / 4009 tests.
