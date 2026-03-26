/**
 * useApiMonitorController Unit Tests
 *
 * Tests the rewritten API Monitor controller composable that fetches
 * real metrics from the backend and manages display-only state.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useApiMonitorController } from '@/composables/useApiMonitorController'
import type { ApiEndpoint, MonitorData } from '@/types/api-monitor'

// Mock auth store
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    token: 'mock-jwt-token'
  })
}))

// Mock runtime config
vi.mock('@/config/runtime', () => ({
  getBackendUrl: () => 'http://test-backend'
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Helper: build a valid MonitorData payload
function buildMonitorData(overrides: Partial<MonitorData> = {}): MonitorData {
  return {
    status: 'operational',
    endpoints: [],
    infrastructure: [],
    channels: [],
    events: [],
    stats: {
      totalEndpoints: 0,
      healthyCount: 0,
      warningCount: 0,
      errorCount: 0,
      avgResponseTime: 0
    },
    timestamp: new Date().toISOString(),
    ...overrides
  }
}

// Helper: build a mock endpoint
function buildEndpoint(overrides: Partial<ApiEndpoint> = {}): ApiEndpoint {
  return {
    id: '1',
    endpoint: '/api/test',
    method: 'GET',
    category: 'system',
    description: 'Test endpoint',
    status: 'healthy',
    responseTime: 100,
    avgResponseTime: 80,
    p50ResponseTime: 60,
    successRate: 100,
    requestCount: 50,
    errorCount: 0,
    statusCodes: { '200': 50 },
    lastCheck: new Date().toISOString(),
    ...overrides
  }
}

// Helper: mock a successful fetch
function mockSuccessfulFetch(data: MonitorData): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, data })
  })
}

describe('useApiMonitorController', () => {
  let controller: ReturnType<typeof useApiMonitorController>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    controller = useApiMonitorController()
  })

  afterEach(() => {
    controller.cleanup()
  })

  // ==========================================================================
  // Default State
  // ==========================================================================

  describe('Default State', () => {
    it('should have monitorData as null', () => {
      expect(controller.monitorData.value).toBeNull()
    })

    it('should have loading as false', () => {
      expect(controller.loading.value).toBe(false)
    })

    it('should have isRefreshing as false', () => {
      expect(controller.isRefreshing.value).toBe(false)
    })

    it('should have error as null', () => {
      expect(controller.error.value).toBeNull()
    })

    it('should have expandedCard as null', () => {
      expect(controller.expandedCard.value).toBeNull()
    })

    it('should have default filter values', () => {
      expect(controller.filters.value.status).toBe('all')
      expect(controller.filters.value.category).toBe('all')
      expect(controller.filters.value.search).toBe('')
    })

    it('should have modal closed by default', () => {
      expect(controller.modal.value.show).toBe(false)
      expect(controller.modal.value.type).toBe('all')
      expect(controller.modal.value.apis).toEqual([])
      expect(controller.modal.value.title).toBe('')
    })

    it('should have auto-refresh enabled with 15s interval', () => {
      expect(controller.autoRefresh.value.enabled).toBe(true)
      expect(controller.autoRefresh.value.interval).toBe(15000)
    })
  })

  // ==========================================================================
  // Computed Defaults (when monitorData is null)
  // ==========================================================================

  describe('Computed Defaults', () => {
    it('should return operational for systemStatus', () => {
      expect(controller.systemStatus.value).toBe('operational')
    })

    it('should return empty array for endpoints', () => {
      expect(controller.endpoints.value).toEqual([])
    })

    it('should return empty array for infrastructure', () => {
      expect(controller.infrastructure.value).toEqual([])
    })

    it('should return empty array for channels', () => {
      expect(controller.channels.value).toEqual([])
    })

    it('should return empty array for events', () => {
      expect(controller.events.value).toEqual([])
    })

    it('should return all-zero stats', () => {
      const s = controller.stats.value
      expect(s.totalEndpoints).toBe(0)
      expect(s.healthyCount).toBe(0)
      expect(s.warningCount).toBe(0)
      expect(s.errorCount).toBe(0)
      expect(s.avgResponseTime).toBe(0)
    })

    it('should return empty array for filteredApis', () => {
      expect(controller.filteredApis.value).toEqual([])
    })

    it('should return null for lastUpdated', () => {
      expect(controller.lastUpdated.value).toBeNull()
    })
  })

  // ==========================================================================
  // toggleCard
  // ==========================================================================

  describe('toggleCard', () => {
    it('should expand card when called with an id', () => {
      controller.toggleCard('card-1')
      expect(controller.expandedCard.value).toBe('card-1')
    })

    it('should collapse card when called with the same id', () => {
      controller.toggleCard('card-1')
      controller.toggleCard('card-1')
      expect(controller.expandedCard.value).toBeNull()
    })

    it('should switch to a different card', () => {
      controller.toggleCard('card-1')
      controller.toggleCard('card-2')
      expect(controller.expandedCard.value).toBe('card-2')
    })
  })

  // ==========================================================================
  // showStatDetails / closeModal
  // ==========================================================================

  describe('showStatDetails / closeModal', () => {
    const healthyEp = buildEndpoint({ id: 'h1', status: 'healthy' })
    const warningEp = buildEndpoint({ id: 'w1', status: 'warning' })
    const errorEp = buildEndpoint({ id: 'e1', status: 'error' })

    beforeEach(() => {
      controller.monitorData.value = buildMonitorData({
        endpoints: [healthyEp, warningEp, errorEp]
      })
    })

    it('should open modal filtered to healthy endpoints', () => {
      controller.showStatDetails('healthy')
      expect(controller.modal.value.show).toBe(true)
      expect(controller.modal.value.type).toBe('healthy')
      expect(controller.modal.value.title).toBe('Healthy Endpoints')
      expect(controller.modal.value.apis).toHaveLength(1)
      expect(controller.modal.value.apis[0].id).toBe('h1')
    })

    it('should open modal filtered to warning endpoints', () => {
      controller.showStatDetails('warning')
      expect(controller.modal.value.show).toBe(true)
      expect(controller.modal.value.type).toBe('warning')
      expect(controller.modal.value.title).toBe('Warning Endpoints')
      expect(controller.modal.value.apis).toHaveLength(1)
      expect(controller.modal.value.apis[0].id).toBe('w1')
    })

    it('should open modal filtered to error endpoints', () => {
      controller.showStatDetails('error')
      expect(controller.modal.value.show).toBe(true)
      expect(controller.modal.value.type).toBe('error')
      expect(controller.modal.value.title).toBe('Error Endpoints')
      expect(controller.modal.value.apis).toHaveLength(1)
      expect(controller.modal.value.apis[0].id).toBe('e1')
    })

    it('should close modal and reset state', () => {
      controller.showStatDetails('healthy')
      controller.closeModal()

      expect(controller.modal.value.show).toBe(false)
      expect(controller.modal.value.type).toBe('all')
      expect(controller.modal.value.apis).toEqual([])
      expect(controller.modal.value.title).toBe('')
    })
  })

  // ==========================================================================
  // toggleAutoRefresh
  // ==========================================================================

  describe('toggleAutoRefresh', () => {
    it('should flip autoRefresh.enabled from true to false', () => {
      expect(controller.autoRefresh.value.enabled).toBe(true)
      controller.toggleAutoRefresh()
      expect(controller.autoRefresh.value.enabled).toBe(false)
    })

    it('should flip autoRefresh.enabled from false to true', () => {
      controller.autoRefresh.value.enabled = false
      controller.toggleAutoRefresh()
      expect(controller.autoRefresh.value.enabled).toBe(true)
    })
  })

  // ==========================================================================
  // filteredApis
  // ==========================================================================

  describe('filteredApis', () => {
    const systemHealthy = buildEndpoint({
      id: 's1', endpoint: '/api/system/health', category: 'system',
      description: 'System health check', status: 'healthy'
    })
    const authWarning = buildEndpoint({
      id: 'a1', endpoint: '/api/auth/login', category: 'auth',
      description: 'User login', status: 'warning'
    })
    const customerError = buildEndpoint({
      id: 'c1', endpoint: '/api/customers', category: 'customer',
      description: 'Get customers', status: 'error'
    })

    beforeEach(() => {
      controller.monitorData.value = buildMonitorData({
        endpoints: [systemHealthy, authWarning, customerError]
      })
    })

    it('should return all endpoints when filters are default', () => {
      expect(controller.filteredApis.value).toHaveLength(3)
    })

    it('should filter by status - healthy', async () => {
      controller.filters.value.status = 'healthy'
      await nextTick()
      expect(controller.filteredApis.value).toHaveLength(1)
      expect(controller.filteredApis.value[0].status).toBe('healthy')
    })

    it('should filter by status - warning', async () => {
      controller.filters.value.status = 'warning'
      await nextTick()
      expect(controller.filteredApis.value).toHaveLength(1)
      expect(controller.filteredApis.value[0].status).toBe('warning')
    })

    it('should filter by status - error', async () => {
      controller.filters.value.status = 'error'
      await nextTick()
      expect(controller.filteredApis.value).toHaveLength(1)
      expect(controller.filteredApis.value[0].status).toBe('error')
    })

    it('should filter by category', async () => {
      controller.filters.value.category = 'auth'
      await nextTick()
      expect(controller.filteredApis.value).toHaveLength(1)
      expect(controller.filteredApis.value[0].category).toBe('auth')
    })

    it('should filter by search on endpoint', async () => {
      controller.filters.value.search = 'health'
      await nextTick()
      expect(controller.filteredApis.value).toHaveLength(1)
      expect(controller.filteredApis.value[0].endpoint).toContain('health')
    })

    it('should filter by search on description', async () => {
      controller.filters.value.search = 'login'
      await nextTick()
      expect(controller.filteredApis.value).toHaveLength(1)
      expect(controller.filteredApis.value[0].description).toContain('login')
    })

    it('should filter by search case-insensitively', async () => {
      controller.filters.value.search = 'HEALTH'
      await nextTick()
      expect(controller.filteredApis.value).toHaveLength(1)
    })

    it('should combine status and category filters', async () => {
      controller.filters.value.status = 'healthy'
      controller.filters.value.category = 'system'
      await nextTick()
      expect(controller.filteredApis.value).toHaveLength(1)
      expect(controller.filteredApis.value[0].id).toBe('s1')
    })

    it('should return empty when no match', async () => {
      controller.filters.value.search = 'nonexistent'
      await nextTick()
      expect(controller.filteredApis.value).toHaveLength(0)
    })
  })

  // ==========================================================================
  // initialize / refreshAll (fetch integration)
  // ==========================================================================

  describe('initialize', () => {
    it('should fetch data and populate monitorData', async () => {
      const data = buildMonitorData({
        status: 'degraded',
        endpoints: [buildEndpoint()],
        stats: {
          totalEndpoints: 1,
          healthyCount: 1,
          warningCount: 0,
          errorCount: 0,
          avgResponseTime: 100
        }
      })
      mockSuccessfulFetch(data)

      await controller.initialize()

      expect(controller.loading.value).toBe(false)
      expect(controller.error.value).toBeNull()
      expect(controller.monitorData.value).not.toBeNull()
      expect(controller.systemStatus.value).toBe('degraded')
      expect(controller.endpoints.value).toHaveLength(1)
      expect(controller.stats.value.totalEndpoints).toBe(1)
    })

    it('should set loading true during fetch', async () => {
      let resolvePromise: (_v: unknown) => void
      mockFetch.mockReturnValueOnce(
        new Promise(resolve => { resolvePromise = resolve })
      )

      const initPromise = controller.initialize()
      expect(controller.loading.value).toBe(true)

      resolvePromise!({
        ok: true,
        json: async () => ({ success: true, data: buildMonitorData() })
      })
      await initPromise

      expect(controller.loading.value).toBe(false)
    })

    it('should set error on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await controller.initialize()

      expect(controller.loading.value).toBe(false)
      expect(controller.error.value).toBe('Network error')
    })

    it('should set error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      await controller.initialize()

      expect(controller.error.value).toBe('API status fetch failed: 500')
    })

    it('should set error on invalid response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, message: 'Bad data' })
      })

      await controller.initialize()

      expect(controller.error.value).toBe('Bad data')
    })

    it('should send auth header in fetch request', async () => {
      mockSuccessfulFetch(buildMonitorData())

      await controller.initialize()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/system/api-status'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-jwt-token'
          })
        })
      )
    })
  })

  describe('refreshAll', () => {
    it('should update monitorData on refresh', async () => {
      const data = buildMonitorData({ status: 'outage' })
      mockSuccessfulFetch(data)

      await controller.refreshAll()

      expect(controller.isRefreshing.value).toBe(false)
      expect(controller.monitorData.value?.status).toBe('outage')
    })

    it('should set error on refresh failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'))

      await controller.refreshAll()

      expect(controller.error.value).toBe('Timeout')
      expect(controller.isRefreshing.value).toBe(false)
    })

    it('should clear previous error on successful refresh', async () => {
      controller.error.value = 'Previous error'
      mockSuccessfulFetch(buildMonitorData())

      await controller.refreshAll()

      expect(controller.error.value).toBeNull()
    })
  })

  // ==========================================================================
  // Lifecycle / Cleanup
  // ==========================================================================

  describe('cleanup', () => {
    it('should not throw when called', () => {
      expect(() => controller.cleanup()).not.toThrow()
    })

    it('should be safe to call multiple times', () => {
      expect(() => {
        controller.cleanup()
        controller.cleanup()
      }).not.toThrow()
    })
  })

  // ==========================================================================
  // Exposed API shape
  // ==========================================================================

  describe('Exposed API', () => {
    it('should expose all state refs', () => {
      expect(controller.monitorData).toBeDefined()
      expect(controller.loading).toBeDefined()
      expect(controller.isRefreshing).toBeDefined()
      expect(controller.error).toBeDefined()
      expect(controller.filters).toBeDefined()
      expect(controller.modal).toBeDefined()
      expect(controller.autoRefresh).toBeDefined()
      expect(controller.expandedCard).toBeDefined()
    })

    it('should expose all computed properties', () => {
      expect(controller.systemStatus).toBeDefined()
      expect(controller.endpoints).toBeDefined()
      expect(controller.infrastructure).toBeDefined()
      expect(controller.channels).toBeDefined()
      expect(controller.events).toBeDefined()
      expect(controller.stats).toBeDefined()
      expect(controller.filteredApis).toBeDefined()
      expect(controller.lastUpdated).toBeDefined()
    })

    it('should expose all methods', () => {
      expect(typeof controller.initialize).toBe('function')
      expect(typeof controller.refreshAll).toBe('function')
      expect(typeof controller.toggleAutoRefresh).toBe('function')
      expect(typeof controller.toggleCard).toBe('function')
      expect(typeof controller.showStatDetails).toBe('function')
      expect(typeof controller.closeModal).toBe('function')
      expect(typeof controller.cleanup).toBe('function')
    })
  })
})
