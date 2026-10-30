import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ActivityOverview } from '@/api/activities'
import ActivityInsights from './ActivityInsights.vue'

const overview = {
  totalActivities: 100,
  activeUserCount: 2,
  restorableCount: 0,
  actionStats: { message_send: 50, user_login: 30, conversation_close: 20 },
  topUsers: [{ user_name: 'Alice', user_role: 'admin', count: 40 }],
  dailyStats: [],
  period: { days: 7, startDate: '', endDate: '' },
} as ActivityOverview

describe('ActivityInsights', () => {
  it('ranks actions by count and members by activity', () => {
    const wrapper = mount(ActivityInsights, { props: { overview } })
    const rows = wrapper.findAll('.ins-row')
    expect(rows[0]?.text()).toContain('50')
    expect(rows[0]?.text()).toContain('訊息發送')
    expect(wrapper.text()).toContain('Alice')
  })

  it('emits the action key to filter by, and clears it when the active row is pressed', async () => {
    const wrapper = mount(ActivityInsights, { props: { overview, activeAction: 'user_login' } })
    await wrapper.findAll('.ins-row')[0]?.trigger('click')
    expect(wrapper.emitted('filter-action')?.[0]).toEqual(['message_send'])
    await wrapper.findAll('.ins-row')[1]?.trigger('click')
    expect(wrapper.emitted('filter-action')?.[1]).toEqual([''])
  })

  it('renders nothing without data', () => {
    const wrapper = mount(ActivityInsights, { props: { overview: null } })
    expect(wrapper.find('.insights').exists()).toBe(false)
  })
})
