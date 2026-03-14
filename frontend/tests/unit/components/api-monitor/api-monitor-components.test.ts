/**
 * API Monitor Components Unit Tests
 *
 * Comprehensive test suite for all API monitor components
 * Tests rendering, props, events, and user interactions
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ApiHeader from '@/components/api-monitor/ApiHeader.vue'
import ApiFilter from '@/components/api-monitor/ApiFilter.vue'
import ApiStatsGrid from '@/components/api-monitor/ApiStatsGrid.vue'
import ApiEmptyState from '@/components/api-monitor/ApiEmptyState.vue'
import ApiCard from '@/components/api-monitor/ApiCard.vue'
import MigrationStatus from '@/components/api-monitor/MigrationStatus.vue'
import type { ApiEndpoint, ApiStatistics, FilterState, MigrationStatus as MigrationStatusType } from '@/types/api-monitor'

// ============================================================================
// ApiHeader Component Tests
// ============================================================================

describe('ApiHeader', () => {
  it('should render title and subtitle', () => {
    const wrapper = mount(ApiHeader)

    expect(wrapper.text()).toContain('API 監控儀表板')
    expect(wrapper.text()).toContain('實時監控系統API狀態')
  })

  it('should emit refresh event when refresh button clicked', async () => {
    const wrapper = mount(ApiHeader)
    const refreshBtn = wrapper.findComponent({ name: 'RefreshButton' })

    await refreshBtn.vm.$emit('refresh')

    expect(wrapper.emitted('refresh')).toBeTruthy()
  })

  it('should show loading state', () => {
    const wrapper = mount(ApiHeader, {
      props: { loading: true }
    })

    const refreshBtn = wrapper.findComponent({ name: 'RefreshButton' })
    expect(refreshBtn.props('loading')).toBe(true)
  })

  it('should emit toggle-auto-refresh event', async () => {
    const wrapper = mount(ApiHeader)
    const checkbox = wrapper.find('input[type="checkbox"]')

    await checkbox.setValue(false)

    expect(wrapper.emitted('toggle-auto-refresh')).toBeTruthy()
    expect(wrapper.emitted('toggle-auto-refresh')![0]).toEqual([false])
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

  it('should render all filter controls', () => {
    const wrapper = mount(ApiFilter, {
      props: { modelValue: defaultFilters }
    })

    expect(wrapper.findAll('select')).toHaveLength(2)
    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
  })

  it('should emit update when status filter changes', async () => {
    const wrapper = mount(ApiFilter, {
      props: { modelValue: defaultFilters }
    })

    const statusSelect = wrapper.findAll('select')[0]
    await statusSelect.setValue('healthy')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const emitted = wrapper.emitted('update:modelValue')![0][0] as FilterState
    expect(emitted.status).toBe('healthy')
  })

  it('should emit update when category filter changes', async () => {
    const wrapper = mount(ApiFilter, {
      props: { modelValue: defaultFilters }
    })

    const categorySelect = wrapper.findAll('select')[1]
    await categorySelect.setValue('system')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const emitted = wrapper.emitted('update:modelValue')![0][0] as FilterState
    expect(emitted.category).toBe('system')
  })

  it('should emit update when search changes', async () => {
    const wrapper = mount(ApiFilter, {
      props: { modelValue: defaultFilters }
    })

    const searchInput = wrapper.find('input[type="text"]')
    await searchInput.setValue('test')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const emitted = wrapper.emitted('update:modelValue')![0][0] as FilterState
    expect(emitted.search).toBe('test')
  })
})

// ============================================================================
// ApiStatsGrid Component Tests
// ============================================================================

describe('ApiStatsGrid', () => {
  const mockStats: ApiStatistics = {
    total: 10,
    healthy: 6,
    warning: 3,
    error: 1
  }

  it('should render all stat cards', () => {
    const wrapper = mount(ApiStatsGrid, {
      props: { stats: mockStats }
    })

    expect(wrapper.findAll('.stat-card')).toHaveLength(4)
  })

  it('should display correct stat numbers', () => {
    const wrapper = mount(ApiStatsGrid, {
      props: { stats: mockStats }
    })

    const statNumbers = wrapper.findAll('.stat-number')
    expect(statNumbers[0].text()).toBe('6')
    expect(statNumbers[1].text()).toBe('3')
    expect(statNumbers[2].text()).toBe('1')
    expect(statNumbers[3].text()).toBe('10')
  })

  it('should emit stat-click event when card is clicked', async () => {
    const wrapper = mount(ApiStatsGrid, {
      props: { stats: mockStats }
    })

    const healthyCard = wrapper.findAll('.stat-card')[0]
    await healthyCard.trigger('click')

    expect(wrapper.emitted('stat-click')).toBeTruthy()
    expect(wrapper.emitted('stat-click')![0]).toEqual(['healthy'])
  })

  it('should emit different types for different cards', async () => {
    const wrapper = mount(ApiStatsGrid, {
      props: { stats: mockStats }
    })

    const cards = wrapper.findAll('.stat-card')

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
  const mockApi: ApiEndpoint = {
    id: 'test-1',
    endpoint: '/api/test',
    method: 'GET',
    category: 'system',
    description: 'Test API',
    status: 'healthy',
    responseTime: 150,
    avgResponseTime: 200,
    successRate: 98,
    requestCount: 100,
    errorCount: 2,
    lastCheck: new Date()
  }

  it('should render API information', () => {
    const wrapper = mount(ApiCard, {
      props: { api: mockApi, expanded: false }
    })

    expect(wrapper.text()).toContain('GET')
    expect(wrapper.text()).toContain('/api/test')
    expect(wrapper.text()).toContain('150ms')
    expect(wrapper.text()).toContain('98%')
  })

  it('should apply correct status class', () => {
    const wrapper = mount(ApiCard, {
      props: { api: mockApi, expanded: false }
    })

    expect(wrapper.classes()).toContain('status-healthy')
  })

  it('should emit toggle event when clicked', async () => {
    const wrapper = mount(ApiCard, {
      props: { api: mockApi, expanded: false }
    })

    await wrapper.trigger('click')

    expect(wrapper.emitted('toggle')).toBeTruthy()
    expect(wrapper.emitted('toggle')![0]).toEqual(['test-1'])
  })

  it('should show details when expanded', () => {
    const wrapper = mount(ApiCard, {
      props: { api: mockApi, expanded: true }
    })

    expect(wrapper.find('.api-details').exists()).toBe(true)
    expect(wrapper.text()).toContain('Test API')
    expect(wrapper.text()).toContain('200ms')
  })

  it('should not show details when collapsed', () => {
    const wrapper = mount(ApiCard, {
      props: { api: mockApi, expanded: false }
    })

    expect(wrapper.find('.api-details').exists()).toBe(false)
  })

  it('should emit test event when test button clicked', async () => {
    const wrapper = mount(ApiCard, {
      props: { api: mockApi, expanded: true }
    })

    const testBtn = wrapper.find('.test-btn')
    await testBtn.trigger('click')

    expect(wrapper.emitted('test')).toBeTruthy()
  })

  it('should show error info when api has error', () => {
    const errorApi = {
      ...mockApi,
      status: 'error' as const,
      error: 'Connection timeout',
      errorTime: new Date()
    }

    const wrapper = mount(ApiCard, {
      props: { api: errorApi, expanded: true }
    })

    expect(wrapper.find('.error-info').exists()).toBe(true)
    expect(wrapper.text()).toContain('Connection timeout')
  })
})

// ============================================================================
// MigrationStatus Component Tests
// ============================================================================

describe('MigrationStatus', () => {
  const mockStatus: MigrationStatusType = {
    rolloutPercentage: 100,
    websocketEnabled: true,
    durableObjectsAvailable: true,
    migrationStrategy: 'gradual',
    lastCheck: new Date()
  }

  it('should render migration status', () => {
    const wrapper = mount(MigrationStatus, {
      props: { status: mockStatus }
    })

    expect(wrapper.text()).toContain('WebSocket 遷移狀態')
    expect(wrapper.text()).toContain('100%')
  })

  it('should show correct progress bar width', () => {
    const wrapper = mount(MigrationStatus, {
      props: { status: mockStatus }
    })

    const progressFill = wrapper.find('.progress-fill')
    expect(progressFill.attributes('style')).toContain('width: 100%')
  })

  it('should show enabled status when websocket is enabled', () => {
    const wrapper = mount(MigrationStatus, {
      props: { status: mockStatus }
    })

    expect(wrapper.text()).toContain(' 已啟用')
  })

  it('should show disabled status when websocket is disabled', () => {
    const disabledStatus = {
      ...mockStatus,
      websocketEnabled: false,
      durableObjectsAvailable: false
    }

    const wrapper = mount(MigrationStatus, {
      props: { status: disabledStatus }
    })

    expect(wrapper.text()).toContain(' 未啟用')
  })

  it('should display migration strategy', () => {
    const wrapper = mount(MigrationStatus, {
      props: { status: mockStatus }
    })

    expect(wrapper.text()).toContain('漸進式')
  })
})

// ============================================================================
// Summary Tests
// ============================================================================

describe('Component Integration', () => {
  it('all components should be importable', async () => {
    const components = await import('@/components/api-monitor')

    expect(components.ApiHeader).toBeDefined()
    expect(components.ApiFilter).toBeDefined()
    expect(components.ApiStatsGrid).toBeDefined()
    expect(components.ApiCard).toBeDefined()
    expect(components.ApiCardList).toBeDefined()
    expect(components.ApiModal).toBeDefined()
    expect(components.MigrationStatus).toBeDefined()
    expect(components.ApiEmptyState).toBeDefined()
  })
})
