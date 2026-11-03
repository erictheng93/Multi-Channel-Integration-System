import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NotificationRail from './NotificationRail.vue'

const types = [
  { value: 'new_message', label: '新訊息', total: 14, unread: 1 },
  { value: 'customer_responded', label: '客戶回覆', total: 11, unread: 0 },
  { value: 'mention', label: '提及', total: 6, unread: 0 },
  { value: 'system', label: '系統通知', total: 0, unread: 0 }
]
const priorities = [
  { value: 'urgent', label: '緊急', total: 8, unread: 1 },
  { value: 'high', label: '高', total: 8, unread: 0 },
  { value: 'low', label: '低', total: 0, unread: 0 }
]
const base = {
  unread: 3,
  urgentUnread: 1,
  times: [{ label: '全部', value: 48 }, { label: '今天', value: 7 }],
  types,
  priorities,
  selectedType: '',
  selectedPriority: ''
}

describe('NotificationRail', () => {
  it('shows the unread count and the urgent share', () => {
    const wrapper = mount(NotificationRail, { props: base })
    expect(wrapper.find('.rail-num .ui-num').text()).toBe('3')
    expect(wrapper.find('.rail-hot').text()).toContain('1 則緊急')
    expect(wrapper.findAll('.rail-time dd').map(d => d.text())).toEqual(['48', '7'])
  })

  it('lists types biggest first on one shared scale, skipping empty ones', () => {
    const wrapper = mount(NotificationRail, { props: base })
    const rows = wrapper.findAll('.group')[0]!.findAll('.row')
    expect(rows.map(r => r.find('.name').text())).toEqual(['新訊息', '客戶回覆', '提及'])
    expect(rows[0]?.find('.track i').attributes('style')).toContain('width: 100%')
    expect(rows[2]?.find('.track i').attributes('style')).toContain('width: 42.857')
  })

  it('skips priorities with nothing in them', () => {
    const wrapper = mount(NotificationRail, { props: base })
    expect(wrapper.findAll('.group')[1]!.findAll('.row')).toHaveLength(2)
  })

  it('emits the type and priority that were tapped and marks the chosen ones', async () => {
    const wrapper = mount(NotificationRail, { props: { ...base, selectedType: 'mention', selectedPriority: 'high' } })
    await wrapper.findAll('.group')[0]!.findAll('.row')[0]?.trigger('click')
    await wrapper.findAll('.group')[1]!.findAll('.row')[0]?.trigger('click')
    expect(wrapper.emitted('toggle-type')?.[0]).toEqual(['new_message'])
    expect(wrapper.emitted('toggle-priority')?.[0]).toEqual(['urgent'])
    expect(wrapper.find('.group .row.is-selected .name').text()).toBe('提及')
    expect(wrapper.find('.rail-toggle-text span').text()).toBe('提及 · 高優先級')
  })

  it('names the unread count in the button label', () => {
    const wrapper = mount(NotificationRail, { props: base })
    expect(wrapper.find('.row').attributes('aria-label')).toBe('新訊息 14 則，1 則未讀')
  })

  it('folds the filters behind a toggle that reports its state', async () => {
    const wrapper = mount(NotificationRail, { props: base })
    const toggle = wrapper.find('.rail-toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.classes()).toContain('is-open')
  })
})
