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
})
