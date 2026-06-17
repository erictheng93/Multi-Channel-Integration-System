# Backup & Restore Runbook (D1: `mcis-db`)

> Created after the 2026-06-17 incident where the production D1 database was
> deleted with no backup. This runbook is the safeguard that was missing.

## TL;DR

- **Automated daily backups** run via GitHub Actions (`.github/workflows/backup.yml`),
  03:00 Asia/Taipei, **off the production worker** (zero risk to the live app).
- Backups land in **R2 bucket `mcis-backups`** and as **GitHub artifacts** (an
  off-Cloudflare copy that survives an account-level teardown).
- **One manual setup step remains**: add the R2 lifecycle (retention) rules in the
  dashboard — see [Action required](#action-required-set-r2-lifecycle-rules).

## What is backed up

Each run produces:

| Artifact | R2 prefix | Contents | UI page |
|----------|-----------|----------|---------|
| Full DB dump | `daily/` (+ `monthly/` on the 1st) | Entire database, schema + all tables | everything |
| Platform members | `members/` | `agents`, `teams`, `agent_teams` | Staff Management (人員管理) + Team Settings (團隊設置) |
| Customer tags | `tags/` | `tags`, `customer_tags`, `conversation_tags` | Customer Tags (客戶標籤管理, `/tags`) |
| Team assignments | `assignments/` | `conversations` (`assigned_team_id`), `customer_team_assignments`, `conversation_transfers` | conversation→team routing |
| Off-Cloudflare copy | GitHub artifact (90 days) | full dump + members + tags + assignments | — |

The focused `members/` and `tags/` dumps are also inside the full dump; they are
kept separately for **fast, targeted restore** of the small, critical config data.

## Schedule & mechanism

- **When:** daily `cron: '0 19 * * *'` (19:00 UTC = 03:00 Asia/Taipei). Manual run
  via GitHub → Actions → "D1 Backup" → "Run workflow".
- **How:** `wrangler d1 export` (the same proven tool used for the recovery), then
  `wrangler r2 object put` to `mcis-backups`, plus a GitHub artifact upload.
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
| GitHub artifact | 90 days | off-Cloudflare safety net |

## Action required: set R2 lifecycle rules

The backup CI token cannot manage R2 lifecycle, so these are set once in the
dashboard. **Until added, nothing breaks** — backups just accumulate (trivial
size); the rules only automate cleanup.

```
Cloudflare dashboard → R2 → mcis-backups → Settings → Object lifecycle rules
→ Add rule (×4):

  Rule 1:  prefix "daily/"        · Delete objects · 30 days
  Rule 2:  prefix "monthly/"      · Delete objects · 365 days
  Rule 3:  prefix "members/"      · Delete objects · 365 days
  Rule 4:  prefix "tags/"         · Delete objects · 365 days
  Rule 5:  prefix "assignments/"  · Delete objects · 365 days
  Rule 6:  prefix "manual/"       · Delete objects · 90 days
```

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

# Push a copy to R2
bunx wrangler r2 object put "mcis-backups/daily/mcis-db-$(date +%F).sql" \
  --file=./backups/mcis-db-$(date +%F).sql --remote
```

> Local dumps live in `backups/` (gitignored — they contain customer PII). Keep at
> least one copy **off this machine** for true disaster recovery.

## Restore

> ⚠️ **D1 deletion is permanent.** If `mcis-db` is gone, recreate it, then import.

1. Download the chosen backup from R2:
   ```bash
   bunx wrangler r2 object get "mcis-backups/daily/mcis-db-YYYY-MM-DD.sql" \
     --file=./restore.sql --remote
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

## Notes

- The R2 data bucket `mcis-files` (uploaded media) is **separate** from
  `mcis-backups`. Never store backups in the data bucket.
- R2-in-the-same-account shares the failure domain that caused the incident — the
  GitHub artifact (and any copy you keep off-machine) is the real isolation tier.
