-- Migration 0079: one conversation per customer, enforced by the database
-- ===============================================================
-- Date: 2026-11-24
--
-- WHY: the product rule is one conversation per customer (an inbound message reopens the SAME
-- conversation, including a closed one). Until now only application code kept it: every create
-- path does find-then-insert, and the webhook path holds the `webhook:conversation:<customerId>`
-- lock for it, but the LINE follow handler and the LIFF welcome API insert without that lock,
-- and the lock gives no exclusion once a critical section outlives its TTL (#277). A race could
-- therefore leave a customer with two live conversations and split their messages.
--
-- Production checked 2026-11-24 before writing this: 487 conversations, 487 distinct
-- customer_id, 0 duplicates, 0 NULLs (customer_id is NOT NULL), so the index builds cleanly.
-- Every insert path now treats "UNIQUE constraint failed: conversations.customer_id" as
-- "another request created it first" and re-reads that conversation instead of failing.
--
-- Also declared in src/db/schema.ts (uniqueIndex) so a schema push or rebuild keeps it: the
-- 2026-06-17 rebuild lost every index that existed only in migration SQL.
--
-- idx_conversations_customer (customer_id) from 0005/0006 is redundant with the unique index
-- (same single column). It is already absent from production (lost in the 2026-06-17 rebuild)
-- but exists in any database built by replaying migrations, so it is dropped here.
-- idx_conversations_customer_status (customer_id, status) covers more columns and is kept.
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_conversations_customer_unique;
--   CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_customer_unique ON conversations(customer_id);

DROP INDEX IF EXISTS idx_conversations_customer;
