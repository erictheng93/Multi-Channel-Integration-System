/**
 * useApiMonitorController Unit Tests
 *
 * Comprehensive test suite for the API Monitor controller composable
 * Tests all state management, business logic, and API interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { useApiMonitorController } from '@/composables/useApiMonitorController'
import type { ApiEndpoint } from '@/types/api-monitor'

// Mock fetch globally
global.fetch = vi.fn()

describe('useApiMonitorController', () => {
  let controller: ReturnType<typeof useApiMonitorController>

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()

    // Create fresh controller instance
    controller = useApiMonitorController()
  })

  afterEach(() => {
    // Cleanup after each test
    controller.cleanup()
  })

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      expect(controller.apis.value).toEqual([])
      expect(controller.loading.value).toBe(false)
      expect(controller.isRefreshing.value).toBe(false)
      expect(controller.error.value).toBeNull()
      expect(controller.expandedCard.value).toBeNull()
    })

    it('should initialize filters with default values', () => {
      expect(controller.filters.status).toBe('all')
      expect(controller.filters.category).toBe('all')
      expect(controller.filters.search).toBe('')
    })

    it('should initialize modal as closed', () => {
      expect(controller.modal.show).toBe(false)
      expect(controller.modal.type).toBe('all')
      expect(controller.modal.apis).toEqual([])
      expect(controller.modal.title).toBe('')
    })

    it('should initialize migration status with defaults', () => {
      expect(controller.migrationStatus.value.rolloutPercentage).toBe(0)
      expect(controller.migrationStatus.value.websocketEnabled).toBe(false)
      expect(controller.migrationStatus.value.durableObjectsAvailable).toBe(false)
      expect(controller.migrationStatus.value.migrationStrategy).toBe('gradual')
    })

    it('should initialize auto-refresh as enabled', () => {
      expect(controller.autoRefresh.enabled).toBe(true)
      expect(controller.autoRefresh.interval).toBe(15000)
    })

    it('should have initial stats of zero', () => {
      expect(controller.stats.value.total).toBe(0)
      expect(controller.stats.value.healthy).toBe(0)
      expect(controller.stats.value.warning).toBe(0)
      expect(controller.stats.value.error).toBe(0)
    })
  })

  // ============================================================================
  // State Management Tests
  // ============================================================================

  describe('State Management', () => {
    it('should expose all required state properties', () => {
      expect(controller.apis).toBeDefined()
      expect(controller.loading).toBeDefined()
      expect(controller.isRefreshing).toBeDefined()
      expect(controller.error).toBeDefined()
      expect(controller.filters).toBeDefined()
      expect(controller.modal).toBeDefined()
      expect(controller.migrationStatus).toBeDefined()
      expect(controller.autoRefresh).toBeDefined()
      expect(controller.expandedCard).toBeDefined()
    })

    it('should expose all computed properties', () => {
      expect(controller.filteredApis).toBeDefined()
      expect(controller.stats).toBeDefined()
    })

    it('should update stats when apis change', async () => {
      const mockApis: ApiEndpoint[] = [
        {
          id: '1',
          endpoint: '/test1',
          method: 'GET',
          category: 'system',
          description: 'Test 1',
          status: 'healthy',
          responseTime: 100,
          avgResponseTime: 100,
          successRate: 100,
          requestCount: 10,
          errorCount: 0,
          lastCheck: new Date()
        },
        {
          id: '2',
          endpoint: '/test2',
          method: 'POST',
          category: 'auth',
          description: 'Test 2',
          status: 'warning',
          responseTime: 800,
          avgResponseTime: 800,
          successRate: 95,
          requestCount: 10,
          errorCount: 1,
          lastCheck: new Date()
        },
        {
          id: '3',
          endpoint: '/test3',
          method: 'DELETE',
          category: 'customer',
          description: 'Test 3',
          status: 'error',
          responseTime: 5000,
          avgResponseTime: 5000,
          successRate: 50,
          requestCount: 10,
          errorCount: 5,
          lastCheck: new Date()
        }
      ]

      controller.apis.value = mockApis
      await nextTick()

      expect(controller.stats.value.total).toBe(3)
      expect(controller.stats.value.healthy).toBe(1)
      expect(controller.stats.value.warning).toBe(1)
      expect(controller.stats.value.error).toBe(1)
    })
  })

  // ============================================================================
  // Filtering Tests
  // ============================================================================

  describe('Filtering', () => {
    const mockApis: ApiEndpoint[] = [
      {
        id: '1',
        endpoint: '/api/system/health',
        method: 'GET',
        category: 'system',
        description: 'System health check',
        status: 'healthy',
        responseTime: 100,
        avgResponseTime: 100,
        successRate: 100,
        requestCount: 10,
        errorCount: 0,
        lastCheck: new Date()
      },
      {
        id: '2',
        endpoint: '/api/auth/login',
        method: 'POST',
        category: 'auth',
        description: 'User login',
        status: 'warning',
        responseTime: 800,
        avgResponseTime: 800,
        successRate: 95,
        requestCount: 10,
        errorCount: 1,
        lastCheck: new Date()
      },
      {
        id: '3',
        endpoint: '/api/customers',
        method: 'GET',
        category: 'customer',
        description: 'Get customers',
        status: 'error',
        responseTime: 5000,
        avgResponseTime: 5000,
        successRate: 50,
        requestCount: 10,
        errorCount: 5,
        lastCheck: new Date()
      }
    ]

    beforeEach(() => {
      controller.apis.value = mockApis
    })

    it('should filter by status - healthy', async () => {
      controller.filters.status = 'healthy'
      await nextTick()

      expect(controller.filteredApis.value).toHaveLength(1)
      expect(controller.filteredApis.value[0].status).toBe('healthy')
    })

    it('should filter by status - warning', async () => {
      controller.filters.status = 'warning'
      await nextTick()

      expect(controller.filteredApis.value).toHaveLength(1)
      expect(controller.filteredApis.value[0].status).toBe('warning')
    })

    it('should filter by status - error', async () => {
      controller.filters.status = 'error'
      await nextTick()

      expect(controller.filteredApis.value).toHaveLength(1)
      expect(controller.filteredApis.value[0].status).toBe('error')
    })

    it('should filter by category - system', async () => {
      controller.filters.category = 'system'
      await nextTick()

      expect(controller.filteredApis.value).toHaveLength(1)
      expect(controller.filteredApis.value[0].category).toBe('system')
    })

    it('should filter by category - auth', async () => {
      controller.filters.category = 'auth'
      await nextTick()

      expect(controller.filteredApis.value).toHaveLength(1)
      expect(controller.filteredApis.value[0].category).toBe('auth')
    })

    it('should filter by search - endpoint', async () => {
      controller.filters.search = 'health'
      await nextTick()

      expect(controller.filteredApis.value).toHaveLength(1)
      expect(controller.filteredApis.value[0].endpoint).toContain('health')
    })

    it('should filter by search - description', async () => {
      controller.filters.search = 'login'
      await nextTick()

      expect(controller.filteredApis.value).toHaveLength(1)
      expect(controller.filteredApis.value[0].description).toContain('login')
    })

    it('should filter by search - case insensitive', async () => {
      controller.filters.search = 'HEALTH'
      await nextTick()

      expect(controller.filteredApis.value).toHaveLength(1)
    })

    it('should combine multiple filters', async () => {
      controller.filters.status = 'healthy'
      controller.filters.category = 'system'
      await nextTick()

      expect(controller.filteredApis.value).toHaveLength(1)
      expect(controller.filteredApis.value[0].status).toBe('healthy')
      expect(controller.filteredApis.value[0].category).toBe('system')
    })

    it('should return empty array when no matches', async () => {
      controller.filters.search = 'nonexistent'
      await nextTick()

      expect(controller.filteredApis.value).toHaveLength(0)
    })

    it('should show all when filters are reset', async () => {
      controller.filters.status = 'all'
      controller.filters.category = 'all'
      controller.filters.search = ''
      await nextTick()

      expect(controller.filteredApis.value).toHaveLength(3)
    })
  })

  // ============================================================================
  // Card Toggle Tests
  // ============================================================================

  describe('Card Toggle', () => {
    it('should expand card when toggleCard is called', () => {
      controller.toggleCard('test-1')
      expect(controller.expandedCard.value).toBe('test-1')
    })

    it('should collapse card when toggleCard is called on expanded card', () => {
      controller.toggleCard('test-1')
      expect(controller.expandedCard.value).toBe('test-1')

      controller.toggleCard('test-1')
      expect(controller.expandedCard.value).toBeNull()
    })

    it('should switch to different card', () => {
      controller.toggleCard('test-1')
      expect(controller.expandedCard.value).toBe('test-1')

      controller.toggleCard('test-2')
      expect(controller.expandedCard.value).toBe('test-2')
    })
  })

  // ============================================================================
  // Modal Tests
  // ============================================================================

  describe('Modal', () => {
    const mockApis: ApiEndpoint[] = [
      {
        id: '1',
        endpoint: '/test1',
        method: 'GET',
        category: 'system',
        description: 'Test 1',
        status: 'healthy',
        responseTime: 100,
        avgResponseTime: 100,
        successRate: 100,
        requestCount: 10,
        errorCount: 0,
        lastCheck: new Date()
      },
      {
        id: '2',
        endpoint: '/test2',
        method: 'POST',
        category: 'auth',
        description: 'Test 2',
        status: 'warning',
        responseTime: 800,
        avgResponseTime: 800,
        successRate: 95,
        requestCount: 10,
        errorCount: 1,
        lastCheck: new Date()
      },
      {
        id: '3',
        endpoint: '/test3',
        method: 'DELETE',
        category: 'customer',
        description: 'Test 3',
        status: 'error',
        responseTime: 5000,
        avgResponseTime: 5000,
        successRate: 50,
        requestCount: 10,
        errorCount: 5,
        lastCheck: new Date()
      }
    ]

    beforeEach(() => {
      controller.apis.value = mockApis
    })

    it('should show modal with healthy APIs', () => {
      controller.showStatDetails('healthy')

      expect(controller.modal.show).toBe(true)
      expect(controller.modal.type).toBe('healthy')
      expect(controller.modal.title).toBe('正常狀態的API')
      expect(controller.modal.apis).toHaveLength(1)
      expect(controller.modal.apis[0].status).toBe('healthy')
    })

    it('should show modal with warning APIs', () => {
      controller.showStatDetails('warning')

      expect(controller.modal.show).toBe(true)
      expect(controller.modal.type).toBe('warning')
      expect(controller.modal.title).toBe('警告狀態的API')
      expect(controller.modal.apis).toHaveLength(1)
      expect(controller.modal.apis[0].status).toBe('warning')
    })

    it('should show modal with error APIs', () => {
      controller.showStatDetails('error')

      expect(controller.modal.show).toBe(true)
      expect(controller.modal.type).toBe('error')
      expect(controller.modal.title).toBe('錯誤狀態的API')
      expect(controller.modal.apis).toHaveLength(1)
      expect(controller.modal.apis[0].status).toBe('error')
    })

    it('should show modal with all APIs', () => {
      controller.showStatDetails('all')

      expect(controller.modal.show).toBe(true)
      expect(controller.modal.type).toBe('all')
      expect(controller.modal.title).toBe('所有API端點')
      expect(controller.modal.apis).toHaveLength(3)
    })

    it('should close modal', () => {
      controller.showStatDetails('all')
      expect(controller.modal.show).toBe(true)

      controller.closeModal()
      expect(controller.modal.show).toBe(false)
      expect(controller.modal.type).toBe('all')
      expect(controller.modal.apis).toEqual([])
      expect(controller.modal.title).toBe('')
    })
  })

  // ============================================================================
  // Utility Functions Tests
  // ============================================================================

  describe('Utility Functions', () => {
    describe('getStatusText', () => {
      it('should return correct text for healthy status', () => {
        expect(controller.getStatusText('healthy')).toBe('正常')
      })

      it('should return correct text for warning status', () => {
        expect(controller.getStatusText('warning')).toBe('警告')
      })

      it('should return correct text for error status', () => {
        expect(controller.getStatusText('error')).toBe('錯誤')
      })
    })

    describe('getResponseTimeClass', () => {
      it('should return excellent for < 200ms', () => {
        expect(controller.getResponseTimeClass(100)).toBe('excellent')
        expect(controller.getResponseTimeClass(199)).toBe('excellent')
      })

      it('should return good for 200-499ms', () => {
        expect(controller.getResponseTimeClass(200)).toBe('good')
        expect(controller.getResponseTimeClass(499)).toBe('good')
      })

      it('should return fair for 500-999ms', () => {
        expect(controller.getResponseTimeClass(500)).toBe('fair')
        expect(controller.getResponseTimeClass(999)).toBe('fair')
      })

      it('should return poor for >= 1000ms', () => {
        expect(controller.getResponseTimeClass(1000)).toBe('poor')
        expect(controller.getResponseTimeClass(5000)).toBe('poor')
      })
    })

    describe('getSuccessRateClass', () => {
      it('should return excellent for >= 98%', () => {
        expect(controller.getSuccessRateClass(98)).toBe('excellent')
        expect(controller.getSuccessRateClass(100)).toBe('excellent')
      })

      it('should return good for >= 95%', () => {
        expect(controller.getSuccessRateClass(95)).toBe('good')
        expect(controller.getSuccessRateClass(97)).toBe('good')
      })

      it('should return fair for >= 90%', () => {
        expect(controller.getSuccessRateClass(90)).toBe('fair')
        expect(controller.getSuccessRateClass(94)).toBe('fair')
      })

      it('should return poor for < 90%', () => {
        expect(controller.getSuccessRateClass(89)).toBe('poor')
        expect(controller.getSuccessRateClass(50)).toBe('poor')
      })
    })

    describe('formatTime', () => {
      it('should format date correctly', () => {
        const date = new Date('2024-12-31T12:30:45')
        const formatted = controller.formatTime(date)

        expect(formatted).toContain('12')
        expect(formatted).toContain('30')
        expect(formatted).toContain('45')
      })

      it('should return "未知" for undefined', () => {
        expect(controller.formatTime(undefined)).toBe('未知')
      })
    })

    describe('getCategoryText', () => {
      it('should return correct text for system category', () => {
        expect(controller.getCategoryText('system')).toBe('系統')
      })

      it('should return correct text for auth category', () => {
        expect(controller.getCategoryText('auth')).toBe('認證')
      })

      it('should return correct text for conversation category', () => {
        expect(controller.getCategoryText('conversation')).toBe('對話')
      })

      it('should return correct text for customer category', () => {
        expect(controller.getCategoryText('customer')).toBe('客戶')
      })

      it('should return correct text for team category', () => {
        expect(controller.getCategoryText('team')).toBe('團隊')
      })

      it('should return original value for unknown category', () => {
        expect(controller.getCategoryText('unknown')).toBe('unknown')
      })
    })
  })

  // ============================================================================
  // Methods Tests
  // ============================================================================

  describe('Methods', () => {
    it('should expose all required methods', () => {
      expect(typeof controller.initialize).toBe('function')
      expect(typeof controller.cleanup).toBe('function')
      expect(typeof controller.refreshAll).toBe('function')
      expect(typeof controller.testApi).toBe('function')
      expect(typeof controller.toggleCard).toBe('function')
      expect(typeof controller.showStatDetails).toBe('function')
      expect(typeof controller.closeModal).toBe('function')
      expect(typeof controller.toggleAutoRefresh).toBe('function')
    })
  })
})
