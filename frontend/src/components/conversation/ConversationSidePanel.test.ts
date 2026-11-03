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
  it('gives each customer-to-reply wait its own bar and labels it', () => {
    const wrapper = mountPanel([msg('customer', 0), msg('agent', 4), msg('customer', 10), msg('agent', 25)], 'closed')
    const rows = wrapper.findAll('.wait')
    expect(rows.map(r => r.find('.wait-val').text())).toEqual(['4 分', '15 分'])
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
