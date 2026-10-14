/**
 * The list view's failure state must outlive the 5s toast timer in handleError,
 * otherwise a failed load falls back to the misleading "no conversations" state.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockList = vi.fn()

vi.mock('@/api/conversations', () => ({
  conversationApi: { list: (...args: unknown[]) => mockList(...args) }
}))

vi.mock('@/api/message', () => ({
  messageApi: { list: vi.fn(), send: vi.fn(), sendMessage: vi.fn() }
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({ currentAgent: { id: 'agent-1' }, allowedTeamIds: [1] }))
}))

vi.mock('@/stores/websocket', () => ({
  useWebSocketStore: vi.fn(() => ({
    connectionState: 'disconnected',
    isConnected: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    connect: vi.fn()
  }))
}))

vi.mock('@/services/cacheManager', () => ({
  conversationCache: {
    getConversation: vi.fn(),
    setConversation: vi.fn(),
    invalidateConversation: vi.fn(),
    hasConversation: vi.fn().mockReturnValue(false),
    getConversationList: vi.fn().mockReturnValue({ data: null, needsUpdate: true }),
    setConversationList: vi.fn()
  },
  cacheManager: { cacheHitRate: { value: 0 } }
}))

describe('conversations store persistent loadError', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    mockList.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps loadError after the 5s toast timer clears error (loadWithCache, thrown)', async () => {
    mockList.mockRejectedValue(new Error('network'))
    const { useConversationsStore } = await import('@/stores/conversations')
    const store = useConversationsStore()

    await store.loadWithCache({})
    expect(store.error).not.toBeNull()
    expect(store.loadError).not.toBeNull()

    vi.advanceTimersByTime(6000)

    expect(store.error).toBeNull()
    expect(store.loadError).not.toBeNull()
  })

  it('keeps loadError after the toast timer for fetchConversations failure', async () => {
    mockList.mockResolvedValue({ success: false, error: 'boom' })
    const { useConversationsStore } = await import('@/stores/conversations')
    const store = useConversationsStore()

    await store.fetchConversations({})
    vi.advanceTimersByTime(6000)

    expect(store.error).toBeNull()
    expect(store.loadError).not.toBeNull()
  })

  it('clears loadError when a retry succeeds', async () => {
    mockList.mockRejectedValueOnce(new Error('network'))
    mockList.mockResolvedValueOnce({
      success: true,
      data: { items: [], page: 1, pageSize: 50, total: 0, totalPages: 0 }
    })
    const { useConversationsStore } = await import('@/stores/conversations')
    const store = useConversationsStore()

    await store.fetchConversations({})
    expect(store.loadError).not.toBeNull()

    await store.fetchConversations({})
    expect(store.loadError).toBeNull()
  })

  const page = (ids: string[]) => ({
    success: true,
    data: {
      items: ids.map(id => ({
        id,
        status: 'open',
        platform: 'line',
        updatedAt: '2026-10-14T00:00:00.000Z',
        createdAt: '2026-10-14T00:00:00.000Z'
      })),
      page: 1,
      pageSize: 50,
      total: ids.length,
      totalPages: 1
    }
  })

  it('sets loadError on a failed fetch even when the list already has rows', async () => {
    mockList.mockResolvedValueOnce(page(['c1', 'c2']))
    mockList.mockResolvedValueOnce({ success: false, error: 'boom' })
    const { useConversationsStore } = await import('@/stores/conversations')
    const store = useConversationsStore()

    await store.fetchConversations({})
    expect(store.conversations.length).toBe(2)
    expect(store.loadError).toBeNull()

    await store.fetchConversations({})
    expect(store.loadError).not.toBeNull()
  })

  it('sets loadError on a thrown fetch even when the list already has rows', async () => {
    mockList.mockResolvedValueOnce(page(['c1']))
    mockList.mockRejectedValueOnce(new Error('network'))
    const { useConversationsStore } = await import('@/stores/conversations')
    const store = useConversationsStore()

    await store.fetchConversations({})
    expect(store.conversations.length).toBe(1)

    await store.fetchConversations({})
    expect(store.loadError).not.toBeNull()
  })

  it('ignores a superseded response that resolves after the newer one', async () => {
    let resolveOld!: (_v: unknown) => void
    let resolveNew!: (_v: unknown) => void
    mockList.mockImplementationOnce(() => new Promise(r => { resolveOld = r }))
    mockList.mockImplementationOnce(() => new Promise(r => { resolveNew = r }))
    const { useConversationsStore } = await import('@/stores/conversations')
    const store = useConversationsStore()

    const oldP = store.fetchConversations({ scope: 'open' })
    const newP = store.fetchConversations({ scope: 'closed' })
    expect(store.loading).toBe(true)

    resolveNew(page(['new1', 'new2']))
    await newP
    expect(store.conversations.map(c => c.id).sort()).toEqual(['new1', 'new2'])
    expect(store.loading).toBe(false)

    resolveOld(page(['old1']))
    await oldP
    expect(store.conversations.map(c => c.id).sort()).toEqual(['new1', 'new2'])
    expect(store.loading).toBe(false)
  })

  it('keeps loading true until the newest fetch finishes when the older one resolves first', async () => {
    let resolveOld!: (_v: unknown) => void
    let resolveNew!: (_v: unknown) => void
    mockList.mockImplementationOnce(() => new Promise(r => { resolveOld = r }))
    mockList.mockImplementationOnce(() => new Promise(r => { resolveNew = r }))
    const { useConversationsStore } = await import('@/stores/conversations')
    const store = useConversationsStore()

    const oldP = store.fetchConversations({ scope: 'open' })
    const newP = store.fetchConversations({ scope: 'closed' })

    resolveOld(page(['old1']))
    await oldP
    expect(store.loading).toBe(true)
    expect(store.conversations.map(c => c.id)).not.toContain('old1')

    resolveNew(page(['new1']))
    await newP
    expect(store.loading).toBe(false)
    expect(store.conversations.map(c => c.id)).toEqual(['new1'])
  })

  it('does not surface loadError from a superseded failing request', async () => {
    let rejectOld!: (_e: unknown) => void
    let resolveNew!: (_v: unknown) => void
    mockList.mockImplementationOnce(() => new Promise((_, rej) => { rejectOld = rej }))
    mockList.mockImplementationOnce(() => new Promise(r => { resolveNew = r }))
    const { useConversationsStore } = await import('@/stores/conversations')
    const store = useConversationsStore()

    const oldP = store.fetchConversations({ scope: 'open' })
    const newP = store.fetchConversations({ scope: 'closed' })

    resolveNew(page(['new1']))
    await newP
    rejectOld(new Error('late failure'))
    await oldP

    expect(store.loadError).toBeNull()
    expect(store.conversations.map(c => c.id)).toEqual(['new1'])
  })
})
