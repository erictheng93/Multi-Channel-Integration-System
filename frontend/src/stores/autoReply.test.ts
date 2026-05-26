import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type {
  AutoReplyRule,
  AutoReplySchedule,
  AutoReplyLog,
  PaginatedRulesResponse,
  SchedulesResponse,
  PaginatedLogsResponse
} from '@/api/autoReply'

// ---------------------------------------------------------------------------
// Mock API
// ---------------------------------------------------------------------------

const mockGetRules = vi.fn()
const mockGetSchedules = vi.fn()
const mockGetLogs = vi.fn()

vi.mock('@/api/autoReply', () => ({
  getRules: (...args: unknown[]) => mockGetRules(...args),
  getSchedules: (...args: unknown[]) => mockGetSchedules(...args),
  getLogs: (...args: unknown[]) => mockGetLogs(...args),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRule(overrides: Partial<AutoReplyRule> = {}): AutoReplyRule {
  return {
    id: 1,
    teamId: 1,
    name: 'Welcome Rule',
    triggerType: 'welcome',
    priority: 10,
    isActive: true,
    allowPushFallback: false,
    createdBy: 'admin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    deletedAt: null,
    conditions: [],
    actions: [],
    ...overrides,
  }
}

function makeRulesResponse(
  rules: AutoReplyRule[],
  paginationOverrides = {}
): PaginatedRulesResponse {
  return {
    success: true,
    data: {
      items: rules,
      pagination: { page: 1, limit: 20, total: rules.length, ...paginationOverrides },
    },
    message: 'ok',
  }
}

function makeSchedule(overrides: Partial<AutoReplySchedule> = {}): AutoReplySchedule {
  return {
    id: 1,
    teamId: 1,
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '18:00',
    timezone: 'Asia/Taipei',
    isActive: true,
    ...overrides,
  }
}

function makeSchedulesResponse(schedules: AutoReplySchedule[]): SchedulesResponse {
  return {
    success: true,
    data: schedules,
    message: 'ok',
  }
}

function makeLog(overrides: Partial<AutoReplyLog> = {}): AutoReplyLog {
  return {
    id: 1,
    rule_id: 1,
    rule_name: 'Welcome Rule',
    conversation_id: 'conv-001',
    customer_id: 100,
    trigger_content: 'Hello',
    response_content: 'Welcome!',
    matched_condition: 'keyword:hello',
    platform: 'line',
    reply_method: 'reply_api',
    created_at: '2026-01-10T12:00:00Z',
    ...overrides,
  }
}

function makeLogsResponse(
  logs: AutoReplyLog[],
  paginationOverrides = {}
): PaginatedLogsResponse {
  return {
    success: true,
    data: {
      items: logs,
      pagination: { page: 1, limit: 20, total: logs.length, ...paginationOverrides },
      todayTotal: logs.length,
    },
    message: 'ok',
  }
}

// ===========================================================================
// Tests
// ===========================================================================

describe('useAutoReplyStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  // =========================================================================
  // Initial state
  // =========================================================================

  describe('initial state', () => {
    it('has correct default values for all state properties', async () => {
      const { useAutoReplyStore } = await import('./autoReply')
      const store = useAutoReplyStore()

      expect(store.rules).toEqual([])
      expect(store.schedules).toEqual([])
      expect(store.logs).toEqual([])
      expect(store.rulesPagination).toEqual({ page: 1, limit: 20, total: 0 })
      expect(store.logsPagination).toEqual({ page: 1, limit: 20, total: 0 })
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  // =========================================================================
  // fetchRules
  // =========================================================================

  describe('fetchRules - success', () => {
    it('populates rules and rulesPagination from API response', async () => {
      const { useAutoReplyStore } = await import('./autoReply')
      const rules = [makeRule({ id: 1 }), makeRule({ id: 2, name: 'Keyword Rule' })]
      const pagination = { page: 2, limit: 10, total: 25 }
      mockGetRules.mockResolvedValue(makeRulesResponse(rules, pagination))

      const store = useAutoReplyStore()
      await store.fetchRules()

      expect(store.rules).toEqual(rules)
      expect(store.rulesPagination).toEqual({ page: 2, limit: 10, total: 25 })
    })

    it('sets loading = true while the API call is in flight', async () => {
      const { useAutoReplyStore } = await import('./autoReply')
      let resolveApi!: (_v: unknown) => void
      mockGetRules.mockReturnValue(new Promise(r => { resolveApi = r }))

      const store = useAutoReplyStore()
      const pending = store.fetchRules()

      expect(store.loading).toBe(true)

      resolveApi(makeRulesResponse([]))
      await pending
    })

    it('passes params through to getRules', async () => {
      const { useAutoReplyStore } = await import('./autoReply')
      mockGetRules.mockResolvedValue(makeRulesResponse([]))

      const store = useAutoReplyStore()
      await store.fetchRules({ teamId: 5, page: 3, pageSize: 10 })

      expect(mockGetRules).toHaveBeenCalledWith({ teamId: 5, page: 3, pageSize: 10 })
    })
  })

  describe('fetchRules - error', () => {
    it('sets error message and re-throws when API fails with Error', async () => {
      const { useAutoReplyStore } = await import('./autoReply')
      mockGetRules.mockRejectedValue(new Error('Network timeout'))

      const store = useAutoReplyStore()
      await expect(store.fetchRules()).rejects.toThrow('Network timeout')

      expect(store.error).toBe('Network timeout')
    })

    it('uses fallback error message for non-Error rejections', async () => {
      const { useAutoReplyStore } = await import('./autoReply')
      mockGetRules.mockRejectedValue('string rejection')

      const store = useAutoReplyStore()
      await expect(store.fetchRules()).rejects.toBe('string rejection')

      expect(store.error).toBe('Failed to fetch auto-reply rules')
    })
  })

  // =========================================================================
  // fetchSchedules
  // =========================================================================

  describe('fetchSchedules - success', () => {
    it('populates schedules from API response', async () => {
      const { useAutoReplyStore } = await import('./autoReply')
      const schedules = [
        makeSchedule({ id: 1, dayOfWeek: 1 }),
        makeSchedule({ id: 2, dayOfWeek: 2 }),
      ]
      mockGetSchedules.mockResolvedValue(makeSchedulesResponse(schedules))

      const store = useAutoReplyStore()
      await store.fetchSchedules()

      expect(store.schedules).toEqual(schedules)
    })
  })

  describe('fetchSchedules - error', () => {
    it('sets error message and re-throws when API fails', async () => {
      const { useAutoReplyStore } = await import('./autoReply')
      mockGetSchedules.mockRejectedValue(new Error('Server error'))

      const store = useAutoReplyStore()
      await expect(store.fetchSchedules()).rejects.toThrow('Server error')

      expect(store.error).toBe('Server error')
    })
  })

  // =========================================================================
  // fetchLogs
  // =========================================================================

  describe('fetchLogs - success', () => {
    it('populates logs and logsPagination from API response', async () => {
      const { useAutoReplyStore } = await import('./autoReply')
      const logs = [makeLog({ id: 1 }), makeLog({ id: 2, rule_name: 'Fallback' })]
      const pagination = { page: 1, limit: 20, total: 50 }
      mockGetLogs.mockResolvedValue(makeLogsResponse(logs, pagination))

      const store = useAutoReplyStore()
      await store.fetchLogs()

      expect(store.logs).toEqual(logs)
      expect(store.logsPagination).toEqual({ page: 1, limit: 20, total: 50 })
    })

    it('passes params through to getLogs', async () => {
      const { useAutoReplyStore } = await import('./autoReply')
      mockGetLogs.mockResolvedValue(makeLogsResponse([]))

      const store = useAutoReplyStore()
      await store.fetchLogs({ teamId: 2, page: 4, ruleId: 10, platform: 'line' })

      expect(mockGetLogs).toHaveBeenCalledWith({
        teamId: 2,
        page: 4,
        ruleId: 10,
        platform: 'line',
      })
    })
  })

  describe('fetchLogs - error', () => {
    it('sets error message and re-throws when API fails', async () => {
      const { useAutoReplyStore } = await import('./autoReply')
      mockGetLogs.mockRejectedValue(new Error('DB connection lost'))

      const store = useAutoReplyStore()
      await expect(store.fetchLogs()).rejects.toThrow('DB connection lost')

      expect(store.error).toBe('DB connection lost')
    })
  })

  // =========================================================================
  // $reset
  // =========================================================================

  describe('$reset', () => {
    it('clears all state back to defaults after data has been loaded', async () => {
      const { useAutoReplyStore } = await import('./autoReply')
      mockGetRules.mockResolvedValue(
        makeRulesResponse([makeRule()], { page: 3, limit: 10, total: 100 })
      )
      mockGetSchedules.mockResolvedValue(makeSchedulesResponse([makeSchedule()]))
      mockGetLogs.mockResolvedValue(
        makeLogsResponse([makeLog()], { page: 2, limit: 15, total: 80 })
      )

      const store = useAutoReplyStore()
      await store.fetchRules()
      await store.fetchSchedules()
      await store.fetchLogs()

      expect(store.rules).toHaveLength(1)
      expect(store.schedules).toHaveLength(1)
      expect(store.logs).toHaveLength(1)

      store.$reset()

      expect(store.rules).toEqual([])
      expect(store.schedules).toEqual([])
      expect(store.logs).toEqual([])
      expect(store.rulesPagination).toEqual({ page: 1, limit: 20, total: 0 })
      expect(store.logsPagination).toEqual({ page: 1, limit: 20, total: 0 })
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  // =========================================================================
  // Loading reset on error
  // =========================================================================

  describe('loading reset on error', () => {
    it('sets loading = false even when fetchRules fails', async () => {
      const { useAutoReplyStore } = await import('./autoReply')
      mockGetRules.mockRejectedValue(new Error('fail'))

      const store = useAutoReplyStore()
      try { await store.fetchRules() } catch { /* expected */ }

      expect(store.loading).toBe(false)
    })

    it('sets loading = false even when fetchSchedules fails', async () => {
      const { useAutoReplyStore } = await import('./autoReply')
      mockGetSchedules.mockRejectedValue(new Error('fail'))

      const store = useAutoReplyStore()
      try { await store.fetchSchedules() } catch { /* expected */ }

      expect(store.loading).toBe(false)
    })

    it('sets loading = false even when fetchLogs fails', async () => {
      const { useAutoReplyStore } = await import('./autoReply')
      mockGetLogs.mockRejectedValue(new Error('fail'))

      const store = useAutoReplyStore()
      try { await store.fetchLogs() } catch { /* expected */ }

      expect(store.loading).toBe(false)
    })
  })
})
