import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ActivityOverview } from '@/api/activities'

import ActivityStatsCards from './ActivityStatsCards.vue'

function makeOverview(overrides: Partial<ActivityOverview> = {}): ActivityOverview {
  return {
    totalActivities: 100,
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
  it('renders 4 stat cards when overview data is provided', () => {
    const wrapper = mountCards({ overview: makeOverview(), loading: false })
    const cards = wrapper.findAll('.stat-card')
    expect(cards).toHaveLength(4)
  })

  it('shows skeleton loading state when loading is true', () => {
    const wrapper = mountCards({ overview: null, loading: true })
    const skeletons = wrapper.findAll('.stat-card--skeleton')
    expect(skeletons).toHaveLength(4)
    const shimmer = wrapper.findAll('.shimmer')
    expect(shimmer.length).toBeGreaterThan(0)
  })

  it('hides entirely when overview is null and loading is false', () => {
    const wrapper = mountCards({ overview: null, loading: false })
    expect(wrapper.find('.stats-grid').exists()).toBe(false)
  })

  it('displays correct totalActivities value', () => {
    const wrapper = mountCards({ overview: makeOverview({ totalActivities: 42 }), loading: false })
    const cards = wrapper.findAll('.stat-card')
    expect(cards[0]!.find('.stat-value').text()).toBe('42')
  })

  it('displays correct topUsers count', () => {
    const overview = makeOverview({
      topUsers: [
        { user_name: 'Alice', user_role: 'admin', count: 10 },
        { user_name: 'Bob', user_role: 'agent', count: 5 },
        { user_name: 'Carol', user_role: 'agent', count: 3 },
      ],
    })
    const wrapper = mountCards({ overview, loading: false })
    const cards = wrapper.findAll('.stat-card')
    expect(cards[1]!.find('.stat-value').text()).toBe('3')
  })

  it('displays correct login count', () => {
    const overview = makeOverview({
      actionStats: { user_login: 17, message_send: 5 },
    })
    const wrapper = mountCards({ overview, loading: false })
    const cards = wrapper.findAll('.stat-card')
    expect(cards[3]!.find('.stat-value').text()).toBe('17')
  })

  it('displays 0 logins when user_login is absent from actionStats', () => {
    const overview = makeOverview({
      actionStats: { message_send: 50 },
    })
    const wrapper = mountCards({ overview, loading: false })
    const cards = wrapper.findAll('.stat-card')
    expect(cards[3]!.find('.stat-value').text()).toBe('0')
  })

  it('renders stat-label for each card', () => {
    const wrapper = mountCards({ overview: makeOverview(), loading: false })
    const labels = wrapper.findAll('.stat-label')
    expect(labels).toHaveLength(4)
  })

  it('shows skeleton cards even when overview is provided if loading is true', () => {
    const wrapper = mountCards({ overview: makeOverview(), loading: true })
    const skeletons = wrapper.findAll('.stat-card--skeleton')
    expect(skeletons).toHaveLength(4)
  })
})
