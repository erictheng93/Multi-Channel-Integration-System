import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import type { WaitingConversation } from '@shared/api-contracts'
import ConversationQueueBoard from './ConversationQueueBoard.vue'

const NOW = Date.parse('2026-11-02T10:00:00Z')

const item = (id: string, name: string, minutes: number, team: number | null): WaitingConversation => ({
  conversationId: id,
  customerId: 1,
  customerName: name,
  avatarUrl: null,
  platform: 'line',
  assignedTeamId: team,
  waitingSince: new Date(NOW - minutes * 60_000).toISOString(),
  waitingSeconds: minutes * 60,
  unansweredCount: 1,
  lastCustomerMessage: null
})

const KEY = 'conversation-queue-board-expanded'

// The global test setup stubs localStorage as a no-op, so give these tests a working one
const stubStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v) },
    removeItem: (k: string) => { data.delete(k) },
    clear: () => { data.clear() }
  })
  return data
}

afterEach(() => { vi.unstubAllGlobals() })

const mountBoard = (items: WaitingConversation[], total = items.length) =>
  mount(ConversationQueueBoard, {
    props: {
      items,
      total,
      staleCount: 2,
      staleOpen: false,
      unread: 3,
      now: NOW,
      teamNames: new Map([[1, '客服一組']]),
      teamOpen: new Map([[1, 15], [0, 2]])
    }
  })

describe('ConversationQueueBoard', () => {
  it('starts folded: no chart, a closed toggle', () => {
    stubStorage()
    const wrapper = mountBoard([item('a', '林', 5, 1)])
    expect(wrapper.find('.board').exists()).toBe(false)
    expect(wrapper.find('button[aria-controls="queue-board"]').attributes('aria-expanded')).toBe('false')
  })

  it('opens the chart from the toggle, remembers the choice, and folds it again', async () => {
    const data = stubStorage()
    const wrapper = mountBoard([item('a', '林', 5, 1)])
    const toggle = wrapper.find('button[aria-controls="queue-board"]')
    await toggle.trigger('click')
    expect(wrapper.find('#queue-board').exists()).toBe(true)
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(data.get(KEY)).toBe('true')
    await toggle.trigger('click')
    expect(wrapper.find('.board').exists()).toBe(false)
    expect(data.get(KEY)).toBe('false')
  })

  it('has no toggle when nobody waits', () => {
    stubStorage()
    expect(mountBoard([]).find('button[aria-controls="queue-board"]').exists()).toBe(false)
  })

  it('honours a stored expanded preference on mount', () => {
    stubStorage({ [KEY]: 'true' })
    const wrapper = mountBoard([item('a', '林', 5, 1)])
    expect(wrapper.find('.board').exists()).toBe(true)
    expect(wrapper.find('button[aria-controls="queue-board"]').attributes('aria-expanded')).toBe('true')
  })

  it('stays folded and still works when storage throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') }
    })
    const wrapper = mountBoard([item('a', '林', 5, 1)])
    expect(wrapper.find('.board').exists()).toBe(false)
    await wrapper.find('button[aria-controls="queue-board"]').trigger('click')
    expect(wrapper.find('.board').exists()).toBe(true)
  })

  it('draws one lane per team, the longest wait first, and marks waits past 30 minutes', () => {
    stubStorage({ [KEY]: 'true' })
    const wrapper = mountBoard([item('a', '林', 5, 1), item('b', '王', 90, null), item('c', '張', 45, 1)])
    const names = wrapper.findAll('.lane-title').map(n => n.text())
    expect(names).toEqual(['未指派', '客服一組'])
    expect(wrapper.findAll('.dot')).toHaveLength(3)
    expect(wrapper.findAll('.dot.is-hot')).toHaveLength(2)
  })

  it('opens a conversation from its dot and filters by team from the lane name', async () => {
    stubStorage({ [KEY]: 'true' })
    const wrapper = mountBoard([item('a', '林', 5, 1)])
    await wrapper.find('.dot').trigger('click')
    await wrapper.find('.lane-name').trigger('click')
    expect(wrapper.emitted('open')?.[0]).toEqual(['a'])
    expect(wrapper.emitted('team')?.[0]).toEqual([1])
  })

  it('says so when more are waiting than are drawn, and shows a calm state at zero', () => {
    stubStorage({ [KEY]: 'true' })
    expect(mountBoard([item('a', '林', 5, 1)], 9).text()).toContain('其餘 8 件')
    const calm = mountBoard([])
    expect(calm.find('.board').exists()).toBe(false)
    expect(calm.text()).toContain('都有人回覆了')
  })

  it('observes the time axis even when the lanes only appear after mount', async () => {
    stubStorage({ [KEY]: 'true' })
    const observe = vi.fn()
    const unobserve = vi.fn()
    const disconnect = vi.fn()
    class FakeObserver {
      observe = observe
      unobserve = unobserve
      disconnect = disconnect
    }
    vi.stubGlobal('ResizeObserver', FakeObserver)
    try {
      const wrapper = mountBoard([])
      expect(observe).not.toHaveBeenCalled()
      await wrapper.setProps({ items: [item('a', '林', 5, 1)], total: 1 })
      await nextTick()
      expect(observe).toHaveBeenCalledTimes(1)
      expect(observe.mock.calls[0]?.[0]).toBe(wrapper.find('.axis-track').element)
      await wrapper.setProps({ items: [], total: 0 })
      await nextTick()
      expect(unobserve).toHaveBeenCalledTimes(1)
      wrapper.unmount()
      expect(disconnect).toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('observes the axis as the chart is opened and folded', async () => {
    stubStorage()
    const observe = vi.fn()
    const unobserve = vi.fn()
    class FakeObserver {
      observe = observe
      unobserve = unobserve
      disconnect = vi.fn()
    }
    vi.stubGlobal('ResizeObserver', FakeObserver)
    const wrapper = mountBoard([item('a', '林', 5, 1)])
    expect(observe).not.toHaveBeenCalled()
    await wrapper.find('button[aria-controls="queue-board"]').trigger('click')
    await nextTick()
    expect(observe).toHaveBeenCalledTimes(1)
    await wrapper.find('button[aria-controls="queue-board"]').trigger('click')
    await nextTick()
    expect(unobserve).toHaveBeenCalledTimes(1)
  })

  it('never disables the primary action and hides it when nobody waits', () => {
    expect(mountBoard([item('a', '林', 5, 1)]).find('.btn-primary').attributes('disabled')).toBeUndefined()
    expect(mountBoard([]).find('.btn-primary').exists()).toBe(false)
  })
})
