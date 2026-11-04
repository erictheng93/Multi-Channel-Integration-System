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

describe('AutoReplyStats -- week timetable', () => {
  const weekPlan = {
    days: [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, open: day !== 0, start: 510, end: 1050 })),
    today: 1,
    now: 600,
    replies: [560, 575, 590],
  }

  it('draws one row per weekday, marks today and rests a closed day', () => {
    const wrapper = mount(AutoReplyStats, {
      props: { activeRules: 5, todayReplies: 3, isBusinessHours: true, successRate: null, weekPlan },
    })
    expect(wrapper.findAll('.wrow')).toHaveLength(7)
    expect(wrapper.find('.wrow.is-today .wday').text()).toBe('週一')
    expect(wrapper.findAll('.wrow')[6]?.text()).toContain('休息')
    expect(wrapper.find('.wrow .wtime').text()).toBe('08:30–17:30')
  })

  it('places now on the day scale and one tick per reply sent today', () => {
    const wrapper = mount(AutoReplyStats, {
      props: { activeRules: 5, todayReplies: 3, isBusinessHours: true, successRate: null, weekPlan },
    })
    expect(wrapper.find('.week-now b').text()).toBe('現在 10:00')
    expect(wrapper.findAll('.wtick')).toHaveLength(3)
    expect(wrapper.find('.week').attributes('aria-label')).toContain('週日休息')
  })

  it('asks for a schedule when none is saved', async () => {
    const wrapper = mount(AutoReplyStats, {
      props: { activeRules: 5, todayReplies: 3, isBusinessHours: false, successRate: null, weekPlan: null },
    })
    expect(wrapper.find('.week').exists()).toBe(false)
    await wrapper.find('.lead-empty button').trigger('click')
    expect(wrapper.emitted('open-schedules')).toHaveLength(1)
  })
})
