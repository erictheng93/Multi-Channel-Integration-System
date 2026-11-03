import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NotificationMosaic from './NotificationMosaic.vue'

const rows = [
  { value: 'new_message', label: '新訊息', total: 14, unread: 1 },
  { value: 'customer_responded', label: '客戶回覆', total: 11, unread: 0 },
  { value: 'conversation_assigned', label: '對話指派', total: 9, unread: 1 },
  { value: 'mention', label: '提及', total: 6, unread: 0 },
  { value: 'system', label: '系統通知', total: 0, unread: 0 }
]

describe('NotificationMosaic', () => {
  it('lists the types biggest first, skipping empty ones, on one shared scale', () => {
    const wrapper = mount(NotificationMosaic, { props: { rows, selected: '' } })
    const types = wrapper.findAll('.type')
    expect(types.map(t => t.find('.type-name').text())).toEqual(['新訊息', '客戶回覆', '對話指派', '提及'])
    const stretches = wrapper.findAll('.mix i')
    expect(stretches).toHaveLength(4)
    expect(stretches[0]?.attributes('style')).toContain('flex: 14 1 0')
    expect(stretches[3]?.attributes('style')).toContain('flex: 6 1 0')
  })

  it('toggles a type from its row and marks the chosen one', async () => {
    const wrapper = mount(NotificationMosaic, { props: { rows, selected: 'mention' } })
    await wrapper.findAll('.type')[0]?.trigger('click')
    expect(wrapper.emitted('toggle')?.[0]).toEqual(['new_message'])
    expect(wrapper.find('.type.is-selected .type-name').text()).toBe('提及')
  })

  it('names the unread count in the button label', () => {
    const wrapper = mount(NotificationMosaic, { props: { rows, selected: '' } })
    expect(wrapper.find('.type').attributes('aria-label')).toBe('新訊息 14 則，1 則未讀')
  })
})
