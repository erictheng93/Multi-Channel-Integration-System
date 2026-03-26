/* eslint-disable vue/one-component-per-file, vue/require-prop-types */
/**
 * API Monitor Integration Tests
 *
 * Full integration tests for the redesigned API Monitor dashboard.
 * Tests component rendering, API fetching, and filter interactions.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, defineComponent } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import ApiMonitor from '@/views/ApiMonitor.vue'

// Mock useAuthStore
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ token: 'test' })
}))

// Mock getBackendUrl
vi.mock('@/config/runtime', () => ({
  getBackendUrl: () => ''
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

function makeMockApiResponse(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      status: 'operational',
      timestamp: new Date().toISOString(),
      stats: {
        totalEndpoints: 2,
        healthyCount: 1,
        warningCount: 1,
        errorCount: 0,
        avgResponseTime: 150
      },
      endpoints: [
        {
          id: 'health',
          endpoint: '/api/system/health',
          method: 'GET',
          category: 'system',
          description: 'System health check',
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
          description: 'User login',
          status: 'warning',
          responseTime: 800,
          avgResponseTime: 750,
          successRate: 95,
          requestCount: 500,
          errorCount: 25,
          lastCheck: new Date().toISOString()
        }
      ],
      infrastructure: [
        { name: 'D1 Database', status: 'operational', latency: 5 }
      ],
      channels: [
        { name: 'LINE', status: 'connected', messageCount: 100 }
      ],
      events: [
        { type: 'info', message: 'System started', timestamp: new Date().toISOString() }
      ],
      ...overrides
    }
  }
}

function setupFetchMock(responseData = makeMockApiResponse()) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(responseData)
  })
}

// Define named stub components so findComponent({ name }) works
const AppLayoutStub = defineComponent({
  name: 'AppLayout',
  template: '<div class="app-layout-stub"><slot /></div>'
})

const ApiHeaderStub = defineComponent({
  name: 'ApiHeader',
  props: ['loading', 'isRefreshing', 'autoRefreshEnabled', 'systemStatus', 'lastUpdated'],
  emits: ['refresh', 'toggle-auto-refresh'],
  template: '<div class="api-header-stub"></div>'
})

const ApiStatsGridStub = defineComponent({
  name: 'ApiStatsGrid',
  props: ['stats'],
  emits: ['stat-click'],
  template: '<div class="api-stats-grid-stub"></div>'
})

const ApiFilterStub = defineComponent({
  name: 'ApiFilter',
  props: ['filters'],
  emits: ['update:filters'],
  template: '<div class="api-filter-stub"></div>'
})

const ApiCardListStub = defineComponent({
  name: 'ApiCardList',
  props: ['endpoints', 'expandedCard'],
  emits: ['toggle-card'],
  template: '<div class="api-card-list-stub"></div>'
})

const ApiModalStub = defineComponent({
  name: 'ApiModal',
  props: ['modalState', 'totalApis'],
  emits: ['close'],
  template: '<div class="api-modal-stub"></div>'
})

const InfrastructureCardStub = defineComponent({
  name: 'InfrastructureCard',
  props: ['infrastructure'],
  template: '<div class="infrastructure-card-stub"></div>'
})

const ChannelIntegrationsCardStub = defineComponent({
  name: 'ChannelIntegrationsCard',
  props: ['channels'],
  template: '<div class="channel-integrations-card-stub"></div>'
})

const RecentEventsCardStub = defineComponent({
  name: 'RecentEventsCard',
  props: ['events'],
  template: '<div class="recent-events-card-stub"></div>'
})

const childStubs = {
  AppLayout: AppLayoutStub,
  ApiHeader: ApiHeaderStub,
  ApiStatsGrid: ApiStatsGridStub,
  ApiFilter: ApiFilterStub,
  ApiCardList: ApiCardListStub,
  ApiModal: ApiModalStub,
  InfrastructureCard: InfrastructureCardStub,
  ChannelIntegrationsCard: ChannelIntegrationsCardStub,
  RecentEventsCard: RecentEventsCardStub
}

/** Flush promises by waiting a short real-time delay + nextTick */
function flushPromises(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(async () => {
      await nextTick()
      resolve()
    }, 50)
  })
}

function mountApiMonitor() {
  return mount(ApiMonitor, {
    global: {
      stubs: childStubs
    }
  })
}

describe('ApiMonitor Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    setupFetchMock()
    // Prevent the auto-refresh setInterval from actually firing
    vi.spyOn(globalThis, 'setInterval').mockReturnValue(999 as unknown as ReturnType<typeof setInterval>)
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render the header (System Status)', async () => {
    const wrapper = mountApiMonitor()
    await flushPromises()

    expect(wrapper.find('.api-header-stub').exists()).toBe(true)
  })

  it('should call /api/system/api-status on mount', async () => {
    mountApiMonitor()
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/system/api-status'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test'
        })
      })
    )
  })

  it('should render child components when API returns data', async () => {
    const wrapper = mountApiMonitor()
    await flushPromises()

    expect(wrapper.find('.api-stats-grid-stub').exists()).toBe(true)
    expect(wrapper.find('.api-filter-stub').exists()).toBe(true)
    expect(wrapper.find('.api-card-list-stub').exists()).toBe(true)
    expect(wrapper.find('.infrastructure-card-stub').exists()).toBe(true)
    expect(wrapper.find('.channel-integrations-card-stub').exists()).toBe(true)
    expect(wrapper.find('.recent-events-card-stub').exists()).toBe(true)
  })

  it('should pass endpoint data to ApiCardList', async () => {
    const wrapper = mountApiMonitor()
    await flushPromises()

    const cardList = wrapper.findComponent({ name: 'ApiCardList' })
    expect(cardList.exists()).toBe(true)
    expect(cardList.props('endpoints')).toHaveLength(2)
  })

  it('should propagate filter updates from ApiFilter', async () => {
    const wrapper = mountApiMonitor()
    await flushPromises()

    const filter = wrapper.findComponent({ name: 'ApiFilter' })
    expect(filter.exists()).toBe(true)

    // Emit a filter update to select only 'system' category
    await filter.vm.$emit('update:filters', {
      status: 'all',
      category: 'system',
      search: ''
    })
    await nextTick()

    // After filter update, ApiCardList should receive only system endpoints
    const cardList = wrapper.findComponent({ name: 'ApiCardList' })
    const passedEndpoints = cardList.props('endpoints') as Array<{ category: string }>
    expect(passedEndpoints).toHaveLength(1)
    expect(passedEndpoints[0].category).toBe('system')
  })

  it('should call fetch again when refresh is triggered', async () => {
    const wrapper = mountApiMonitor()
    await flushPromises()

    const initialCallCount = mockFetch.mock.calls.length
    expect(initialCallCount).toBeGreaterThan(0)

    // Trigger refresh from header
    const header = wrapper.findComponent({ name: 'ApiHeader' })
    expect(header.exists()).toBe(true)
    await header.vm.$emit('refresh')
    await flushPromises()

    expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount)
  })
})
