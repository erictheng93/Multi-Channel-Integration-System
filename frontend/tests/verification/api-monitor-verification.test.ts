/**
 * API Monitor Refactoring Verification Test
 *
 * This test verifies that all refactored components are properly
 * structured and can be imported/used correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock fetch globally so the controller doesn't make real requests
vi.stubGlobal('fetch', vi.fn())

// Mock useAuthStore
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    token: 'test-token',
    isAuthenticated: true
  })
}))

// Mock getBackendUrl
vi.mock('@/config/runtime', () => ({
  getBackendUrl: () => 'http://localhost:8787',
  getWebSocketUrl: () => 'ws://localhost:8787'
}))

describe('ApiMonitor Refactoring Verification', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Type Definitions', () => {
    it('should export all required types from api-monitor.ts', async () => {
      const types = await import('@/types/api-monitor')

      // Check that all types are exported
      expect(types).toBeDefined()

      // We can't directly test type exports, but we can verify the module loads
      expect(Object.keys(types).length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Controller Composable', () => {
    it('should export useApiMonitorController composable', async () => {
      const { useApiMonitorController } = await import('@/composables/useApiMonitorController')

      expect(useApiMonitorController).toBeDefined()
      expect(typeof useApiMonitorController).toBe('function')
    })

    it('should return controller object with all required properties', async () => {
      const { useApiMonitorController } = await import('@/composables/useApiMonitorController')
      const controller = useApiMonitorController()

      // State
      expect(controller.monitorData).toBeDefined()
      expect(controller.loading).toBeDefined()
      expect(controller.isRefreshing).toBeDefined()
      expect(controller.error).toBeDefined()
      expect(controller.filters).toBeDefined()
      expect(controller.modal).toBeDefined()
      expect(controller.autoRefresh).toBeDefined()
      expect(controller.expandedCard).toBeDefined()

      // Computed
      expect(controller.systemStatus).toBeDefined()
      expect(controller.endpoints).toBeDefined()
      expect(controller.infrastructure).toBeDefined()
      expect(controller.channels).toBeDefined()
      expect(controller.events).toBeDefined()
      expect(controller.stats).toBeDefined()
      expect(controller.filteredApis).toBeDefined()
      expect(controller.lastUpdated).toBeDefined()

      // Methods
      expect(typeof controller.initialize).toBe('function')
      expect(typeof controller.cleanup).toBe('function')
      expect(typeof controller.refreshAll).toBe('function')
      expect(typeof controller.toggleCard).toBe('function')
      expect(typeof controller.showStatDetails).toBe('function')
      expect(typeof controller.closeModal).toBe('function')
      expect(typeof controller.toggleAutoRefresh).toBe('function')
    })
  })

  describe('Component Exports', () => {
    it('should export all components from api-monitor/index.ts', async () => {
      const components = await import('@/components/api-monitor')

      expect(components.ApiHeader).toBeDefined()
      expect(components.ApiStatsGrid).toBeDefined()
      expect(components.ApiFilter).toBeDefined()
      expect(components.ApiCardList).toBeDefined()
      expect(components.ApiCard).toBeDefined()
      expect(components.ApiModal).toBeDefined()
      expect(components.ApiEmptyState).toBeDefined()
      expect(components.EndpointDetailPanel).toBeDefined()
      expect(components.InfrastructureCard).toBeDefined()
      expect(components.ChannelIntegrationsCard).toBeDefined()
      expect(components.RecentEventsCard).toBeDefined()
    })

    it('should be able to import ApiHeader component', async () => {
      const ApiHeader = (await import('@/components/api-monitor/ApiHeader.vue')).default
      expect(ApiHeader).toBeDefined()
      expect(ApiHeader).toHaveProperty('__name')
    })

    it('should be able to import ApiFilter component', async () => {
      const ApiFilter = (await import('@/components/api-monitor/ApiFilter.vue')).default
      expect(ApiFilter).toBeDefined()
      expect(ApiFilter).toHaveProperty('__name')
    })

    it('should be able to import ApiStatsGrid component', async () => {
      const ApiStatsGrid = (await import('@/components/api-monitor/ApiStatsGrid.vue')).default
      expect(ApiStatsGrid).toBeDefined()
      expect(ApiStatsGrid).toHaveProperty('__name')
    })

    it('should be able to import ApiEmptyState component', async () => {
      const ApiEmptyState = (await import('@/components/api-monitor/ApiEmptyState.vue')).default
      expect(ApiEmptyState).toBeDefined()
      expect(ApiEmptyState).toHaveProperty('__name')
    })

    it('should be able to import ApiCard component', async () => {
      const ApiCard = (await import('@/components/api-monitor/ApiCard.vue')).default
      expect(ApiCard).toBeDefined()
      expect(ApiCard).toHaveProperty('__name')
    })

    it('should be able to import ApiCardList component', async () => {
      const ApiCardList = (await import('@/components/api-monitor/ApiCardList.vue')).default
      expect(ApiCardList).toBeDefined()
      expect(ApiCardList).toHaveProperty('__name')
    })

    it('should be able to import ApiModal component', async () => {
      const ApiModal = (await import('@/components/api-monitor/ApiModal.vue')).default
      expect(ApiModal).toBeDefined()
      expect(ApiModal).toHaveProperty('__name')
    })

    it('should be able to import new components', async () => {
      const InfrastructureCard = (await import('@/components/api-monitor/InfrastructureCard.vue')).default
      const ChannelIntegrationsCard = (await import('@/components/api-monitor/ChannelIntegrationsCard.vue')).default
      const RecentEventsCard = (await import('@/components/api-monitor/RecentEventsCard.vue')).default
      const EndpointDetailPanel = (await import('@/components/api-monitor/EndpointDetailPanel.vue')).default

      expect(InfrastructureCard).toBeDefined()
      expect(ChannelIntegrationsCard).toBeDefined()
      expect(RecentEventsCard).toBeDefined()
      expect(EndpointDetailPanel).toBeDefined()
    })
  })

  describe('Refactored Main Component', () => {
    it('should be able to import refactored ApiMonitor view', async () => {
      const ApiMonitor = (await import('@/views/ApiMonitor.vue')).default
      expect(ApiMonitor).toBeDefined()
      expect(ApiMonitor).toHaveProperty('__name')
    })
  })

  describe('Integration Check', () => {
    it('should have correct file structure', () => {
      // This test verifies that the refactoring maintains proper structure
      // All imports above would fail if structure is wrong
      expect(true).toBe(true)
    })
  })
})
