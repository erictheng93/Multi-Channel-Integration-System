# Activity Log Detail Enhancement — Design Spec

**Date:** 2026-03-23
**Status:** Draft
**Author:** Claude (brainstormed with user)

## Problem

The activity log page (`/activities`) shows vague, hard-to-read descriptions:

- Raw action types displayed instead of Chinese labels (`member_add #12`, `tag_assign #29`)
- Resource IDs shown instead of entity names (`更新用戶資料 #agent-1772442197684-4qstqowd2`)
- Detail panel lacks change context (shows `Updated Fields: displayName,email,role` without old/new values)
- Full UUIDs displayed for conversation actions, unreadable

## Approach

**Approach A: Structured changes in existing details JSON column.**

- No schema migration, no new tables
- Backend enriches `details` with `targetName`, `changes[]` at log time
- SQL migration backfills entity names for existing records
- Frontend renders adaptively based on data richness

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Description style | Style B: "Action + target" (short) | Keep timeline scannable, detail panel does heavy lifting |
| Old records handling | Option B: Backfill via SQL migration | User requires consistent display across all records |
| Old records without old/new values | Adaptive detail density | Shows field list summary, feels intentional not broken |
| Backfill mechanism | Pure SQL migration (not temp API endpoint) | Atomic, no cleanup, no timeout risk, tracked in git |
| settings_update format | Normalize old format on frontend read | Both `{field,oldValue,newValue}` and `changes[]` supported |

---

## Section 1: Backend — Enriched Activity Logging

### Standardized Details Schema

Every `logActivity()` call should include entity names in `details`. For update actions, include a structured `changes[]` array.

**User actions** (`user_create`, `user_update`, `user_delete`):
```json
{
  "targetName": "Claire",
  "targetEmail": "claire@example.com",
  "changes": [
    { "field": "displayName", "old": "Alice", "new": "Claire" },
    { "field": "email", "old": "old@x.com", "new": "new@x.com" },
    { "field": "role", "old": "agent", "new": "admin" }
  ]
}
```

**Team actions via TeamActivityService** (already capture `teamName`, `addedAgentName`, etc. — no structural change):
```json
{
  "teamName": "Support Team",
  "addedAgentName": "Claire",
  "addedAgentId": "agent-xxx"
}
```

**Team actions via agent-teams.ts** (currently MISSING names — need enrichment):
```json
// Current (agent-teams.ts MEMBER_ADD):  { agentId, roleInTeam, isPrimary }
// Current (agent-teams.ts MEMBER_REMOVE): { agentId, teamName, affectedConversationCount }
// Proposed:
{
  "teamName": "Support Team",
  "addedAgentName": "Claire",
  "addedAgentId": "agent-xxx",
  "roleInTeam": "member",
  "isPrimary": true
}
```

**Tag actions** (need `tagName` and `customerName` added):
```json
{
  "tagName": "VIP",
  "conversationId": "...",
  "customerName": "Customer Name"
}
```

**Conversation actions** (team-based assignment — use team names, not agent names):
```json
// conversation_assign:
{
  "teamName": "Support Team",
  "reason": "manual"
}
// conversation_transfer:
{
  "fromTeamName": "Support Team A",
  "toTeamName": "Support Team B",
  "reason": "workload"
}
// conversation_unassign:
{
  "previousTeamName": "Support Team"
}
```

> **Note:** This system uses team-based conversation assignment, not individual agent assignment. Templates use `{teamName}` / `{fromTeamName}` / `{toTeamName}`.

### Files to Modify

| File | Change |
|------|--------|
| `src/modules/teams/handlers/members.ts` | `PUT /:memberId` — fetch old values before update, add `targetName` + `changes[]` to details |
| `src/modules/teams/handlers/members.ts` | `PUT /:memberId/status` — add `targetName`, old status value |
| `src/modules/teams/handlers/members.ts` | `PUT /:memberId/role` — add `targetName`, old role value |
| `src/modules/teams/handlers/members.ts` | `POST /` (user_create) — add `targetName` (created member's displayName) |
| `src/modules/teams/handlers/members.ts` | `DELETE /:memberId` (user_delete) — add `targetName` |
| `src/modules/teams/handlers/agent-teams.ts` | Add `targetName` for `user_update` calls (including `setPrimaryTeam`); add `teamName` + `addedAgentName` to MEMBER_ADD; add `removedAgentName` to MEMBER_REMOVE |
| `src/modules/teams/handlers/team-members.ts` | Add `teamName` to batch MEMBER_ADD logging |
| `src/modules/customer/handlers/customer-tags.ts` | Add `tagName` + `customerName` to `tag_assign`/`tag_unassign` |
| `src/modules/conversations/handlers/conversation-assignment.ts` | Add `teamName` to assign; add `fromTeamName`/`toTeamName` to transfer (team-based, not agent-based) |

**Principle:** Fetch the target entity's name BEFORE logging, so it is baked into the record permanently.

---

## Section 2: Backend — Backfill SQL Migration

A Drizzle SQL migration using D1's SQLite JSON functions to resolve entity names for all existing activity records.

### Migration Statements

```sql
-- 1. Resolve user names (resourceType = 'user')
UPDATE activities
SET details = json_set(
  COALESCE(details, '{}'),
  '$.targetName', agents.display_name
)
FROM agents
WHERE activities.resource_type = 'user'
  AND activities.resource_id = agents.id
  AND json_extract(COALESCE(details, '{}'), '$.targetName') IS NULL;

-- 2. Resolve team names (resourceType = 'team', no teamName in details)
UPDATE activities
SET details = json_set(
  COALESCE(details, '{}'),
  '$.teamName', teams.name
)
FROM teams
WHERE activities.resource_type = 'team'
  AND activities.resource_id = CAST(teams.id AS TEXT)
  AND json_extract(COALESCE(details, '{}'), '$.teamName') IS NULL;

-- 3. Resolve tag names (resourceType = 'tag')
UPDATE activities
SET details = json_set(
  COALESCE(details, '{}'),
  '$.tagName', tags.name
)
FROM tags
WHERE activities.resource_type = 'tag'
  AND activities.resource_id = CAST(tags.id AS TEXT)
  AND json_extract(COALESCE(details, '{}'), '$.tagName') IS NULL;

-- 4. Resolve customer names for tag_assign/tag_unassign
--    (these use resourceType='customer', resourceId=customerId)
UPDATE activities
SET details = json_set(
  COALESCE(details, '{}'),
  '$.customerName', customers.display_name
)
FROM customers
WHERE activities.action IN ('tag_assign', 'tag_unassign')
  AND activities.resource_type = 'customer'
  AND activities.resource_id = CAST(customers.id AS TEXT)
  AND json_extract(COALESCE(details, '{}'), '$.customerName') IS NULL;
```

### Edge Cases

| Case | Handling |
|------|----------|
| `details IS NULL` | `COALESCE(details, '{}')` creates empty object |
| Soft-deleted entity | JOIN includes deleted rows (no `WHERE deletedAt IS NULL` filter) |
| Hard-deleted entity | Unmatched rows stay unchanged; frontend falls back to truncated resourceId |
| `tag_assign`/`tag_unassign` tag names | Cannot resolve from SQL — details stores `tagIds[]` array, not a single ID. Customer name is resolved. Tag names only available in new records going forward. |
| `user_bulk_delete`/`user_bulk_update` | `resourceId` is comma-separated list of IDs — JOIN won't match. Frontend uses `{count}` template, no entity name needed. |

### Compatibility

- `UPDATE ... FROM` syntax requires SQLite 3.33.0+. D1 uses a recent SQLite version and supports this.
- `json_set()` and `json_extract()` are built-in SQLite JSON1 functions, supported by D1.

### Execution

- Run via `bun run db:migrate` as part of normal migration flow
- Atomic, transactional, tracked in Drizzle migration history
- No cleanup needed

---

## Section 3: Frontend — Description Generation

Rewrite `getActivityDescription()` to use action-specific templates that consume `details` for entity names.

### Action-to-Description Mapping

All known actions in `ACTIVITY_ACTIONS` are mapped below. Any unlisted action falls through to the raw action string as a fallback.

| Action | Description Template |
|--------|---------------------|
| **User** | |
| `user_login` | 登入系統 |
| `user_logout` | 登出系統 |
| `user_create` | 建立用戶 {targetName} |
| `user_update` | 更新用戶 {targetName} |
| `user_delete` | 刪除用戶 {targetName} |
| `user_bulk_delete` | 批量刪除 {count} 位用戶 |
| `user_bulk_update` | 批量更新 {count} 位用戶 |
| `user_restore` | 恢復用戶 {targetName} |
| **Team** | |
| `team_create` | 建立團隊 {teamName} |
| `team_update` | 更新團隊 {teamName} |
| `team_delete` | 刪除團隊 {teamName} |
| `team_invite` | 邀請 {invitedEmail} 加入 {teamName} |
| `team_member_update` | 更新 {updatedAgentName} 在 {teamName} 的角色 |
| `team_member_remove` | 移除成員從 {teamName} |
| `member_add` | 新增 {addedAgentName} 至 {teamName} |
| `member_remove` | 移除 {removedAgentName} 從 {teamName} |
| **Conversation** (team-based assignment) | |
| `conversation_assign` | 指派對話至 {teamName} |
| `conversation_transfer` | 轉移對話 {fromTeamName} → {toTeamName} |
| `conversation_close` | 關閉對話 (*) |
| `conversation_reopen` | 重新開啟對話 (*) |
| `conversation_unassign` | 取消指派對話 |
| `conversation_bulk_assign` | 批量指派 {count} 個對話 |
| **Message** | |
| `message_send` | 發送訊息 |
| `message_recall` | 撤回訊息 |
| `message_forward` | 轉發訊息 |
| `message_received` | 收到訊息 |
| **Customer** | |
| `customer_create` | 建立客戶 {customerName} |
| `customer_update` | 更新客戶 {customerName} |
| `customer_delete` | 刪除客戶 {customerName} |
| `customer_followed` | 客戶追蹤 {customerName} |
| `customer_unfollowed` | 客戶取消追蹤 {customerName} |
| **Tag** | |
| `tag_create` | 建立標籤 {tagName} |
| `tag_update` | 更新標籤 {tagName} |
| `tag_delete` | 刪除標籤 {tagName} |
| `tag_assign` | 指派標籤 {tagName} |
| `tag_unassign` | 移除標籤 {tagName} |
| `tag_bulk_update` | 批量更新標籤 |
| **Other** | |
| `qr_code_generate` | 產生 QR Code |
| `delayed_message_schedule` | 排程延遲訊息 |
| `delayed_message_cancel` | 取消延遲訊息 |
| `file_upload` | 上傳檔案 |
| `file_delete` | 刪除檔案 |
| `settings_update` | 更新系統設定 |
| `system_health_check` | 系統健康檢查 |
| `system_backup` | 系統備份 |
| `system_restore` | 系統還原 |

> (*) `conversation_close` and `conversation_reopen` are not currently logged by any backend handler. Templates exist for future use — they will display correctly once logging is added to the relevant handler.

### Template Resolution Logic

1. Look up action-specific template
2. Extract names from `activity.details` to fill `{placeholders}`
3. If name not found in details → **action-aware fallback:**
   - For `user_*` actions: show truncated `resourceId` (e.g., `更新用戶 #7b038396`)
   - For `team_*`, `member_*` actions: show truncated `resourceId` only if it's a team ID
   - For `conversation_*` actions: **omit resourceId** — it's the conversationId, not a team name. Show just the action label (e.g., `指派對話`)
   - For `tag_assign`/`tag_unassign`: **omit resourceId** — it's a customerId, not a tag name. Show just the action label (e.g., `指派標籤`)
   - For other `tag_*` actions: show truncated `resourceId`
   - General rule: only append `#resourceId` when it semantically matches the template placeholder
4. If no template for action → use raw action string

### File Changed

`frontend/src/components/activity/utils.ts` — rewrite `getActivityDescription()`

---

## Section 4: Frontend — Adaptive Detail Panel

Rewrite `formatActivityDetails()` to render differently based on data richness. Same component, same interaction pattern — content adapts.

### Rendering Modes

Auto-detected from details shape:

| Mode | Trigger | Rendering |
|------|---------|-----------|
| **Diff View** | `details.changes[]` exists | Per-field: `fieldName  oldValue → newValue` |
| **Normalized Diff** | `details.field` + `details.oldValue` + `details.newValue` (old settings_update format) | Convert to single-item diff view |
| **Field List** | `details.updatedFields[]` exists | Single row: `變更欄位  field1, field2, field3` |
| **Key-Value** | None of the above | Generic key-value pairs (current behavior) |

### DetailEntry Type Update

The existing `DetailEntry` interface needs a new `'diff'` type to represent old→new rows:

```typescript
interface DetailEntry {
  key: string
  value: string
  oldValue?: string   // NEW: for diff view rows
  type: 'default' | 'old-value' | 'new-value' | 'diff'  // NEW: 'diff' type
}
```

When `type === 'diff'`: render `key | oldValue → value` in a single row.

### Diff View Layout

```
  fieldName    oldValue  →  newValue
  ─────────    ────────     ────────
  #8E8E93      #8E8E93      #34C759 bold
  80px         flex          flex
```

- Old value: muted gray `#8E8E93`
- Arrow `→`: muted gray
- New value: green `#34C759`, font-weight 500

### Field Name Humanization (Chinese Labels)

| Raw Field | Display Label |
|-----------|--------------|
| `displayName` | 顯示名稱 |
| `email` | 電子郵件 |
| `role` | 角色 |
| `isActive` | 啟用狀態 |
| `teamName` | 團隊名稱 |
| `invitedEmail` | 邀請信箱 |
| `invitedRole` | 邀請角色 |
| `addedAgentName` | 新增成員 |
| `removedAgentName` | 移除成員 |
| `tagName` | 標籤名稱 |
| `customerName` | 客戶名稱 |
| `assigneeName` | 指派對象 |
| `fromTeamName` | 原團隊 |
| `toTeamName` | 新團隊 |
| `previousTeamName` | 原團隊 |
| `primaryTeamId` | 主要團隊 |
| `oldRole` / `newRole` | 原角色 / 新角色 |
| (fallback) | camelCase → Title Case |

### Detail Panel Exclusion Rules

Fields already used in the description line are excluded from the detail panel to avoid redundancy:

**Excluded fields:** `targetName`, `teamName`, `addedAgentName`, `removedAgentName`, `tagName`, `assigneeName`, `fromTeamName`, `toTeamName`, `previousTeamName`, `customerName`, `updatedAgentName`, `invitedEmail`

Additionally, raw ID fields (suffix `Id`) are excluded unless no other fields remain.

If no displayable fields remain after exclusion → hide "查看詳情" button entirely.

### Long Value Handling

Values exceeding 120 characters are truncated with `...`. Full value available via `title` attribute on hover.

### Files Changed

- `frontend/src/components/activity/utils.ts` — rewrite `formatActivityDetails()`, expand `humanizeKey()`
- `frontend/src/components/activity/ActivityDetailPanel.vue` — add diff row layout with arrow styling

---

## Section 5: Edge Cases

### Empty Detail Panel After Exclusions

When all detail fields are either name fields (used in description) or raw IDs, the detail panel is hidden entirely. No "查看詳情" button shown.

**Filter logic:**
1. Remove excluded name fields
2. Remove fields ending in `Id` (raw identifiers)
3. If nothing left → hide panel

### settings_update Normalization

Old format `{field, oldValue, newValue}` is normalized to single-item diff view on the frontend read path. No backend migration needed — frontend handles both formats.

### Deleted Entities in Descriptions

Fallback chain when name is unavailable:
1. `details.targetName` exists → use it
2. `resourceId` exists → truncate and show (e.g., `更新用戶 #7b038396`)
3. Neither → just the action label (e.g., `更新用戶`)

No "(已刪除)" suffix — keep descriptions clean.

### Long Values in Diff View

Truncate display at 120 characters with `...`. Full value on hover via `title` attribute.

---

## Testing Strategy

### Frontend Unit Tests (Vitest)

**`utils.test.ts`:**
- `getActivityDescription()`: all mapped actions produce Chinese labels; templates resolve names from details; action-aware fallback (omit resourceId for conversation/tag_assign actions); fallback to raw action for unknown types
- `formatActivityDetails()`: diff view mode; field list mode; normalized old settings_update format; key-value fallback; excludes name fields; excludes raw ID fields; returns empty when nothing useful remains
- `humanizeKey()`: Chinese labels for all known field names; camelCase fallback

### Backend

- Migration tested via `bun run db:migrate`
- Existing handler tests updated for new details shape (added `targetName`, `changes[]`)

---

## Files Summary

### Backend (modify)

| File | Change |
|------|--------|
| `src/modules/teams/handlers/members.ts` | Add targetName + changes[] to user_update; add targetName to user_create and user_delete |
| `src/modules/teams/handlers/agent-teams.ts` | Add targetName for user_update (including setPrimaryTeam); add teamName + addedAgentName to MEMBER_ADD; add removedAgentName to MEMBER_REMOVE |
| `src/modules/teams/handlers/team-members.ts` | Add teamName to batch MEMBER_ADD logging |
| `src/modules/customer/handlers/customer-tags.ts` | Add tagName + customerName to tag_assign/tag_unassign |
| `src/modules/conversations/handlers/conversation-assignment.ts` | Add teamName to assign; add fromTeamName/toTeamName to transfer |
| New migration file | SQL backfill for existing records (4 UPDATE statements) |

### Frontend (modify)

| File | Change |
|------|--------|
| `frontend/src/components/activity/utils.ts` | Rewrite getActivityDescription(), formatActivityDetails(), expand humanizeKey() |
| `frontend/src/components/activity/ActivityDetailPanel.vue` | Add diff row layout with arrow styling |
