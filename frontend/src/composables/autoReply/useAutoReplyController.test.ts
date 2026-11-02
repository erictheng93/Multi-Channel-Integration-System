import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref, reactive } from 'vue'

// Mock store
const mockFetchRules = vi.fn().mockResolvedValue(undefined)
const mockFetchSchedules = vi.fn().mockResolvedValue(undefined)
const mockFetchLogs = vi.fn().mockResolvedValue(undefined)
const mockFetchStats = vi.fn().mockResolvedValue(undefined)
const mockReset = vi.fn()
const mockStoreRules = ref<Array<{ id: number; name: string; triggerType: string; isActive: boolean; conditions: Array<{ value: string }>; actions: unknown[] }>>([])
const mockStoreSchedules = ref<Array<{ dayOfWeek: number; isActive: boolean; startTime: string; endTime: string }>>([])
const mockStoreLogs = ref<Array<{ id: number; reply_method: string }>>([])
const mockTodayReplyCount = ref(0)
const mockStatsSnapshot = ref<unknown>(null)

vi.mock('@/stores/autoReply', () => ({
  useAutoReplyStore: () => ({
    rules: mockStoreRules.value,
    schedules: mockStoreSchedules.value,
    logs: mockStoreLogs.value,
    todayReplyCount: mockTodayReplyCount.value,
    statsSnapshot: mockStatsSnapshot.value,
    fetchRules: mockFetchRules,
    fetchSchedules: mockFetchSchedules,
    fetchLogs: mockFetchLogs,
    fetchStats: mockFetchStats,
    $reset: mockReset,
  }),
}))

// Mock sub-composables
const mockCollapseRule = vi.fn()
const mockLoadFromSchedules = vi.fn()

vi.mock('./useRuleEditor', () => ({
  useRuleEditor: () => ({
    expandedRuleId: ref(null),
    isCreating: ref(false),
    saving: ref(false),
    formData: reactive({ name: '', triggerType: 'keyword', priority: 100, isActive: true, conditions: [], actions: [] }),
    collapseRule: mockCollapseRule,
    expandRule: vi.fn(),
    startCreate: vi.fn(),
    addCondition: vi.fn(),
    removeCondition: vi.fn(),
    addAction: vi.fn(),
    removeAction: vi.fn(),
    updateActionContent: vi.fn(),
    saveRule: vi.fn(),
    removeRule: vi.fn(),
    toggleRuleActive: vi.fn(),
  }),
}))

vi.mock('./useScheduleEditor', () => ({
  useScheduleEditor: () => ({
    saving: ref(false),
    timezone: ref('Asia/Taipei'),
    rows: reactive([]),
    loadFromSchedules: mockLoadFromSchedules,
    toggleDay: vi.fn(),
    updateTime: vi.fn(),
    save: vi.fn(),
    getDayLabel: vi.fn(),
    isWeekend: vi.fn(),
  }),
}))

import { useAutoReplyController } from './useAutoReplyController'

const sampleRules = [
  { id: 1, name: 'Welcome', triggerType: 'welcome', isActive: true, conditions: [{ value: 'hi' }], actions: [] },
  { id: 2, name: 'Keyword Match', triggerType: 'keyword', isActive: false, conditions: [{ value: 'help' }], actions: [] },
  { id: 3, name: 'FAQ Bot', triggerType: 'keyword', isActive: true, conditions: [{ value: 'faq' }], actions: [] },
]

describe('useAutoReplyController', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockStatsSnapshot.value = null
    mockStoreRules.value = []
    mockStoreSchedules.value = []
    mockStoreLogs.value = []
    mockTodayReplyCount.value = 0
  })

  // 1. Initial state
  it('has correct initial state', () => {
    const ctrl = useAutoReplyController()
    expect(ctrl.loading.value).toBe(true)
    expect(ctrl.activeTab.value).toBe('rules')
    expect(ctrl.searchQuery.value).toBe('')
    expect(ctrl.filterTriggerType.value).toBe('')
    expect(ctrl.filterRuleId.value).toBe('')
    expect(ctrl.filterPlatform.value).toBe('')
    expect(ctrl.logsPage.value).toBe(1)
  })

  // 2. initialize calls all 3 fetches + loadFromSchedules (todayTotal piggybacks on fetchLogs)
  it('initialize calls fetchRules, fetchSchedules, fetchLogs, and loadFromSchedules', async () => {
    const ctrl = useAutoReplyController()
    await ctrl.initialize()

    expect(mockFetchRules).toHaveBeenCalledWith({ scope: 'global' })
    expect(mockFetchSchedules).toHaveBeenCalledOnce()
    expect(mockFetchLogs).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 50 }))
    expect(mockLoadFromSchedules).toHaveBeenCalledOnce()
  })

  // 3. initialize sets loading false after completion
  it('initialize sets loading to false after completion', async () => {
    const ctrl = useAutoReplyController()
    expect(ctrl.loading.value).toBe(true)
    await ctrl.initialize()
    expect(ctrl.loading.value).toBe(false)
  })

  // 4. initialize handles errors gracefully
  it('initialize handles errors gracefully without throwing', async () => {
    mockFetchRules.mockRejectedValueOnce(new Error('Network error'))
    const ctrl = useAutoReplyController()

    // Should not throw
    await expect(ctrl.initialize()).resolves.toBeUndefined()
    expect(ctrl.loading.value).toBe(false)
  })

  // 5. cleanup calls store.$reset()
  it('cleanup calls store.$reset()', () => {
    const ctrl = useAutoReplyController()
    ctrl.cleanup()
    expect(mockReset).toHaveBeenCalledOnce()
  })

  // 6. switchTab sets activeTab and calls collapseRule
  it('switchTab sets activeTab and calls collapseRule', () => {
    const ctrl = useAutoReplyController()
    ctrl.switchTab('schedules')
    expect(ctrl.activeTab.value).toBe('schedules')
    expect(mockCollapseRule).toHaveBeenCalledOnce()
  })

  // 7. filteredRules - no filter returns all rules
  it('filteredRules returns all rules when no filters applied', () => {
    mockStoreRules.value = sampleRules
    const ctrl = useAutoReplyController()
    expect(ctrl.filteredRules.value).toEqual(sampleRules)
  })

  // 8. filteredRules - search by name
  it('filteredRules filters by name via searchQuery', () => {
    mockStoreRules.value = sampleRules
    const ctrl = useAutoReplyController()
    ctrl.searchQuery.value = 'welcome'
    expect(ctrl.filteredRules.value).toHaveLength(1)
    expect(ctrl.filteredRules.value[0]!.name).toBe('Welcome')
  })

  // 9. filteredRules - search by condition value
  it('filteredRules filters by condition value via searchQuery', () => {
    mockStoreRules.value = sampleRules
    const ctrl = useAutoReplyController()
    ctrl.searchQuery.value = 'help'
    expect(ctrl.filteredRules.value).toHaveLength(1)
    expect(ctrl.filteredRules.value[0]!.id).toBe(2)
  })

  // 10. filteredRules - filter by triggerType
  it('filteredRules filters by triggerType', () => {
    mockStoreRules.value = sampleRules
    const ctrl = useAutoReplyController()
    ctrl.filterTriggerType.value = 'keyword'
    expect(ctrl.filteredRules.value).toHaveLength(2)
    expect(ctrl.filteredRules.value.every(r => r.triggerType === 'keyword')).toBe(true)
  })

  // 11. filteredRules - combined search + filter
  it('filteredRules applies both searchQuery and triggerType filter', () => {
    mockStoreRules.value = sampleRules
    const ctrl = useAutoReplyController()
    ctrl.searchQuery.value = 'faq'
    ctrl.filterTriggerType.value = 'keyword'
    expect(ctrl.filteredRules.value).toHaveLength(1)
    expect(ctrl.filteredRules.value[0]!.name).toBe('FAQ Bot')
  })

  // 12. stats - activeRules count
  it('stats computes activeRules count correctly', () => {
    mockStoreRules.value = sampleRules
    const ctrl = useAutoReplyController()
    // 2 active rules: Welcome (id 1) and FAQ Bot (id 3)
    expect(ctrl.stats.value.activeRules).toBe(2)
  })

  // 13. stats - todayReplies = store.todayReplyCount (from backend with date filter)
  it('stats computes todayReplies from store.todayReplyCount', () => {
    mockTodayReplyCount.value = 7
    const ctrl = useAutoReplyController()
    expect(ctrl.stats.value.todayReplies).toBe(7)
  })

  // 14. stats - successRate comes from the server snapshot (ratio -> percent), not from log rows
  it('stats takes successRate and todayReplies from the server snapshot', () => {
    mockStatsSnapshot.value = {
      todaySuccess: 47,
      todayFailed: 1,
      yesterdaySameTimeSuccess: 38,
      successRate: 0.9792,
      businessHours: { hasSchedule: true, isOpen: true, timezone: 'Asia/Taipei', closesAt: '17:30', opensAt: null },
    }
    const ctrl = useAutoReplyController()
    expect(ctrl.stats.value.successRate).toBe(97.9)
    expect(ctrl.stats.value.todayReplies).toBe(47)
    expect(ctrl.stats.value.todayFailed).toBe(1)
    expect(ctrl.stats.value.yesterdaySameTime).toBe(38)
    expect(ctrl.stats.value.isBusinessHours).toBe(true)
  })

  // 15. loadLogsPage - calls fetchLogs with page and filters
  it('loadLogsPage calls fetchLogs with page, pageSize, and active filters', async () => {
    const ctrl = useAutoReplyController()

    // Wait for any pending microtasks from watch setup
    await vi.dynamicImportSettled()

    // Set filters - the watch will trigger loadLogsPage(1) asynchronously
    ctrl.filterRuleId.value = '5'
    ctrl.filterPlatform.value = 'line'

    // Flush the watch callbacks
    await vi.dynamicImportSettled()

    // Clear all previous calls
    mockFetchLogs.mockClear()

    await ctrl.loadLogsPage(3)

    expect(ctrl.logsPage.value).toBe(3)
    expect(mockFetchLogs).toHaveBeenCalledWith({
      page: 3,
      pageSize: 50,
      ruleId: 5,
      platform: 'line',
    })
  })

  // Bonus: no snapshot yet / no attempts -> successRate is null (not a made-up 0)
  it('stats returns successRate null when there is no data', () => {
    mockStatsSnapshot.value = null
    mockTodayReplyCount.value = 0
    const ctrl = useAutoReplyController()
    expect(ctrl.stats.value.successRate).toBeNull()
    expect(ctrl.stats.value.todayReplies).toBe(0)
  })
})
