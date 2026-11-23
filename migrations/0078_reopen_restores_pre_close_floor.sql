-- Migration 0078: a prompt manual reopen undoes the close, including the wait it settled
-- ===============================================================
-- Date: 2026-11-23
--
-- WHY: closing sets unread_floor_at = now and clears awaiting_since (0077), so messages before the close
-- no longer count as unread or as a wait. That is right when the customer's next message reopens the
-- conversation, but an agent who closes by mistake and reopens got a conversation shown as answered
-- although nobody replied: the customer silently dropped off the waiting list and the dashboard.
--
-- RULE (setConversationsClosed): close stores the floor it replaces in unread_floor_before_close; a manual
-- reopen within REOPEN_UNDO_WINDOW_MS (one hour) of the close puts it back and re-derives awaiting_since.
-- A later manual reopen, or a reopen by an inbound message, keeps the floor (0077), so reopening a
-- conversation the nightly auto-close settled weeks ago does not bring back a months-old wait.
-- Additive only; no trigger changes (0077 still holds the current awaiting triggers).

ALTER TABLE conversations ADD COLUMN unread_floor_before_close TEXT;
