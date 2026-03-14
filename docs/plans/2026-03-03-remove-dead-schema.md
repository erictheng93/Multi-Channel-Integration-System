# Remove Dead Schema Columns Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove confirmed dead/unused columns and tables from the database schema, clean up fallback code, and apply the resulting migrations to production.

**Architecture:** Two-phase approach — Phase 1 (zero-risk: pure dead code) then Phase 2 (fallback cleanup needed before schema drop). Each phase gets its own migration file. Schema changes happen in both `src/db/schema.ts` (primary, read by drizzle-kit) and `src/shared/database/schema.ts` (DO mirror, must stay in sync).

**Tech Stack:** Drizzle ORM + SQLite D1, Cloudflare D1 (`wrangler d1 migrations apply`), TypeScript strict mode, Bun.

---

## Background / Evidence Summary

| Column/Table | Location | Why Dead |
|---|---|---|
| `qrCodeAnalytics` table | `schema.ts:98` | 0 INSERTs, 0 SELECTs anywhere in codebase |
| `reports.fileHash` | `schema.ts:452` | 0 usages — file integrity never implemented |
| `fileAttachments.url` | `schema.ts:184` | Legacy (v0 col). All code now uses `fileUrl`; remnant fallbacks only |
| `conversations.internalNotes` | `schema.ts:121` | Never read; only written with `null` or one-off QR metadata |

SQLite version on D1: **3.42.0+** → `ALTER TABLE … DROP COLUMN` fully supported (added in 3.35.0).

---

## Task 1: Remove `qrCodeAnalytics` from both schema files

**Files:**
- Modify: `src/db/schema.ts:97-109`
- Modify: `src/shared/database/schema.ts:121-155` (extended version with more columns)

**Step 1: Delete the `qrCodeAnalytics` block from `src/db/schema.ts`**

Remove lines 97-109 (the table definition + closing brace):
```
// QR Code Analytics table - 分析統計
export const qrCodeAnalytics = sqliteTable('qr_code_analytics', {
  id: integer('id').primaryKey(),
  qrCodeId: text('qr_code_id').notNull().references(() => qrCodes.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  totalScans: integer('total_scans').default(0),
  uniqueScans: integer('unique_scans').default(0),
  newCustomers: integer('new_customers').default(0),
  returningCustomers: integer('returning_customers').default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  qrCodeDateUnique: unique().on(table.qrCodeId, table.date),
}));
```

**Step 2: Delete the `qrCodeAnalytics` block from `src/shared/database/schema.ts`**

Locate the section starting with `// QR Code Analytics table` (around line 121) and remove the entire table definition — it is larger in the shared schema (has extra columns like `lineScans`, `facebookScans`, `deviceInfo`, etc.). Remove until the closing `});`.

**Step 3: Run TypeScript check**

```bash
bash scripts/check.sh backend
```

Expected: no errors (the removed export is not imported anywhere).

---

## Task 2: Remove `reports.fileHash` from schema

**Files:**
- Modify: `src/db/schema.ts:452`

**Step 1: Delete the `fileHash` line**

Remove this single line from the `reports` table definition (between `fileSize` and the blank line):
```typescript
  fileHash: text('file_hash'),
```

**Step 2: Run TypeScript check**

```bash
bash scripts/check.sh backend
```

Expected: no errors.

---

## Task 3: Write and apply Phase 1 migration

**Files:**
- Create: `migrations/0041_remove_dead_schema_phase1.sql`

**Step 1: Create the migration file**

```sql
-- ===============================================
-- Migration 0041: Remove Dead Schema — Phase 1
-- ===============================================
-- Date: 2026-03-03
-- Purpose: Drop unused table and column that have zero reads/writes
-- in production code.
--
-- CHANGES:
-- 1. DROP TABLE qr_code_analytics  (0 usages in codebase)
-- 2. ALTER TABLE reports DROP COLUMN file_hash  (0 usages in codebase)
--
-- SAFETY:
-- D1 uses SQLite 3.42.0+ — DROP COLUMN supported since 3.35.0.
-- qr_code_analytics table has no FK references from other tables.
-- file_hash column has no constraints or indexes.
--
-- Rollback SQL:
-- CREATE TABLE qr_code_analytics ( ... ) -- see 0005_add_qr_codes_table.sql
-- ALTER TABLE reports ADD COLUMN file_hash TEXT;
-- ===============================================

-- 1. Drop the unused analytics table
DROP TABLE IF EXISTS qr_code_analytics;

-- 2. Drop the unused file hash column from reports
ALTER TABLE reports DROP COLUMN file_hash;
```

**Step 2: Apply migration to production D1**

```bash
bun run db:migrate
```

Expected output: migration `0041` applied successfully.

**Step 3: Verify in production**

```bash
bun run db:query -- --command "PRAGMA table_info(reports);"
```

Expected: `file_hash` column absent from the output.

```bash
bun run db:query -- --command "SELECT name FROM sqlite_master WHERE type='table' AND name='qr_code_analytics';"
```

Expected: empty result set.

---

## Task 4: Remove `fileAttachments.url` fallback code (backend)

**Files:**
- Modify: `src/modules/file-management/services/file-service.ts` (2 locations)
- Modify: `src/durable-objects/CustomerMessageDO.ts` (1 location)
- Modify: `src/modules/messaging/handlers/messaging/routes/attachments.ts` (1 location)

**Step 1: Fix `file-service.ts` — line ~220**

Find:
```typescript
          : fileRecord.fileUrl || fileRecord.url;
```
Replace with:
```typescript
          : fileRecord.fileUrl;
```

**Step 2: Fix `file-service.ts` — line ~574**

Find:
```typescript
      url: record.fileUrl || record.url,
```
Replace with:
```typescript
      url: record.fileUrl,
```

**Step 3: Fix `CustomerMessageDO.ts` — line ~403**

Find:
```typescript
                  const attachmentUrl = attachment.fileUrl || attachment.url; // Fallback for legacy
```
Replace with:
```typescript
                  const attachmentUrl = attachment.fileUrl;
```

**Step 4: Fix `attachments.ts` — remove the `url` field from SELECT**

Find this block (around line 65-70):
```typescript
        mimeType: fileAttachments.mimeType,
        fileSize: fileAttachments.fileSize,
        fileUrl: fileAttachments.fileUrl,
        r2Key: fileAttachments.r2Key,
        url: fileAttachments.url,
        createdAt: fileAttachments.createdAt
```
Replace with (remove the `url` line):
```typescript
        mimeType: fileAttachments.mimeType,
        fileSize: fileAttachments.fileSize,
        fileUrl: fileAttachments.fileUrl,
        r2Key: fileAttachments.r2Key,
        createdAt: fileAttachments.createdAt
```

**Step 5: Run TypeScript check**

```bash
bash scripts/check.sh backend
```

Expected: no errors.

---

## Task 5: Remove `conversations.internalNotes` usage (backend)

**Files:**
- Modify: `src/modules/integrations/services/webhook-conversation-service.ts` (1 location)
- Modify: `src/modules/integrations/handlers/line-event-processor.ts` (1 location)

**Step 1: Fix `webhook-conversation-service.ts` — line ~73**

Find:
```typescript
          firstResponseAt: null,
          closedAt: null,
          internalNotes: null,
          lastMessageAt: timestamp,
```
Replace with:
```typescript
          firstResponseAt: null,
          closedAt: null,
          lastMessageAt: timestamp,
```

**Step 2: Fix `line-event-processor.ts` — line ~614**

Find:
```typescript
            status: 'active',
            priority: 'normal',
            internalNotes: JSON.stringify({
              autoAssigned: true,
              source: 'qr_code_follow',
              followedAt: timestamp
            }),
            lastMessageAt: timestamp,
```
Replace with:
```typescript
            status: 'active',
            priority: 'normal',
            lastMessageAt: timestamp,
```

**Step 3: Run TypeScript check**

```bash
bash scripts/check.sh backend
```

Expected: no errors.

---

## Task 6: Remove `url` and `internalNotes` from schema files

**Files:**
- Modify: `src/db/schema.ts` (2 columns)
- Modify: `src/shared/database/schema.ts` (1 column — `internalNotes` in conversations)

**Step 1: Remove `url` from `fileAttachments` in `src/db/schema.ts`**

In the `fileAttachments` table definition, remove:
```typescript
  url: text('url'),
```

**Step 2: Remove `internalNotes` from `conversations` in `src/db/schema.ts`**

In the `conversations` table definition, remove:
```typescript
  internalNotes: text('internal_notes'),
```

**Step 3: Remove `internalNotes` from `conversations` in `src/shared/database/schema.ts`**

Locate the `conversations` table in `src/shared/database/schema.ts` (around line 224) and remove:
```typescript
  internalNotes: text('internal_notes'),
```

**Step 4: Run TypeScript check**

```bash
bash scripts/check.sh backend
```

Expected: no errors (all runtime references were removed in Task 4 & 5).

---

## Task 7: Write and apply Phase 2 migration

**Files:**
- Create: `migrations/0042_remove_dead_schema_phase2.sql`

**Step 1: Create the migration file**

```sql
-- ===============================================
-- Migration 0042: Remove Dead Schema — Phase 2
-- ===============================================
-- Date: 2026-03-03
-- Purpose: Drop legacy `url` column from file_attachments (replaced by
-- `file_url` since migration 0025) and drop `internal_notes`
-- from conversations (never read; code cleaned up before this
-- migration).
--
-- CHANGES:
-- 1. ALTER TABLE file_attachments DROP COLUMN url
-- 2. ALTER TABLE conversations DROP COLUMN internal_notes
--
-- SAFETY:
-- D1 uses SQLite 3.42.0+. Both columns are plain TEXT with no
-- constraints or indexes — DROP COLUMN is safe.
-- All backend fallback code referencing these columns was removed
-- in the codebase before this migration is applied.
--
-- Rollback SQL:
-- ALTER TABLE file_attachments ADD COLUMN url TEXT;
-- ALTER TABLE conversations ADD COLUMN internal_notes TEXT;
-- ===============================================

-- 1. Drop legacy URL column (replaced by file_url since migration 0025)
ALTER TABLE file_attachments DROP COLUMN url;

-- 2. Drop internal notes column (never read; write-only dead column)
ALTER TABLE conversations DROP COLUMN internal_notes;
```

**Step 2: Apply migration to production D1**

```bash
bun run db:migrate
```

Expected output: migration `0042` applied successfully.

**Step 3: Verify in production**

```bash
bun run db:query -- --command "PRAGMA table_info(file_attachments);"
```

Expected: `url` column absent.

```bash
bun run db:query -- --command "PRAGMA table_info(conversations);"
```

Expected: `internal_notes` column absent.

---

## Task 8: Final verification

**Step 1: Full TypeScript + lint check**

```bash
bash scripts/check.sh
```

Expected: zero errors, zero warnings.

**Step 2: Run backend tests**

```bash
bunx vitest run tests/unit tests/modules --passWithNoTests
```

Expected: same pass rate as before (4 pre-existing P3 failures are OK).

**Step 3: Commit**

```bash
git add src/db/schema.ts src/shared/database/schema.ts \
        src/modules/file-management/services/file-service.ts \
        src/durable-objects/CustomerMessageDO.ts \
        src/modules/messaging/handlers/messaging/routes/attachments.ts \
        src/modules/integrations/services/webhook-conversation-service.ts \
        src/modules/integrations/handlers/line-event-processor.ts \
        migrations/0041_remove_dead_schema_phase1.sql \
        migrations/0042_remove_dead_schema_phase2.sql
git commit -m "chore(db): remove dead schema columns and unused qrCodeAnalytics table

Phase 1 (zero-risk):
- DROP TABLE qr_code_analytics (0 usages)
- DROP COLUMN reports.file_hash (0 usages)

Phase 2 (fallback cleanup):
- DROP COLUMN file_attachments.url (legacy, replaced by file_url)
- DROP COLUMN conversations.internal_notes (write-only, never read)
- Remove all || fallback code referencing file_attachments.url
- Remove internalNotes assignments from webhook/line-event code"
```
