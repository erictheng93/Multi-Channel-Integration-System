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
  it('leads with the total activity count with thousands separators', () => {
    const wrapper = mountCards({ overview: makeOverview({ totalActivities: 1284 }), loading: false })
    expect(wrapper.find('.rl-num').text()).toContain('1,284')
  })

  it('draws a ring for the top member and the top action, each against the total', () => {
    const wrapper = mountCards({ overview: makeOverview(), loading: false })
    const text = wrapper.find('.sr-legend').text()
    expect(text).toContain('最活躍：Alice')
    expect(text).toContain('40')
    expect(text).toContain('最常見：訊息發送')
    expect(text).toContain('50')
    expect(wrapper.findAll('.sr-item')).toHaveLength(2)
  })

  it('names the period, the member count and the real restorable count', () => {
    const wrapper = mountCards({ overview: makeOverview({ restorableCount: 7 }), loading: false })
    expect(wrapper.find('.rl-meaning').text()).toBe('近 7 天 · 2 位成員 · 7 筆可還原')
  })

  it('hides the restorable count while the restore feature is off', () => {
    restore.enabled = false
    const wrapper = mountCards({ overview: makeOverview({ restorableCount: 9 }), loading: false })
    expect(wrapper.text()).not.toContain('可還原')
    restore.enabled = true
  })

  it('draws no rings when there was no activity (a share of zero means nothing)', () => {
    const wrapper = mountCards({ overview: makeOverview({ totalActivities: 0, topUsers: [], actionStats: {} }), loading: false })
    expect(wrapper.find('.sr-legend').exists()).toBe(false)
  })

  it('draws one bar per day from dailyStats', () => {
    const wrapper = mountCards({ overview: makeOverview(), loading: false })
    expect(wrapper.findAll('.bars i')).toHaveLength(2)
  })

  it('shows a busy lead while loading', () => {
    const wrapper = mountCards({ overview: null, loading: true })
    expect(wrapper.find('.rl-num').attributes('aria-busy')).toBe('true')
  })

  it('hides entirely when overview is null and loading is false', () => {
    const wrapper = mountCards({ overview: null, loading: false })
    expect(wrapper.find('.stats-grid').exists()).toBe(false)
  })
})
