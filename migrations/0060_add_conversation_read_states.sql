-- Migration: 0060_add_conversation_read_states.sql
-- Date: 2026-08-31
-- Purpose: Make read/unread state per-agent instead of global.
--
-- Until now `conversations.last_read_at` and `conversations.marked_unread_at`
-- were single columns on the conversation row, so one agent opening a
-- conversation cleared the unread badge for every other agent. This table adds
-- the missing dimension: read state belongs to the (agent, conversation) pair.
--
-- Scope of the change (decision A-1):
--   * `last_read_at` and `marked_unread_at` become per-agent.
--   * The `last_agent_reply` term of the unread formula stays GLOBAL — a
--     customer message answered by any agent counts as handled for everyone,
--     so unread badges keep signalling "needs a reply" rather than "nobody on
--     the team has personally opened this".
--
-- Storage is sparse: a row only exists once an agent has actually read or
-- manually flagged that conversation.
--
-- The old columns on `conversations` are intentionally NOT dropped. Keeping
-- them lets the read path be reverted to the global behaviour without a
-- reverse migration while the new semantics are observed in production.

CREATE TABLE IF NOT EXISTS conversation_read_states (
  agent_id         TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  last_read_at     TEXT,
  marked_unread_at TEXT,
  updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (agent_id, conversation_id)
);

-- The composite primary key already indexes (agent_id, conversation_id), which
-- is the lookup the per-agent LEFT JOIN needs. This second index covers the
-- reverse direction: purging or inspecting every agent's state for one
-- conversation.
CREATE INDEX IF NOT EXISTS idx_conversation_read_states_conversation
ON conversation_read_states(conversation_id);

-- Backfill: seed every active agent from the current global state so nobody
-- sees a wall of freshly-unread conversations the moment this ships. Only
-- conversations that actually carry state are seeded, keeping the table sparse.
INSERT OR IGNORE INTO conversation_read_states
  (agent_id, conversation_id, last_read_at, marked_unread_at, updated_at)
SELECT
  agent.id,
  conversation.id,
  conversation.last_read_at,
  conversation.marked_unread_at,
  CURRENT_TIMESTAMP
FROM agents AS agent
CROSS JOIN conversations AS conversation
WHERE agent.deleted_at IS NULL
  AND conversation.deleted_at IS NULL
  AND (conversation.last_read_at IS NOT NULL OR conversation.marked_unread_at IS NOT NULL);
