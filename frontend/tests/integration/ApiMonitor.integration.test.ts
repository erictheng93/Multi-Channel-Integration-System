/**
 * API Monitor Integration Tests
 *
 * Full integration tests for the API Monitor feature
 * Tests complete user workflows and component interactions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ApiMonitorRefactored from '@/views/ApiMonitor.refactored.vue'

// Mock fetch globally
global.fetch = vi.fn()

describe('ApiMonitor Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock successful API responses
    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/system/api-status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              endpoints: [
                {
                  id: 'health',
                  endpoint: '/api/system/health',
                  method: 'GET',
                  category: 'system',
                  description: '系統健康檢查',
                  status: 'healthy',
                  responseTime: 100,
                  avgResponseTime: 120,
                  successRate: 100,
                  requestCount: 1000,
                  errorCount: 0,
                  lastCheck: new Date().toISOString()
                },
                {
                  id: 'auth-login',
                  endpoint: '/api/auth/login',
                  method: 'POST',
                  category: 'auth',
                  description: '用戶登入',
                  status: 'warning',
                  responseTime: 800,
                  avgResponseTime: 750,
                  successRate: 95,
                  requestCount: 500,
                  errorCount: 25,
                  lastCheck: new Date().toISOString()
                }
              ]
            }
          })
        })
      }

      if (url.includes('/api/websocket/migration-status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            rolloutPercentage: 100,
            websocketEnabled: true,
            durableObjectsAvailable: true,
            migrationStrategy: 'gradual'
          })
        })
      }

      return Promise.reject(new Error('Unknown endpoint'))
    })
  })

  it('should render the main component', () => {
    const wrapper = mount(ApiMonitorRefactored, {
      global: {
        stubs: {
          AppLayout: {
            template: '<div class="app-layout-stub"><slot /></div>'
          }
        }
      }
    })

    expect(wrapper.find('.api-monitor').exists()).toBe(true)
  })

  it('should load and display API status on mount', async () => {
    const wrapper = mount(ApiMonitorRefactored, {
      global: {
        stubs: {
          AppLayout: {
            template: '<div class="app-layout-stub"><slot /></div>'
          }
        }
      }
    })

    // Wait for initialization
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/system/api-status')
    )
  })

  it('should display statistics grid', () => {
    const wrapper = mount(ApiMonitorRefactored, {
      global: {
        stubs: {
          AppLayout: {
            template: '<div class="app-layout-stub"><slot /></div>'
          }
        }
      }
    })

    const statsGrid = wrapper.findComponent({ name: 'ApiStatsGrid' })
    expect(statsGrid.exists()).toBe(true)
  })

  it('should display filter component', () => {
    const wrapper = mount(ApiMonitorRefactored, {
      global: {
        stubs: {
          AppLayout: {
            template: '<div class="app-layout-stub"><slot /></div>'
          }
        }
      }
    })

    const filter = wrapper.findComponent({ name: 'ApiFilter' })
    expect(filter.exists()).toBe(true)
  })

  it('should display migration status', () => {
    const wrapper = mount(ApiMonitorRefactored, {
      global: {
        stubs: {
          AppLayout: {
            template: '<div class="app-layout-stub"><slot /></div>'
          }
        }
      }
    })

    const migrationStatus = wrapper.findComponent({ name: 'MigrationStatus' })
    expect(migrationStatus.exists()).toBe(true)
  })

  it('should handle refresh action', async () => {
    const wrapper = mount(ApiMonitorRefactored, {
      global: {
        stubs: {
          AppLayout: {
            template: '<div class="app-layout-stub"><slot /></div>'
          }
        }
      }
    })

    // Wait for initial load
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    // Get initial call count
    const initialCallCount = (global.fetch as any).mock.calls.length

    // Find the header component
    const header = wrapper.findComponent({ name: 'ApiHeader' })

    // Trigger refresh
    await header.vm.$emit('refresh')
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 150))

    // Should have made additional calls
    expect((global.fetch as any).mock.calls.length).toBeGreaterThan(initialCallCount)
  })
})
