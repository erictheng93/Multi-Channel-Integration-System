# Legacy Migrations (pre-`migrations/` drizzle-kit output)

These SQL files were the output of an **older `drizzle-kit` output directory** (`drizzle/` at
the repo root) that was superseded by `migrations/`.

## Why they are here and not deleted

`drizzle.config.ts` has `out: './migrations'` and `wrangler.toml` has
`migrations_dir = "migrations"`, so `drizzle/` was never read by `db:generate`,
`db:migrate`, or `wrangler d1 migrations apply`. It was a **dead directory** — but it shared
migration numbers with `migrations/` while holding *different* DDL, which is exactly the
kind of ambiguity that produced the 2026-06-17 schema drift.

The 11 files in it that were **byte-identical** to files in `migrations/` were removed.
The 10 files kept here are the ones whose DDL exists **nowhere else in the repo**:

| File | Note |
|------|------|
| `0005_add_qr_codes_table.sql` | collided with `migrations/0005_change_conversation_id_to_string.sql` |
| `0016_add_performance_indexes.sql` | index-only DDL — relevant to the 2026-07-30 drift audit |
| `0017_remove_team_role.sql` | |
| `0018_add_channel_integrations.sql` | collided with `migrations/0018_add_customer_tags_indexes.sql` |
| `0019_update_admin_teamid.sql` | collided with `migrations/0019_add_customers_platform_indexes.sql` |
| `0020_add_assigned_status.sql` | collided with `migrations/0020_add_presigned_upload_fields.sql` |
| `0030_add_critical_performance_indexes.sql` | index-only DDL — relevant to the drift audit |
| `0034_add_customer_friend_status.sql` | |
| `0035_remove_customer_friend_status.sql` | reverts `0034` |
| `0038_add_message_read_by.sql` | collided with `migrations/0038_drop_agents_team_id.sql` |

## Rules

- **Do not** apply these directly. They are a historical record, not a migration path.
- The single source of truth for migrations is `migrations/` + `migrations/meta/_journal.json`.
- If any object declared here is missing from production, `bun run check:migrations` is the
  tool that will say so — write a **new** numbered migration in `migrations/`, never re-run one
  of these.

## `stale-drizzle-kit-meta/`

A second orphan drizzle-kit journal that sat at `database/migrations/meta/`. Its
`_journal.json` declares a single entry `0000_eager_the_hunter` — a tag that exists in no
migration directory in this repo, and its sibling `.sql` files were removed long ago.
It is kept only so the decoy is not silently recreated. The real journal is
`migrations/meta/_journal.json`.
