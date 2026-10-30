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

  it('shows the real figures once: active rules as pips, failed replies as text', () => {
    const wrapper = mountStats({ activeRules: 5, totalRules: 6, todayReplies: 47, todayFailed: 1 })
    const labels = wrapper.findAll('[role="img"]').map((n) => n.attributes('aria-label') ?? '').join('|')
    expect(labels).toContain('啟用 5 條，共 6 條')
    expect(wrapper.text()).toContain('1 則失敗')
  })

  it('omits the result bar when nothing was attempted', () => {
    const wrapper = mountStats({ successRate: null })
    const labels = wrapper.findAll('[role="img"]').map((n) => n.attributes('aria-label') ?? '').join('|')
    expect(labels).not.toContain('成功')
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
