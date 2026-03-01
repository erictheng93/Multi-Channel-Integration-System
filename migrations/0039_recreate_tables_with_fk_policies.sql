-- ===============================================
-- Migration 0039: Safe FK Policy + Report Templates
-- ===============================================
-- Date: 2026-02-19 (revised 2026-03-01)
-- Purpose: Create system agent for report templates FK reference,
--          then insert default report templates.
--
-- REVISED APPROACH (2026-03-01):
--   The original migration attempted to DROP and recreate ALL tables
--   to change FK policies from RESTRICT to CASCADE/SET NULL.
--   This failed on D1 because:
--     1. D1 ignores PRAGMA foreign_keys = OFF (FK enforcement stays active)
--     2. INSERT OR IGNORE only suppresses UNIQUE/PK conflicts, not FK violations
--     3. The 'system' agent referenced by report_templates didn't exist
--
--   The safe approach:
--     - Skip table recreation (RESTRICT FK policies are fine — code handles cascading manually)
--     - Create the 'system' agent record (for report_templates FK)
--     - Insert default report templates
--     - No data loss, no downtime
--
-- WHY RESTRICT IS FINE:
--   - RESTRICT prevents accidental cascading deletion (safety net)
--   - Code in hardDeleteMember() manually cleans up all FK references
--   - schema.ts declares CASCADE/SET NULL as Drizzle-level intent, but
--     DB-level RESTRICT is actually safer for production data
-- ===============================================

-- ================================================================
-- STEP 1: Create system agent (required for report_templates FK)
-- ================================================================
-- This agent is used as created_by for system-generated report templates.
-- It has is_active=0 and a non-loginable password hash to prevent login.
INSERT OR IGNORE INTO agents (id, email, password_hash, display_name, role, is_active, created_at, updated_at)
VALUES ('system', 'system@internal', 'SYSTEM_NO_LOGIN', 'System', 'admin', 0, datetime('now'), datetime('now'));

-- ================================================================
-- STEP 2: Insert default report templates
-- ================================================================
INSERT OR IGNORE INTO report_templates (id, name, description, report_type, template_config, category, is_system_template, is_public, created_by)
VALUES
  ('tpl_conv_summary_basic', '基本對話摘要', '顯示對話總數、訊息量和回應時間的基本報告', 'conversation_summary', '{"includeMetrics":["total","active","closed"],"groupBy":"day"}', 'operational', 1, 1, 'system'),
  ('tpl_agent_perf_monthly', '月度客服績效', '展示客服人員的月度工作表現和KPI指標', 'agent_performance', '{"timeRange":"last_30_days","metrics":["conversations","messages","avgResponseTime","satisfaction"]}', 'analytical', 1, 1, 'system'),
  ('tpl_team_analytics', '團隊分析報告', '團隊整體表現和協作效率分析', 'team_analytics', '{"includeCharts":true,"compareTeams":true}', 'analytical', 1, 1, 'system'),
  ('tpl_executive_summary', '高層管理摘要', '為管理層提供關鍵業務指標的簡潔摘要', 'executive_summary', '{"includeKPIs":true,"includeTrends":true}', 'executive', 1, 1, 'system');

-- ===============================================
-- Migration metadata
-- ===============================================
-- Version: 0039
-- Date: 2026-02-19 (revised 2026-03-01)
-- Author: Schema FK Policy + Report Templates
-- Purpose: Safe migration - create system agent + insert report templates
--
-- CHANGES:
--   - Creates 'system' agent (id='system', is_active=0, non-loginable)
--   - Inserts 4 default report templates referencing 'system' agent
--
-- WHAT WAS REMOVED (from original destructive version):
--   - No longer drops/recreates 30 tables (preserves production data)
--   - No longer changes FK policies (RESTRICT is kept as safety net)
--   - No longer recreates 96 indexes or 3 views
--
-- FK POLICY NOTE:
--   The original migration wanted to change RESTRICT → CASCADE/SET NULL.
--   This is unnecessary because the application code handles cascading
--   manually in hardDeleteMember() and related service methods.
--   RESTRICT acts as an additional safety net against accidental data loss.
