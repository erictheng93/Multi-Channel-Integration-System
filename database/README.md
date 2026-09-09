# `database/`

Ad-hoc DB assets that are **not** part of the migration pipeline. The migration pipeline is
`migrations/` + `migrations/meta/_journal.json`, applied with `bun run db:migrate`.

## Live files

| File | Used by |
|------|---------|
| `migrate-file-attachments.ts` | `bun run db:migrate:attachments` / `:verify` |
| `file-attachments-schema.sql` | `scripts/deploy-file-upload.ts`, `scripts/file-upload-status-check.ts` |
| `schema.sql` | `scripts/file-upload-status-check.ts` |
| `apply-enhancements.sql` | `scripts/` one-off |
| `init-database.ps1` | first-time local bootstrap |

## `legacy/`

Pre-drizzle bootstrap SQL and PowerShell helpers from Sep 2025 with **zero references** in the
codebase. Kept for history only. They target the retired `omni-channel-platform` database name,
not the current `mcis-db` — do not run them against production.

## `legacy-migrations/`

Historical DDL rescued from two orphan drizzle-kit output directories. See its own README.
