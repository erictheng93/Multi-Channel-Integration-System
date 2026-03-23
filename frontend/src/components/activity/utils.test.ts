import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ActivityLog } from '@/api/activities'
import {
  groupActivitiesByDate,
  getActionIconStyle,
  formatActivityDetails,
  getActivityDescription,
  getRoleLabel,
  getRoleBadgeClasses,
} from './utils'

// Factory function for creating a default ActivityLog object
function makeActivity(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: 1,
    userId: 'user-1',
    userName: 'Test User',
    userRole: 'agent',
    action: 'user_login',
    resourceType: 'system',
    resourceId: undefined,
    details: undefined,
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: '2026-03-20T10:00:00.000Z',
    ...overrides,
  }
}

// ─── groupActivitiesByDate ────────────────────────────────────────────────────

describe('groupActivitiesByDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime('2026-03-20T10:00:00Z')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty array for empty input', () => {
    const result = groupActivitiesByDate([])
    expect(result).toEqual([])
  })

  it("groups today's activities under a single group labeled '\u4eca\u5929'", () => {
    const activities = [
      makeActivity({ createdAt: '2026-03-20T09:00:00.000Z' }),
      makeActivity({ id: 2, createdAt: '2026-03-20T08:00:00.000Z' }),
    ]
    const result = groupActivitiesByDate(activities)
    expect(result).toHaveLength(1)
    expect(result[0]!.label).toBe('\u4eca\u5929')
    expect(result[0]!.activities).toHaveLength(2)
  })

  it("groups yesterday's activities separately from today", () => {
    const activities = [
      makeActivity({ id: 1, createdAt: '2026-03-20T09:00:00.000Z' }),
      makeActivity({ id: 2, createdAt: '2026-03-19T09:00:00.000Z' }),
    ]
    const result = groupActivitiesByDate(activities)
    expect(result).toHaveLength(2)
    const labels = result.map(g => g.label)
    expect(labels).toContain('\u4eca\u5929')
    expect(labels).toContain('\u6628\u5929')
  })

  it('uses formatted date for older activities (not today/yesterday)', () => {
    const activities = [
      makeActivity({ id: 1, createdAt: '2026-03-18T09:00:00.000Z' }),
    ]
    const result = groupActivitiesByDate(activities)
    expect(result).toHaveLength(1)
    const first = result[0]!
    expect(first.label).not.toBe('\u4eca\u5929')
    expect(first.label).not.toBe('\u6628\u5929')
    // Should be a formatted date string (zh-TW locale or similar)
    expect(first.label.length).toBeGreaterThan(0)
  })
})

// ─── getActionIconStyle ───────────────────────────────────────────────────────

describe('getActionIconStyle', () => {
  it('returns blue style for user_login (bgClass contains blue)', () => {
    const style = getActionIconStyle('user_login')
    expect(style.bgClass).toContain('blue')
    expect(style.icon).toBeDefined()
  })

  it('returns green style for message_send', () => {
    const style = getActionIconStyle('message_send')
    expect(style.bgClass).toContain('green')
  })

  it('returns orange style for conversation_assign', () => {
    const style = getActionIconStyle('conversation_assign')
    expect(style.bgClass).toContain('orange')
  })

  it('returns bg containing F2E8FB for settings_update (purple)', () => {
    const style = getActionIconStyle('settings_update')
    expect(style.bgClass).toContain('F2E8FB')
  })

  it('returns bg containing E6F7FA for team_invite (teal)', () => {
    const style = getActionIconStyle('team_invite')
    expect(style.bgClass).toContain('E6F7FA')
  })

  it('returns a default style for unknown actions', () => {
    const style = getActionIconStyle('completely_unknown_action')
    expect(style).toBeDefined()
    expect(style.bgClass).toBeTruthy()
    expect(style.icon).toBeDefined()
  })
})

// ─── formatActivityDetails ────────────────────────────────────────────────────

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

// ─── getActivityDescription ───────────────────────────────────────────────────

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

// ─── getRoleLabel ─────────────────────────────────────────────────────────────

describe('getRoleLabel', () => {
  it("maps 'admin' to '\u7ba1\u7406\u54e1'", () => {
    expect(getRoleLabel('admin')).toBe('\u7ba1\u7406\u54e1')
  })

  it('returns the raw role string for unknown roles', () => {
    expect(getRoleLabel('unknown_role')).toBe('unknown_role')
  })
})

// ─── getRoleBadgeClasses ──────────────────────────────────────────────────────

describe('getRoleBadgeClasses', () => {
  it("returns classes containing 'blue' for admin", () => {
    const classes = getRoleBadgeClasses('admin')
    expect(classes).toContain('blue')
  })

  it("returns classes containing 'green' for agent", () => {
    const classes = getRoleBadgeClasses('agent')
    expect(classes).toContain('green')
  })
})
