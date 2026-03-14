import { ref, computed, watch } from 'vue'
import { useAutoReplyStore } from '@/stores/autoReply'
import { useRuleEditor } from './useRuleEditor'
import { useScheduleEditor } from './useScheduleEditor'

export type TabName = 'rules' | 'schedules' | 'logs'

export function useAutoReplyController() {
  const store = useAutoReplyStore()
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

  const stats = computed(() => {
    const activeRules = store.rules.filter(r => r.isActive).length
    const todayLogs = store.logs.length
    const successLogs = store.logs.filter(l => l.reply_method === 'reply_api').length
    const successRate = todayLogs > 0 ? Math.round((successLogs / todayLogs) * 100) : 0

    // Check if currently within business hours
    const now = new Date()
    const dayOfWeek = now.getDay()
    const currentTime =`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
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

  // Init
  async function initialize() {
    loading.value = true
    try {
      await Promise.all([
        store.fetchRules(),
        store.fetchSchedules(),
        store.fetchLogs({ pageSize: 50 })
      ])
      scheduleEditor.loadFromSchedules(store.schedules)
    } catch (err) {
      console.error('Failed to initialize auto-reply:', err)
    } finally {
      loading.value = false
    }
  }

  function cleanup() {
    store.$reset()
  }

  // Tab switching
  function switchTab(tab: TabName) {
    activeTab.value = tab
    ruleEditor.collapseRule()
  }

  // Log pagination
  async function loadLogsPage(page: number) {
    logsPage.value = page
    await store.fetchLogs({
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
