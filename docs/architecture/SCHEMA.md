# 資料庫結構 (Database Schema)

> **此文件由程式產生，請勿手動編輯。**
> 重新產生：`bun run db:doc:schema`（正式庫）或 `bun scripts/generate-schema-doc.ts`（本地鏡像）
>
> **產生時間**: 2026-09-09T08:08:58.253Z
> **資料來源**: REMOTE production D1 (mcis-db)
>
> 內容直接讀自資料庫的 `sqlite_master` 與 pragma 函式，**不是**讀 `src/db/schema.ts`
> 或 `migrations/`。這個順序是刻意的：2026-06-17 的重建事件證明那兩者可能與正式庫
> 不一致，而 `d1_migrations` 日誌也曾在 DDL 從未落地的情況下標記 migration 已套用。
> **資料庫裡實際存在的東西，才是唯一的事實。**

---

## 概覽

| 項目 | 數量 |
|---|---|
| 資料表 | 41 |
| 索引 | 124 |
| 視圖 | 3 |
| 外鍵關係 | 69 |
| CHECK 約束 | 0 |

> **注意：資料庫中沒有任何 CHECK 約束。** 至少 9 個 migration 的 SQL 有宣告
> CHECK（例如 `customer_feedback.rating` 的 1–5 範圍、`cors_events.type` 的列舉），
> 但正式庫一個都沒有。這與 2026-06-17 重建事件的模式一致 —— 能用 `schema.ts`
> 表達的存活了，只存在於 migration SQL 的則遺失。
>
> `bun run check:migrations` **偵測不到這件事**：它只追蹤 table / index /
> trigger / view 四種物件，不含 CHECK 約束。這些資料完整性保護目前在正式庫
> 沒有生效，相關驗證只靠應用層。

## 與 `src/db/schema.ts` 的一致性

資料庫中的 41 張表與 `src/db/schema.ts` 宣告的表**完全一致**。
相關檢查：`bun run check:migrations` 會比對「已套用的 migration 宣告了什麼」與
「資料庫實際有什麼」，涵蓋 table / index / trigger / view 四種物件，比本文件的
表級比對更細。**但它不檢查 CHECK 約束、欄位型別與外鍵**。

---

## 資料表目錄

- [`activities`](#activities) — 11 欄；Activities table - 活動記錄表（審計追蹤）
- [`agent_teams`](#agent-teams) — 7 欄；Agent Teams junction table - 客服人員與團隊的多對多關係 (Migration 0028) Allows agents to belong to unlimited teams simultaneously
- [`agents`](#agents) — 12 欄；Agents table - 客服人員 ENCRYPTION NOTE: passwordHash uses bcrypt (not reversible encryption)
- [`auto_reply_actions`](#auto-reply-actions) — 6 欄；Auto-Reply Actions table - 自動回覆動作 (1:N to rules)
- [`auto_reply_conditions`](#auto-reply-conditions) — 7 欄；Auto-Reply Conditions table - 自動回覆匹配條件 (1:N to rules)
- [`auto_reply_deliveries`](#auto-reply-deliveries) — 14 欄；Auto-Reply Deliveries table - idempotency ledger for webhook-triggered auto replies
- [`auto_reply_logs`](#auto-reply-logs) — 10 欄；Auto-Reply Logs table - 自動回覆審計日誌 (append-only, no soft delete)
- [`auto_reply_rules`](#auto-reply-rules) — 11 欄；Auto-Reply Rules table - 自動回覆規則
- [`auto_reply_schedules`](#auto-reply-schedules) — 9 欄；Auto-Reply Schedules table - 營業時間設定 (per team, per day of week)
- [`broadcast_recipients`](#broadcast-recipients) — 10 欄；Broadcast recipients table - 群發收件人明細（受眾快照 + 逐人結果）
- [`broadcasts`](#broadcasts) — 16 欄；Broadcasts table - 群發活動
- [`channel_integrations`](#channel-integrations) — 16 欄；Channel Integrations table - 渠道集成配置（多租户支持） NOTE: Migration 0026 introduced JSON-based configuration for extensibility Legacy platform-specific columns are preserved for backward compatibility
- [`conversation_read_states`](#conversation-read-states) — 5 欄；Conversation read states - 每位客服各自的已讀/未讀狀態 (Migration 0060) One row per (agent, conversation) pair, created lazily the first time that agent reads or manually flags the conversation. Replaces the global conversations.last_read_at / .marked_unread_at columns so that one agent reading a conversation no longer clears every other agent's unread badge. The last-agent-reply half of the unread formula stays global by design.
- [`conversation_sessions`](#conversation-sessions) — 10 欄；Conversation sessions table - 對話會話管理
- [`conversation_tags`](#conversation-tags) — 4 欄；Conversation tags junction table - 對話標籤關聯
- [`conversation_transfers`](#conversation-transfers) — 8 欄；Conversation transfers table - 對話轉移記錄 Note: fromUserId/toUserId removed - only team-based transfers are supported now
- [`conversations`](#conversations) — 13 欄；Conversations table - 對話
- [`cors_events`](#cors-events) — 9 欄；CORS Events table - CORS 事件記錄
- [`customer_feedback`](#customer-feedback) — 10 欄；Customer Feedback table - 客户满意度反馈 (Migration 0032)
- [`customer_tags`](#customer-tags) — 4 欄；Customer tags junction table - 客戶標籤關聯
- [`customer_team_assignments`](#customer-team-assignments) — 8 欄；Customer Team Assignments table - 客戶團隊分配記錄 (Migration 0031) Tracks customer team assignments from LIFF QR Code scans (recorded BEFORE friend status)
- [`customers`](#customers) — 12 欄；Customers table - 平台客戶資訊表 ENCRYPTION NOTE: Consider encrypting email, phone, metadata for PII protection
- [`delayed_messages`](#delayed-messages) — 12 欄
- [`file_attachments`](#file-attachments) — 12 欄；File attachments table - 檔案附件表 All columns now use consistent snake_case naming (Migration 0037 applied 2026-02-14)
- [`message_recall_logs`](#message-recall-logs) — 5 欄；Message recall logs table - 訊息撤回日誌
- [`messages`](#messages) — 24 欄；Messages table - 訊息 NOTE: replyToMessageId is a self-reference to messages.id Foreign key constraint is enforced at application layer (see message-crud.ts)
- [`metrics`](#metrics) — 7 欄；Metrics table - 企業分析指標
- [`notifications`](#notifications) — 12 欄；Notifications table - 通知系統
- [`qr_code_scans`](#qr-code-scans) — 7 欄；QR Code Scans table - 掃描記錄
- [`qr_codes`](#qr-codes) — 13 欄；QR Codes table - QR碼管理
- [`report_download_history`](#report-download-history) — 9 欄；Report download history table - 報告下載歷史表
- [`report_templates`](#report-templates) — 17 欄；Report templates table - 報告模板表
- [`reports`](#reports) — 26 欄；Reports main table - 報告系統主表
- [`scheduled_report_executions`](#scheduled-report-executions) — 10 欄；Scheduled report executions table - 排程執行歷史表
- [`scheduled_reports`](#scheduled-reports) — 24 欄；Scheduled reports table - 排程報告表
- [`system_settings`](#system-settings) — 4 欄；System settings table - 系統設定表
- [`tags`](#tags) — 10 欄；Tags table - 標籤系統 SEMANTIC CONTRACT: isActive=false → temporarily disabled (recoverable) deletedAt=set  → soft deleted (logically removed)
- [`task_reminders`](#task-reminders) — 13 欄；Task Reminders table - 任務提醒 (Migration 0029)
- [`team_liff_qr_codes`](#team-liff-qr-codes) — 8 欄；Team LIFF QR Codes table - 團隊 LIFF QR Code (Migration 0031 - pending) Stores persistent LIFF URLs and QR Code images for team member onboarding
- [`teams`](#teams) — 8 欄；Teams table - 團隊 SEMANTIC CONTRACT: isActive=false → temporarily disabled (recoverable) deletedAt=set  → soft deleted (logically removed)
- [`webhook_security_events`](#webhook-security-events) — 8 欄；Webhook Security Events table - 安全事件記錄

---

## 資料表定義

### `activities`

> Activities table - 活動記錄表（審計追蹤）

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK, NOT NULL | - |
| `user_id` | TEXT | NOT NULL | - |
| `user_name` | TEXT | NOT NULL | - |
| `user_role` | TEXT | NOT NULL | - |
| `action` | TEXT | NOT NULL | - |
| `resource_type` | TEXT | NOT NULL | - |
| `resource_id` | TEXT | - | - |
| `details` | TEXT | - | - |
| `ip_address` | TEXT | - | - |
| `user_agent` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `user_id` → `agents.id` (ON DELETE RESTRICT)

**索引**:

- `idx_activities_action` — (action)
- `idx_activities_created_at` — (created_at)
- `idx_activities_resource` — (resource_type, resource_id)
- `idx_activities_user` — (user_id)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `activities` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`user_role` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`details` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE restrict
)
```

</details>

### `agent_teams`

> Agent Teams junction table - 客服人員與團隊的多對多關係 (Migration 0028) Allows agents to belong to unlimited teams simultaneously

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK, NOT NULL | - |
| `agent_id` | TEXT | NOT NULL | - |
| `team_id` | INTEGER | NOT NULL | - |
| `role_in_team` | TEXT | - | `'member'` |
| `is_primary` | INTEGER | - | `false` |
| `joined_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `team_id` → `teams.id` (ON DELETE CASCADE)
- `agent_id` → `agents.id` (ON DELETE CASCADE)

**索引**:

- `agent_teams_agent_id_team_id_unique` *(UNIQUE)* — (`agent_id`,`team_id`)
- `idx_agent_teams_agent_id` — (agent_id)
- `idx_agent_teams_is_primary` *(partial)* — (agent_id, is_primary)
- `idx_agent_teams_role` — (team_id, role_in_team)
- `idx_agent_teams_team_id` — (team_id)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `agent_teams` (
	`id` integer PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`team_id` integer NOT NULL,
	`role_in_team` text DEFAULT 'member',
	`is_primary` integer DEFAULT false,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
)
```

</details>

### `agents`

> Agents table - 客服人員 ENCRYPTION NOTE: passwordHash uses bcrypt (not reversible encryption)

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `email` | TEXT | NOT NULL | - |
| `password_hash` | TEXT | NOT NULL | - |
| `display_name` | TEXT | NOT NULL | - |
| `role` | TEXT | NOT NULL | `'agent'` |
| `is_active` | INTEGER | - | `true` |
| `password_policy` | TEXT | - | `'changeable'` |
| `last_active` | TEXT | - | - |
| `last_login_at` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `deleted_at` | TEXT | - | - |

**索引**:

- `agents_email_unique` *(UNIQUE)* — (`email`)
- `idx_agents_deleted_at` *(partial)* — (deleted_at)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'agent' NOT NULL,
	`is_active` integer DEFAULT true,
	`password_policy` text DEFAULT 'changeable',
	`last_active` text,
	`last_login_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` text
)
```

</details>

### `auto_reply_actions`

> Auto-Reply Actions table - 自動回覆動作 (1:N to rules)

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK, NOT NULL | - |
| `rule_id` | INTEGER | NOT NULL | - |
| `action_type` | TEXT | NOT NULL | - |
| `content` | TEXT | NOT NULL | - |
| `sort_order` | INTEGER | - | `0` |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `rule_id` → `auto_reply_rules.id` (ON DELETE CASCADE)

**索引**:

- `idx_auto_reply_actions_rule` — (`rule_id`)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `auto_reply_actions` (
	`id` integer PRIMARY KEY NOT NULL,
	`rule_id` integer NOT NULL,
	`action_type` text NOT NULL,
	`content` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`rule_id`) REFERENCES `auto_reply_rules`(`id`) ON UPDATE no action ON DELETE cascade
)
```

</details>

### `auto_reply_conditions`

> Auto-Reply Conditions table - 自動回覆匹配條件 (1:N to rules)

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK, NOT NULL | - |
| `rule_id` | INTEGER | NOT NULL | - |
| `condition_type` | TEXT | NOT NULL | - |
| `value` | TEXT | NOT NULL | - |
| `case_sensitive` | INTEGER | - | `false` |
| `match_mode` | TEXT | - | `'any'` |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `rule_id` → `auto_reply_rules.id` (ON DELETE CASCADE)

**索引**:

- `idx_auto_reply_conditions_rule` — (`rule_id`)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `auto_reply_conditions` (
	`id` integer PRIMARY KEY NOT NULL,
	`rule_id` integer NOT NULL,
	`condition_type` text NOT NULL,
	`value` text NOT NULL,
	`case_sensitive` integer DEFAULT false,
	`match_mode` text DEFAULT 'any',
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`rule_id`) REFERENCES `auto_reply_rules`(`id`) ON UPDATE no action ON DELETE cascade
)
```

</details>

### `auto_reply_deliveries`

> Auto-Reply Deliveries table - idempotency ledger for webhook-triggered auto replies

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK, NOT NULL | - |
| `platform` | TEXT | NOT NULL | `'line'` |
| `platform_message_id` | TEXT | NOT NULL | - |
| `rule_id` | INTEGER | - | - |
| `conversation_id` | TEXT | - | - |
| `customer_id` | INTEGER | - | - |
| `status` | TEXT | NOT NULL | `'pending'` |
| `reply_method` | TEXT | - | - |
| `attempt_count` | INTEGER | NOT NULL | `0` |
| `last_error` | TEXT | - | - |
| `last_attempt_at` | TEXT | - | - |
| `sent_at` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `customer_id` → `customers.id` (ON DELETE SET NULL)
- `conversation_id` → `conversations.id` (ON DELETE SET NULL)
- `rule_id` → `auto_reply_rules.id` (ON DELETE SET NULL)

**索引**:

- `auto_reply_deliveries_platform_platform_message_id_unique` *(UNIQUE)* — (`platform`,`platform_message_id`)
- `idx_auto_reply_deliveries_conversation` — (conversation_id, created_at)
- `idx_auto_reply_deliveries_status` — (status, updated_at)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `auto_reply_deliveries` (
	`id` integer PRIMARY KEY NOT NULL,
	`platform` text DEFAULT 'line' NOT NULL,
	`platform_message_id` text NOT NULL,
	`rule_id` integer,
	`conversation_id` text,
	`customer_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`reply_method` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`last_attempt_at` text,
	`sent_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`rule_id`) REFERENCES `auto_reply_rules`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `auto_reply_logs`

> Auto-Reply Logs table - 自動回覆審計日誌 (append-only, no soft delete)

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK, NOT NULL | - |
| `rule_id` | INTEGER | - | - |
| `conversation_id` | TEXT | - | - |
| `customer_id` | INTEGER | - | - |
| `trigger_content` | TEXT | - | - |
| `response_content` | TEXT | - | - |
| `matched_condition` | TEXT | - | - |
| `platform` | TEXT | NOT NULL | `'line'` |
| `reply_method` | TEXT | NOT NULL | `'reply_api'` |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `customer_id` → `customers.id` (ON DELETE SET NULL)
- `conversation_id` → `conversations.id` (ON DELETE SET NULL)
- `rule_id` → `auto_reply_rules.id` (ON DELETE SET NULL)

**索引**:

- `idx_auto_reply_logs_created` — (`created_at`)
- `idx_auto_reply_logs_rule` — (`rule_id`)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `auto_reply_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`rule_id` integer,
	`conversation_id` text,
	`customer_id` integer,
	`trigger_content` text,
	`response_content` text,
	`matched_condition` text,
	`platform` text DEFAULT 'line' NOT NULL,
	`reply_method` text DEFAULT 'reply_api' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`rule_id`) REFERENCES `auto_reply_rules`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `auto_reply_rules`

> Auto-Reply Rules table - 自動回覆規則

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK, NOT NULL | - |
| `team_id` | INTEGER | - | - |
| `name` | TEXT | NOT NULL | - |
| `trigger_type` | TEXT | NOT NULL | - |
| `priority` | INTEGER | NOT NULL | `100` |
| `is_active` | INTEGER | - | `true` |
| `allow_push_fallback` | INTEGER | NOT NULL | `false` |
| `created_by` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `deleted_at` | TEXT | - | - |

**外鍵**:

- `created_by` → `agents.id` (ON DELETE SET NULL)
- `team_id` → `teams.id` (ON DELETE CASCADE)

**索引**:

- `idx_auto_reply_rules_global_active` *(partial)* — (`is_active`)
- `idx_auto_reply_rules_team_active` *(partial)* — (`team_id`, `is_active`)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `auto_reply_rules` (
	`id` integer PRIMARY KEY NOT NULL,
	`team_id` integer,
	`name` text NOT NULL,
	`trigger_type` text NOT NULL,
	`priority` integer DEFAULT 100 NOT NULL,
	`is_active` integer DEFAULT true,
	`allow_push_fallback` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `auto_reply_schedules`

> Auto-Reply Schedules table - 營業時間設定 (per team, per day of week)

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK, NOT NULL | - |
| `team_id` | INTEGER | NOT NULL | - |
| `day_of_week` | INTEGER | NOT NULL | - |
| `start_time` | TEXT | NOT NULL | - |
| `end_time` | TEXT | NOT NULL | - |
| `timezone` | TEXT | - | `'Asia/Taipei'` |
| `is_active` | INTEGER | - | `true` |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `team_id` → `teams.id` (ON DELETE CASCADE)

**索引**:

- `auto_reply_schedules_team_id_day_of_week_unique` *(UNIQUE)* — (`team_id`,`day_of_week`)
- `idx_auto_reply_schedules_team` — (`team_id`)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `auto_reply_schedules` (
	`id` integer PRIMARY KEY NOT NULL,
	`team_id` integer NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Taipei',
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
)
```

</details>

### `broadcast_recipients`

> Broadcast recipients table - 群發收件人明細（受眾快照 + 逐人結果）

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK | - |
| `broadcast_id` | TEXT | NOT NULL | - |
| `customer_id` | INTEGER | - | - |
| `platform` | TEXT | NOT NULL | - |
| `platform_user_id` | TEXT | NOT NULL | - |
| `resolved_team_id` | INTEGER | - | - |
| `status` | TEXT | NOT NULL | `'pending'` |
| `error_reason` | TEXT | - | - |
| `sent_at` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `customer_id` → `customers.id` (ON DELETE SET NULL)
- `broadcast_id` → `broadcasts.id` (ON DELETE CASCADE)

**索引**:

- `idx_broadcast_recipients_broadcast_platform_user` *(UNIQUE)* — (broadcast_id, platform, platform_user_id)
- `idx_broadcast_recipients_broadcast_status` — (broadcast_id, status)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE broadcast_recipients (
  id INTEGER PRIMARY KEY,
  broadcast_id TEXT NOT NULL,
  customer_id INTEGER,
  platform TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  resolved_team_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  error_reason TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT broadcast_recipients_broadcast_customer_unique UNIQUE (broadcast_id, customer_id)
)
```

</details>

### `broadcasts`

> Broadcasts table - 群發活動

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `title` | TEXT | NOT NULL | - |
| `content_type` | TEXT | NOT NULL | `'text'` |
| `content` | TEXT | NOT NULL | - |
| `tag_ids` | TEXT | NOT NULL | - |
| `match_mode` | TEXT | NOT NULL | `'any'` |
| `status` | TEXT | NOT NULL | `'draft'` |
| `total_recipients` | INTEGER | - | `0` |
| `sent_count` | INTEGER | - | `0` |
| `failed_count` | INTEGER | - | `0` |
| `skipped_count` | INTEGER | - | `0` |
| `created_by` | TEXT | NOT NULL | - |
| `sent_at` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `deleted_at` | TEXT | - | - |

**外鍵**:

- `created_by` → `agents.id` (ON DELETE RESTRICT)

**索引**:

- `idx_broadcasts_list` — (deleted_at, created_at)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE broadcasts (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  tag_ids TEXT NOT NULL,
  match_mode TEXT NOT NULL DEFAULT 'any',
  status TEXT NOT NULL DEFAULT 'draft',
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  sent_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (created_by) REFERENCES agents(id) ON UPDATE NO ACTION ON DELETE RESTRICT
)
```

</details>

### `channel_integrations`

> Channel Integrations table - 渠道集成配置（多租户支持） NOTE: Migration 0026 introduced JSON-based configuration for extensibility Legacy platform-specific columns are preserved for backward compatibility

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK, NOT NULL | - |
| `team_id` | INTEGER | NOT NULL | - |
| `platform` | TEXT | NOT NULL | - |
| `config` | TEXT | - | - |
| `credentials` | TEXT | - | - |
| `webhook_config` | TEXT | - | - |
| `stats` | TEXT | - | - |
| `is_active` | INTEGER | - | `true` |
| `is_verified` | INTEGER | - | `false` |
| `last_verified_at` | TEXT | - | - |
| `configured_by` | TEXT | - | - |
| `config_metadata` | TEXT | - | - |
| `last_error` | TEXT | - | - |
| `error_count` | INTEGER | - | `0` |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `configured_by` → `agents.id` (ON DELETE SET NULL)
- `team_id` → `teams.id` (ON DELETE CASCADE)

**索引**:

- `idx_channel_integrations_team_platform_active` — (team_id, platform, is_active)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `channel_integrations` (
	`id` integer PRIMARY KEY NOT NULL,
	`team_id` integer NOT NULL,
	`platform` text NOT NULL,
	`config` text,
	`credentials` text,
	`webhook_config` text,
	`stats` text,
	`is_active` integer DEFAULT true,
	`is_verified` integer DEFAULT false,
	`last_verified_at` text,
	`configured_by` text,
	`config_metadata` text,
	`last_error` text,
	`error_count` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`configured_by`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `conversation_read_states`

> Conversation read states - 每位客服各自的已讀/未讀狀態 (Migration 0060) One row per (agent, conversation) pair, created lazily the first time that agent reads or manually flags the conversation. Replaces the global conversations.last_read_at / .marked_unread_at columns so that one agent reading a conversation no longer clears every other agent's unread badge. The last-agent-reply half of the unread formula stays global by design.

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `agent_id` | TEXT | PK(1), NOT NULL | - |
| `conversation_id` | TEXT | PK(2), NOT NULL | - |
| `last_read_at` | TEXT | - | - |
| `marked_unread_at` | TEXT | - | - |
| `updated_at` | TEXT | NOT NULL | `CURRENT_TIMESTAMP` |

**複合主鍵**: (`agent_id`, `conversation_id`)

**外鍵**:

- `conversation_id` → `conversations.id` (ON DELETE CASCADE)
- `agent_id` → `agents.id` (ON DELETE CASCADE)

**索引**:

- `idx_conversation_read_states_conversation` — (conversation_id)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE conversation_read_states (
  agent_id         TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  last_read_at     TEXT,
  marked_unread_at TEXT,
  updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (agent_id, conversation_id)
)
```

</details>

### `conversation_sessions`

> Conversation sessions table - 對話會話管理

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `conversation_id` | TEXT | NOT NULL | - |
| `session_type` | TEXT | NOT NULL | `'continuous'` |
| `topic` | TEXT | - | - |
| `start_time` | TEXT | NOT NULL | - |
| `end_time` | TEXT | - | - |
| `last_activity` | TEXT | NOT NULL | - |
| `message_count` | INTEGER | - | `0` |
| `is_active` | INTEGER | - | `true` |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `conversation_id` → `conversations.id` (ON DELETE CASCADE)

**索引**:

- `idx_conversation_sessions_conversation_id` — (conversation_id)
- `idx_conversation_sessions_is_active` — (is_active)
- `idx_conversation_sessions_last_activity` — (last_activity)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `conversation_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`session_type` text DEFAULT 'continuous' NOT NULL,
	`topic` text,
	`start_time` text NOT NULL,
	`end_time` text,
	`last_activity` text NOT NULL,
	`message_count` integer DEFAULT 0,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
)
```

</details>

### `conversation_tags`

> Conversation tags junction table - 對話標籤關聯

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `conversation_id` | TEXT | PK(1), NOT NULL | - |
| `tag_id` | INTEGER | PK(2), NOT NULL | - |
| `assigned_by` | TEXT | NOT NULL | - |
| `assigned_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**複合主鍵**: (`conversation_id`, `tag_id`)

**外鍵**:

- `assigned_by` → `agents.id` (ON DELETE RESTRICT)
- `tag_id` → `tags.id` (ON DELETE CASCADE)
- `conversation_id` → `conversations.id` (ON DELETE CASCADE)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `conversation_tags` (
	`conversation_id` text NOT NULL,
	`tag_id` integer NOT NULL,
	`assigned_by` text NOT NULL,
	`assigned_at` text DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`conversation_id`, `tag_id`),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_by`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE restrict
)
```

</details>

### `conversation_transfers`

> Conversation transfers table - 對話轉移記錄 Note: fromUserId/toUserId removed - only team-based transfers are supported now

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK, NOT NULL | - |
| `conversation_id` | TEXT | NOT NULL | - |
| `from_team_id` | INTEGER | - | - |
| `to_team_id` | INTEGER | - | - |
| `transfer_reason` | TEXT | - | - |
| `transferred_by` | TEXT | NOT NULL | - |
| `transfer_type` | TEXT | - | `'manual'` |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `transferred_by` → `agents.id` (ON DELETE RESTRICT)
- `to_team_id` → `teams.id` (ON DELETE SET NULL)
- `from_team_id` → `teams.id` (ON DELETE SET NULL)
- `conversation_id` → `conversations.id` (ON DELETE CASCADE)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `conversation_transfers` (
	`id` integer PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`from_team_id` integer,
	`to_team_id` integer,
	`transfer_reason` text,
	`transferred_by` text NOT NULL,
	`transfer_type` text DEFAULT 'manual',
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transferred_by`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE restrict
)
```

</details>

### `conversations`

> Conversations table - 對話

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `customer_id` | INTEGER | NOT NULL | - |
| `assigned_team_id` | INTEGER | - | - |
| `status` | TEXT | NOT NULL | `'active'` |
| `priority` | TEXT | - | `'normal'` |
| `first_response_at` | TEXT | - | - |
| `closed_at` | TEXT | - | - |
| `last_message_at` | TEXT | - | - |
| `last_read_at` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `deleted_at` | TEXT | - | - |
| `marked_unread_at` | TEXT | - | - |

**外鍵**:

- `assigned_team_id` → `teams.id` (ON DELETE SET NULL)
- `customer_id` → `customers.id` (ON DELETE RESTRICT)

**索引**:

- `idx_conversations_customer_status` — (customer_id, status)
- `idx_conversations_deleted_at` *(partial)* — (deleted_at)
- `idx_conversations_last_message` — (last_message_at)
- `idx_conversations_updated_at` — (updated_at, id)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` integer NOT NULL,
	`assigned_team_id` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`priority` text DEFAULT 'normal',
	`first_response_at` text,
	`closed_at` text,
	`last_message_at` text,
	`last_read_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` text, marked_unread_at TEXT,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`assigned_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `cors_events`

> CORS Events table - CORS 事件記錄

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `type` | TEXT | NOT NULL | - |
| `origin` | TEXT | NOT NULL | - |
| `method` | TEXT | - | - |
| `path` | TEXT | - | - |
| `user_agent` | TEXT | - | - |
| `ip_address` | TEXT | - | - |
| `timestamp` | TEXT | NOT NULL | `datetime('now')` |
| `metadata` | TEXT | - | - |

**索引**:

- `idx_cors_events_allowed_origin` *(partial)* — (type, origin, timestamp DESC)
- `idx_cors_events_origin` — (origin)
- `idx_cors_events_rejected_origin` *(partial)* — (type, origin, timestamp DESC)
- `idx_cors_events_timestamp` — (timestamp DESC)
- `idx_cors_events_type` — (type)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `cors_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`origin` text NOT NULL,
	`method` text,
	`path` text,
	`user_agent` text,
	`ip_address` text,
	`timestamp` text DEFAULT (datetime('now')) NOT NULL,
	`metadata` text
)
```

</details>

### `customer_feedback`

> Customer Feedback table - 客户满意度反馈 (Migration 0032)

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `conversation_id` | TEXT | NOT NULL | - |
| `customer_id` | INTEGER | NOT NULL | - |
| `agent_id` | TEXT | - | - |
| `rating` | INTEGER | NOT NULL | - |
| `comment` | TEXT | - | - |
| `feedback_type` | TEXT | - | `'satisfaction'` |
| `metadata` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `agent_id` → `agents.id` (ON DELETE SET NULL)
- `customer_id` → `customers.id` (ON DELETE CASCADE)
- `conversation_id` → `conversations.id` (ON DELETE CASCADE)

**索引**:

- `idx_customer_feedback_agent` *(partial)* — (agent_id)
- `idx_customer_feedback_conversation` — (conversation_id)
- `idx_customer_feedback_created_at` — (created_at)
- `idx_customer_feedback_customer` — (customer_id)
- `idx_customer_feedback_rating` — (rating, created_at)
- `idx_customer_feedback_type` — (feedback_type, created_at)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `customer_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`customer_id` integer NOT NULL,
	`agent_id` text,
	`rating` integer NOT NULL,
	`comment` text,
	`feedback_type` text DEFAULT 'satisfaction',
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `customer_tags`

> Customer tags junction table - 客戶標籤關聯

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `customer_id` | INTEGER | PK(1), NOT NULL | - |
| `tag_id` | INTEGER | PK(2), NOT NULL | - |
| `assigned_by` | TEXT | NOT NULL | - |
| `assigned_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**複合主鍵**: (`customer_id`, `tag_id`)

**外鍵**:

- `assigned_by` → `agents.id` (ON DELETE RESTRICT)
- `tag_id` → `tags.id` (ON DELETE CASCADE)
- `customer_id` → `customers.id` (ON DELETE CASCADE)

**索引**:

- `idx_customer_tags_assigned_by` — (assigned_by)
- `idx_customer_tags_customer_id` — (customer_id)
- `idx_customer_tags_tag_assigned` — (tag_id, assigned_at DESC)
- `idx_customer_tags_tag_id` — (tag_id)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `customer_tags` (
	`customer_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`assigned_by` text NOT NULL,
	`assigned_at` text DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`customer_id`, `tag_id`),
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_by`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE restrict
)
```

</details>

### `customer_team_assignments`

> Customer Team Assignments table - 客戶團隊分配記錄 (Migration 0031) Tracks customer team assignments from LIFF QR Code scans (recorded BEFORE friend status)

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `platform_user_id` | TEXT | NOT NULL | - |
| `team_id` | INTEGER | NOT NULL | - |
| `qr_code_id` | TEXT | - | - |
| `source` | TEXT | - | `'liff_qr'` |
| `display_name` | TEXT | - | - |
| `assigned_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `metadata` | TEXT | - | - |

**外鍵**:

- `qr_code_id` → `team_liff_qr_codes.id` (ON DELETE SET NULL)
- `team_id` → `teams.id` (ON DELETE CASCADE)

**索引**:

- `customer_team_assignments_platform_user_id_team_id_unique` *(UNIQUE)* — (`platform_user_id`,`team_id`)
- `idx_customer_team_assignments_platform_user` — (platform_user_id)
- `idx_customer_team_assignments_qr_code` — (qr_code_id)
- `idx_customer_team_assignments_source` — (source)
- `idx_customer_team_assignments_team_date` — (team_id, assigned_at DESC)
- `idx_customer_team_assignments_team_id` — (team_id)
- `idx_customer_team_assignments_unique` *(UNIQUE)* — (platform_user_id, team_id)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `customer_team_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`platform_user_id` text NOT NULL,
	`team_id` integer NOT NULL,
	`qr_code_id` text,
	`source` text DEFAULT 'liff_qr',
	`display_name` text,
	`assigned_at` text DEFAULT CURRENT_TIMESTAMP,
	`metadata` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`qr_code_id`) REFERENCES `team_liff_qr_codes`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `customers`

> Customers table - 平台客戶資訊表 ENCRYPTION NOTE: Consider encrypting email, phone, metadata for PII protection

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK, NOT NULL | - |
| `platform` | TEXT | NOT NULL | - |
| `platform_user_id` | TEXT | NOT NULL | - |
| `display_name` | TEXT | - | - |
| `avatar_url` | TEXT | - | - |
| `email` | TEXT | - | - |
| `phone` | TEXT | - | - |
| `source_team_id` | INTEGER | - | - |
| `metadata` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `deleted_at` | TEXT | - | - |

**外鍵**:

- `source_team_id` → `teams.id` (ON DELETE SET NULL)

**索引**:

- `customers_platform_platform_user_id_unique` *(UNIQUE)* — (`platform`,`platform_user_id`)
- `idx_customers_deleted_at` *(partial)* — (deleted_at)
- `idx_customers_id` — (id)
- `idx_customers_platform` — (platform)
- `idx_customers_platform_id` — (platform, id)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`platform_user_id` text NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`email` text,
	`phone` text,
	`source_team_id` integer,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` text,
	FOREIGN KEY (`source_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `delayed_messages`

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `conversation_id` | TEXT | NOT NULL | - |
| `agent_id` | TEXT | NOT NULL | - |
| `content` | TEXT | NOT NULL | - |
| `message_type` | TEXT | NOT NULL | `'text'` |
| `scheduled_at` | TEXT | NOT NULL | - |
| `sent_at` | TEXT | - | - |
| `cancelled_at` | TEXT | - | - |
| `status` | TEXT | NOT NULL | `'pending'` |
| `metadata` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `agent_id` → `agents.id` (ON DELETE CASCADE)
- `conversation_id` → `conversations.id` (ON DELETE CASCADE)

**索引**:

- `idx_delayed_messages_agent` — (agent_id)
- `idx_delayed_messages_conversation` — (conversation_id)
- `idx_delayed_messages_scheduled_at` — (scheduled_at)
- `idx_delayed_messages_status` — (status)
- `idx_delayed_messages_status_scheduled` *(partial)* — (status, scheduled_at)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `delayed_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`content` text NOT NULL,
	`message_type` text DEFAULT 'text' NOT NULL,
	`scheduled_at` text NOT NULL,
	`sent_at` text,
	`cancelled_at` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
)
```

</details>

### `file_attachments`

> File attachments table - 檔案附件表 All columns now use consistent snake_case naming (Migration 0037 applied 2026-02-14)

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `message_id` | TEXT | - | - |
| `conversation_id` | TEXT | - | - |
| `filename` | TEXT | NOT NULL | - |
| `mime_type` | TEXT | NOT NULL | - |
| `file_size` | INTEGER | NOT NULL | - |
| `file_url` | TEXT | - | - |
| `r2_key` | TEXT | NOT NULL | - |
| `upload_status` | TEXT | - | `'completed'` |
| `uploaded_by` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | - |

**外鍵**:

- `conversation_id` → `conversations.id` (ON DELETE SET NULL)
- `message_id` → `messages.id` (ON DELETE SET NULL)

**索引**:

- `idx_file_attachments_conversation_id` — (conversation_id)
- `idx_file_attachments_created_at` — (created_at)
- `idx_file_attachments_message` — (message_id)
- `idx_file_attachments_upload_status` *(partial)* — (upload_status)
- `idx_file_attachments_uploaded_by` — (uploaded_by)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `file_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text,
	`conversation_id` text,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`file_url` text,
	`r2_key` text NOT NULL,
	`upload_status` text DEFAULT 'completed',
	`uploaded_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `message_recall_logs`

> Message recall logs table - 訊息撤回日誌

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK, NOT NULL | - |
| `message_id` | TEXT | NOT NULL | - |
| `user_id` | TEXT | NOT NULL | - |
| `action` | TEXT | NOT NULL | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `user_id` → `agents.id` (ON DELETE RESTRICT)
- `message_id` → `messages.id` (ON DELETE CASCADE)

**索引**:

- `idx_message_recall_logs_message_id` — (message_id)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `message_recall_logs` (
	`id` integer PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE restrict
)
```

</details>

### `messages`

> Messages table - 訊息 NOTE: replyToMessageId is a self-reference to messages.id Foreign key constraint is enforced at application layer (see message-crud.ts)

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `conversation_id` | TEXT | NOT NULL | - |
| `sender_type` | TEXT | NOT NULL | - |
| `customer_sender_id` | INTEGER | - | - |
| `agent_sender_id` | TEXT | - | - |
| `content` | TEXT | NOT NULL | - |
| `message_type` | TEXT | NOT NULL | `'text'` |
| `platform_message_id` | TEXT | - | - |
| `is_recalled` | INTEGER | - | `false` |
| `recall_deadline` | TEXT | - | - |
| `recalled_at` | TEXT | - | - |
| `is_sent` | INTEGER | - | `true` |
| `sent_at` | TEXT | - | - |
| `delivery_status` | TEXT | - | `'delivered'` |
| `reply_to_message_id` | TEXT | - | - |
| `thread_id` | TEXT | - | - |
| `session_id` | TEXT | - | - |
| `session_sequence` | INTEGER | - | `1` |
| `metadata` | TEXT | - | - |
| `sender_name` | TEXT | - | - |
| `read_by` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | - |
| `deleted_at` | TEXT | - | - |

**外鍵**:

- `agent_sender_id` → `agents.id` (ON DELETE SET NULL)
- `customer_sender_id` → `customers.id` (ON DELETE SET NULL)
- `conversation_id` → `conversations.id` (ON DELETE CASCADE)

**索引**:

- `idx_messages_agent_sender_created` *(partial)* — (agent_sender_id, created_at DESC)
- `idx_messages_conv_sender_deleted_created` — (conversation_id, sender_type, deleted_at, created_at)
- `idx_messages_customer_sender_created` *(partial)* — (customer_sender_id, created_at DESC)
- `idx_messages_deleted_at` *(partial)* — (deleted_at)
- `idx_messages_reply_to` *(partial)* — (reply_to_message_id)
- `idx_messages_thread_id_sequence` *(partial)* — (thread_id, session_sequence)
- `idx_messages_updated_at` *(partial)* — (updated_at DESC)
- `messages_platform_message_id_unique` *(UNIQUE)* *(partial)* — (platform_message_id)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_type` text NOT NULL,
	`customer_sender_id` integer,
	`agent_sender_id` text,
	`content` text NOT NULL,
	`message_type` text DEFAULT 'text' NOT NULL,
	`platform_message_id` text,
	`is_recalled` integer DEFAULT false,
	`recall_deadline` text,
	`recalled_at` text,
	`is_sent` integer DEFAULT true,
	`sent_at` text,
	`delivery_status` text DEFAULT 'delivered',
	`reply_to_message_id` text,
	`thread_id` text,
	`session_id` text,
	`session_sequence` integer DEFAULT 1,
	`metadata` text,
	`sender_name` text,
	`read_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text,
	`deleted_at` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_sender_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`agent_sender_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `metrics`

> Metrics table - 企業分析指標

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK, NOT NULL | - |
| `metric_name` | TEXT | NOT NULL | - |
| `metric_value` | REAL | NOT NULL | - |
| `timestamp` | INTEGER | NOT NULL | - |
| `tags` | TEXT | - | - |
| `unit` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**索引**:

- `idx_metrics_name` — (metric_name)
- `idx_metrics_name_timestamp` — (metric_name, timestamp)
- `idx_metrics_timestamp` — (timestamp)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `metrics` (
	`id` integer PRIMARY KEY NOT NULL,
	`metric_name` text NOT NULL,
	`metric_value` real NOT NULL,
	`timestamp` integer NOT NULL,
	`tags` text,
	`unit` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
)
```

</details>

### `notifications`

> Notifications table - 通知系統

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `user_id` | TEXT | NOT NULL | - |
| `type` | TEXT | NOT NULL | - |
| `title` | TEXT | NOT NULL | - |
| `content` | TEXT | NOT NULL | - |
| `data` | TEXT | - | - |
| `is_read` | INTEGER | - | `false` |
| `read_at` | TEXT | - | - |
| `expires_at` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `priority` | TEXT | - | `'normal'` |
| `updated_at` | TEXT | - | - |

**外鍵**:

- `user_id` → `agents.id` (ON DELETE CASCADE)

**索引**:

- `idx_notifications_user_priority` — (user_id, priority)
- `idx_notifications_user_unread` *(partial)* — (user_id, is_read)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`data` text,
	`is_read` integer DEFAULT false,
	`read_at` text,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP, priority TEXT DEFAULT 'normal', updated_at TEXT,
	FOREIGN KEY (`user_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
)
```

</details>

### `qr_code_scans`

> QR Code Scans table - 掃描記錄

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `qr_code_id` | TEXT | NOT NULL | - |
| `customer_id` | INTEGER | - | - |
| `platform` | TEXT | NOT NULL | - |
| `platform_user_id` | TEXT | - | - |
| `scan_metadata` | TEXT | - | - |
| `scanned_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `customer_id` → `customers.id` (ON DELETE SET NULL)
- `qr_code_id` → `qr_codes.id` (ON DELETE CASCADE)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `qr_code_scans` (
	`id` text PRIMARY KEY NOT NULL,
	`qr_code_id` text NOT NULL,
	`customer_id` integer,
	`platform` text NOT NULL,
	`platform_user_id` text,
	`scan_metadata` text,
	`scanned_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`qr_code_id`) REFERENCES `qr_codes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `qr_codes`

> QR Codes table - QR碼管理

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `team_id` | INTEGER | NOT NULL | - |
| `token` | TEXT | NOT NULL | - |
| `line_url` | TEXT | NOT NULL | - |
| `qr_code_image_url` | TEXT | NOT NULL | - |
| `campaign_name` | TEXT | - | - |
| `description` | TEXT | - | - |
| `usage_count` | INTEGER | - | `0` |
| `max_uses` | INTEGER | - | - |
| `is_active` | INTEGER | - | `true` |
| `expires_at` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `team_id` → `teams.id` (ON DELETE CASCADE)

**索引**:

- `qr_codes_token_unique` *(UNIQUE)* — (`token`)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `qr_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` integer NOT NULL,
	`token` text NOT NULL,
	`line_url` text NOT NULL,
	`qr_code_image_url` text NOT NULL,
	`campaign_name` text,
	`description` text,
	`usage_count` integer DEFAULT 0,
	`max_uses` integer,
	`is_active` integer DEFAULT true,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
)
```

</details>

### `report_download_history`

> Report download history table - 報告下載歷史表

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `report_id` | TEXT | NOT NULL | - |
| `downloaded_by` | TEXT | NOT NULL | - |
| `downloaded_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `ip_address` | TEXT | - | - |
| `user_agent` | TEXT | - | - |
| `download_method` | TEXT | - | - |
| `download_size` | INTEGER | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `downloaded_by` → `agents.id` (ON DELETE RESTRICT)
- `report_id` → `reports.id` (ON DELETE CASCADE)

**索引**:

- `idx_download_history_downloaded_at` — (downloaded_at DESC)
- `idx_download_history_report` — (report_id)
- `idx_download_history_user` — (downloaded_by)
- `idx_report_download_history_downloaded_by` — (downloaded_by)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `report_download_history` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`downloaded_by` text NOT NULL,
	`downloaded_at` text DEFAULT CURRENT_TIMESTAMP,
	`ip_address` text,
	`user_agent` text,
	`download_method` text,
	`download_size` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`downloaded_by`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE restrict
)
```

</details>

### `report_templates`

> Report templates table - 報告模板表

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `name` | TEXT | NOT NULL | - |
| `description` | TEXT | - | - |
| `report_type` | TEXT | NOT NULL | - |
| `template_config` | TEXT | NOT NULL | - |
| `preview_image_url` | TEXT | - | - |
| `category` | TEXT | - | - |
| `tags` | TEXT | - | - |
| `is_system_template` | INTEGER | - | `false` |
| `is_public` | INTEGER | - | `false` |
| `created_by` | TEXT | NOT NULL | - |
| `team_id` | INTEGER | - | - |
| `usage_count` | INTEGER | - | `0` |
| `last_used_at` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `deleted_at` | TEXT | - | - |

**外鍵**:

- `team_id` → `teams.id` (ON DELETE SET NULL)
- `created_by` → `agents.id` (ON DELETE RESTRICT)

**索引**:

- `idx_report_templates_created_by` — (created_by)
- `idx_templates_category` — (category)
- `idx_templates_created_by` — (created_by)
- `idx_templates_is_public` — (is_public)
- `idx_templates_report_type` — (report_type)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `report_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`report_type` text NOT NULL,
	`template_config` text NOT NULL,
	`preview_image_url` text,
	`category` text,
	`tags` text,
	`is_system_template` integer DEFAULT false,
	`is_public` integer DEFAULT false,
	`created_by` text NOT NULL,
	`team_id` integer,
	`usage_count` integer DEFAULT 0,
	`last_used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` text,
	FOREIGN KEY (`created_by`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `reports`

> Reports main table - 報告系統主表

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `title` | TEXT | NOT NULL | - |
| `description` | TEXT | - | - |
| `type` | TEXT | NOT NULL | - |
| `format` | TEXT | NOT NULL | - |
| `status` | TEXT | NOT NULL | `'pending'` |
| `created_by` | TEXT | NOT NULL | - |
| `team_id` | INTEGER | - | - |
| `time_range` | TEXT | - | - |
| `start_date` | TEXT | - | - |
| `end_date` | TEXT | - | - |
| `filters` | TEXT | - | - |
| `options` | TEXT | - | - |
| `generation_started_at` | TEXT | - | - |
| `completed_at` | TEXT | - | - |
| `failed_at` | TEXT | - | - |
| `error_message` | TEXT | - | - |
| `execution_time` | INTEGER | - | - |
| `download_url` | TEXT | - | - |
| `file_size` | INTEGER | - | - |
| `downloaded_count` | INTEGER | - | `0` |
| `last_downloaded_at` | TEXT | - | - |
| `expires_at` | TEXT | - | - |
| `deleted_at` | TEXT | - | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `team_id` → `teams.id` (ON DELETE SET NULL)
- `created_by` → `agents.id` (ON DELETE RESTRICT)

**索引**:

- `idx_reports_created_at` — (created_at DESC)
- `idx_reports_created_by` — (created_by)
- `idx_reports_expires_at` — (expires_at)
- `idx_reports_status` — (status)
- `idx_reports_team_id` — (team_id)
- `idx_reports_type` — (type)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`format` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_by` text NOT NULL,
	`team_id` integer,
	`time_range` text,
	`start_date` text,
	`end_date` text,
	`filters` text,
	`options` text,
	`generation_started_at` text,
	`completed_at` text,
	`failed_at` text,
	`error_message` text,
	`execution_time` integer,
	`download_url` text,
	`file_size` integer,
	`downloaded_count` integer DEFAULT 0,
	`last_downloaded_at` text,
	`expires_at` text,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`created_by`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `scheduled_report_executions`

> Scheduled report executions table - 排程執行歷史表

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `scheduled_report_id` | TEXT | NOT NULL | - |
| `execution_started_at` | TEXT | NOT NULL | - |
| `execution_completed_at` | TEXT | - | - |
| `execution_status` | TEXT | NOT NULL | - |
| `execution_duration` | INTEGER | - | - |
| `generated_report_id` | TEXT | - | - |
| `error_message` | TEXT | - | - |
| `retry_count` | INTEGER | - | `0` |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `generated_report_id` → `reports.id` (ON DELETE SET NULL)
- `scheduled_report_id` → `scheduled_reports.id` (ON DELETE CASCADE)

**索引**:

- `idx_sched_exec_scheduled_report` — (scheduled_report_id)
- `idx_sched_exec_started_at` — (execution_started_at DESC)
- `idx_sched_exec_status` — (execution_status)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `scheduled_report_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`scheduled_report_id` text NOT NULL,
	`execution_started_at` text NOT NULL,
	`execution_completed_at` text,
	`execution_status` text NOT NULL,
	`execution_duration` integer,
	`generated_report_id` text,
	`error_message` text,
	`retry_count` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`scheduled_report_id`) REFERENCES `scheduled_reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`generated_report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `scheduled_reports`

> Scheduled reports table - 排程報告表

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `name` | TEXT | NOT NULL | - |
| `description` | TEXT | - | - |
| `report_type` | TEXT | NOT NULL | - |
| `report_format` | TEXT | NOT NULL | `'excel'` |
| `report_params` | TEXT | NOT NULL | - |
| `schedule_type` | TEXT | NOT NULL | - |
| `schedule_config` | TEXT | NOT NULL | - |
| `timezone` | TEXT | - | `'UTC'` |
| `is_active` | INTEGER | - | `true` |
| `max_retries` | INTEGER | - | `3` |
| `retry_delay_minutes` | INTEGER | - | `30` |
| `created_by` | TEXT | NOT NULL | - |
| `team_id` | INTEGER | - | - |
| `notify_on_completion` | INTEGER | - | `true` |
| `notify_on_failure` | INTEGER | - | `true` |
| `notification_emails` | TEXT | - | - |
| `next_execution_at` | TEXT | - | - |
| `last_execution_at` | TEXT | - | - |
| `last_execution_status` | TEXT | - | - |
| `execution_count` | INTEGER | - | `0` |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `deleted_at` | TEXT | - | - |

**外鍵**:

- `team_id` → `teams.id` (ON DELETE SET NULL)
- `created_by` → `agents.id` (ON DELETE RESTRICT)

**索引**:

- `idx_scheduled_reports_created_by` — (created_by)
- `idx_scheduled_reports_is_active` — (is_active)
- `idx_scheduled_reports_next_execution` — (next_execution_at)
- `idx_scheduled_reports_team_id` — (team_id)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `scheduled_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`report_type` text NOT NULL,
	`report_format` text DEFAULT 'excel' NOT NULL,
	`report_params` text NOT NULL,
	`schedule_type` text NOT NULL,
	`schedule_config` text NOT NULL,
	`timezone` text DEFAULT 'UTC',
	`is_active` integer DEFAULT true,
	`max_retries` integer DEFAULT 3,
	`retry_delay_minutes` integer DEFAULT 30,
	`created_by` text NOT NULL,
	`team_id` integer,
	`notify_on_completion` integer DEFAULT true,
	`notify_on_failure` integer DEFAULT true,
	`notification_emails` text,
	`next_execution_at` text,
	`last_execution_at` text,
	`last_execution_status` text,
	`execution_count` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` text,
	FOREIGN KEY (`created_by`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `system_settings`

> System settings table - 系統設定表

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `key` | TEXT | PK, NOT NULL | - |
| `value` | TEXT | NOT NULL | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
)
```

</details>

### `tags`

> Tags table - 標籤系統 SEMANTIC CONTRACT: isActive=false → temporarily disabled (recoverable) deletedAt=set  → soft deleted (logically removed)

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK, NOT NULL | - |
| `name` | TEXT | NOT NULL | - |
| `color` | TEXT | NOT NULL | `'#3B82F6'` |
| `description` | TEXT | - | - |
| `team_id` | INTEGER | - | - |
| `is_active` | INTEGER | - | `true` |
| `created_by` | TEXT | NOT NULL | - |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `deleted_at` | TEXT | - | - |

**外鍵**:

- `created_by` → `agents.id` (ON DELETE RESTRICT)
- `team_id` → `teams.id` (ON DELETE SET NULL)

**索引**:

- `idx_tags_team_active` *(partial)* — (team_id, is_active)
- `tags_name_team_id_unique` *(UNIQUE)* — (`name`,`team_id`)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#3B82F6' NOT NULL,
	`description` text,
	`team_id` integer,
	`is_active` integer DEFAULT true,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE restrict
)
```

</details>

### `task_reminders`

> Task Reminders table - 任務提醒 (Migration 0029)

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `user_id` | TEXT | NOT NULL | - |
| `title` | TEXT | NOT NULL | - |
| `content` | TEXT | - | - |
| `remind_at` | TEXT | NOT NULL | - |
| `conversation_id` | TEXT | - | - |
| `repeat_type` | TEXT | - | `'none'` |
| `repeat_interval` | INTEGER | - | `0` |
| `is_completed` | INTEGER | - | `false` |
| `is_sent` | INTEGER | - | `false` |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `completed_at` | TEXT | - | - |
| `sent_at` | TEXT | - | - |

**外鍵**:

- `conversation_id` → `conversations.id` (ON DELETE SET NULL)
- `user_id` → `agents.id` (ON DELETE CASCADE)

**索引**:

- `idx_task_reminders_conversation` *(partial)* — (conversation_id)
- `idx_task_reminders_conversation_id` *(partial)* — (conversation_id)
- `idx_task_reminders_pending` *(partial)* — (remind_at)
- `idx_task_reminders_user_remind` *(partial)* — (user_id, remind_at)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `task_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`remind_at` text NOT NULL,
	`conversation_id` text,
	`repeat_type` text DEFAULT 'none',
	`repeat_interval` integer DEFAULT 0,
	`is_completed` integer DEFAULT false,
	`is_sent` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`completed_at` text,
	`sent_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE set null
)
```

</details>

### `team_liff_qr_codes`

> Team LIFF QR Codes table - 團隊 LIFF QR Code (Migration 0031 - pending) Stores persistent LIFF URLs and QR Code images for team member onboarding

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `team_id` | INTEGER | NOT NULL | - |
| `liff_url` | TEXT | NOT NULL | - |
| `qr_code_url` | TEXT | NOT NULL | - |
| `scan_count` | INTEGER | - | `0` |
| `is_active` | INTEGER | - | `true` |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |

**外鍵**:

- `team_id` → `teams.id` (ON DELETE CASCADE)

**索引**:

- `idx_team_liff_qr_codes_is_active` — (is_active)
- `idx_team_liff_qr_codes_team_id` — (team_id)
- `team_liff_qr_codes_team_id_unique` *(UNIQUE)* — (`team_id`)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `team_liff_qr_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` integer NOT NULL,
	`liff_url` text NOT NULL,
	`qr_code_url` text NOT NULL,
	`scan_count` integer DEFAULT 0,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
)
```

</details>

### `teams`

> Teams table - 團隊 SEMANTIC CONTRACT: isActive=false → temporarily disabled (recoverable) deletedAt=set  → soft deleted (logically removed)

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | INTEGER | PK, NOT NULL | - |
| `name` | TEXT | NOT NULL | - |
| `description` | TEXT | - | - |
| `qr_code` | TEXT | - | - |
| `is_active` | INTEGER | - | `true` |
| `created_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `updated_at` | TEXT | - | `CURRENT_TIMESTAMP` |
| `deleted_at` | TEXT | - | - |

**索引**:

- `idx_teams_deleted_at` *(partial)* — (deleted_at)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`qr_code` text,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` text
)
```

</details>

### `webhook_security_events`

> Webhook Security Events table - 安全事件記錄

| 欄位 | 型別 | 約束 | 預設值 |
|---|---|---|---|
| `id` | TEXT | PK, NOT NULL | - |
| `type` | TEXT | NOT NULL | - |
| `severity` | TEXT | NOT NULL | - |
| `platform` | TEXT | NOT NULL | - |
| `integration_id` | INTEGER | - | - |
| `source_ip` | TEXT | - | - |
| `details` | TEXT | - | - |
| `created_at` | TEXT | NOT NULL | `datetime('now')` |

**外鍵**:

- `integration_id` → `channel_integrations.id` (ON DELETE CASCADE)

**索引**:

- `idx_webhook_security_events_created_at` — (created_at)
- `idx_webhook_security_events_integration` — (integration_id)
- `idx_webhook_security_events_platform` — (platform)
- `idx_webhook_security_events_platform_severity` — (platform, severity, created_at DESC)
- `idx_webhook_security_events_severity` — (severity)
- `idx_webhook_security_events_type` — (type)

<details><summary>CREATE TABLE</summary>

```sql
CREATE TABLE `webhook_security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`platform` text NOT NULL,
	`integration_id` integer,
	`source_ip` text,
	`details` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`integration_id`) REFERENCES `channel_integrations`(`id`) ON UPDATE no action ON DELETE cascade
)
```

</details>

---

## 視圖 (Views)

### `v_active_scheduled_reports`

```sql
CREATE VIEW v_active_scheduled_reports AS SELECT sr.id, sr.name, sr.report_type, sr.schedule_type, sr.is_active, sr.next_execution_at, sr.last_execution_at, sr.last_execution_status, sr.execution_count, sr.created_by, a.display_name as creator_name FROM scheduled_reports sr LEFT JOIN agents a ON sr.created_by = a.id WHERE sr.deleted_at IS NULL AND sr.is_active = 1 ORDER BY sr.next_execution_at ASC
```

### `v_recent_reports`

```sql
CREATE VIEW v_recent_reports AS SELECT r.id, r.title, r.type, r.format, r.status, r.created_by, a.display_name as creator_name, r.created_at, r.completed_at, r.file_size, r.downloaded_count FROM reports r LEFT JOIN agents a ON r.created_by = a.id WHERE r.deleted_at IS NULL ORDER BY r.created_at DESC LIMIT 100
```

### `v_report_generation_stats`

```sql
CREATE VIEW v_report_generation_stats AS SELECT type as report_type, format as report_format, COUNT(*) as total_count, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count, ROUND(AVG(execution_time), 2) as avg_execution_time, ROUND(AVG(file_size) / 1024.0 / 1024.0, 2) as avg_file_size_mb FROM reports WHERE deleted_at IS NULL GROUP BY type, format
```

---

## 相關文件

- [`MIGRATION_CHANGELOG.md`](database/MIGRATION_CHANGELOG.md) — migration 逐版說明
- [`../adr/`](../adr/) — 架構決策紀錄（含取捨與被否決的方案）
- `src/db/schema.ts` — Drizzle ORM 的型別定義
- `migrations/` — 實際的 migration SQL
