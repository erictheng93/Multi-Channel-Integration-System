import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { Conversation, ConversationFilters } from '@/types'

const listMock = vi.hoisted(() => vi.fn())
vi.mock('@/api/conversations', () => ({ conversationApi: { list: listMock } }))
vi.mock('@/services/cacheManager', () => ({ conversationCache: {} }))
vi.mock('../auth', () => ({ useAuthStore: () => ({}) }))

import { createRealtimeHandler, type RealtimeHandlerDeps } from './realtimeHandler'

const makeDeps = () => {
  const activeFilters = ref<ConversationFilters>({ scope: 'all' } as ConversationFilters)
  const loadError = ref<string | null>(null)
  const updateIncremental = vi.fn()
  const deps = {
    conversations: ref<Conversation[]>([]),
    currentConversation: ref(null),
    transferredConversation: ref(null),
    receivedConversation: ref(null),
    stats: ref({}),
    lastUpdateTime: ref(null),
    activeFilters,
    error: ref<string | null>(null),
    loadError,
    updateConversationFromWebSocketMessage: vi.fn(),
    updateConversationStatus: vi.fn(),
    updateConversationsIncrementally: updateIncremental,
    updateStatsFromConversations: vi.fn()
  } as unknown as RealtimeHandlerDeps
  return { deps, activeFilters, loadError, updateIncremental }
}

describe('pollConversations stale-result guard', () => {
  beforeEach(() => listMock.mockReset())

  it('keeps loadError set when a stale poll resolves after the filters changed', async () => {
    const { deps, activeFilters, loadError, updateIncremental } = makeDeps()
    const handler = createRealtimeHandler(deps)
    let resolvePoll!: (_v: unknown) => void
    listMock.mockReturnValueOnce(new Promise(r => { resolvePoll = r }))

    const poll = handler.pollConversations()
    // New scope starts; its foreground fetch fails.
    activeFilters.value = { scope: 'closed' } as ConversationFilters
    loadError.value = '載入對話失敗'

    resolvePoll({ success: true, data: { items: [] } })
    await poll

    expect(loadError.value).toBe('載入對話失敗')
    expect(updateIncremental).not.toHaveBeenCalled()
  })

  it('clears loadError when the poll succeeds with unchanged filters', async () => {
    const { deps, loadError, updateIncremental } = makeDeps()
    const handler = createRealtimeHandler(deps)
    loadError.value = '載入對話失敗'
    listMock.mockResolvedValueOnce({ success: true, data: { items: [] } })

    await handler.pollConversations()

    expect(loadError.value).toBeNull()
    expect(updateIncremental).toHaveBeenCalled()
  })
})
