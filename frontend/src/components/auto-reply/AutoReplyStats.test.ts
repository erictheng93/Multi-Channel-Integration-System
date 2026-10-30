import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AutoReplyStats from './AutoReplyStats.vue'

function mountStats(props: {
  activeRules?: number
  totalRules?: number
  todayReplies?: number
  todayFailed?: number
  isBusinessHours?: boolean
  successRate?: number | null
}) {
  return mount(AutoReplyStats, {
    props: {
      activeRules: props.activeRules ?? 5,
      totalRules: props.totalRules,
      todayReplies: props.todayReplies ?? 42,
      todayFailed: props.todayFailed,
      isBusinessHours: props.isBusinessHours ?? true,
      successRate: props.successRate === undefined ? 93 : props.successRate,
    },
  })
}

describe('AutoReplyStats -- lead', () => {
  it('leads with today replies as the big number', () => {
    const wrapper = mountStats({ todayReplies: 99 })
    expect(wrapper.find('.lead-num').text()).toContain('99')
  })

  it('draws one arc per real ratio: active rules and successful replies', () => {
    const wrapper = mountStats({ activeRules: 5, totalRules: 6, todayReplies: 47, todayFailed: 1 })
    const label = wrapper.find('[role="img"]').attributes('aria-label') ?? ''
    expect(label).toContain('啟用規則 5')
    expect(label).toContain('共 6')
    expect(label).toContain('今日回覆成功 47')
    expect(label).toContain('共 48')
  })

  it('omits rings that have no data behind them', () => {
    const wrapper = mountStats({ successRate: null })
    expect(wrapper.find('[role="img"]').exists()).toBe(false)
  })
})

describe('AutoReplyStats -- business hours', () => {
  it('shows business hours text when isBusinessHours is true', () => {
    const wrapper = mountStats({ isBusinessHours: true })
    expect(wrapper.find('.hours-state').text()).toContain('營業中')
    expect(wrapper.find('.hours-state').classes()).toContain('is-open')
  })

  it('shows non-business hours text when isBusinessHours is false', () => {
    const wrapper = mountStats({ isBusinessHours: false })
    expect(wrapper.find('.hours-state').text()).toContain('非營業時間')
    expect(wrapper.find('.hours-state').classes()).toContain('is-closed')
  })
})
