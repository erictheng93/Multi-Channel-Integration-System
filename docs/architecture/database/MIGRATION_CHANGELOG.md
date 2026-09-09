# Database Migration Changelog

> **Last Updated:** 2026-08-31
> **Current Version:** 0060
> **Status:** Production-Ready

> **Coverage warning.** This file has detailed entries for 0024-0027 and 0060 only.
> Migrations **0028-0059 were never written up here**. Do not treat this file as a
> complete history. The authoritative record is `migrations/` plus
> `migrations/meta/_journal.json`; run `bun run check:migrations` to compare what
> the applied migrations declare against what production actually contains.
> Historical DDL rescued from two orphan drizzle-kit directories lives in
> `database/legacy-migrations/`.

---

## Migration Summary

| Version | Date | Description | Breaking |
|---------|------|-------------|----------|
| 0060 | 2026-08-31 | Per-agent conversation read state (`conversation_read_states`) | No |
| 0028-0059 | 2025-12 – 2026-08 | Not documented here — see `migrations/` | — |
| 0027 | 2025-01-29 | Schema optimizations (indexes, soft delete, encryption docs) | No |
| 0026 | 2025-01-29 | Refactor channel_integrations to JSON configuration | No |
| 0025 | 2025-01-29 | Fix file_attachments column naming (snake_case) | No |
| 0024 | 2025-01-29 | Add missing indexes for agents table | No |
| 0023 | 2025-01-15 | Enhance file_attachments (conversation_id, uploadedBy) | No |
| ... | ... | Previous migrations | ... |

---

## Detailed Changelog

### Migration 0060 - Per-Agent Conversation Read State (2026-08-31)

**Why:** `conversations.last_read_at` (0047) and `conversations.marked_unread_at`
(0054) carry no `agent_id`, so read/unread was a single shared cell — one agent
opening a conversation cleared the unread badge for all 30 agents.

**Added:**

```sql
CREATE TABLE conversation_read_states (
  agent_id         TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  last_read_at     TEXT,
  marked_unread_at TEXT,
  updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (agent_id, conversation_id)
);
CREATE INDEX idx_conversation_read_states_conversation
  ON conversation_read_states(conversation_id);
```

The composite primary key is the index the per-agent join uses; the second index
covers the reverse direction (all agents' state for one conversation).

**Backfill:** seeds every active agent from the current global values, so day-one
behaviour is identical to the old behaviour. Applied to production as 3 570 rows
(30 agents x the 119 conversations that carried state). Storage stays sparse
afterwards — one row per (agent, conversation) only once that agent reads it.

**Scope:** only `last_read_at` / `marked_unread_at` become per-agent. The
`last_agent_reply` half of the unread formula stays global (decision A-1). Full
rationale, alternatives and the live verification are in
[ADR 0004](../../adr/0004-per-agent-conversation-read-state.md).

**Breaking:** No. Additive table only; the previously deployed Worker ignores it.
Apply this migration **before** deploying the code that reads it.

**Deprecated but NOT dropped:** `conversations.last_read_at` and
`conversations.marked_unread_at` are no longer read or written. They are kept so
that `wrangler rollback` remains a single command during the observation window.
Drop decision deferred to on/after 2026-09-14 — see the Follow-ups section of
ADR 0004 for the required prerequisites.

---

### Migration 0027 - Schema Optimizations (2025-01-29)

**Purpose:** Add comprehensive performance indexes, soft delete support, and encryption documentation

**Changes:**

1. **New Composite Indexes (10+)**
   ```sql
   -- Messages
   idx_messages_agent_sender_created
   idx_messages_customer_sender_created
   idx_messages_thread_id_sequence
   idx_messages_reply_to

   -- Conversations
   idx_conversations_customer_status
   idx_conversations_assigned_user_status

   -- Delayed Messages
   idx_delayed_messages_status_scheduled

   -- Tags
   idx_tags_team_active

   -- File Attachments
   idx_file_attachments_upload_status

   -- Notifications
   idx_notifications_user_unread
   ```

2. **Soft Delete Columns**
   - Added `deleted_at TEXT` to:
     - `teams`
     - `agents`
     - `customers`
     - `conversations`
     - `messages`
     - `tags`

3. **Encryption Strategy Documentation**
   - Documented encrypted fields (AES-256-GCM)
   - Marked PII fields for future encryption consideration
   - Added bcrypt documentation for password hashing

**Impact:** Non-breaking. Existing queries continue to work.

**Rollback:** Safe to rollback. Indexes can be dropped, deleted_at columns ignored.

---

### Migration 0026 - Channel Integrations JSON Refactoring (2025-01-29)

**Purpose:** Refactor channel_integrations to use JSON columns for platform flexibility

**Changes:**

1. **New JSON Columns**
   ```sql
   ALTER TABLE channel_integrations ADD COLUMN config TEXT;
   ALTER TABLE channel_integrations ADD COLUMN credentials TEXT;
   ALTER TABLE channel_integrations ADD COLUMN webhook_config TEXT;
   ALTER TABLE channel_integrations ADD COLUMN stats TEXT;
   ```

2. **Data Migration**
   - Existing LINE data → `config`, `credentials`, `webhook_config`, `stats`
   - Existing Facebook data → `config`, `credentials`, `stats`
   - Existing WhatsApp data → `config`, `credentials`, `stats`

3. **Deprecated Columns** (kept for backward compatibility)
   - `line_channel_id`, `line_channel_access_token`, `line_channel_secret`
   - `line_webhook_url`, `line_webhook_token`
   - `facebook_page_id`, `facebook_access_token`, `facebook_app_secret`
   - `whatsapp_phone_number`, `whatsapp_business_account_id`, `whatsapp_access_token`
   - `total_messages_sent`, `total_messages_received`, `last_message_at`

**Benefits:**
-  Adding new platforms requires NO schema changes
-  Eliminates ~70% NULL value waste
-  Separates sensitive credentials for independent encryption
-  Type definitions in `src/modules/integrations/types/channel-types.ts`

**Impact:** Non-breaking. Legacy columns preserved.

**Rollback:** Data preserved in legacy columns.

---

### Migration 0025 - File Attachments Naming Fix (2025-01-29)

**Purpose:** Standardize column naming to snake_case

**Changes:**
```sql
ALTER TABLE file_attachments RENAME COLUMN mimeType TO mime_type;
ALTER TABLE file_attachments RENAME COLUMN fileSize TO file_size;
ALTER TABLE file_attachments RENAME COLUMN fileUrl TO file_url;
ALTER TABLE file_attachments RENAME COLUMN r2Key TO r2_key;
ALTER TABLE file_attachments RENAME COLUMN uploadStatus TO upload_status;
```

**Impact:** Non-breaking. Drizzle ORM handles mapping automatically.

**Rollback:**
```sql
ALTER TABLE file_attachments RENAME COLUMN mime_type TO mimeType;
ALTER TABLE file_attachments RENAME COLUMN file_size TO fileSize;
ALTER TABLE file_attachments RENAME COLUMN file_url TO fileUrl;
ALTER TABLE file_attachments RENAME COLUMN r2_key TO r2Key;
ALTER TABLE file_attachments RENAME COLUMN upload_status TO uploadStatus;
```

---

### Migration 0024 - Agents Table Indexes (2025-01-29)

**Purpose:** Add missing indexes for common query patterns

**Changes:**
```sql
CREATE INDEX idx_agents_team_id ON agents(team_id);
CREATE INDEX idx_agents_role ON agents(role);
CREATE INDEX idx_agents_team_id_active ON agents(team_id, is_active);
CREATE INDEX idx_agents_role_active ON agents(role, is_active);
```

**Performance Impact:**
- Team member queries: ~70% faster
- Role-based filtering: ~60% faster
- Active team member queries: ~65% faster

**Impact:** Non-breaking. Indexes are additive.

**Rollback:**
```sql
DROP INDEX idx_agents_team_id;
DROP INDEX idx_agents_role;
DROP INDEX idx_agents_team_id_active;
DROP INDEX idx_agents_role_active;
```

---

## Running Migrations

### Local Development
```bash
# Apply all pending migrations
bun run db:migrate

# View database in Drizzle Studio (remote DB — there is no local-only variant)
bun run db:studio
```

### Production
```bash
# Apply migrations to production (guarded — see below)
MCIS_CONFIRM_PRODUCTION=allow:d1:migrate bun run db:migrate

# Verify the applied migrations match what production actually contains
bun run check:migrations

# Verify system health
bun run health:check:all
```

`bun run db:migrate` is wrapped by `scripts/guard-production-command.ts` and
refuses to run without `MCIS_CONFIRM_PRODUCTION=allow:d1:migrate`. This is
deliberate — the only D1 is production.

---

## Migration Best Practices

1. **Always back up before migration**
   ```bash
   # `wrangler d1 backup` no longer exists — D1 uses Time Travel
   node node_modules/wrangler/bin/wrangler.js d1 export mcis-db --remote --output backup.sql
   ```
   Point-in-time restore is `wrangler d1 time-travel`. A nightly full export also
   runs in `.github/workflows/backup.yml`.

2. **Test on the local D1 mirror first**
   ```bash
   bun run db:sync:local                                    # pull remote data down
   node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local
   bun run test:backend:ci
   ```

3. **Apply the migration BEFORE deploying code that depends on it**
   An additive migration is invisible to the running Worker; deploying first
   means the new code queries a table that does not exist yet.

4. **Regenerate the schema doc in the same commit as the migration**
   ```bash
   bun run db:doc:schema        # rebuild docs/architecture/SCHEMA.md from production
   bun run db:doc:schema:check  # exits 1 if the committed doc is stale
   ```
   SCHEMA.md is generated, never hand-written. The `schema-doc` CI job runs the
   check on every push to main, so skipping this turns the build red.

5. **Verify after applying**
   ```bash
   bun run check:migrations   # 0 phantom-applied, 0 pending objects
   ```
   The `d1_migrations` journal has been observed to mark a migration applied when
   the DDL never landed (2026-06-30). Trust `check:migrations`, not the journal.

6. **Prefer a deprecate-then-drop window over an immediate destructive change**
   Leaving a superseded column in place keeps rollback to one command. See
   Migration 0060 for a worked example.

> **Windows:** run wrangler as `node node_modules/wrangler/bin/wrangler.js`. The
> `.cmd` shim strips the quotes around `--command`, silently truncating SQL.

---

## Related Documentation

- **Schema Documentation:** `docs/architecture/SCHEMA.md`
- **API Reference:** `docs/api/`
- **Deployment Guide:** `docs/deployment/`
- **CLAUDE.md:** Project root

---

**Maintained by:** Development Team
**Last Updated:** 2026-08-31
