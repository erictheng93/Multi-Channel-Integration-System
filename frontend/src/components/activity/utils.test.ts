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
  it('returns [] for null details', () => {
    const result = formatActivityDetails(null, 'user_login')
    expect(result).toEqual([])
  })

  it('returns [] for undefined details', () => {
    const result = formatActivityDetails(undefined, 'user_login')
    expect(result).toEqual([])
  })

  it('formats login details with IP Address key', () => {
    const details = { ipAddress: '192.168.1.1', userAgent: 'Chrome', userId: 'u1' }
    const result = formatActivityDetails(details, 'user_login')
    const keys = result.map(e => e.key)
    expect(keys).toContain('IP Address')
  })

  it('formats settings_update with old-value and new-value types', () => {
    const details = {
      field: 'teamName',
      oldValue: 'Old Name',
      newValue: 'New Name',
    }
    const result = formatActivityDetails(details, 'settings_update')
    const types = result.map(e => e.type)
    expect(types).toContain('old-value')
    expect(types).toContain('new-value')
  })

  it('falls back to generic key-value for unknown action structures', () => {
    const details = { someKey: 'someValue', anotherKey: 42 }
    const result = formatActivityDetails(details, 'unknown_action')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]!.type).toBe('default')
  })
})

// ─── getActivityDescription ───────────────────────────────────────────────────

describe('getActivityDescription', () => {
  it("returns Chinese text containing '\u767b\u5165\u7cfb\u7d71' for user_login", () => {
    const activity = makeActivity({ action: 'user_login' })
    const desc = getActivityDescription(activity)
    expect(desc).toContain('\u767b\u5165\u7cfb\u7d71')
  })

  it('includes resource info (resourceId) when available', () => {
    const activity = makeActivity({
      action: 'conversation_assign',
      resourceId: 'conv-123',
    })
    const desc = getActivityDescription(activity)
    expect(desc).toContain('conv-123')
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
