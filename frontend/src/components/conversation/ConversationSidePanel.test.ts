import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ConversationSidePanel from './ConversationSidePanel.vue'
import type { Conversation } from '@/types'

const BASE = Date.parse('2026-11-02T09:00:00Z')
const msg = (senderType: 'customer' | 'agent', minutes: number) => ({ senderType, createdAt: BASE + minutes * 60_000 })

const mountPanel = (messages: ReturnType<typeof msg>[], status = 'open') =>
  mount(ConversationSidePanel, {
    props: {
      conversation: { id: 'c1', status, customer: { id: 1, name: '林志明' }, platform: 'line' } as unknown as Conversation,
      tags: [],
      messageCount: messages.length,
      hasMore: false,
      messages
    }
  })

describe('ConversationSidePanel reply speed', () => {
  it('gives each customer-to-reply wait its own row and labels it', () => {
    const wrapper = mountPanel([msg('customer', 0), msg('agent', 4), msg('customer', 10), msg('agent', 25)], 'closed')
    const rows = wrapper.findAll('.wait')
    expect(rows.map(r => r.find('.wait-line b').text())).toEqual(['4 分', '15 分'])
    expect(wrapper.findAll('.wait.is-pending')).toHaveLength(0)
  })

  it('shows an open wait when the customer spoke last on an open conversation', () => {
    const wrapper = mountPanel([msg('customer', -90), msg('agent', -80), msg('customer', -30)])
    expect(wrapper.find('.wait.is-pending').exists()).toBe(true)
  })

  it('shows nothing for a single message', () => {
    expect(mountPanel([msg('customer', 0)]).find('.waits').exists()).toBe(false)
  })
})

describe('ConversationSidePanel reply state anchor', () => {
  it('counts the open wait up in the waiting tone', () => {
    const wrapper = mountPanel([msg('customer', -90), msg('agent', -80), msg('customer', -30), msg('customer', -29)])
    const hold = wrapper.find('.hold')
    expect(hold.classes()).toContain('hold-waiting')
    expect(hold.find('.hold-k').text()).toBe('客戶在等回覆')
    expect(hold.find('.hold-sub').text()).toContain('2 則來訊未回')
  })

  it('shows how long the last round took once the team has answered', () => {
    const wrapper = mountPanel([msg('customer', -90), msg('agent', -86)])
    const hold = wrapper.find('.hold')
    expect(hold.classes()).toContain('hold-answered')
    expect(hold.find('.hold-fig').text()).toContain('4')
  })

  it('reads as settled when closed, and says who spoke last', () => {
    const answered = mountPanel([msg('customer', 0), msg('agent', 4)], 'closed')
    expect(answered.find('.hold-k').text()).toBe('已結案')
    expect(answered.find('.hold-sub').text()).toBe('客服回覆後結案')
    const unanswered = mountPanel([msg('customer', 0), msg('agent', 4), msg('customer', 9)], 'closed')
    expect(unanswered.find('.hold-sub').text()).toBe('最後一則來訊未回覆就結案了')
  })

  it('shows no anchor before anyone has spoken', () => {
    expect(mountPanel([]).find('.hold').exists()).toBe(false)
  })

  it('shows the customer identity only where the thread header is hidden', () => {
    expect(mountPanel([msg('customer', 0)]).find('.who').exists()).toBe(false)
    const sheet = mount(ConversationSidePanel, {
      props: {
        conversation: { id: 'c1', status: 'open', customer: { id: 1, name: '林志明' }, platform: 'line' } as unknown as Conversation,
        tags: [], messageCount: 1, hasMore: false, messages: [msg('customer', 0)], showWho: true
      }
    })
    expect(sheet.find('.who .name').text()).toBe('林志明')
  })
})

