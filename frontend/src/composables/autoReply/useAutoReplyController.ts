import { ref, computed, watch } from 'vue'
import { useAutoReplyStore } from '@/stores/autoReply'
import { useAuthStore } from '@/stores/auth'
import { usePreloadStore } from '@/stores/preload'
import { useRuleEditor } from './useRuleEditor'
import { useScheduleEditor } from './useScheduleEditor'

export type TabName = 'rules' | 'schedules' | 'logs'

export function useAutoReplyController() {
  const store = useAutoReplyStore()
  const authStore = useAuthStore()
  const preloadStore = usePreloadStore()
  const activeTab = ref<TabName>('rules')
  const loading = ref(true)
  const searchQuery = ref('')
  const filterTriggerType = ref<string>('')
  const filterRuleId = ref<string>('')
  const filterPlatform = ref<string>('')
  const logsPage = ref(1)

  // Sub-composables
  const ruleEditor = useRuleEditor()
  const scheduleEditor = useScheduleEditor()

  // Computed
  const filteredRules = computed(() => {
    let rules = store.rules
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      rules = rules.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.conditions.some(c => c.value.toLowerCase().includes(q))
      )
    }
    if (filterTriggerType.value) {
      rules = rules.filter(r => r.triggerType === filterTriggerType.value)
    }
    return rules
  })

  // Reactive clock tick — triggers business hours recomputation every 60s
  const clockTick = ref(Date.now())

  const stats = computed(() => {
    // Reference clockTick so Vue tracks it as a dependency
    void clockTick.value

    const activeRules = store.rules.filter(r => r.isActive).length
    const todayLogs = store.logs.length
    const successLogs = store.logs.filter(l => l.reply_method === 'reply_api').length
    const successRate = todayLogs > 0 ? Math.round((successLogs / todayLogs) * 100) : 0

    // Check if currently within business hours
    const now = new Date()
    const dayOfWeek = now.getDay()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const todaySchedule = store.schedules.find(s => s.dayOfWeek === dayOfWeek)
    const isBusinessHours = todaySchedule
      ? todaySchedule.isActive && currentTime >= todaySchedule.startTime && currentTime <= todaySchedule.endTime
      : false

    return {
      activeRules,
      todayReplies: todayLogs,
      isBusinessHours,
      successRate
    }
  })

  // Resolve a teamId for API calls: contextTeamId > first preloaded team
  function resolveTeamId(): number | undefined {
    // If auth store already has a context team, use it
    if (authStore.contextTeamId) {
      return authStore.contextTeamId
    }
    // For admin users without a context team, pick the first available team
    const teams = preloadStore.getTeams()
    const firstTeam = teams[0]
    if (firstTeam) {
      authStore.switchTeam(firstTeam.id)
      return firstTeam.id
    }
    return undefined
  }

  // Init
  async function initialize() {
    loading.value = true
    try {
      const teamId = resolveTeamId()
      await Promise.all([
        store.fetchRules({ scope: 'global' }),
        store.fetchSchedules({ teamId }),
        store.fetchLogs({ teamId, pageSize: 50 })
      ])
      scheduleEditor.loadFromSchedules(store.schedules)
      startPolling()
    } catch (err) {
      console.error('Failed to initialize auto-reply:', err)
    } finally {
      loading.value = false
    }
  }

  function cleanup() {
    stopPolling()
    store.$reset()
  }

  // --- Polling timers ---
  let statsPollingTimer: ReturnType<typeof setInterval> | null = null
  let logsPollingTimer: ReturnType<typeof setInterval> | null = null
  let clockTickTimer: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    stopPolling()

    // Stats polling: silently refresh rules + logs every 30s (always active)
    statsPollingTimer = setInterval(() => {
      const teamId = resolveTeamId()
      store.silentFetchRules({ scope: 'global' })
      store.silentFetchLogs({ teamId, pageSize: 50 })
    }, 30000)

    // Logs tab polling: refresh with filters every 15s when logs tab is active
    logsPollingTimer = setInterval(() => {
      if (activeTab.value === 'logs') {
        store.fetchLogs({
          teamId: resolveTeamId(),
          page: logsPage.value,
          pageSize: 50,
          ruleId: filterRuleId.value ? Number(filterRuleId.value) : undefined,
          platform: filterPlatform.value || undefined
        })
      }
    }, 15000)

    // Clock tick: update business hours status every 60s
    clockTickTimer = setInterval(() => {
      clockTick.value = Date.now()
    }, 60000)
  }

  function stopPolling() {
    if (statsPollingTimer) {
      clearInterval(statsPollingTimer)
      statsPollingTimer = null
    }
    if (logsPollingTimer) {
      clearInterval(logsPollingTimer)
      logsPollingTimer = null
    }
    if (clockTickTimer) {
      clearInterval(clockTickTimer)
      clockTickTimer = null
    }
  }

  // Tab switching
  function switchTab(tab: TabName) {
    activeTab.value = tab
    ruleEditor.collapseRule()
    // Refresh logs immediately when switching to logs tab
    if (tab === 'logs') {
      loadLogsPage(logsPage.value)
    }
  }

  // Log pagination
  async function loadLogsPage(page: number) {
    logsPage.value = page
    await store.fetchLogs({
      teamId: resolveTeamId(),
      page,
      pageSize: 50,
      ruleId: filterRuleId.value ? Number(filterRuleId.value) : undefined,
      platform: filterPlatform.value || undefined
    })
  }

  // Watch log filters
  watch([filterRuleId, filterPlatform], () => {
    loadLogsPage(1)
  })

  return {
    // State
    loading,
    activeTab,
    searchQuery,
    filterTriggerType,
    filterRuleId,
    filterPlatform,
    logsPage,

    // Computed
    filteredRules,
    stats,

    // Store refs
    store,

    // Sub-composables
    ruleEditor,
    scheduleEditor,

    // Actions
    initialize,
    cleanup,
    switchTab,
    loadLogsPage
  }
}
