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
  it('lays the three biggest types in the top band and the rest below, skipping empty types', () => {
    const wrapper = mount(NotificationMosaic, { props: { rows, selected: '' } })
    const bands = wrapper.findAll('.band')
    expect(bands).toHaveLength(2)
    expect(bands[0]?.findAll('.tile').map(t => t.find('.tile-name').text())).toEqual(['新訊息', '客戶回覆', '對話指派'])
    expect(bands[1]?.findAll('.tile')).toHaveLength(1)
  })

  it('toggles a type from its tile and marks the chosen one', async () => {
    const wrapper = mount(NotificationMosaic, { props: { rows, selected: 'mention' } })
    await wrapper.findAll('.tile')[0]?.trigger('click')
    expect(wrapper.emitted('toggle')?.[0]).toEqual(['new_message'])
    expect(wrapper.find('.tile.is-selected .tile-name').text()).toBe('提及')
  })

  it('names the unread count in the button label', () => {
    const wrapper = mount(NotificationMosaic, { props: { rows, selected: '' } })
    expect(wrapper.find('.tile').attributes('aria-label')).toBe('新訊息 14 則，1 則未讀')
  })
})
