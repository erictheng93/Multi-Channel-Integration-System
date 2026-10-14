import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Conversation } from '@/types'

const mockBulkClose = vi.fn()
const mockBulkReopen = vi.fn()

vi.mock('@/api/conversations', () => ({
  conversationApi: {
    bulkClose: (...args: unknown[]) => mockBulkClose(...args),
    bulkReopen: (...args: unknown[]) => mockBulkReopen(...args)
  }
}))

vi.mock('@/api/message', () => ({ messageApi: {} }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ currentAgent: { id: 'agent-1', name: 'A', role: 'agent' } })
}))

function conv(id: string, overrides: Partial<Conversation> = {}): Conversation {
  return {
    id,
    userId: `u-${id}`,
    status: 'active',
    unreadCount: 0,
    lastMessageAt: 1,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  } as Conversation
}

async function setup(list: Conversation[]) {
  const { useConversationsStore } = await import('@/stores/conversations')
  const store = useConversationsStore()
  store.conversations = list
  return store
}

const statusOf = (store: Awaited<ReturnType<typeof setup>>, id: string) =>
  store.conversations.find(c => c.id === id)?.status

describe('bulkSetConversationsClosed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('sends only ids that need closing and updates optimistically before the API resolves', async () => {
    const store = await setup([conv('a'), conv('b', { status: 'closed' }), conv('c', { status: 'assigned' })])
    let observedDuringCall: string | undefined
    mockBulkClose.mockImplementation(async () => {
      observedDuringCall = statusOf(store, 'a')
      return { success: true, data: { operation: 'close', affectedCount: 2, conversationIds: ['a', 'c'], statuses: { a: 'closed', c: 'closed' } } }
    })

    const result = await store.bulkSetConversationsClosed(['a', 'b', 'c'], true)

    expect(mockBulkClose).toHaveBeenCalledWith(['a', 'c'])
    expect(observedDuringCall).toBe('closed')
    expect(result).toBe(2)
    expect(statusOf(store, 'a')).toBe('closed')
    expect(statusOf(store, 'c')).toBe('closed')
  })

  it('reopens closed ids to assigned or active depending on team, and reconciles with server statuses', async () => {
    const store = await setup([
      conv('a', { status: 'closed', assignedTeamId: 3 }),
      conv('b', { status: 'closed' }),
      conv('c')
    ])
    mockBulkReopen.mockResolvedValue({
      success: true,
      data: { operation: 'reopen', affectedCount: 2, conversationIds: ['a', 'b'], statuses: { a: 'assigned', b: 'active' } }
    })

    const result = await store.bulkSetConversationsClosed(['a', 'b', 'c'], false)

    expect(mockBulkReopen).toHaveBeenCalledWith(['a', 'b'])
    expect(result).toBe(2)
    expect(statusOf(store, 'a')).toBe('assigned')
    expect(statusOf(store, 'b')).toBe('active')
    expect(statusOf(store, 'c')).toBe('active')
  })

  it('rolls back every id and returns null when the API reports failure', async () => {
    const store = await setup([conv('a'), conv('b', { status: 'assigned' })])
    mockBulkClose.mockResolvedValue({ success: false, error: 'forbidden' })

    const result = await store.bulkSetConversationsClosed(['a', 'b'], true)

    expect(result).toBeNull()
    expect(statusOf(store, 'a')).toBe('active')
    expect(statusOf(store, 'b')).toBe('assigned')
  })

  it('rolls back and returns null when the request throws', async () => {
    const store = await setup([conv('a')])
    mockBulkClose.mockRejectedValue(new Error('network'))

    const result = await store.bulkSetConversationsClosed(['a'], true)

    expect(result).toBeNull()
    expect(statusOf(store, 'a')).toBe('active')
  })

  it('zeroes unread on close and restores it on rollback', async () => {
    const store = await setup([conv('a', { unreadCount: 3 })])
    const unreadOf = () => store.conversations.find(c => c.id === 'a')?.unreadCount
    let observedDuringCall: number | undefined
    mockBulkClose.mockImplementation(async () => {
      observedDuringCall = unreadOf()
      return { success: false, error: 'forbidden' }
    })

    await store.bulkSetConversationsClosed(['a'], true)

    expect(observedDuringCall).toBe(0)
    expect(unreadOf()).toBe(3)
  })

  it('does not call the API when nothing needs to change', async () => {
    const store = await setup([conv('a', { status: 'closed' })])

    const result = await store.bulkSetConversationsClosed(['a'], true)

    expect(result).toBe(0)
    expect(mockBulkClose).not.toHaveBeenCalled()
  })
})
