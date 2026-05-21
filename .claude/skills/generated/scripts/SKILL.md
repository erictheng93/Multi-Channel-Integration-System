---
name: scripts
description: "Skill for the Scripts area of Multi-Channel-Integration-System. 190 symbols across 40 files."
---

# Scripts

190 symbols | 40 files | Cohesion: 93%

## When to Use

- Working with code in `scripts/`
- Understanding how startsWith, useLocalStorage, generatePasswordHash work
- Modifying scripts-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `scripts/sync-database.ts` | DatabaseSyncTool, runSync, getErrorMessage, preCheck, checkDatabaseConnection (+12) |
| `scripts/security-validation.ts` | readFile, checkDebugEndpointSecurity, checkCorsConfiguration, checkSecurityHeaders, checkMockDataProduction (+9) |
| `scripts/file-upload-status-check.ts` | log, checkFileExists, checkFileContent, checkFrontendComponents, checkBackendComponents (+7) |
| `scripts/sync-scheduler.ts` | start, stop, executeSync, healthCheck, getLastSyncTime (+6) |
| `scripts/deploy-file-upload.ts` | runSync, log, executeCommand, checkPrerequisites, setupR2Storage (+6) |
| `frontend/scripts/deploy-to-pages.ts` | log, section, execCommand, checkPrerequisites, buildProject (+4) |
| `scripts/setup-r2-storage.ts` | runSync, runInherit, getErrorMessage, checkCloudflareAuth, createR2Bucket (+4) |
| `scripts/error-handling-migration.ts` | analyzeFile, detectNonStandardizedCatch, detectInconsistentResponse, detectMissingErrorHandling, addIssue (+3) |
| `scripts/run-all-tests.ts` | runTestsSequentially, runTestsInParallel, runSingleTest, logTestResult, sleep (+3) |
| `frontend/scripts/verify-deployment.cjs` | logSection, logResult, makeRequest, checkFrontend, checkBackend (+2) |

## Entry Points

Start here when exploring this area:

- **`startsWith`** (Function) — `frontend/src/services/searchHistoryService.ts:294`
- **`useLocalStorage`** (Function) — `frontend/src/composables/useLocalStorage.ts:25`
- **`generatePasswordHash`** (Function) — `src/utils/password-hash.ts:31`
- **`generateHashCLI`** (Function) — `src/utils/password-hash.ts:68`
- **`generateMultipleHashesCLI`** (Function) — `src/utils/password-hash.ts:92`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `startsWith` | Function | `frontend/src/services/searchHistoryService.ts` | 294 |
| `useLocalStorage` | Function | `frontend/src/composables/useLocalStorage.ts` | 25 |
| `generatePasswordHash` | Function | `src/utils/password-hash.ts` | 31 |
| `generateHashCLI` | Function | `src/utils/password-hash.ts` | 68 |
| `generateMultipleHashesCLI` | Function | `src/utils/password-hash.ts` | 92 |
| `migrateToNewSchema` | Function | `scripts/migrate-to-drizzle.ts` | 9 |
| `main` | Function | `scripts/check-docs.py` | 166 |
| `process_file` | Function | `scripts/remove-emoji.py` | 50 |
| `main` | Function | `scripts/remove-emoji.py` | 110 |
| `check_file` | Method | `scripts/check-docs.py` | 39 |
| `DatabaseSyncTool` | Class | `scripts/sync-database.ts` | 58 |
| `log` | Function | `scripts/file-upload-status-check.ts` | 59 |
| `checkFileExists` | Function | `scripts/file-upload-status-check.ts` | 63 |
| `checkFileContent` | Function | `scripts/file-upload-status-check.ts` | 70 |
| `checkFrontendComponents` | Function | `scripts/file-upload-status-check.ts` | 84 |
| `checkBackendComponents` | Function | `scripts/file-upload-status-check.ts` | 120 |
| `checkDatabaseStructure` | Function | `scripts/file-upload-status-check.ts` | 151 |
| `checkConfiguration` | Function | `scripts/file-upload-status-check.ts` | 175 |
| `checkTests` | Function | `scripts/file-upload-status-check.ts` | 199 |
| `calculateCompletionRate` | Function | `scripts/file-upload-status-check.ts` | 228 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 2 calls |
| Auto-reply | 1 calls |
| Views | 1 calls |

## How to Explore

1. `gitnexus_context({name: "startsWith"})` — see callers and callees
2. `gitnexus_query({query: "scripts"})` — find related execution flows
3. Read key files listed above for implementation details
