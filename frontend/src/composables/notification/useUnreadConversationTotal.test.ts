import { describe, it, expect, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import { diffUnreadTransitions, useUnreadConversationTotal } from './useUnreadConversationTotal'

const store = vi.hoisted(() => ({ conversations: [] as Array<{ id: string; unreadCount: number }> }))
const getStats = vi.hoisted(() => vi.fn())
vi.mock('@/stores/conversations', () => ({ useConversationsStore: () => reactive(store) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ isAuthenticated: true }) }))
vi.mock('@/api/conversations', () => ({ conversationApi: { getStats } }))

const m = (entries: Array<[string, boolean]>) => new Map(entries)

describe('diffUnreadTransitions', () => {
  it('已讀 -> 未讀 計 +1', () => {
    expect(diffUnreadTransitions(m([['a', false]]), m([['a', true]]))).toEqual({ delta: 1, appearedUnread: false })
  })

  it('未讀 -> 已讀 計 -1', () => {
    expect(diffUnreadTransitions(m([['a', true]]), m([['a', false]]))).toEqual({ delta: -1, appearedUnread: false })
  })

  it('同一對話未讀數增加(仍為未讀)不改變對話數', () => {
    expect(diffUnreadTransitions(m([['a', true]]), m([['a', true]])).delta).toBe(0)
  })

  it('新載入的已讀對話(分頁/篩選)不影響計數', () => {
    expect(diffUnreadTransitions(m([['a', true]]), m([['a', true], ['b', false]]))).toEqual({
      delta: 0,
      appearedUnread: false
    })
  })

  it('新出現的未讀對話無法判斷先前狀態 -> 標記需校正,不直接加', () => {
    expect(diffUnreadTransitions(m([['a', true]]), m([['a', true], ['b', true]]))).toEqual({
      delta: 0,
      appearedUnread: true
    })
  })

  it('切換篩選導致對話消失不計為已讀', () => {
    expect(diffUnreadTransitions(m([['a', true], ['b', true]]), m([['a', true]])).delta).toBe(0)
  })

  it('多筆轉換淨增減', () => {
    const prev = m([['a', true], ['b', false], ['c', false]])
    const next = m([['a', false], ['b', true], ['c', true]])
    expect(diffUnreadTransitions(prev, next).delta).toBe(1)
  })
})

describe('reconcile', () => {
  it('保留請求期間發生的已讀/未讀轉換', async () => {
    const state = reactive(store)
    state.conversations = [{ id: 'a', unreadCount: 0 }, { id: 'b', unreadCount: 1 }]
    getStats.mockResolvedValueOnce({ success: true, data: { unreadConversations: 1 } }) // 登入後的初次校正
    const scope = effectScope()
    const unread = scope.run(() => useUnreadConversationTotal())!
    await new Promise((resolve) => setTimeout(resolve, 0))

    let resolveStats!: (_v: unknown) => void
    getStats.mockReturnValueOnce(new Promise((resolve) => { resolveStats = resolve }))
    const pending = unread.reconcile()
    state.conversations = [{ id: 'a', unreadCount: 1 }, { id: 'b', unreadCount: 1 }]
    await nextTick()
    resolveStats({ success: true, data: { unreadConversations: 5 } })
    await pending

    // 伺服器快照 5(早於 a 變為未讀) + 請求期間的 +1
    expect(unread.total.value).toBe(6)
    scope.stop()
  })

  it('請求期間其他分頁 adopt 歸零 delta,不會造出負的轉換', async () => {
    let channel!: { onmessage: ((_e: { data: unknown }) => void) | null }
    vi.stubGlobal('BroadcastChannel', class {
      onmessage = null
      constructor() { channel = this }
      postMessage() {}
      close() {}
    })
    const state = reactive(store)
    state.conversations = [{ id: 'a', unreadCount: 0 }, { id: 'b', unreadCount: 1 }]
    getStats.mockResolvedValueOnce({ success: true, data: { unreadConversations: 1 } })
    const scope = effectScope()
    const unread = scope.run(() => useUnreadConversationTotal())!
    await new Promise((resolve) => setTimeout(resolve, 0))
    state.conversations = [{ id: 'a', unreadCount: 1 }, { id: 'b', unreadCount: 1 }]
    await nextTick() // 請求前 delta = +1

    let resolveStats!: (_v: unknown) => void
    getStats.mockReturnValueOnce(new Promise((resolve) => { resolveStats = resolve }))
    const pending = unread.reconcile()
    channel.onmessage?.({ data: { total: 9, at: Date.now() + 1000 } })
    resolveStats({ success: true, data: { unreadConversations: 5 } })
    await pending

    expect(unread.total.value).toBe(5)
    scope.stop()
    vi.unstubAllGlobals()
  })
})
