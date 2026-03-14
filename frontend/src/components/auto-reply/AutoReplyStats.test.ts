import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AutoReplyStats from './AutoReplyStats.vue'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function mountStats(props: {
  activeRules?: number
  todayReplies?: number
  isBusinessHours?: boolean
  successRate?: number
}) {
  return mount(AutoReplyStats, {
    props: {
      activeRules: props.activeRules ?? 5,
      todayReplies: props.todayReplies ?? 42,
      isBusinessHours: props.isBusinessHours ?? true,
      successRate: props.successRate ?? 93,
    },
  })
}

// ===========================================================================
// Rendering
// ===========================================================================

describe('AutoReplyStats -- rendering', () => {
  it('renders 4 stat cards', () => {
    const wrapper = mountStats({})
    const cards = wrapper.findAll('.stat-card')
    expect(cards).toHaveLength(4)
  })

  it('displays activeRules value', () => {
    const wrapper = mountStats({ activeRules: 12 })
    const card = wrapper.find('.stat-card--rules')
    expect(card.find('.stat-value').text()).toBe('12')
  })

  it('displays todayReplies value', () => {
    const wrapper = mountStats({ todayReplies: 99 })
    const card = wrapper.find('.stat-card--replies')
    expect(card.find('.stat-value').text()).toBe('99')
  })

  it('displays successRate with % suffix', () => {
    const wrapper = mountStats({ successRate: 87 })
    const card = wrapper.find('.stat-card--rate')
    expect(card.find('.stat-value').text()).toBe('87%')
  })
})

// ===========================================================================
// Business hours display
// ===========================================================================

describe('AutoReplyStats -- business hours', () => {
  it('shows business hours text when isBusinessHours is true', () => {
    const wrapper = mountStats({ isBusinessHours: true })
    const card = wrapper.find('.stat-card--hours')
    expect(card.find('.stat-value').text()).toContain('營業中')
  })

  it('shows non-business hours text when isBusinessHours is false', () => {
    const wrapper = mountStats({ isBusinessHours: false })
    const card = wrapper.find('.stat-card--hours')
    expect(card.find('.stat-value').text()).toContain('非營業時間')
  })

  it('applies text-amber class when isBusinessHours is true', () => {
    const wrapper = mountStats({ isBusinessHours: true })
    const value = wrapper.find('.stat-card--hours .stat-value')
    expect(value.classes()).toContain('text-amber')
  })

  it('applies text-red class when isBusinessHours is false', () => {
    const wrapper = mountStats({ isBusinessHours: false })
    const value = wrapper.find('.stat-card--hours .stat-value')
    expect(value.classes()).toContain('text-red')
  })
})
