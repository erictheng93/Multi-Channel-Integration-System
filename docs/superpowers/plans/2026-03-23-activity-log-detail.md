# Activity Log Detail Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make activity log descriptions human-readable with entity names and structured change tracking.

**Architecture:** Frontend-first TDD approach. Rewrite `getActivityDescription()` and `formatActivityDetails()` in `utils.ts` with comprehensive action mapping, then update `ActivityDetailPanel.vue` for diff view rendering. Backend handlers are enriched to capture entity names + `changes[]` in details JSON. SQL migration backfills existing records.

**Tech Stack:** Vue 3 + TypeScript (frontend), Hono + Drizzle ORM on Cloudflare Workers (backend), D1 SQLite (database)

**Spec:** `docs/superpowers/specs/2026-03-23-activity-log-detail-design.md`

> **Note on line numbers:** Line numbers in this plan are approximate guides. The executing agent MUST read the actual file to find the correct insertion/replacement points. Search for the surrounding code context (variable names, function calls) rather than relying on exact line numbers.

> **Note on DB queries:** Use **Drizzle ORM** for all database queries in backend handlers. Do NOT use raw `c.env.DB.prepare()` SQL — follow the existing patterns in each file (e.g., `db.select().from(table).where(...)` or the file's existing query style).

---

## File Structure

### Frontend (modify)

| File | Responsibility |
|------|---------------|
| `frontend/src/components/activity/types.ts` | Add `'diff'` type and `oldValue` to `DetailEntry` |
| `frontend/src/components/activity/utils.ts` | Rewrite `getActivityDescription()`, `formatActivityDetails()`, expand `humanizeKey()` |
| `frontend/src/components/activity/utils.test.ts` | Comprehensive tests for all new logic |
| `frontend/src/components/activity/ActivityDetailPanel.vue` | Add diff row layout with arrow styling |
| `frontend/src/components/activity/ActivityTimelineItem.vue` | Fix detail button visibility to use formatted entries |

### Backend (modify)

| File | Responsibility |
|------|---------------|
| `src/modules/teams/handlers/members.ts` | Enrich 5 endpoints with `targetName` + `changes[]` |
| `src/modules/teams/handlers/agent-teams.ts` | Add `teamName`, `addedAgentName`, `targetName` to 5 endpoints |
| `src/modules/teams/handlers/team-members.ts` | Add `teamName` to batch MEMBER_ADD |
| `src/modules/customer/handlers/customer-tags.ts` | Add `tagName` + `customerName` to 3 endpoints |
| `src/modules/conversations/handlers/conversation-assignment.ts` | Add `teamName`/`fromTeamName`/`toTeamName` to 3 endpoints |

### Backend (create)

| File | Responsibility |
|------|---------------|
| `src/db/migrations/XXXX_backfill_activity_names.sql` | SQL backfill for existing records |

---

## Task 1: Update DetailEntry Type

**Files:**
- Modify: `frontend/src/components/activity/types.ts:19-23`

- [ ] **Step 1: Add `oldValue` and `'diff'` type to DetailEntry**

In `frontend/src/components/activity/types.ts`, replace lines 19-23:

```typescript
export interface DetailEntry {
  key: string
  value: string
  oldValue?: string
  type?: 'default' | 'old-value' | 'new-value' | 'diff'
}
```

- [ ] **Step 2: Run type check**

Run: `cd frontend && bunx vue-tsc --noEmit`
Expected: PASS (no consumers use `'diff'` yet, additive change)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/activity/types.ts
git commit -m "feat(activity): add diff type to DetailEntry interface"
```

---

## Task 2: Write Failing Tests for getActivityDescription

**Files:**
- Modify: `frontend/src/components/activity/utils.test.ts`

- [ ] **Step 1: Replace existing `getActivityDescription` tests with comprehensive suite**

Replace the `describe('getActivityDescription', ...)` block (lines 163-178) in `frontend/src/components/activity/utils.test.ts`:

```typescript
describe('getActivityDescription', () => {
  // Simple actions (no template placeholders)
  it('returns "登入系統" for user_login', () => {
    const activity = makeActivity({ action: 'user_login' })
    expect(getActivityDescription(activity)).toBe('登入系統')
  })

  it('returns "登出系統" for user_logout', () => {
    const activity = makeActivity({ action: 'user_logout' })
    expect(getActivityDescription(activity)).toBe('登出系統')
  })

  it('returns "關閉對話" for conversation_close', () => {
    const activity = makeActivity({ action: 'conversation_close' })
    expect(getActivityDescription(activity)).toBe('關閉對話')
  })

  it('returns "更新系統設定" for settings_update', () => {
    const activity = makeActivity({ action: 'settings_update' })
    expect(getActivityDescription(activity)).toBe('更新系統設定')
  })

  // Template actions — resolve names from details
  it('resolves targetName for user_update', () => {
    const activity = makeActivity({
      action: 'user_update',
      resourceId: 'agent-123',
      details: { targetName: 'Claire' },
    })
    expect(getActivityDescription(activity)).toBe('更新用戶 Claire')
  })

  it('resolves teamName for team_create', () => {
    const activity = makeActivity({
      action: 'team_create',
      resourceId: '12',
      details: { teamName: 'Support Team' },
    })
    expect(getActivityDescription(activity)).toBe('建立團隊 Support Team')
  })

  it('resolves addedAgentName + teamName for member_add', () => {
    const activity = makeActivity({
      action: 'member_add',
      resourceId: '5',
      details: { addedAgentName: 'Alice', teamName: 'Sales' },
    })
    expect(getActivityDescription(activity)).toBe('新增 Alice 至 Sales')
  })

  it('resolves removedAgentName + teamName for member_remove', () => {
    const activity = makeActivity({
      action: 'member_remove',
      resourceId: '5',
      details: { removedAgentName: 'Bob', teamName: 'Sales' },
    })
    expect(getActivityDescription(activity)).toBe('移除 Bob 從 Sales')
  })

  it('resolves teamName for conversation_assign', () => {
    const activity = makeActivity({
      action: 'conversation_assign',
      resourceId: 'conv-uuid-123',
      details: { teamName: 'Support' },
    })
    expect(getActivityDescription(activity)).toBe('指派對話至 Support')
  })

  it('resolves fromTeamName/toTeamName for conversation_transfer', () => {
    const activity = makeActivity({
      action: 'conversation_transfer',
      resourceId: 'conv-uuid-456',
      details: { fromTeamName: 'Team A', toTeamName: 'Team B' },
    })
    expect(getActivityDescription(activity)).toContain('Team A')
    expect(getActivityDescription(activity)).toContain('Team B')
  })

  it('resolves tagName for tag_assign', () => {
    const activity = makeActivity({
      action: 'tag_assign',
      resourceId: '29',
      details: { tagName: 'VIP' },
    })
    expect(getActivityDescription(activity)).toBe('指派標籤 VIP')
  })

  it('resolves invitedEmail + teamName for team_invite', () => {
    const activity = makeActivity({
      action: 'team_invite',
      resourceId: '5',
      details: { invitedEmail: 'new@co.com', teamName: 'Dev' },
    })
    expect(getActivityDescription(activity)).toBe('邀請 new@co.com 加入 Dev')
  })

  // Fallback behavior — name not in details
  it('falls back to truncated resourceId for user_update without targetName', () => {
    const activity = makeActivity({
      action: 'user_update',
      resourceId: 'agent-1772442197684-4qstqowd2',
      details: { updatedFields: ['displayName'] },
    })
    const desc = getActivityDescription(activity)
    expect(desc).toContain('更新用戶')
    expect(desc).toContain('#agent-17')
    // Should NOT contain the full long ID
    expect(desc.length).toBeLessThan(30)
  })

  it('omits resourceId for conversation_assign without teamName (action-aware fallback)', () => {
    const activity = makeActivity({
      action: 'conversation_assign',
      resourceId: '7b038396-4b50-45bd-9dc8-9e5fd352d987',
      details: { teamId: 5 },
    })
    const desc = getActivityDescription(activity)
    expect(desc).toBe('指派對話')
    // Should NOT include the conversationId
    expect(desc).not.toContain('7b038396')
  })

  it('omits resourceId for tag_assign without tagName (action-aware fallback)', () => {
    const activity = makeActivity({
      action: 'tag_assign',
      resourceId: '23',
      details: { tagIds: [1, 2] },
    })
    const desc = getActivityDescription(activity)
    expect(desc).toBe('指派標籤')
    // Should NOT include customerId
    expect(desc).not.toContain('23')
  })

  it('shows just action label when no resourceId and no names', () => {
    const activity = makeActivity({
      action: 'user_update',
      resourceId: undefined,
      details: {},
    })
    expect(getActivityDescription(activity)).toBe('更新用戶')
  })

  // Unknown action fallback
  it('returns raw action string for unknown actions', () => {
    const activity = makeActivity({ action: 'some_future_action' })
    expect(getActivityDescription(activity)).toBe('some_future_action')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && bunx vitest run src/components/activity/utils.test.ts`
Expected: Most new tests FAIL (current implementation doesn't resolve names from details)

---

## Task 3: Implement getActivityDescription

**Files:**
- Modify: `frontend/src/components/activity/utils.ts:267-292`

- [ ] **Step 1: Replace getActivityDescription and ACTION_DESCRIPTION_MAP**

Replace the `ACTION_DESCRIPTION_MAP` constant and `getActivityDescription` function (lines 267-292) in `frontend/src/components/activity/utils.ts`:

```typescript
// ─── getActivityDescription ───────────────────────────────────────────────────

// Actions where resourceId should NOT be shown as fallback
// (because it doesn't match what the template placeholder represents)
const OMIT_RESOURCE_ID_ACTIONS = new Set([
  'conversation_assign', 'conversation_transfer', 'conversation_close',
  'conversation_reopen', 'conversation_unassign', 'conversation_bulk_assign',
  'tag_assign', 'tag_unassign',
])

type DescriptionResolver = (details: Record<string, unknown>, resourceId?: string) => string

function d(label: string): string { return label }

function name(details: Record<string, unknown>, key: string): string | undefined {
  const v = details[key]
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function truncateId(resourceId: string): string {
  if (resourceId.length <= 8) return resourceId
  return resourceId.slice(0, 8)
}

const ACTION_TEMPLATES: Record<string, DescriptionResolver> = {
  // User
  user_login: () => d('登入系統'),
  user_logout: () => d('登出系統'),
  user_create: (det, rid) => `建立用戶${name(det, 'targetName') ? ' ' + name(det, 'targetName') : (rid ? ' #' + truncateId(rid) : '')}`,
  user_update: (det, rid) => `更新用戶${name(det, 'targetName') ? ' ' + name(det, 'targetName') : (rid ? ' #' + truncateId(rid) : '')}`,
  user_delete: (det, rid) => `刪除用戶${name(det, 'targetName') ? ' ' + name(det, 'targetName') : (rid ? ' #' + truncateId(rid) : '')}`,
  user_bulk_delete: (det) => `批量刪除 ${det['deletedCount'] ?? det['count'] ?? ''} 位用戶`,
  user_bulk_update: (det) => `批量更新 ${det['updatedCount'] ?? det['count'] ?? ''} 位用戶`,
  user_restore: (det, rid) => `恢復用戶${name(det, 'targetName') ? ' ' + name(det, 'targetName') : (rid ? ' #' + truncateId(rid) : '')}`,

  // Team
  team_create: (det, rid) => `建立團隊${name(det, 'teamName') ? ' ' + name(det, 'teamName') : (rid ? ' #' + truncateId(rid) : '')}`,
  team_update: (det, rid) => `更新團隊${name(det, 'teamName') ? ' ' + name(det, 'teamName') : (rid ? ' #' + truncateId(rid) : '')}`,
  team_delete: (det, rid) => `刪除團隊${name(det, 'teamName') ? ' ' + name(det, 'teamName') : (rid ? ' #' + truncateId(rid) : '')}`,
  team_invite: (det) => {
    const email = name(det, 'invitedEmail')
    const team = name(det, 'teamName')
    if (email && team) return `邀請 ${email} 加入 ${team}`
    if (email) return `邀請 ${email} 加入團隊`
    return '邀請加入團隊'
  },
  team_member_update: (det) => {
    const agent = name(det, 'updatedAgentName')
    const team = name(det, 'teamName')
    if (agent && team) return `更新 ${agent} 在 ${team} 的角色`
    if (agent) return `更新 ${agent} 的角色`
    return '更新成員角色'
  },
  team_member_remove: (det) => {
    const team = name(det, 'teamName')
    return team ? `移除成員從 ${team}` : '移除成員'
  },
  member_add: (det) => {
    const agent = name(det, 'addedAgentName')
    const team = name(det, 'teamName')
    if (agent && team) return `新增 ${agent} 至 ${team}`
    if (agent) return `新增 ${agent}`
    if (team) return `新增成員至 ${team}`
    return '新增成員'
  },
  member_remove: (det) => {
    const agent = name(det, 'removedAgentName')
    const team = name(det, 'teamName')
    if (agent && team) return `移除 ${agent} 從 ${team}`
    if (agent) return `移除 ${agent}`
    if (team) return `移除成員從 ${team}`
    return '移除成員'
  },

  // Conversation (team-based)
  conversation_assign: (det) => {
    const team = name(det, 'teamName')
    return team ? `指派對話至 ${team}` : '指派對話'
  },
  conversation_transfer: (det) => {
    const from = name(det, 'fromTeamName')
    const to = name(det, 'toTeamName')
    if (from && to) return `轉移對話 ${from} \u2192 ${to}`
    return '轉移對話'
  },
  conversation_close: () => d('關閉對話'),
  conversation_reopen: () => d('重新開啟對話'),
  conversation_unassign: () => d('取消指派對話'),
  conversation_bulk_assign: (det) => `批量指派 ${det['count'] ?? ''} 個對話`,

  // Message
  message_send: () => d('發送訊息'),
  message_recall: () => d('撤回訊息'),
  message_forward: () => d('轉發訊息'),
  message_received: () => d('收到訊息'),

  // Customer
  customer_create: (det) => {
    const n = name(det, 'customerName')
    return n ? `建立客戶 ${n}` : '建立客戶'
  },
  customer_update: (det) => {
    const n = name(det, 'customerName')
    return n ? `更新客戶 ${n}` : '更新客戶'
  },
  customer_delete: (det) => {
    const n = name(det, 'customerName')
    return n ? `刪除客戶 ${n}` : '刪除客戶'
  },
  customer_followed: (det) => {
    const n = name(det, 'customerName')
    return n ? `客戶追蹤 ${n}` : '客戶追蹤'
  },
  customer_unfollowed: (det) => {
    const n = name(det, 'customerName')
    return n ? `客戶取消追蹤 ${n}` : '客戶取消追蹤'
  },

  // Tag
  tag_create: (det, rid) => {
    const n = name(det, 'tagName')
    return n ? `建立標籤 ${n}` : (rid ? `建立標籤 #${truncateId(rid)}` : '建立標籤')
  },
  tag_update: (det, rid) => {
    const n = name(det, 'tagName')
    return n ? `更新標籤 ${n}` : (rid ? `更新標籤 #${truncateId(rid)}` : '更新標籤')
  },
  tag_delete: (det, rid) => {
    const n = name(det, 'tagName')
    return n ? `刪除標籤 ${n}` : (rid ? `刪除標籤 #${truncateId(rid)}` : '刪除標籤')
  },
  tag_assign: (det) => {
    const n = name(det, 'tagName')
    return n ? `指派標籤 ${n}` : '指派標籤'
  },
  tag_unassign: (det) => {
    const n = name(det, 'tagName')
    return n ? `移除標籤 ${n}` : '移除標籤'
  },
  tag_bulk_update: () => d('批量更新標籤'),

  // Other
  qr_code_generate: () => d('產生 QR Code'),
  delayed_message_schedule: () => d('排程延遲訊息'),
  delayed_message_cancel: () => d('取消延遲訊息'),
  file_upload: () => d('上傳檔案'),
  file_delete: () => d('刪除檔案'),
  settings_update: () => d('更新系統設定'),
  system_health_check: () => d('系統健康檢查'),
  system_backup: () => d('系統備份'),
  system_restore: () => d('系統還原'),
}

export function getActivityDescription(activity: ActivityLog): string {
  const details = (activity.details ?? {}) as Record<string, unknown>
  const resolver = ACTION_TEMPLATES[activity.action]

  if (resolver) {
    return resolver(details, activity.resourceId)
  }

  // Unknown action — show raw action string
  // Append resourceId only if action doesn't have omit rule
  if (activity.resourceId && !OMIT_RESOURCE_ID_ACTIONS.has(activity.action)) {
    return `${activity.action} #${truncateId(activity.resourceId)}`
  }
  return activity.action
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run src/components/activity/utils.test.ts`
Expected: ALL tests in `getActivityDescription` PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/activity/utils.ts frontend/src/components/activity/utils.test.ts
git commit -m "feat(activity): rewrite getActivityDescription with action-specific templates"
```

---

## Task 4: Write Failing Tests for formatActivityDetails

**Files:**
- Modify: `frontend/src/components/activity/utils.test.ts`

- [ ] **Step 1: Replace existing `formatActivityDetails` tests with comprehensive suite**

Replace the `describe('formatActivityDetails', ...)` block (lines 123-159) in `frontend/src/components/activity/utils.test.ts`:

```typescript
describe('formatActivityDetails', () => {
  // Null/undefined handling
  it('returns [] for null details', () => {
    expect(formatActivityDetails(null, 'user_login')).toEqual([])
  })

  it('returns [] for undefined details', () => {
    expect(formatActivityDetails(undefined, 'user_login')).toEqual([])
  })

  // MODE: Diff view (changes[] array)
  it('renders diff view when changes[] is present', () => {
    const details = {
      targetName: 'Claire',
      changes: [
        { field: 'displayName', old: 'Alice', new: 'Claire' },
        { field: 'email', old: 'a@x.com', new: 'c@x.com' },
      ],
    }
    const result = formatActivityDetails(details, 'user_update')
    // Should have 2 diff entries (targetName excluded)
    expect(result).toHaveLength(2)
    expect(result[0]!.type).toBe('diff')
    expect(result[0]!.oldValue).toBe('Alice')
    expect(result[0]!.value).toBe('Claire')
  })

  // MODE: Normalized diff (old settings_update format)
  it('normalizes old settings_update format into diff view', () => {
    const details = {
      field: 'maxTeamMembers',
      oldValue: '50',
      newValue: '100',
    }
    const result = formatActivityDetails(details, 'settings_update')
    expect(result).toHaveLength(1)
    expect(result[0]!.type).toBe('diff')
    expect(result[0]!.oldValue).toBe('50')
    expect(result[0]!.value).toBe('100')
  })

  // MODE: Field list (updatedFields[])
  it('renders field list when updatedFields[] is present', () => {
    const details = {
      targetName: 'Claire',
      updatedFields: ['displayName', 'email', 'role'],
    }
    const result = formatActivityDetails(details, 'user_update')
    expect(result).toHaveLength(1)
    expect(result[0]!.value).toContain('displayName')
    expect(result[0]!.value).toContain('email')
    expect(result[0]!.value).toContain('role')
  })

  // MODE: Key-Value (generic fallback)
  it('renders key-value for login details', () => {
    const details = { ipAddress: '192.168.1.1', userAgent: 'Chrome' }
    const result = formatActivityDetails(details, 'user_login')
    const keys = result.map(e => e.key)
    expect(keys).toContain('IP Address')
    expect(keys).toContain('User Agent')
    expect(result.every(e => e.type === 'default')).toBe(true)
  })

  it('renders generic key-value for unknown action structures', () => {
    const details = { someKey: 'someValue', anotherKey: 42 }
    const result = formatActivityDetails(details, 'unknown_action')
    expect(result.length).toBe(2)
    expect(result[0]!.type).toBe('default')
  })

  // Exclusion rules
  it('excludes name fields used in description (targetName, teamName, etc.)', () => {
    const details = {
      targetName: 'Claire',
      teamName: 'Support',
      addedAgentName: 'Alice',
      reason: 'manual',
    }
    const result = formatActivityDetails(details, 'member_add')
    const keys = result.map(e => e.key)
    expect(keys).not.toContain('Target Name')
    expect(keys).not.toContain('Team Name')
    expect(keys).not.toContain('Added Agent Name')
  })

  it('excludes raw ID fields (suffix Id)', () => {
    const details = {
      teamName: 'Support',
      addedAgentName: 'Alice',
      addedAgentId: 'agent-123',
      teamId: 5,
    }
    const result = formatActivityDetails(details, 'member_add')
    const keys = result.map(e => e.key)
    expect(keys).not.toContain('Added Agent Id')
    expect(keys).not.toContain('Team Id')
  })

  it('returns empty array when all fields are excluded', () => {
    const details = {
      targetName: 'Claire',
      addedAgentId: 'agent-123',
    }
    const result = formatActivityDetails(details, 'user_create')
    expect(result).toHaveLength(0)
  })

  // humanizeKey
  it('humanizes known field names to Chinese labels in diff view', () => {
    const details = {
      changes: [
        { field: 'displayName', old: 'A', new: 'B' },
      ],
    }
    const result = formatActivityDetails(details, 'user_update')
    expect(result[0]!.key).toBe('顯示名稱')
  })

  // Long value truncation
  it('truncates values longer than 120 characters', () => {
    const longValue = 'x'.repeat(150)
    const details = { description: longValue }
    const result = formatActivityDetails(details, 'team_update')
    expect(result[0]!.value.length).toBeLessThanOrEqual(123) // 120 + "..."
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && bunx vitest run src/components/activity/utils.test.ts`
Expected: Most new `formatActivityDetails` tests FAIL

---

## Task 5: Implement formatActivityDetails + humanizeKey

**Files:**
- Modify: `frontend/src/components/activity/utils.ts:189-263`

- [ ] **Step 1: Replace humanizeKey and formatActivityDetails**

Replace `humanizeKey` and `formatActivityDetails` (lines 189-263) in `frontend/src/components/activity/utils.ts`:

```typescript
// ─── humanizeKey ─────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  displayName: '顯示名稱',
  email: '電子郵件',
  role: '角色',
  isActive: '啟用狀態',
  teamName: '團隊名稱',
  invitedEmail: '邀請信箱',
  invitedRole: '邀請角色',
  addedAgentName: '新增成員',
  removedAgentName: '移除成員',
  tagName: '標籤名稱',
  customerName: '客戶名稱',
  assigneeName: '指派對象',
  fromTeamName: '原團隊',
  toTeamName: '新團隊',
  previousTeamName: '原團隊',
  primaryTeamId: '主要團隊',
  oldRole: '原角色',
  newRole: '新角色',
  ipAddress: 'IP Address',
  userAgent: 'User Agent',
  userId: 'User ID',
  field: 'Field',
  oldValue: 'Old Value',
  newValue: 'New Value',
  teamId: 'Team ID',
  conversationId: 'Conversation ID',
  agentId: 'Agent ID',
  reason: '原因',
  description: '描述',
  status: '狀態',
  password: '密碼',
}

function humanizeKey(key: string): string {
  if (FIELD_LABELS[key]) { return FIELD_LABELS[key] }
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim()
}

// ─── formatActivityDetails ────────────────────────────────────────────────────

// Fields shown in the description line — exclude from detail panel
const DESCRIPTION_FIELDS = new Set([
  'targetName', 'teamName', 'addedAgentName', 'removedAgentName',
  'tagName', 'assigneeName', 'fromTeamName', 'toTeamName',
  'previousTeamName', 'customerName', 'updatedAgentName', 'invitedEmail',
])

function isIdField(key: string): boolean {
  return key.endsWith('Id') || key.endsWith('Ids')
}

function truncateValue(value: string, maxLen = 120): string {
  if (value.length <= maxLen) return value
  return value.slice(0, maxLen) + '...'
}

interface ChangeEntry {
  field: string
  old?: string
  new?: string
}

export function formatActivityDetails(
  details: Record<string, unknown> | null | undefined,
  action: string,
): DetailEntry[] {
  if (details === null || details === undefined) { return [] }

  // MODE 1: Diff view — changes[] array
  if (Array.isArray(details['changes']) && details['changes'].length > 0) {
    return (details['changes'] as ChangeEntry[]).map(change => ({
      key: humanizeKey(change.field),
      value: truncateValue(String(change.new ?? '')),
      oldValue: change.old !== undefined ? truncateValue(String(change.old)) : undefined,
      type: 'diff' as const,
    }))
  }

  // MODE 2: Normalized diff — old settings_update format { field, oldValue, newValue }
  if (
    details['field'] !== undefined &&
    (details['oldValue'] !== undefined || details['newValue'] !== undefined)
  ) {
    const entries: DetailEntry[] = [{
      key: humanizeKey(String(details['field'])),
      value: truncateValue(String(details['newValue'] ?? '')),
      oldValue: details['oldValue'] !== undefined ? truncateValue(String(details['oldValue'])) : undefined,
      type: 'diff' as const,
    }]
    // Include remaining keys not part of the field/oldValue/newValue triple
    for (const [k, v] of Object.entries(details)) {
      if (['field', 'oldValue', 'newValue'].includes(k)) continue
      if (DESCRIPTION_FIELDS.has(k) || isIdField(k)) continue
      entries.push({ key: humanizeKey(k), value: truncateValue(String(v)), type: 'default' })
    }
    return entries
  }

  // MODE 3: Field list — updatedFields[] array
  if (Array.isArray(details['updatedFields']) && details['updatedFields'].length > 0) {
    return [{
      key: '變更欄位',
      value: (details['updatedFields'] as string[]).join(', '),
      type: 'default' as const,
    }]
  }

  // MODE 4: Key-Value fallback — filter out description fields and IDs
  const entries: DetailEntry[] = []
  for (const [k, v] of Object.entries(details)) {
    if (DESCRIPTION_FIELDS.has(k)) continue
    if (isIdField(k)) continue
    if (v === null || v === undefined) continue
    // Skip changes array (already handled) and updatedFields
    if (k === 'changes' || k === 'updatedFields') continue

    const stringValue = typeof v === 'object' ? JSON.stringify(v) : String(v)
    entries.push({
      key: humanizeKey(k),
      value: truncateValue(stringValue),
      type: 'default' as const,
    })
  }
  return entries
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run src/components/activity/utils.test.ts`
Expected: ALL tests PASS

- [ ] **Step 3: Run full type check**

Run: `cd frontend && bunx vue-tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/activity/utils.ts frontend/src/components/activity/utils.test.ts
git commit -m "feat(activity): rewrite formatActivityDetails with adaptive rendering modes"
```

---

## Task 6: Update ActivityDetailPanel for Diff View

**Files:**
- Modify: `frontend/src/components/activity/ActivityDetailPanel.vue:1-29` (template), `71-111` (styles)

- [ ] **Step 1: Update template to handle diff type**

Replace the template section (lines 1-29) in `ActivityDetailPanel.vue`:

```vue
<template>
  <Transition
    @enter="onEnter"
    @after-enter="onAfterEnter"
    @leave="onLeave"
  >
    <div
      v-if="show && entries.length > 0"
      class="detail-panel"
    >
      <div class="detail-panel__content">
        <div
          v-for="(entry, index) in entries"
          :key="index"
          class="detail-entry"
        >
          <span class="detail-key">{{ entry.key }}</span>
          <template v-if="entry.type === 'diff'">
            <span
              v-if="entry.oldValue"
              class="detail-value detail-value--old"
              :title="entry.oldValue"
            >{{ entry.oldValue }}</span>
            <span
              v-if="entry.oldValue"
              class="detail-arrow"
            >&rarr;</span>
            <span
              class="detail-value detail-value--new"
              :title="entry.value"
            >{{ entry.value }}</span>
          </template>
          <template v-else>
            <span
              class="detail-value"
              :class="{
                'detail-value--old': entry.type === 'old-value',
                'detail-value--new': entry.type === 'new-value',
              }"
              :title="entry.value"
            >{{ entry.value }}</span>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>
```

- [ ] **Step 2: Update styles to add diff arrow**

Replace the style section (lines 71-111) in `ActivityDetailPanel.vue`:

```css
.detail-panel__content {
  background: #F2F2F7;
  border-radius: 20px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.detail-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.detail-key {
  font-size: 12px;
  color: #8E8E93;
  width: 96px;
  flex-shrink: 0;
}

.detail-value {
  font-size: 12px;
  color: #1C1C1E;
  font-family: monospace;
  word-break: break-all;
}

.detail-value--old {
  color: #8E8E93;
}

.detail-value--new {
  color: #34C759;
  font-weight: 500;
}

.detail-arrow {
  font-size: 12px;
  color: #8E8E93;
  flex-shrink: 0;
  padding: 0 2px;
}
```

- [ ] **Step 3: Fix parent component button visibility**

In `frontend/src/components/activity/ActivityTimelineItem.vue`, the "查看詳情" button currently checks `activity.details && Object.keys(activity.details).length > 0`, but after our exclusion filtering, `formattedDetails` may be empty even when `activity.details` has keys. Change the button's `v-if` to use the formatted entries:

Replace:
```vue
      <button
        v-if="activity.details && Object.keys(activity.details).length > 0"
```

With:
```vue
      <button
        v-if="formattedDetails.length > 0"
```

This ensures the "查看詳情" button is hidden when all detail fields are excluded (name fields + ID fields).

- [ ] **Step 4: Run type check and lint**

Run: `cd frontend && bunx vue-tsc --noEmit && bunx eslint src/components/activity/ActivityDetailPanel.vue src/components/activity/ActivityTimelineItem.vue --fix`
Expected: PASS

- [ ] **Step 5: Run all activity tests**

Run: `cd frontend && bunx vitest run src/components/activity/`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/activity/ActivityDetailPanel.vue frontend/src/components/activity/ActivityTimelineItem.vue
git commit -m "feat(activity): add diff view rendering and fix detail button visibility"
```

---

## Task 7: Backend — Enrich members.ts Logging

**Files:**
- Modify: `src/modules/teams/handlers/members.ts`

For each endpoint, we need to add `targetName` and, where applicable, old values to the `details` object. The `member` object is already fetched from the database before logging in every case.

- [ ] **Step 1: Enrich POST / (user_create) — line 148**

Change the details object at line 148-151:

```typescript
      details: {
        targetName: member.displayName || member.email,
        memberEmail: member.email,
        memberRole: member.role
      }
```

- [ ] **Step 2: Enrich PUT /:memberId/status (user_update) — line 203**

Before the `logActivity` call (around line 195), fetch the member's name. The `member` variable (line 192) already has the updated data. We need the old status. Add a pre-fetch before the update call:

At line 191 (before `const member = await memberService.updateMemberStatus(...)`), add:

```typescript
    const existingMember = await memberService.getMember(memberId);
```

Then change the details object at line 203-207:

```typescript
      details: {
        targetName: existingMember?.displayName || existingMember?.email || memberId,
        changes: [{
          field: 'isActive',
          old: existingMember?.isActive ? 'active' : 'inactive',
          new: data.isActive ? 'active' : 'inactive',
        }],
        reason: data.reason
      }
```

- [ ] **Step 3: Enrich PUT /:memberId/role (user_update) — line 266**

Similar pattern — fetch existing before update. At line 254 (before `const member = await memberService.updateMemberRole(...)`), add:

```typescript
    const existingMember = await memberService.getMember(memberId);
```

Then change the details at line 266-270:

```typescript
      details: {
        targetName: existingMember?.displayName || existingMember?.email || memberId,
        changes: [{
          field: 'role',
          old: existingMember?.role || '',
          new: data.role,
        }],
        reason: data.reason
      }
```

- [ ] **Step 4: Enrich PUT /:memberId full update (user_update) — line 314**

At line 302 (before `const member = await memberService.updateMember(...)`), add:

```typescript
    const existingMember = await memberService.getMember(memberId);
```

Then change the details at line 314-316:

```typescript
      details: {
        targetName: existingMember?.displayName || existingMember?.email || memberId,
        changes: Object.keys(data).map(field => ({
          field,
          old: String((existingMember as Record<string, unknown>)?.[field] ?? ''),
          new: String((data as Record<string, unknown>)[field] ?? ''),
        })),
      }
```

- [ ] **Step 5: Enrich DELETE /:memberId (user_delete) — line 381**

The `member` variable is already fetched at line 360. Change the details at line 381-384:

```typescript
      details: {
        targetName: member.displayName || member.email,
        memberEmail: member.email,
        memberRole: member.role
      }
```

- [ ] **Step 6: Run type check**

Run: `bunx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/teams/handlers/members.ts
git commit -m "feat(activity): enrich members.ts with targetName and changes[]"
```

---

## Task 8: Backend — Enrich agent-teams.ts Logging

**Files:**
- Modify: `src/modules/teams/handlers/agent-teams.ts`

- [ ] **Step 1: Enrich POST /:agentId/join (MEMBER_ADD) — line 140**

The variables `agentName` (line 124) and `teamName` (line 115) are already fetched. Change details at line 143-147:

```typescript
      details: {
        addedAgentName: agentName,
        teamName,
        agentId,
        roleInTeam: membership.roleInTeam,
        isPrimary: membership.isPrimary
      }
```

- [ ] **Step 2: Enrich DELETE /:agentId/leave/:teamId (MEMBER_REMOVE) — line 351**

The variables `teamName` (line 321) and `agentName` (line 339) are already fetched. Change details at line 354-358:

```typescript
      details: {
        removedAgentName: agentName,
        teamName,
        agentId,
        affectedConversationCount: affectedConversationIds.length
      }
```

- [ ] **Step 3: Enrich PUT /:agentId/role/:teamId (USER_UPDATE)**

Need to fetch agent and team names. Use the same Drizzle ORM pattern already used elsewhere in this file (look at how `joinTeam` fetches names around lines 109-122). Before the `logActivity` call, add:

```typescript
    // Fetch names for activity log
    const agentForLog = await db.select({ displayName: agents.displayName }).from(agents).where(eq(agents.id, agentId)).limit(1);
    const teamForLog = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, Number(teamId))).limit(1);
    const agentDisplayName = agentForLog[0]?.displayName || agentId;
    const teamDisplayName = teamForLog[0]?.name || String(teamId);
```

Then change the details object:

```typescript
      details: {
        targetName: agentDisplayName,
        teamName: teamDisplayName,
        agentId,
        roleInTeam: updated.roleInTeam,
        isPrimary: updated.isPrimary
      }
```

- [ ] **Step 4: Enrich PUT /:agentId/primary/:teamId (USER_UPDATE)**

Same Drizzle ORM pattern. Add name lookups before the `logActivity` call:

```typescript
    // Fetch names for activity log
    const agentForLog = await db.select({ displayName: agents.displayName }).from(agents).where(eq(agents.id, agentId)).limit(1);
    const teamForLog = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, Number(teamId))).limit(1);
    const targetName = agentForLog[0]?.displayName || agentId;
    const primaryTeamName = teamForLog[0]?.name || String(teamId);
```

Then change the details object:

```typescript
      details: {
        targetName,
        teamName: primaryTeamName,
        primaryTeamId: teamId
      }
```

- [ ] **Step 5: Run type check**

Run: `bunx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/teams/handlers/agent-teams.ts
git commit -m "feat(activity): enrich agent-teams.ts with entity names"
```

---

## Task 9: Backend — Enrich Remaining Handlers

**Files:**
- Modify: `src/modules/teams/handlers/team-members.ts`
- Modify: `src/modules/customer/handlers/customer-tags.ts`
- Modify: `src/modules/conversations/handlers/conversation-assignment.ts`

- [ ] **Step 1: Enrich team-members.ts batch MEMBER_ADD — line 126**

The `teamInfo` object (line 108-112) already has the team name. Change details at line 129-134:

```typescript
      details: {
        teamName: teamInfo?.name || String(teamId),
        agentIds: result.added,
        skipped: result.skipped,
        roleInTeam,
        batchOperation: true
      }
```

- [ ] **Step 2: Enrich customer-tags.ts addTagsToCustomer**

Before the `logActivity` call, fetch customer name and tag names. Use Drizzle ORM following the file's existing query patterns. Look for where `validTags` is fetched (it contains tag objects with names) and reuse that data. Also fetch the customer's `display_name`.

Add customer name + tag name resolution before the logActivity call:

```typescript
        // Resolve names for activity log
        const customerForLog = await db.select({ displayName: customers.displayName }).from(customers).where(eq(customers.id, customerId)).limit(1);
        const custName = customerForLog[0]?.displayName || String(customerId);
        // validTags already fetched earlier — extract names
        const tagNames = validTags.map((t: { name: string }) => t.name).join(', ');
```

Change the details object:

```typescript
          details: {
            customerName: custName,
            tagName: tagNames,
            tagIds: newTagIds,
            operation: 'add'
          }
```

> **Note:** `tagName` is a comma-separated string when multiple tags are assigned. The frontend description will show "指派標籤 VIP, Important" etc.

- [ ] **Step 3: Enrich customer-tags.ts removeTagsFromCustomer**

Same pattern — fetch customer name and tag names using Drizzle ORM. Tag names need to be fetched since they aren't already available in scope:

```typescript
      // Resolve names for activity log
      const customerForLog = await db.select({ displayName: customers.displayName }).from(customers).where(eq(customers.id, customerId)).limit(1);
      const custName = customerForLog[0]?.displayName || String(customerId);
      const tagsForLog = await db.select({ name: tags.name }).from(tags).where(inArray(tags.id, tagIds));
      const tagNames = tagsForLog.map(t => t.name).join(', ');
```

Change the details object:

```typescript
        details: {
          customerName: custName,
          tagName: tagNames,
          tagIds,
          operation: 'remove'
        }
```

- [ ] **Step 4: Enrich customer-tags.ts setCustomerTags**

Same pattern:

```typescript
      // Resolve names for activity log
      const customerForLog = await db.select({ displayName: customers.displayName }).from(customers).where(eq(customers.id, customerId)).limit(1);
      const custName = customerForLog[0]?.displayName || String(customerId);
      const tagsForLog = await db.select({ name: tags.name }).from(tags).where(inArray(tags.id, tagIds));
      const tagNames = tagsForLog.map(t => t.name).join(', ');
```

Change the details object:

```typescript
        details: {
          customerName: custName,
          tagName: tagNames,
          tagIds,
          operation: 'set'
        }
```

- [ ] **Step 5: Enrich conversation-assignment.ts assign — line 125**

The `teamInfo` variable (fetched around line 88-94) already has the team name. Change details at line 128-131:

```typescript
      details: {
        teamName: assignedTeamName || String(teamId),
        teamId,
        reason
      }
```

(Note: `assignedTeamName` is the variable name used in the existing code at line 94.)

- [ ] **Step 6: Enrich conversation-assignment.ts transfer**

Team names are fetched further down in the handler for WebSocket broadcasting, but the `logActivity` call runs BEFORE those fetches. Add Drizzle ORM name lookups before the logActivity call. Follow the file's existing query patterns:

```typescript
      // Fetch team names for activity log
      const fromTeamForLog = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, Number(fromTeamId))).limit(1);
      const toTeamForLog = await db.select({ name: teams.name }).from(teams).where(eq(teams.id, Number(toTeamId))).limit(1);
      const fromTeamDisplayName = fromTeamForLog[0]?.name || String(fromTeamId);
      const toTeamDisplayName = toTeamForLog[0]?.name || String(toTeamId);
```

Then change the details object:

```typescript
      details: {
        fromTeamName: fromTeamDisplayName,
        toTeamName: toTeamDisplayName,
        fromTeamId,
        toTeamId,
        reason
      }
```

- [ ] **Step 7: Run type check**

Run: `bunx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/modules/teams/handlers/team-members.ts src/modules/customer/handlers/customer-tags.ts src/modules/conversations/handlers/conversation-assignment.ts
git commit -m "feat(activity): enrich remaining handlers with entity names"
```

---

## Task 10: SQL Backfill Migration

**Files:**
- Create: `src/db/migrations/XXXX_backfill_activity_names.sql` (via `bun run db:generate`)

- [ ] **Step 1: Create a custom SQL migration file**

Since this is a data migration (not a schema change), create it manually. First check the migration directory:

```bash
ls src/db/migrations/ | tail -5
```

Create a new SQL file with the next sequence number. The file should be placed in the Drizzle migrations directory. Create it as a custom SQL migration:

```sql
-- Backfill activity entity names from source tables
-- Uses SQLite JSON1 functions (json_set, json_extract) with UPDATE...FROM (SQLite 3.33.0+)

-- 1. Resolve user names (resourceType = 'user')
UPDATE activities
SET details = json_set(
  COALESCE(details, '{}'),
  '$.targetName', agents.display_name
)
FROM agents
WHERE activities.resource_type = 'user'
  AND activities.resource_id = agents.id
  AND json_extract(COALESCE(activities.details, '{}'), '$.targetName') IS NULL;

-- 2. Resolve team names (resourceType = 'team', no teamName in details)
UPDATE activities
SET details = json_set(
  COALESCE(details, '{}'),
  '$.teamName', teams.name
)
FROM teams
WHERE activities.resource_type = 'team'
  AND activities.resource_id = CAST(teams.id AS TEXT)
  AND json_extract(COALESCE(activities.details, '{}'), '$.teamName') IS NULL;

-- 3. Resolve tag names (resourceType = 'tag')
UPDATE activities
SET details = json_set(
  COALESCE(details, '{}'),
  '$.tagName', tags.name
)
FROM tags
WHERE activities.resource_type = 'tag'
  AND activities.resource_id = CAST(tags.id AS TEXT)
  AND json_extract(COALESCE(activities.details, '{}'), '$.tagName') IS NULL;

-- 4. Resolve customer names for tag_assign/tag_unassign
UPDATE activities
SET details = json_set(
  COALESCE(details, '{}'),
  '$.customerName', customers.display_name
)
FROM customers
WHERE activities.action IN ('tag_assign', 'tag_unassign')
  AND activities.resource_type = 'customer'
  AND activities.resource_id = CAST(customers.id AS TEXT)
  AND json_extract(COALESCE(activities.details, '{}'), '$.customerName') IS NULL;
```

- [ ] **Step 2: Run the migration**

Run: `bun run db:migrate`
Expected: Migration applies successfully. Check output for row counts.

- [ ] **Step 3: Verify migration results**

Use Drizzle Studio or a query to spot-check:

```bash
bun run db:studio
```

Verify: activities with `resource_type = 'user'` now have `targetName` in details JSON.

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/
git commit -m "feat(activity): backfill entity names in existing activity records"
```

---

## Task 11: Manual Verification

- [ ] **Step 1: Start dev servers**

```bash
bun run dev          # Backend (in one terminal)
cd frontend && bun run dev  # Frontend (in another terminal)
```

- [ ] **Step 2: Open activities page**

Navigate to `http://localhost:5173/activities`

- [ ] **Step 3: Verify description improvements**

Check that:
- `member_add` shows "新增 [Name] 至 [Team]" instead of "member_add #12"
- `user_update` shows "更新用戶 [Name]" instead of "更新用戶資料 #agent-xxx"
- `team_create` shows "建立團隊 [Name]" instead of "建立團隊 #12"
- `conversation_assign` shows "指派對話至 [Team]" or just "指派對話" (not UUID)
- `tag_assign` shows "指派標籤 [Name]" or just "指派標籤" (not customer ID)

- [ ] **Step 4: Verify detail panel**

Click "查看詳情" on various activities:
- New user_update records: should show diff view (field: old → new in green)
- Old user_update records: should show field list ("變更欄位: displayName, email, role")
- Login records: should show key-value (IP Address, User Agent)
- member_add: detail button should be hidden (only name fields + IDs in details)

- [ ] **Step 5: Run full test suite**

```bash
cd frontend && bun run test
```

Expected: ALL PASS
