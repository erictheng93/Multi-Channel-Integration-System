# Backup & Restore Runbook (D1: `mcis-db`)

> Created after the 2026-06-17 incident where the production D1 database was
> deleted with no backup. This runbook is the safeguard that was missing.

## TL;DR

- **Automated daily backups** run via GitHub Actions (`.github/workflows/backup.yml`),
  03:00 Asia/Taipei, **off the production worker** (zero risk to the live app).
- Backups are gzip-compressed (`.sql.gz`) and land in **R2 bucket `mcis-backups`**.
- **There is no off-Cloudflare copy yet.** GitHub artifacts were removed on
  2026-10-12 because this repo is public and the dumps contain customer data and
  agent credentials. An account-level teardown would take every copy with it until
  a private external store is added (see [Known gaps](#known-gaps)).
- R2 lifecycle (retention) rules are set on the bucket — see [Retention](#retention--grandfather-father-son-gfs).

## What is backed up

Each run produces:

| Artifact | R2 prefix | Contents | UI page |
|----------|-----------|----------|---------|
| Full DB dump | `daily/` (+ `monthly/` on the 1st) | Entire database, schema + all tables | everything |
| Platform members | `members/` | `agents`, `teams`, `agent_teams` | Staff Management (人員管理) + Team Settings (團隊設置) |
| Customer tags | `tags/` | `tags`, `customer_tags`, `conversation_tags` | Customer Tags (客戶標籤管理, `/tags`) |
| Team assignments | `assignments/` | `conversations` (`assigned_team_id`), `customer_team_assignments`, `conversation_transfers` | conversation→team routing |

Objects written by the workflow are `*.sql.gz`. Objects under `manual/` (in-app
button) and any dump taken before 2026-10-12 are plain `.sql`.

The focused `members/` and `tags/` dumps are also inside the full dump; they are
kept separately for **fast, targeted restore** of the small, critical config data.

## Schedule & mechanism

- **When:** daily `cron: '0 19 * * *'` (19:00 UTC = 03:00 Asia/Taipei). Manual run
  via GitHub → Actions → "D1 Backup" → "Run workflow".
- **How:** `wrangler d1 export` (the same proven tool used for the recovery), then
  `gzip -9` + `gzip -t`, then `wrangler r2 object put` to `mcis-backups`. Every run
  is a **full** snapshot, not incremental, so any single file restores on its own.
- **Auth:** repo secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (shared
  with `ci-cd.yml`). The token must have **D1:read** (export) and **R2:write**.

## Retention — Grandfather-Father-Son (GFS)

DB is tiny (~2.5 MB/dump) so cost is negligible; retention is driven by detection
window, not storage.

| Tier | Keep | Recovery granularity |
|------|------|----------------------|
| `daily/` | 30 days | any single day in the last month |
| `monthly/` | 365 days | any month in the last year |
| `members/` | 365 days | access-control snapshots for a year |
| `tags/` | 365 days | tag config snapshots for a year |
| `assignments/` | 365 days | conversation→team routing snapshots for a year |
| `manual/` | 90 days | on-demand admin backups (in-app button) |

### R2 lifecycle rules (applied 2026-10-12)

Rules are **per prefix** — never one rule over the whole bucket, or `monthly/`
would be deleted at 30 days too. The backup CI token cannot manage lifecycle;
use an interactive `wrangler` login:

```bash
bunx wrangler r2 bucket lifecycle list mcis-backups     # verify
bunx wrangler r2 bucket lifecycle add mcis-backups daily-30d       daily/       --expire-days 30
bunx wrangler r2 bucket lifecycle add mcis-backups monthly-365d    monthly/     --expire-days 365
bunx wrangler r2 bucket lifecycle add mcis-backups members-365d    members/     --expire-days 365
bunx wrangler r2 bucket lifecycle add mcis-backups tags-365d       tags/        --expire-days 365
bunx wrangler r2 bucket lifecycle add mcis-backups assignments-365d assignments/ --expire-days 365
bunx wrangler r2 bucket lifecycle add mcis-backups manual-90d      manual/      --expire-days 90
```

A new rule applies to objects that already exist, by age, so adding `daily-30d`
deletes every `daily/` object older than 30 days at once.

## Known gaps

- **No off-Cloudflare copy.** R2 in the same account shares the failure domain of
  the 2026-06-17 incident. Add a private S3-compatible store (rclone from a
  scheduled workflow). Never use a public-repo GitHub artifact for these files.
- **Media bucket `mcis-files` is not backed up.**
- No automated restore drill and no failure notification on the workflow.

## Manual backup — in-app (admin)

Admins can take an on-demand backup from the app: **資料管理 → 資料備份** (`/data/backup`,
admin-only). The page shows the last automatic backup, a "立即備份到雲端" button (full DB
dump → R2 `manual/`), and a downloadable list of recent backups. Backend:
`POST /api/data/backup/run`, `GET /api/data/backup`, `GET /api/data/backup/download`.

## Manual backup — CLI (on demand)

```bash
# Full database
bunx wrangler d1 export mcis-db --remote --output ./backups/mcis-db-$(date +%F).sql

# Members only (Staff Management + Team Settings)
bunx wrangler d1 export mcis-db --remote --table agents --table teams --table agent_teams \
  --output ./backups/members-$(date +%F).sql

# Customer tags only
bunx wrangler d1 export mcis-db --remote --table tags --table customer_tags --table conversation_tags \
  --output ./backups/tags-$(date +%F).sql

# Team assignments only (conversation→team routing)
bunx wrangler d1 export mcis-db --remote --table conversations --table customer_team_assignments --table conversation_transfers \
  --output ./backups/assignments-$(date +%F).sql

# Push a copy to R2 (compress first, matching the workflow)
gzip -9 ./backups/mcis-db-$(date +%F).sql
bunx wrangler r2 object put "mcis-backups/daily/mcis-db-$(date +%F).sql.gz" \
  --file=./backups/mcis-db-$(date +%F).sql.gz --content-type=application/gzip --remote
```

> Local dumps live in `backups/` (gitignored — they contain customer PII). Keep at
> least one copy **off this machine** for true disaster recovery.

## Restore

> ⚠️ **D1 deletion is permanent.** If `mcis-db` is gone, recreate it, then import.

1. Download the chosen backup from R2:
   ```bash
   bunx wrangler r2 object get "mcis-backups/daily/mcis-db-YYYY-MM-DD.sql.gz" \
     --file=./restore.sql.gz --remote
   gunzip ./restore.sql.gz        # skip for plain .sql objects (manual/, pre-2026-10-12)
   ```
2. If the database no longer exists, recreate and re-point:
   ```bash
   bunx wrangler d1 create mcis-db          # copy the new database_id
   # update database_id in wrangler.toml (line ~58), then redeploy the worker
   ```
3. Import the dump:
   ```bash
   bunx wrangler d1 execute mcis-db --remote --file=./restore.sql
   ```
4. **Partial restore** (e.g., just members or tags): import only that focused dump
   (`members-*.sql` / `tags-*.sql`) instead of the full file.
5. Verify: log in, open a conversation, check `/team` and `/tags`.
6. **Verify migration-only objects survived** (required after every rebuild, restore or recreate).
   Triggers, partial indexes and CHECK constraints live only in `migrations/*.sql`, not in
   `src/db/schema.ts`; the 2026-06-17 rebuild silently dropped all of them. Missing triggers do not
   fail any query — the dashboard just shows stale 待回覆 / unread data.
   ```bash
   bun run check:migrations     # tables / indexes / triggers / views vs migrations
   node node_modules/wrangler/bin/wrangler.js d1 execute mcis-db --remote --command \
     "SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name"
   ```
   The 9 triggers listed in `src/health-checkers/schema-integrity.ts` (`REQUIRED_TRIGGERS`) must
   all be present. If any are missing, re-run only the `CREATE TRIGGER IF NOT EXISTS ...` statements
   from migrations 0070 and 0071 (do NOT re-run the whole files: their `ALTER TABLE ... ADD COLUMN`
   fails when the column already exists), then let the nightly heal (daily cron) re-converge `awaiting_since` and the unread markers.
   The admin page 系統設定 › 健康檢查 shows a `schema_integrity` row, and the daily cron logs an
   error and sets the KV key `alert:schema_trigger_missing` while any trigger is missing.

## Notes

- The R2 data bucket `mcis-files` (uploaded media) is **separate** from
  `mcis-backups`. Never store backups in the data bucket.
- R2-in-the-same-account shares the failure domain that caused the incident. Until
  a private external copy exists, keep at least one recent dump off this machine
  and off Cloudflare yourself.
- This repo is **public**. Anything uploaded as a workflow artifact or committed
  is world-readable; the dumps contain PII and must stay out of both.
