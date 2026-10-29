import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ActivityOverview } from '@/api/activities'

const restore = vi.hoisted(() => ({ enabled: true }))
vi.mock('@/config/runtime', () => ({ isActivityRestoreEnabled: () => restore.enabled }))

import ActivityStatsCards from './ActivityStatsCards.vue'

function makeOverview(overrides: Partial<ActivityOverview> = {}): ActivityOverview {
  return {
    totalActivities: 100,
    activeUserCount: 2,
    restorableCount: 0,
    actionStats: {
      user_login: 30,
      message_send: 50,
      conversation_close: 20,
    },
    topUsers: [
      { user_name: 'Alice', user_role: 'admin', count: 40 },
      { user_name: 'Bob', user_role: 'agent', count: 30 },
    ],
    dailyStats: [
      { date: '2026-03-19', count: 50 },
      { date: '2026-03-20', count: 50 },
    ],
    period: { days: 7, startDate: '2026-03-13', endDate: '2026-03-20' },
    ...overrides,
  }
}

function mountCards(props: { overview: ActivityOverview | null; loading: boolean }) {
  return mount(ActivityStatsCards, { props })
}

describe('ActivityStatsCards', () => {
  it('renders 4 stat cards when restore is enabled', () => {
    restore.enabled = true
    const wrapper = mountCards({ overview: makeOverview(), loading: false })
    expect(wrapper.findAll('.stat-card')).toHaveLength(4)
  })

  it('hides the restorable card while the restore feature is off', () => {
    restore.enabled = false
    const wrapper = mountCards({ overview: makeOverview({ restorableCount: 9 }), loading: false })
    expect(wrapper.findAll('.stat-card')).toHaveLength(3)
    expect(wrapper.text()).not.toContain('可還原')
    restore.enabled = true
  })

  it('shows skeleton loading state when loading is true', () => {
    const wrapper = mountCards({ overview: null, loading: true })
    expect(wrapper.findAll('.stat-card--skeleton')).toHaveLength(4)
    expect(wrapper.findAll('.shimmer').length).toBeGreaterThan(0)
  })

  it('hides entirely when overview is null and loading is false', () => {
    const wrapper = mountCards({ overview: null, loading: false })
    expect(wrapper.find('.stats-grid').exists()).toBe(false)
  })

  it('displays totalActivities with thousands separators', () => {
    const wrapper = mountCards({ overview: makeOverview({ totalActivities: 1284 }), loading: false })
    expect(wrapper.findAll('.stat-card')[0]!.find('.stat-value').text()).toBe('1,284')
  })

  it('names the most active member with count and role', () => {
    const wrapper = mountCards({ overview: makeOverview(), loading: false })
    const card = wrapper.findAll('.stat-card')[1]!
    expect(card.find('.stat-value').text()).toBe('Alice')
    expect(card.text()).toContain('40 筆')
    expect(card.text()).toContain('管理員')
  })

  it('shows the top action with its share of all activity', () => {
    const wrapper = mountCards({ overview: makeOverview(), loading: false })
    const card = wrapper.findAll('.stat-card')[2]!
    expect(card.find('.stat-value').text()).toBe('訊息發送')
    expect(card.text()).toContain('50 筆，佔 50%')
  })

  it('shows the real restorable count', () => {
    const wrapper = mountCards({ overview: makeOverview({ restorableCount: 7 }), loading: false })
    expect(wrapper.findAll('.stat-card')[3]!.find('.stat-value').text()).toContain('7')
  })

  it('draws one bar per day from dailyStats', () => {
    const wrapper = mountCards({ overview: makeOverview(), loading: false })
    expect(wrapper.findAll('.bars i')).toHaveLength(2)
  })

  it('renders stat-label for each card', () => {
    const wrapper = mountCards({ overview: makeOverview(), loading: false })
    expect(wrapper.findAll('.stat-label')).toHaveLength(4)
  })

  it('shows skeleton cards even when overview is provided if loading is true', () => {
    const wrapper = mountCards({ overview: makeOverview(), loading: true })
    expect(wrapper.findAll('.stat-card--skeleton')).toHaveLength(4)
  })
})
