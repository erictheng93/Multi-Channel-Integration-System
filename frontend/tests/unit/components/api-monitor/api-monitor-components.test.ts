/**
 * API Monitor Components Unit Tests
 *
 * Tests rendering, props, events, and user interactions
 * for the redesigned API monitor dashboard components.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ApiHeader from '@/components/api-monitor/ApiHeader.vue'
import ApiFilter from '@/components/api-monitor/ApiFilter.vue'
import ApiStatsGrid from '@/components/api-monitor/ApiStatsGrid.vue'
import ApiEmptyState from '@/components/api-monitor/ApiEmptyState.vue'
import ApiCard from '@/components/api-monitor/ApiCard.vue'
import type { ApiEndpoint, ApiStatistics, FilterState } from '@/types/api-monitor'

// ============================================================================
// ApiHeader Component Tests
// ============================================================================

describe('ApiHeader', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should render title', () => {
    const wrapper = mount(ApiHeader)

    expect(wrapper.text()).toContain('System Status')
  })

  it('should emit refresh event when refresh button clicked', async () => {
    const wrapper = mount(ApiHeader)
    // The refresh button is the last button in the header
    const buttons = wrapper.findAll('button')
    const refreshBtn = buttons[buttons.length - 1]
    await refreshBtn.trigger('click')

    expect(wrapper.emitted('refresh')).toBeTruthy()
  })

  it('should show operational status badge by default', () => {
    const wrapper = mount(ApiHeader)

    expect(wrapper.text()).toContain('Operational')
  })

  it('should show degraded status badge', () => {
    const wrapper = mount(ApiHeader, {
      props: { systemStatus: 'degraded' }
    })

    expect(wrapper.text()).toContain('Degraded')
  })

  it('should emit toggle-auto-refresh event', async () => {
    const wrapper = mount(ApiHeader)
    // The auto-refresh toggle is the first button (contains "Auto" text)
    const autoBtn = wrapper.findAll('button')[0]
    await autoBtn.trigger('click')

    expect(wrapper.emitted('toggle-auto-refresh')).toBeTruthy()
  })

  it('should accept loading prop', () => {
    const wrapper = mount(ApiHeader, {
      props: { loading: true }
    })

    expect(wrapper.props('loading')).toBe(true)
  })
})

// ============================================================================
// ApiFilter Component Tests
// ============================================================================

describe('ApiFilter', () => {
  const defaultFilters: FilterState = {
    status: 'all',
    category: 'all',
    search: ''
  }

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should render filter pills and search input', () => {
    const wrapper = mount(ApiFilter, {
      props: { filters: defaultFilters }
    })

    expect(wrapper.findAll('button').length).toBeGreaterThan(0)
    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
  })

  it('should emit update:filters when status pill is clicked', async () => {
    const wrapper = mount(ApiFilter, {
      props: { filters: defaultFilters }
    })

    // Find the "Healthy" pill button
    const buttons = wrapper.findAll('button')
    const healthyBtn = buttons.find(btn => btn.text() === 'Healthy')
    expect(healthyBtn).toBeDefined()
    await healthyBtn!.trigger('click')

    expect(wrapper.emitted('update:filters')).toBeTruthy()
    const emitted = wrapper.emitted('update:filters')![0][0] as FilterState
    expect(emitted.status).toBe('healthy')
  })

  it('should emit update:filters when category pill is clicked', async () => {
    const wrapper = mount(ApiFilter, {
      props: { filters: defaultFilters }
    })

    const buttons = wrapper.findAll('button')
    const systemBtn = buttons.find(btn => btn.text() === 'System')
    expect(systemBtn).toBeDefined()
    await systemBtn!.trigger('click')

    expect(wrapper.emitted('update:filters')).toBeTruthy()
    const emitted = wrapper.emitted('update:filters')![0][0] as FilterState
    expect(emitted.category).toBe('system')
  })

  it('should emit update:filters when search input changes', async () => {
    const wrapper = mount(ApiFilter, {
      props: { filters: defaultFilters }
    })

    const searchInput = wrapper.find('input[type="text"]')
    // Trigger native input event
    const inputEl = searchInput.element as HTMLInputElement
    inputEl.value = 'test'
    await searchInput.trigger('input')

    expect(wrapper.emitted('update:filters')).toBeTruthy()
  })
})

// ============================================================================
// ApiStatsGrid Component Tests
// ============================================================================

describe('ApiStatsGrid', () => {
  const mockStats: ApiStatistics = {
    totalEndpoints: 10,
    healthyCount: 6,
    warningCount: 3,
    errorCount: 1,
    avgResponseTime: 150
  }

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should display stat values', () => {
    const wrapper = mount(ApiStatsGrid, {
      props: { stats: mockStats }
    })

    // The component renders stats as text content
    expect(wrapper.text()).toContain('6')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('1')
    expect(wrapper.text()).toContain('150')
  })

  it('should display labels', () => {
    const wrapper = mount(ApiStatsGrid, {
      props: { stats: mockStats }
    })

    expect(wrapper.text()).toContain('Healthy')
    expect(wrapper.text()).toContain('Warnings')
    expect(wrapper.text()).toContain('Errors')
    expect(wrapper.text()).toContain('Avg Response')
  })

  it('should emit stat-click events when cards are clicked', async () => {
    const wrapper = mount(ApiStatsGrid, {
      props: { stats: mockStats }
    })

    // Multi-root component: 4 cards rendered as siblings inside a VTU wrapper div
    // Each card has a bg-white class and a click handler
    const cards = wrapper.findAll('.bg-white')
    expect(cards).toHaveLength(4)

    await cards[0].trigger('click')
    expect(wrapper.emitted('stat-click')![0]).toEqual(['healthy'])

    await cards[1].trigger('click')
    expect(wrapper.emitted('stat-click')![1]).toEqual(['warning'])

    await cards[2].trigger('click')
    expect(wrapper.emitted('stat-click')![2]).toEqual(['error'])

    await cards[3].trigger('click')
    expect(wrapper.emitted('stat-click')![3]).toEqual(['all'])
  })
})

// ============================================================================
// ApiEmptyState Component Tests
// ============================================================================

describe('ApiEmptyState', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should render default message', () => {
    const wrapper = mount(ApiEmptyState)

    expect(wrapper.text()).toContain('未找到匹配的API')
    expect(wrapper.text()).toContain('請調整篩選條件或搜索關鍵詞')
  })

  it('should render custom title', () => {
    const wrapper = mount(ApiEmptyState, {
      props: { title: 'Custom Title' }
    })

    expect(wrapper.text()).toContain('Custom Title')
  })

  it('should render custom message', () => {
    const wrapper = mount(ApiEmptyState, {
      props: { message: 'Custom Message' }
    })

    expect(wrapper.text()).toContain('Custom Message')
  })
})

// ============================================================================
// ApiCard Component Tests
// ============================================================================

describe('ApiCard', () => {
  const mockEndpoint: ApiEndpoint = {
    id: 'test-1',
    endpoint: '/api/test',
    method: 'GET',
    category: 'system',
    description: 'Test API',
    status: 'healthy',
    responseTime: 150,
    avgResponseTime: 200,
    p50ResponseTime: 120,
    successRate: 98,
    requestCount: 100,
    errorCount: 2,
    statusCodes: { '200': 98, '500': 2 },
    lastCheck: '2026-03-26T00:00:00Z'
  }

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should render endpoint information', () => {
    const wrapper = mount(ApiCard, {
      props: { endpoint: mockEndpoint, expanded: false }
    })

    expect(wrapper.text()).toContain('GET')
    expect(wrapper.text()).toContain('/api/test')
    expect(wrapper.text()).toContain('150ms')
    expect(wrapper.text()).toContain('98%')
  })

  it('should emit toggle event when clicked', async () => {
    const wrapper = mount(ApiCard, {
      props: { endpoint: mockEndpoint, expanded: false }
    })

    await wrapper.trigger('click')

    expect(wrapper.emitted('toggle')).toBeTruthy()
  })

  it('should show EndpointDetailPanel when expanded', () => {
    const wrapper = mount(ApiCard, {
      props: { endpoint: mockEndpoint, expanded: true }
    })

    // EndpointDetailPanel is rendered when expanded
    expect(wrapper.findComponent({ name: 'EndpointDetailPanel' }).exists()).toBe(true)
  })

  it('should not show EndpointDetailPanel when collapsed', () => {
    const wrapper = mount(ApiCard, {
      props: { endpoint: mockEndpoint, expanded: false }
    })

    expect(wrapper.findComponent({ name: 'EndpointDetailPanel' }).exists()).toBe(false)
  })

  it('should show chevron rotation when expanded', () => {
    const wrapper = mount(ApiCard, {
      props: { endpoint: mockEndpoint, expanded: true }
    })

    const svg = wrapper.find('svg')
    expect(svg.classes()).toContain('rotate-90')
  })
})

// ============================================================================
// Component Integration
// ============================================================================

describe('Component Integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('all components should be importable', async () => {
    const components = await import('@/components/api-monitor')

    expect(components.ApiHeader).toBeDefined()
    expect(components.ApiFilter).toBeDefined()
    expect(components.ApiStatsGrid).toBeDefined()
    expect(components.ApiCard).toBeDefined()
    expect(components.ApiCardList).toBeDefined()
    expect(components.ApiModal).toBeDefined()
    expect(components.ApiEmptyState).toBeDefined()
    expect(components.EndpointDetailPanel).toBeDefined()
    expect(components.InfrastructureCard).toBeDefined()
    expect(components.ChannelIntegrationsCard).toBeDefined()
    expect(components.RecentEventsCard).toBeDefined()
  })
})
