/**
 * API Monitor Controller Composable
 *
 * Simplified controller: fetches real metrics from backend,
 * manages filters, expandable cards, and auto-refresh.
 * Frontend does ZERO health pinging — display only.
 */

import { ref, computed, onUnmounted, getCurrentInstance } from 'vue'
import { getBackendUrl } from '@/config/runtime'
import { useAuthStore } from '@/stores/auth'
import type {
  ApiEndpoint,
  FilterState,
  ModalState,
  AutoRefreshConfig,
  ApiStatus,
  MonitorData,
  ApiStatistics,
  InfrastructureItem,
  ChannelItem,
  MonitorEvent,
  SystemStatus
} from '@/types/api-monitor'

export function useApiMonitorController() {
  // ===== State =====
  const monitorData = ref<MonitorData | null>(null)
  const loading = ref(false)
  const isRefreshing = ref(false)
  const error = ref<string | null>(null)
  const expandedCard = ref<string | null>(null)

  const filters = ref<FilterState>({
    status: 'all',
    category: 'all',
    search: ''
  })

  const modal = ref<ModalState>({
    show: false,
    type: 'all',
    apis: [],
    title: ''
  })

  const autoRefresh = ref<AutoRefreshConfig>({
    enabled: true,
    interval: 15000
  })

  let refreshTimer: ReturnType<typeof setInterval> | null = null

  // ===== Computed =====
  const systemStatus = computed<SystemStatus>(() => monitorData.value?.status ?? 'operational')

  const endpoints = computed<ApiEndpoint[]>(() => monitorData.value?.endpoints ?? [])

  const infrastructure = computed<InfrastructureItem[]>(() => monitorData.value?.infrastructure ?? [])

  const channels = computed<ChannelItem[]>(() => monitorData.value?.channels ?? [])

  const events = computed<MonitorEvent[]>(() => monitorData.value?.events ?? [])

  const stats = computed<ApiStatistics>(() => {
    if (monitorData.value?.stats) {return monitorData.value.stats}
    return {
      totalEndpoints: 0,
      healthyCount: 0,
      warningCount: 0,
      errorCount: 0,
      avgResponseTime: 0
    }
  })

  const filteredApis = computed(() => {
    let result = endpoints.value

    // Filter by status
    if (filters.value.status !== 'all') {
      result = result.filter(api => api.status === filters.value.status)
    }

    // Filter by category
    if (filters.value.category !== 'all') {
      result = result.filter(api => api.category === filters.value.category)
    }

    // Filter by search
    if (filters.value.search) {
      const search = filters.value.search.toLowerCase()
      result = result.filter(api =>
        api.endpoint.toLowerCase().includes(search) ||
        api.description.toLowerCase().includes(search) ||
        api.method.toLowerCase().includes(search)
      )
    }

    return result
  })

  const lastUpdated = computed(() => {
    if (!monitorData.value?.timestamp) {return null}
    return new Date(monitorData.value.timestamp)
  })

  // ===== Methods =====
  async function fetchApiStatus(): Promise<void> {
    const authStore = useAuthStore()
    // Dev: use Vite proxy (/api) to avoid CORS; Prod: direct backend URL
    const baseUrl = import.meta.env.DEV ? '' : getBackendUrl()

    const response = await fetch(`${baseUrl}/api/system/api-status`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`API status fetch failed: ${response.status}`)
    }

    const json = await response.json()
    if (json.success && json.data) {
      monitorData.value = json.data
    } else {
      throw new Error(json.message || 'Invalid response format')
    }
  }

  async function initialize(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      await fetchApiStatus()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load monitoring data'
      console.error('API Monitor initialization error:', err)
    } finally {
      loading.value = false
    }

    if (autoRefresh.value.enabled) {
      startAutoRefresh()
    }
  }

  async function refreshAll(): Promise<void> {
    if (isRefreshing.value) {return}
    isRefreshing.value = true

    try {
      await fetchApiStatus()
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Refresh failed'
      console.error('API Monitor refresh error:', err)
    } finally {
      isRefreshing.value = false
    }
  }

  function startAutoRefresh(): void {
    stopAutoRefresh()
    refreshTimer = setInterval(() => {
      refreshAll()
    }, autoRefresh.value.interval)
  }

  function stopAutoRefresh(): void {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }

  function toggleAutoRefresh(): void {
    autoRefresh.value.enabled = !autoRefresh.value.enabled
    if (autoRefresh.value.enabled) {
      startAutoRefresh()
    } else {
      stopAutoRefresh()
    }
  }

  function toggleCard(id: string): void {
    expandedCard.value = expandedCard.value === id ? null : id
  }

  function showStatDetails(type: ApiStatus): void {
    const filtered = endpoints.value.filter(api => api.status === type)
    const titles: Record<ApiStatus, string> = {
      healthy: 'Healthy Endpoints',
      warning: 'Warning Endpoints',
      error: 'Error Endpoints'
    }
    modal.value = {
      show: true,
      type,
      apis: filtered,
      title: titles[type] || 'Endpoints'
    }
  }

  function closeModal(): void {
    modal.value = { show: false, type: 'all', apis: [], title: '' }
  }

  function cleanup(): void {
    stopAutoRefresh()
  }

  // Auto-cleanup on unmount if in component context
  if (getCurrentInstance()) {
    onUnmounted(cleanup)
  }

  return {
    // State
    monitorData,
    loading,
    isRefreshing,
    error,
    filters,
    modal,
    autoRefresh,
    expandedCard,

    // Computed
    systemStatus,
    endpoints,
    infrastructure,
    channels,
    events,
    stats,
    filteredApis,
    lastUpdated,

    // Methods
    initialize,
    refreshAll,
    toggleAutoRefresh,
    toggleCard,
    showStatDetails,
    closeModal,
    cleanup
  }
}
