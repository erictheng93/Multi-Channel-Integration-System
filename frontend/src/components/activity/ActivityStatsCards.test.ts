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
  it('states the total activity count with thousands separators', () => {
    const wrapper = mountCards({ overview: makeOverview({ totalActivities: 1284 }), loading: false })
    expect(wrapper.find('.wk-sum b').text()).toBe('1,284')
  })

  it('states the daily average as a plain fact', () => {
    const wrapper = mountCards({ overview: makeOverview({ dailyStats: [{ date: '2026-03-19', count: 20 }, { date: '2026-03-20', count: 50 }] }), loading: false })
    expect(wrapper.find('.wk-sum').text()).toContain('日均 35 筆')
  })

  it('names the member count and the real restorable count', () => {
    const wrapper = mountCards({ overview: makeOverview({ restorableCount: 7 }), loading: false })
    expect(wrapper.find('.wk-sum').text()).toContain('2 位成員')
    expect(wrapper.find('.wk-sum').text()).toContain('7 筆可還原')
  })

  it('hides the restorable count while the restore feature is off', () => {
    restore.enabled = false
    const wrapper = mountCards({ overview: makeOverview({ restorableCount: 9 }), loading: false })
    expect(wrapper.text()).not.toContain('可還原')
    restore.enabled = true
  })

  it('draws no tiles when there was no activity', () => {
    const wrapper = mountCards({ overview: makeOverview({ totalActivities: 0, dailyStats: [] }), loading: false })
    expect(wrapper.find('.wk-days').exists()).toBe(false)
  })

  it('draws one labelled tile per day from dailyStats and marks the busiest', () => {
    const wrapper = mountCards({ overview: makeOverview({ dailyStats: [{ date: '2026-03-19', count: 20 }, { date: '2026-03-20', count: 50 }] }), loading: false })
    expect(wrapper.findAll('.wk-day')).toHaveLength(2)
    expect(wrapper.find('.wk-day.is-peak .wk-wd').text()).toBe('週五')
  })

  it('flags a day far below the average and names it', () => {
    const wrapper = mountCards({
      overview: makeOverview({ dailyStats: [{ date: '2026-03-18', count: 100 }, { date: '2026-03-19', count: 100 }, { date: '2026-03-20', count: 10 }] }),
      loading: false
    })
    expect(wrapper.find('.wk-day.is-low .wk-flag').text()).toBe('偏少')
    expect(wrapper.find('.wk-note').text()).toContain('僅 10 筆')
  })

  it('shows a busy card while loading', () => {
    const wrapper = mountCards({ overview: null, loading: true })
    expect(wrapper.find('.wk').attributes('aria-busy')).toBe('true')
  })

  it('hides entirely when overview is null and loading is false', () => {
    const wrapper = mountCards({ overview: null, loading: false })
    expect(wrapper.find('.wk').exists()).toBe(false)
  })
})
