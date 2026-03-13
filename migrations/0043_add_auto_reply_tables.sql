-- ===============================================
-- Migration 0043: Add Auto-Reply System Tables
-- ===============================================
-- Date: 2026-03-13
-- Purpose: Create tables for the auto-reply engine (LINE OA auto-reply).
--          Supports 4 trigger types: welcome, keyword, off_hours, fallback.
--
-- TABLES ADDED:
--   1. auto_reply_rules      — Core rule definitions (per team)
--   2. auto_reply_conditions  — Match conditions (1:N to rules)
--   3. auto_reply_actions     — Response actions (1:N to rules)
--   4. auto_reply_schedules   — Business hours per team (per day of week)
--   5. auto_reply_logs        — Audit trail (append-only)
--
-- ROLLBACK: Drop all 5 tables in reverse dependency order.
-- ===============================================

-- 1. Auto-Reply Rules
CREATE TABLE IF NOT EXISTS `auto_reply_rules` (
  `id` integer PRIMARY KEY,
  `team_id` integer NOT NULL REFERENCES `teams`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `trigger_type` text NOT NULL,  -- 'welcome' | 'keyword' | 'off_hours' | 'fallback'
  `priority` integer NOT NULL DEFAULT 100,
  `is_active` integer DEFAULT 1,
  `created_by` text REFERENCES `agents`(`id`) ON DELETE SET NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` text
);

-- 2. Auto-Reply Conditions
CREATE TABLE IF NOT EXISTS `auto_reply_conditions` (
  `id` integer PRIMARY KEY,
  `rule_id` integer NOT NULL REFERENCES `auto_reply_rules`(`id`) ON DELETE CASCADE,
  `condition_type` text NOT NULL,  -- 'exact' | 'contains' | 'regex' | 'message_type'
  `value` text NOT NULL,
  `case_sensitive` integer DEFAULT 0,
  `match_mode` text DEFAULT 'any',  -- 'any' (OR) | 'all' (AND)
  `created_at` text DEFAULT CURRENT_TIMESTAMP
);

-- 3. Auto-Reply Actions
CREATE TABLE IF NOT EXISTS `auto_reply_actions` (
  `id` integer PRIMARY KEY,
  `rule_id` integer NOT NULL REFERENCES `auto_reply_rules`(`id`) ON DELETE CASCADE,
  `action_type` text NOT NULL,  -- 'reply_text' | 'reply_image' | 'reply_flex'
  `content` text NOT NULL,
  `sort_order` integer DEFAULT 0,
  `created_at` text DEFAULT CURRENT_TIMESTAMP
);

-- 4. Auto-Reply Schedules
CREATE TABLE IF NOT EXISTS `auto_reply_schedules` (
  `id` integer PRIMARY KEY,
  `team_id` integer NOT NULL REFERENCES `teams`(`id`) ON DELETE CASCADE,
  `day_of_week` integer NOT NULL,  -- 0=Sunday .. 6=Saturday
  `start_time` text NOT NULL,      -- 'HH:mm'
  `end_time` text NOT NULL,        -- 'HH:mm'
  `timezone` text DEFAULT 'Asia/Taipei',
  `is_active` integer DEFAULT 1,
  `created_at` text DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(`team_id`, `day_of_week`)
);

-- 5. Auto-Reply Logs (append-only audit trail)
CREATE TABLE IF NOT EXISTS `auto_reply_logs` (
  `id` integer PRIMARY KEY,
  `rule_id` integer REFERENCES `auto_reply_rules`(`id`) ON DELETE SET NULL,
  `conversation_id` text REFERENCES `conversations`(`id`) ON DELETE SET NULL,
  `customer_id` integer REFERENCES `customers`(`id`) ON DELETE SET NULL,
  `trigger_content` text,
  `response_content` text,
  `matched_condition` text,
  `platform` text NOT NULL DEFAULT 'line',
  `reply_method` text NOT NULL DEFAULT 'reply_api',
  `created_at` text DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS `idx_auto_reply_rules_team_active` ON `auto_reply_rules`(`team_id`, `is_active`) WHERE `deleted_at` IS NULL;
CREATE INDEX IF NOT EXISTS `idx_auto_reply_conditions_rule` ON `auto_reply_conditions`(`rule_id`);
CREATE INDEX IF NOT EXISTS `idx_auto_reply_actions_rule` ON `auto_reply_actions`(`rule_id`);
CREATE INDEX IF NOT EXISTS `idx_auto_reply_schedules_team` ON `auto_reply_schedules`(`team_id`);
CREATE INDEX IF NOT EXISTS `idx_auto_reply_logs_rule` ON `auto_reply_logs`(`rule_id`);
CREATE INDEX IF NOT EXISTS `idx_auto_reply_logs_created` ON `auto_reply_logs`(`created_at`);
