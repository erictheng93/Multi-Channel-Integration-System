/**
 * API Monitor Controller Composable
 *
 * Central business logic for API monitoring dashboard
 * Manages state, API calls, filtering, and user interactions
 *
 * Based on the Controller Pattern from ConversationDetail.vue refactoring
 */

import { ref, computed, reactive, onUnmounted, getCurrentInstance } from 'vue'
import { getBackendUrl } from '@/config/runtime'
import type {
  ApiEndpoint,
  FilterState,
  ModalState,
  MigrationStatus,
  ApiStatistics,
  ApiStatusResponse,
  MigrationStatusResponse,
  AutoRefreshConfig,
  ApiStatus,
  ResponseTimeClass,
  SuccessRateClass
} from '@/types/api-monitor'

/**
 * Default API endpoints configuration
 * These are initialized on mount and updated from backend
 */
const DEFAULT_APIS: Omit<ApiEndpoint, 'lastCheck'>[] = [
  {
    id: 'health',
    endpoint: '/api/system/health',
    method: 'GET',
    category: 'system',
    description: '系統健康檢查',
    status: 'healthy',
    responseTime: 0,
    avgResponseTime: 0,
    successRate: 100,
    requestCount: 0,
    errorCount: 0
  },
  {
    id: 'system-info',
    endpoint: '/api/system/info',
    method: 'GET',
    category: 'system',
    description: '系統信息',
    status: 'healthy',
    responseTime: 0,
    avgResponseTime: 0,
    successRate: 100,
    requestCount: 0,
    errorCount: 0
  },
  {
    id: 'auth-login',
    endpoint: '/api/auth/login',
    method: 'POST',
    category: 'auth',
    description: '用戶登入',
    status: 'healthy',
    responseTime: 0,
    avgResponseTime: 0,
    successRate: 100,
    requestCount: 0,
    errorCount: 0
  },
  {
    id: 'conversations-list',
    endpoint: '/api/conversations',
    method: 'GET',
    category: 'conversation',
    description: '獲取對話列表',
    status: 'healthy',
    responseTime: 0,
    avgResponseTime: 0,
    successRate: 100,
    requestCount: 0,
    errorCount: 0
  },
  {
    id: 'customers-list',
    endpoint: '/api/customers',
    method: 'GET',
    category: 'customer',
    description: '獲取客戶列表',
    status: 'healthy',
    responseTime: 0,
    avgResponseTime: 0,
    successRate: 100,
    requestCount: 0,
    errorCount: 0
  },
  {
    id: 'team-members',
    endpoint: '/api/teams/members',
    method: 'GET',
    category: 'team',
    description: '獲取團隊成員',
    status: 'healthy',
    responseTime: 0,
    avgResponseTime: 0,
    successRate: 100,
    requestCount: 0,
    errorCount: 0
  }
]

/**
 * API Monitor Controller Composable
 *
 * @returns Controller object with state and methods
 */
export function useApiMonitorController() {
  // ============================================================================
  // State Management
  // ============================================================================

  /** All API endpoints */
  const apis = ref<ApiEndpoint[]>([])

  /** Loading state for initial load */
  const loading = ref(false)

  /** Refreshing state for manual/auto refresh */
  const isRefreshing = ref(false)

  /** Error message */
  const error = ref<string | null>(null)

  /** Filter state */
  const filters = reactive<FilterState>({
    status: 'all',
    category: 'all',
    search: ''
  })

  /** Modal state */
  const modal = reactive<ModalState>({
    show: false,
    type: 'all',
    apis: [],
    title: ''
  })

  /** WebSocket migration status */
  const migrationStatus = ref<MigrationStatus>({
    rolloutPercentage: 0,
    websocketEnabled: false,
    durableObjectsAvailable: false,
    migrationStrategy: 'gradual',
    lastCheck: new Date()
  })

  /** Auto-refresh configuration */
  const autoRefresh = reactive<AutoRefreshConfig>({
    enabled: true,
    interval: 15000 // 15 seconds
  })

  /** Currently expanded card ID */
  const expandedCard = ref<string | null>(null)

  /** Auto-refresh interval timer */
  let refreshInterval: number | null = null

  // ============================================================================
  // Computed Properties
  // ============================================================================

  /**
   * Filtered APIs based on current filter state
   */
  const filteredApis = computed(() => {
    return apis.value.filter(api => {
      const matchesStatus = filters.status === 'all' || api.status === filters.status
      const matchesCategory = filters.category === 'all' || api.category === filters.category
      const matchesSearch = filters.search === '' ||
        api.endpoint.toLowerCase().includes(filters.search.toLowerCase()) ||
        api.description.toLowerCase().includes(filters.search.toLowerCase())

      return matchesStatus && matchesCategory && matchesSearch
    })
  })

  /**
   * API statistics summary
   */
  const stats = computed<ApiStatistics>(() => ({
    total: apis.value.length,
    healthy: apis.value.filter(api => api.status === 'healthy').length,
    warning: apis.value.filter(api => api.status === 'warning').length,
    error: apis.value.filter(api => api.status === 'error').length
  }))

  // ============================================================================
  // API Calls
  // ============================================================================

  /**
   * Initialize default API list
   */
  function initializeApis(): void {
    apis.value = DEFAULT_APIS.map(api => ({
      ...api,
      lastCheck: new Date()
    }))
  }

  /**
   * Load API status from backend
   */
  async function loadApiStatusFromBackend(): Promise<void> {
    try {
      // ✅ Dev: use Vite proxy (/api) to avoid CORS; Prod: direct backend URL
      const baseUrl = import.meta.env.DEV ? '' : getBackendUrl()
      const response = await fetch(`${baseUrl}/api/system/api-status`)

      if (!response.ok) {
        throw new Error(`API status endpoint returned ${response.status}`)
      }

      const data: ApiStatusResponse = await response.json()

      if (data.success && data.data) {
        apis.value = data.data.endpoints.map((endpoint): ApiEndpoint => ({
          id: endpoint.id || '',
          endpoint: endpoint.endpoint || '',
          method: endpoint.method || 'GET',
          category: endpoint.category || 'system',
          description: endpoint.description || '',
          status: endpoint.status || 'healthy',
          responseTime: endpoint.responseTime || 0,
          avgResponseTime: endpoint.avgResponseTime || 0,
          successRate: endpoint.successRate || 100,
          requestCount: endpoint.requestCount || 0,
          errorCount: endpoint.errorCount || 0,
          lastCheck: endpoint.lastCheck ? new Date(endpoint.lastCheck) : new Date(),
          error: endpoint.error,
          errorTime: endpoint.errorTime ? new Date(endpoint.errorTime) : undefined
        }))
      }
    } catch (err) {
      console.error('❌ Failed to load API status from backend:', err)
      error.value = err instanceof Error ? err.message : 'Unknown error'
      throw err
    }
  }

  /**
   * Fetch WebSocket migration status
   */
  async function fetchMigrationStatus(): Promise<void> {
    try {
      // ✅ Dev: use Vite proxy (/api) to avoid CORS; Prod: direct backend URL
      const baseUrl = import.meta.env.DEV ? '' : getBackendUrl()
      const response = await fetch(`${baseUrl}/api/websocket/migration-status`)

      if (response.ok) {
        const data: MigrationStatusResponse = await response.json()
        migrationStatus.value = {
          rolloutPercentage: data.rolloutPercentage || 0,
          websocketEnabled: data.websocketEnabled || false,
          durableObjectsAvailable: data.durableObjectsAvailable || false,
          migrationStrategy: (data.migrationStrategy as MigrationStatus['migrationStrategy']) || 'gradual',
          lastCheck: new Date()
        }
      }
    } catch (err) {
      console.error('Failed to fetch WebSocket migration status:', err)
    }
  }

  /**
   * Check individual API status
   */
  async function checkApiStatus(api: ApiEndpoint): Promise<void> {
    const startTime = Date.now()

    try {
      let response: Response | undefined

      switch (api.endpoint) {
        case '/api/system/health':
          response = await fetch('/api/system/health')
          break
        case '/api/system/info':
          response = await fetch('/api/system/info', { method: 'HEAD' })

          // 401 means endpoint exists but needs auth - this is normal
          if (response.status === 401) {
            api.status = 'warning'
            api.error = '需要認證'
            api.errorTime = new Date()
            api.responseTime = Date.now() - startTime
            api.lastCheck = new Date()
            api.requestCount++
            return
          }
          break
        default:
          // For authenticated APIs, just check if endpoint exists
          response = await fetch(api.endpoint, { method: 'HEAD' })
      }

      const responseTime = Date.now() - startTime
      api.responseTime = responseTime
      api.avgResponseTime = Math.round((api.avgResponseTime + responseTime) / 2)
      api.lastCheck = new Date()
      api.requestCount++

      if (response && response.ok) {
        api.status = responseTime > 1000 ? 'warning' : 'healthy'
        api.successRate = Math.min(100, Math.round((api.successRate * 0.9) + 10))
        api.error = undefined
        api.errorTime = undefined
      } else {
        api.status = 'error'
        api.errorCount++
        api.successRate = Math.max(0, Math.round(api.successRate * 0.9))
        api.error = response ? `HTTP ${response.status}` : '無響應'
        api.errorTime = new Date()
      }
    } catch (err) {
      const responseTime = Date.now() - startTime
      api.responseTime = responseTime
      api.lastCheck = new Date()
      api.requestCount++
      api.errorCount++
      api.status = 'error'
      api.successRate = Math.max(0, Math.round(api.successRate * 0.9))
      api.error = err instanceof Error ? err.message : '未知錯誤'
      api.errorTime = new Date()
    }
  }

  // ============================================================================
  // Business Logic
  // ============================================================================

  /**
   * Refresh all API statuses and migration status
   */
  async function refreshAll(): Promise<void> {
    if (isRefreshing.value) {
      return
    }

    isRefreshing.value = true
    error.value = null

    try {
      await Promise.all([
        loadApiStatusFromBackend(),
        fetchMigrationStatus()
      ])
    } catch (err) {
      console.error('❌ Failed to refresh:', err)
      error.value = err instanceof Error ? err.message : 'Refresh failed'
    } finally {
      isRefreshing.value = false
    }
  }

  /**
   * Test individual API endpoint
   */
  async function testApi(api: ApiEndpoint): Promise<void> {
    api.testing = true
    await checkApiStatus(api)
    api.testing = false
  }

  /**
   * Toggle card expansion
   */
  function toggleCard(id: string): void {
    expandedCard.value = expandedCard.value === id ? null : id
  }

  /**
   * Show statistics detail modal
   */
  function showStatDetails(type: 'all' | 'healthy' | 'warning' | 'error'): void {
    let filteredApis: ApiEndpoint[]

    switch (type) {
      case 'healthy':
        filteredApis = apis.value.filter(api => api.status === 'healthy')
        break
      case 'warning':
        filteredApis = apis.value.filter(api => api.status === 'warning')
        break
      case 'error':
        filteredApis = apis.value.filter(api => api.status === 'error')
        break
      case 'all':
      default:
        filteredApis = [...apis.value]
        break
    }

    const titleMap = {
      healthy: '正常狀態的API',
      warning: '警告狀態的API',
      error: '錯誤狀態的API',
      all: '所有API端點'
    }

    modal.show = true
    modal.type = type
    modal.apis = filteredApis
    modal.title = titleMap[type]
  }

  /**
   * Close statistics modal
   */
  function closeModal(): void {
    modal.show = false
    modal.type = 'all'
    modal.apis = []
    modal.title = ''
  }

  /**
   * Toggle auto-refresh
   */
  function toggleAutoRefresh(): void {
    if (autoRefresh.enabled) {
      startAutoRefresh()
    } else {
      stopAutoRefresh()
    }
  }

  /**
   * Start auto-refresh interval
   */
  function startAutoRefresh(): void {
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }
    refreshInterval = window.setInterval(refreshAll, autoRefresh.interval)
  }

  /**
   * Stop auto-refresh interval
   */
  function stopAutoRefresh(): void {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Get status text in Chinese
   */
  function getStatusText(status: ApiStatus): string {
    const statusMap = {
      healthy: '正常',
      warning: '警告',
      error: '錯誤'
    }
    return statusMap[status]
  }

  /**
   * Get response time classification
   */
  function getResponseTimeClass(time: number): ResponseTimeClass {
    if (time < 200) {return 'excellent'}
    if (time < 500) {return 'good'}
    if (time < 1000) {return 'fair'}
    return 'poor'
  }

  /**
   * Get success rate classification
   */
  function getSuccessRateClass(rate: number): SuccessRateClass {
    if (rate >= 98) {return 'excellent'}
    if (rate >= 95) {return 'good'}
    if (rate >= 90) {return 'fair'}
    return 'poor'
  }

  /**
   * Format timestamp
   */
  function formatTime(date: Date | undefined): string {
    if (!date) {return '未知'}

    return new Intl.DateTimeFormat('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      month: 'short',
      day: 'numeric'
    }).format(date)
  }

  /**
   * Get category text in Chinese
   */
  function getCategoryText(category: string): string {
    const categoryMap: Record<string, string> = {
      system: '系統',
      auth: '認證',
      conversation: '對話',
      customer: '客戶',
      team: '團隊',
      message: '訊息',
      integration: '整合'
    }
    return categoryMap[category] || category
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Initialize controller
   */
  async function initialize(): Promise<void> {
    loading.value = true

    try {
      // Initialize with default APIs first
      initializeApis()

      // Load actual status from backend
      await refreshAll()

      // Start auto-refresh if enabled
      if (autoRefresh.enabled) {
        startAutoRefresh()
      }
    } catch (err) {
      console.error('Failed to initialize API monitor:', err)
      error.value = err instanceof Error ? err.message : 'Initialization failed'
    } finally {
      loading.value = false
    }
  }

  /**
   * Cleanup controller (call in onUnmounted)
   */
  function cleanup(): void {
    stopAutoRefresh()
  }

  // Auto-cleanup on unmount (only if running inside a component)
  if (getCurrentInstance()) {
    onUnmounted(cleanup)
  }

  // ============================================================================
  // Public API
  // ============================================================================

  return {
    // State
    apis,
    loading,
    isRefreshing,
    error,
    filters,
    modal,
    migrationStatus,
    autoRefresh,
    expandedCard,

    // Computed
    filteredApis,
    stats,

    // Methods
    initialize,
    cleanup,
    refreshAll,
    testApi,
    toggleCard,
    showStatDetails,
    closeModal,
    toggleAutoRefresh,

    // Utilities
    getStatusText,
    getResponseTimeClass,
    getSuccessRateClass,
    formatTime,
    getCategoryText
  }
}
