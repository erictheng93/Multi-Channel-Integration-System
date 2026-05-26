-- Migration: 0049_add_allow_push_fallback.sql
-- Date: 2026-05-26
-- Purpose: Per-rule opt-in switch for Push API fallback on Reply API failure.
-- Default 0 (disabled) preserves the existing behavior: Reply API failure returns
-- an error without consuming Push quota. Operators can enable per-rule for
-- business-critical replies where delivery guarantee outweighs Push API cost.

ALTER TABLE auto_reply_rules
  ADD COLUMN allow_push_fallback INTEGER NOT NULL DEFAULT 0;
