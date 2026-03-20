import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// No icon imports needed in this component
vi.mock('@/components/icons', () => ({}))

import ActivityFilterPills from './ActivityFilterPills.vue'

interface Filters {
  userId: string
  action: string
  resourceType: string
}

function defaultFilters(): Filters {
  return { userId: '', action: '', resourceType: '' }
}

function mountPills(overrides: {
  filters?: Filters
  dateRange?: string
  customDateRange?: { start: string; end: string }
  users?: Array<{ id: string; name: string; role: string }>
}) {
  return mount(ActivityFilterPills, {
    props: {
      filters: overrides.filters ?? defaultFilters(),
      dateRange: overrides.dateRange ?? 'week',
      customDateRange: overrides.customDateRange ?? { start: '', end: '' },
      users: overrides.users ?? [],
    },
  })
}

describe('ActivityFilterPills', () => {
  it('renders 4 filter selects', () => {
    const wrapper = mountPills({})
    const selects = wrapper.findAll('select')
    expect(selects).toHaveLength(4)
  })

  it('emits apply when user select changes', async () => {
    const users = [{ id: 'u1', name: 'Alice', role: 'agent' }]
    const wrapper = mountPills({ users })
    const selects = wrapper.findAll('select')
    await selects[0]!.setValue('u1')
    expect(wrapper.emitted('apply')).toBeTruthy()
  })

  it('emits apply when action select changes', async () => {
    const wrapper = mountPills({})
    const selects = wrapper.findAll('select')
    await selects[1]!.setValue('message_send')
    expect(wrapper.emitted('apply')).toBeTruthy()
  })

  it('emits apply when resource type select changes', async () => {
    const wrapper = mountPills({})
    const selects = wrapper.findAll('select')
    await selects[2]!.setValue('conversation')
    expect(wrapper.emitted('apply')).toBeTruthy()
  })

  it('emits apply when date range select changes', async () => {
    const wrapper = mountPills({})
    const selects = wrapper.findAll('select')
    await selects[3]!.setValue('month')
    expect(wrapper.emitted('apply')).toBeTruthy()
  })

  it('shows clear link when a filter is active (non-default)', () => {
    const wrapper = mountPills({
      filters: { userId: 'u1', action: '', resourceType: '' },
    })
    expect(wrapper.find('.filter-clear').exists()).toBe(true)
  })

  it('shows clear link when date range is non-default', () => {
    const wrapper = mountPills({ dateRange: 'today' })
    expect(wrapper.find('.filter-clear').exists()).toBe(true)
  })

  it('hides clear link when all filters are default', () => {
    const wrapper = mountPills({
      filters: defaultFilters(),
      dateRange: 'week',
    })
    expect(wrapper.find('.filter-clear').exists()).toBe(false)
  })

  it('emits clear when clear link is clicked', async () => {
    const wrapper = mountPills({
      filters: { userId: 'u1', action: '', resourceType: '' },
    })
    await wrapper.find('.filter-clear').trigger('click')
    expect(wrapper.emitted('clear')).toBeTruthy()
  })

  it('shows custom date inputs when dateRange is custom', () => {
    const wrapper = mountPills({ dateRange: 'custom' })
    expect(wrapper.find('.custom-date-card').exists()).toBe(true)
    const dateInputs = wrapper.findAll('.date-input')
    expect(dateInputs).toHaveLength(2)
  })

  it('hides custom date inputs when dateRange is not custom', () => {
    const wrapper = mountPills({ dateRange: 'week' })
    expect(wrapper.find('.custom-date-card').exists()).toBe(false)
  })

  it('renders user options from users prop', () => {
    const users = [
      { id: 'u1', name: 'Alice', role: 'admin' },
      { id: 'u2', name: 'Bob', role: 'agent' },
    ]
    const wrapper = mountPills({ users })
    const selects = wrapper.findAll('select')
    const userSelect = selects[0]!
    // default "All Users" + 2 users = 3 options
    expect(userSelect.findAll('option')).toHaveLength(3)
  })

  it('emits update:filters with correct payload on action change', async () => {
    const wrapper = mountPills({
      filters: { userId: 'u1', action: '', resourceType: 'message' },
    })
    const selects = wrapper.findAll('select')
    await selects[1]!.setValue('user_login')
    const emitted = wrapper.emitted('update:filters')
    expect(emitted).toBeTruthy()
    expect(emitted![0]![0]).toEqual({ userId: 'u1', action: 'user_login', resourceType: 'message' })
  })
})
