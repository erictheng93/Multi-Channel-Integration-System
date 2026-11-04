import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ConversationWaitStrip from './ConversationWaitStrip.vue'

const ago = (minutes: number, senderType: 'customer' | 'agent') => ({ senderType, createdAt: Date.now() - minutes * 60_000 })

describe('ConversationWaitStrip', () => {
  it('shows the unanswered run and opens the customer sheet on tap', async () => {
    const wrapper = mount(ConversationWaitStrip, { props: { messages: [ago(30, 'agent'), ago(12, 'customer'), ago(11, 'customer')] } })
    expect(wrapper.text()).toContain('已等 12 分')
    expect(wrapper.text()).toContain('2 則未回')
    await wrapper.trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('is absent when the agent spoke last, or the conversation is closed', () => {
    expect(mount(ConversationWaitStrip, { props: { messages: [ago(12, 'customer'), ago(5, 'agent')] } }).find('button').exists()).toBe(false)
    expect(mount(ConversationWaitStrip, { props: { messages: [ago(12, 'customer')], closed: true } }).find('button').exists()).toBe(false)
  })

  it('does not start a wait for a thanks or sticker after an agent reply', () => {
    const thanks = { ...ago(5, 'customer'), messageType: 'text', content: '謝謝' }
    const sticker = { ...ago(4, 'customer'), messageType: 'sticker' }
    expect(mount(ConversationWaitStrip, { props: { messages: [ago(30, 'customer'), ago(20, 'agent'), thanks, sticker] } }).find('button').exists()).toBe(false)
  })

  it('counts from the real question that follows a thanks', () => {
    const thanks = { ...ago(15, 'customer'), messageType: 'text', content: '謝謝' }
    const ask = { ...ago(9, 'customer'), messageType: 'text', content: '那可以退貨嗎' }
    const wrapper = mount(ConversationWaitStrip, { props: { messages: [ago(30, 'agent'), thanks, ask] } })
    expect(wrapper.text()).toContain('已等 9 分')
    expect(wrapper.text()).toContain('1 則未回')
  })
})
