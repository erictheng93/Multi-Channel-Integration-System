/**
 * Unit Tests for conversations/realtimeHandler.ts
 *
 * Tests: createRealtimeHandler (handleRealtimeUpdate, pollConversations)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import type { Conversation, ConversationFilters } from '@/types'
import type { WebSocketMessage } from '@/services/websocketClient'
import { createRealtimeHandler, type RealtimeHandlerDeps } from '@/stores/conversations/realtimeHandler'
import type { ConversationStats, TransferredConversationState, ReceivedConversationState } from '@/stores/conversations/types'

// ===== Mock Setup =====

const mockConversationList = vi.fn()

vi.mock('@/api/conversations', () => ({
  conversationApi: {
    list: (...args: unknown[]) => mockConversationList(...args)
  }
}))

vi.mock('@/services/cacheManager', () => ({
  conversationCache: {
    setConversation: vi.fn(),
    invalidateConversation: vi.fn()
  }
}))

vi.mock('@/utils/type-normalization', () => ({
  normalizeTeamId: (id: unknown) => {
    if (id === undefined || id === null) {return undefined}
    const n = typeof id === 'string' ? parseInt(id, 10) : id
    return typeof n === 'number' && !isNaN(n) ? n : undefined
  }
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    currentAgent: { id: 'agent-1', name: 'Test Agent', role: 'admin' },
    allowedTeamIds: [1, 2]
  }))
}))

vi.mock('@/utils/timestamp', () => ({
  nowISO: () => '2026-03-06T00:00:00.000Z'
}))

// ===== Test Helpers =====

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    userId: 'user-1',
    status: 'active',
    lastMessageAt: 1000,
    unreadCount: 0,
    createdAt: 900,
    updatedAt: 1000,
    ...overrides
  } as Conversation
}

function makeDeps(overrides: Partial<RealtimeHandlerDeps> = {}): RealtimeHandlerDeps {
  return {
    conversations: ref<Conversation[]>([]),
    currentConversation: ref<Conversation | null>(null),
    transferredConversation: ref<TransferredConversationState | null>(null),
    receivedConversation: ref<ReceivedConversationState | null>(null),
    stats: ref<ConversationStats>({ total: 0, active: 0, assigned: 0, pending: 0, unreadCount: 0 }),
    lastUpdateTime: ref<Date | null>(null),
    activeFilters: ref<ConversationFilters>({}),
    error: ref<string | null>(null),
    updateConversationFromWebSocketMessage: vi.fn().mockReturnValue(true),
    updateConversationStatus: vi.fn().mockReturnValue(true),
    updateConversationsIncrementally: vi.fn(),
    updateStatsFromConversations: vi.fn(),
    ...overrides
  }
}

function makeWsMessage(type: string, data?: Record<string, unknown>, conversationId?: string): WebSocketMessage {
  return {
    type,
    data,
    conversationId,
    timestamp: Date.now()
  }
}

// ===== Tests =====

describe('createRealtimeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockConversationList.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, pageSize: 50 }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('pollConversations', () => {
    it('fetches conversations from API and updates incrementally', async () => {
      const convs = [makeConversation({ id: 'c1' })]
      mockConversationList.mockResolvedValue({
        success: true,
        data: { items: convs, total: 1, page: 1, pageSize: 50 }
      })

      const deps = makeDeps()
      const { pollConversations } = createRealtimeHandler(deps)

      await pollConversations()

      expect(deps.updateConversationsIncrementally).toHaveBeenCalledWith(convs, true)
      expect(deps.lastUpdateTime.value).not.toBeNull()
      expect(deps.stats.value.total).toBe(1)
    })

    it('respects activeFilters when polling', async () => {
      mockConversationList.mockResolvedValue({ success: true, data: [] })

      const deps = makeDeps({
        activeFilters: ref({ status: 'pending', platform: 'line', teamId: 3 } as ConversationFilters)
      })
      const { pollConversations } = createRealtimeHandler(deps)

      await pollConversations()

      expect(mockConversationList).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          platform: 'line',
          teamId: 3
        })
      )
    })

    it('handles API error without throwing', async () => {
      mockConversationList.mockRejectedValue(new Error('network'))

      const deps = makeDeps()
      const { pollConversations } = createRealtimeHandler(deps)

      await expect(pollConversations()).resolves.not.toThrow()
      expect(deps.error.value).toBeTruthy()
    })

    it('handles array response format', async () => {
      const convs = [makeConversation({ id: 'arr-1' })]
      mockConversationList.mockResolvedValue({ success: true, data: convs })

      const deps = makeDeps()
      const { pollConversations } = createRealtimeHandler(deps)

      await pollConversations()

      expect(deps.updateConversationsIncrementally).toHaveBeenCalledWith(convs, true)
    })
  })

  describe('handleRealtimeUpdate - new_message', () => {
    it('calls updateConversationFromWebSocketMessage for new_message with conversationId', () => {
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate(makeWsMessage('new_message', {
        content: 'Hello',
        messageType: 'text',
        senderType: 'customer'
      }, 'conv-1'))

      expect(deps.updateConversationFromWebSocketMessage).toHaveBeenCalledWith(
        'conv-1',
        expect.objectContaining({ content: 'Hello', senderType: 'customer' }),
        expect.objectContaining({ incrementUnread: true, moveToTop: true })
      )
      expect(deps.lastUpdateTime.value).not.toBeNull()
    })

    it('does not increment unread for agent messages', () => {
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate(makeWsMessage('new_message', {
        content: 'Reply',
        senderType: 'agent'
      }, 'conv-1'))

      expect(deps.updateConversationFromWebSocketMessage).toHaveBeenCalledWith(
        'conv-1',
        expect.anything(),
        expect.objectContaining({ incrementUnread: false })
      )
    })

    it('falls back to polling when conversationId is missing', () => {
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate(makeWsMessage('new_message', { content: 'test' }))

      expect(deps.updateConversationFromWebSocketMessage).not.toHaveBeenCalled()
      expect(mockConversationList).toHaveBeenCalled()
    })

    it('handles message_sent and message_delivered types', () => {
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate(makeWsMessage('message_sent', { content: 'sent' }, 'conv-1'))
      handleRealtimeUpdate(makeWsMessage('message_delivered', { content: 'delivered' }, 'conv-1'))

      expect(deps.updateConversationFromWebSocketMessage).toHaveBeenCalledTimes(2)
    })

    it('extracts conversationId from data when not on message root', () => {
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate({
        type: 'new_message',
        data: { conversationId: 'conv-from-data', content: 'hi', senderType: 'customer' },
        timestamp: Date.now()
      })

      expect(deps.updateConversationFromWebSocketMessage).toHaveBeenCalledWith(
        'conv-from-data',
        expect.anything(),
        expect.anything()
      )
    })
  })

  describe('handleRealtimeUpdate - conversation_updated / conversation_status_changed / conversation_assigned', () => {
    it('updates conversation status via updateConversationStatus', () => {
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate(makeWsMessage('conversation_updated', {
        status: 'in-progress',
        assignedTeamId: 5,
        assignedTeamName: 'Support'
      }, 'conv-1'))

      expect(deps.updateConversationStatus).toHaveBeenCalledWith('conv-1', {
        status: 'in-progress',
        assignedTeamId: 5,
        assignedTeam: { id: 5, name: 'Support', description: null }
      })
    })

    it('clears assignedTeam when assignedTeamId is 0 (falsy)', () => {
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate(makeWsMessage('conversation_status_changed', {
        assignedTeamId: 0
      }, 'conv-1'))

      expect(deps.updateConversationStatus).toHaveBeenCalledWith('conv-1', {
        assignedTeamId: 0,
        assignedTeam: undefined
      })
    })

    it('falls back to polling when conversationId is missing', () => {
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate(makeWsMessage('conversation_assigned', { status: 'assigned' }))

      expect(mockConversationList).toHaveBeenCalled()
    })

    it('falls back to polling when no updates to apply', () => {
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate(makeWsMessage('conversation_updated', {}, 'conv-1'))

      expect(mockConversationList).toHaveBeenCalled()
    })
  })

  describe('handleRealtimeUpdate - conversation_unassigned', () => {
    it('clears team assignment and sets status to active', () => {
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate(makeWsMessage('conversation_unassigned', {
        previousTeamId: 3,
        previousTeamName: 'Old Team'
      }, 'conv-1'))

      expect(deps.updateConversationStatus).toHaveBeenCalledWith('conv-1', {
        status: 'active',
        assignedTeamId: undefined,
        assignedTeam: undefined
      })
      expect(deps.lastUpdateTime.value).not.toBeNull()
    })

    it('falls back to polling when conversationId is missing', () => {
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate(makeWsMessage('conversation_unassigned', {}))

      expect(mockConversationList).toHaveBeenCalled()
    })
  })

  describe('handleRealtimeUpdate - conversation_transferred', () => {
    describe('action=removed', () => {
      it('removes conversation from list (admin user)', () => {
        const conv = makeConversation({ id: 'conv-1', assignedTeamId: 1 })
        const deps = makeDeps({ conversations: ref([conv]) })
        const { handleRealtimeUpdate } = createRealtimeHandler(deps)

        handleRealtimeUpdate(makeWsMessage('conversation_transferred', {
          action: 'removed',
          fromTeamId: 1,
          toTeamId: 3,
          toTeamName: 'Other Team'
        }, 'conv-1'))

        expect(deps.conversations.value).toHaveLength(0)
        expect(deps.updateStatsFromConversations).toHaveBeenCalled()
      })

      it('sets transferredConversation state when viewing removed conversation', () => {
        const conv = makeConversation({ id: 'conv-1' })
        const deps = makeDeps({
          conversations: ref([conv]),
          currentConversation: ref({ ...conv })
        })
        const { handleRealtimeUpdate } = createRealtimeHandler(deps)

        handleRealtimeUpdate(makeWsMessage('conversation_transferred', {
          action: 'removed',
          fromTeamId: 1,
          toTeamId: 3,
          toTeamName: 'Sales'
        }, 'conv-1'))

        expect(deps.transferredConversation.value).toEqual({
          conversationId: 'conv-1',
          toTeamName: 'Sales',
          transferredAt: expect.any(String)
        })
      })
    })

    describe('action=assigned', () => {
      it('adds new conversation to the top of the list', () => {
        const deps = makeDeps({ conversations: ref([]) })
        const { handleRealtimeUpdate } = createRealtimeHandler(deps)

        handleRealtimeUpdate(makeWsMessage('conversation_transferred', {
          action: 'assigned',
          toTeamId: 1,
          toTeamName: 'My Team',
          conversation: {
            customerName: 'John',
            platform: 'line',
            status: 'active',
            customerId: 'cust-1',
            lastMessageAt: 2000,
            unreadCount: 1
          }
        }, 'conv-new'))

        expect(deps.conversations.value).toHaveLength(1)
        expect(deps.conversations.value[0].id).toBe('conv-new')
        expect(deps.conversations.value[0].assignedTeamId).toBe(1)
        expect(deps.updateStatsFromConversations).toHaveBeenCalled()
      })

      it('preserves LINE identity fields from transfer payload when adding conversation', () => {
        const deps = makeDeps({ conversations: ref([]) })
        const { handleRealtimeUpdate } = createRealtimeHandler(deps)

        handleRealtimeUpdate(makeWsMessage('conversation_transferred', {
          action: 'assigned',
          toTeamId: 1,
          toTeamName: 'Support Team',
          conversation: {
            customerName: 'Line Customer',
            platform: 'line',
            status: 'active',
            customerId: 123,
            platformUserId: 'U1234567890abcdef',
            avatarUrl: 'https://profile.line-scdn.net/avatar.jpg'
          }
        }, 'conv-line-transfer'))

        expect(deps.conversations.value).toHaveLength(1)
        expect(deps.conversations.value[0].customer).toEqual(expect.objectContaining({
          id: '123',
          name: 'Line Customer',
          platform: 'line',
          platformUserId: 'U1234567890abcdef',
          avatarUrl: 'https://profile.line-scdn.net/avatar.jpg'
        }))
      })

      it('updates existing conversation team info instead of duplicating', () => {
        const existingConv = makeConversation({ id: 'conv-1', assignedTeamId: 1 })
        const deps = makeDeps({ conversations: ref([existingConv]) })
        const { handleRealtimeUpdate } = createRealtimeHandler(deps)

        handleRealtimeUpdate(makeWsMessage('conversation_transferred', {
          action: 'assigned',
          toTeamId: 2,
          toTeamName: 'New Team',
          conversation: { customerName: 'John', platform: 'line', status: 'active' }
        }, 'conv-1'))

        expect(deps.conversations.value).toHaveLength(1)
        expect(deps.updateConversationStatus).toHaveBeenCalledWith('conv-1', expect.objectContaining({
          assignedTeamId: 2
        }))
      })

      it('falls back to polling when no conversation data', () => {
        const deps = makeDeps()
        const { handleRealtimeUpdate } = createRealtimeHandler(deps)

        handleRealtimeUpdate(makeWsMessage('conversation_transferred', {
          action: 'assigned',
          toTeamId: 1
        }, 'conv-1'))

        expect(mockConversationList).toHaveBeenCalled()
      })

      it('updates currentConversation when it matches the assigned conversation', () => {
        const currentConv = makeConversation({ id: 'conv-1' })
        const deps = makeDeps({
          conversations: ref([]),
          currentConversation: ref({ ...currentConv })
        })
        const { handleRealtimeUpdate } = createRealtimeHandler(deps)

        handleRealtimeUpdate(makeWsMessage('conversation_transferred', {
          action: 'assigned',
          toTeamId: 2,
          toTeamName: 'Team B',
          conversation: {
            customerName: 'Alice',
            platform: 'facebook',
            status: 'assigned',
            customerId: 'cust-2'
          }
        }, 'conv-1'))

        expect(deps.currentConversation.value?.id).toBe('conv-1')
        expect(deps.currentConversation.value?.assignedTeamId).toBe(2)
      })
    })

    describe('action=team_changed', () => {
      it('updates team info via updateConversationStatus', () => {
        const deps = makeDeps()
        const { handleRealtimeUpdate } = createRealtimeHandler(deps)

        handleRealtimeUpdate(makeWsMessage('conversation_transferred', {
          action: 'team_changed',
          toTeamId: 7,
          toTeamName: 'Engineering'
        }, 'conv-1'))

        expect(deps.updateConversationStatus).toHaveBeenCalledWith('conv-1', {
          assignedTeamId: 7,
          assignedTeam: { id: 7, name: 'Engineering', description: null }
        })
      })

      it('falls back to newTeam object when toTeamId is missing', () => {
        const deps = makeDeps()
        const { handleRealtimeUpdate } = createRealtimeHandler(deps)

        handleRealtimeUpdate(makeWsMessage('conversation_transferred', {
          action: 'team_changed',
          newTeam: { id: 9, name: 'Finance' }
        }, 'conv-1'))

        expect(deps.updateConversationStatus).toHaveBeenCalledWith('conv-1', {
          assignedTeamId: 9,
          assignedTeam: { id: 9, name: 'Finance', description: null }
        })
      })
    })

    describe('legacy format (no action field)', () => {
      it('updates status and team via updateConversationStatus', () => {
        const deps = makeDeps()
        const { handleRealtimeUpdate } = createRealtimeHandler(deps)

        handleRealtimeUpdate(makeWsMessage('conversation_transferred', {
          status: 'assigned',
          assignedTeamId: 4,
          assignedTeamName: 'Legacy Team'
        }, 'conv-1'))

        expect(deps.updateConversationStatus).toHaveBeenCalledWith('conv-1', {
          status: 'assigned',
          assignedTeamId: 4,
          assignedTeam: { id: 4, name: 'Legacy Team', description: null }
        })
      })

      it('falls back to polling when no updates', () => {
        const deps = makeDeps()
        const { handleRealtimeUpdate } = createRealtimeHandler(deps)

        handleRealtimeUpdate(makeWsMessage('conversation_transferred', {}, 'conv-1'))

        expect(mockConversationList).toHaveBeenCalled()
      })

      it('falls back to polling when no conversationId', () => {
        const deps = makeDeps()
        const { handleRealtimeUpdate } = createRealtimeHandler(deps)

        handleRealtimeUpdate(makeWsMessage('conversation_transferred', { status: 'active' }))

        expect(mockConversationList).toHaveBeenCalled()
      })
    })
  })

  describe('handleRealtimeUpdate - conversations_update (batch)', () => {
    it('triggers polling for batch updates', () => {
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate(makeWsMessage('conversations_update', {}))

      expect(deps.lastUpdateTime.value).not.toBeNull()
      expect(mockConversationList).toHaveBeenCalled()
    })
  })

  describe('handleRealtimeUpdate - message_updated / message_deleted', () => {
    it('triggers polling for message_updated', () => {
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate(makeWsMessage('message_updated', {}))

      expect(deps.lastUpdateTime.value).not.toBeNull()
      expect(mockConversationList).toHaveBeenCalled()
    })

    it('triggers polling for message_deleted', () => {
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate(makeWsMessage('message_deleted', {}))

      expect(mockConversationList).toHaveBeenCalled()
    })
  })

  describe('handleRealtimeUpdate - unknown type', () => {
    it('logs warning for unhandled message type', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate(makeWsMessage('unknown_type', {}))

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled message type'),
        'unknown_type'
      )
      warnSpy.mockRestore()
    })
  })

  describe('pending reconciliation', () => {
    it('schedules reconciliation poll for pending LIFF conversations', async () => {
      const deps = makeDeps({ conversations: ref([]) })
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      // Add a pending conversation via the assigned event
      handleRealtimeUpdate(makeWsMessage('conversation_transferred', {
        action: 'assigned',
        toTeamId: 1,
        toTeamName: 'Team',
        conversation: {
          customerName: 'LIFF User',
          platform: 'line',
          status: 'active',
          customerId: 'liff-cust',
          _liffMetadata: { isPending: true, lineUserId: 'U123456' }
        }
      }, 'pending-conv-1'))

      expect(deps.conversations.value).toHaveLength(1)

      // Advance past PENDING_RECONCILIATION_DELAY (5000ms)
      await vi.advanceTimersByTimeAsync(5100)

      // pollConversations should have been called (through the scheduled timer)
      expect(mockConversationList).toHaveBeenCalled()
    })
  })

  describe('string team ID normalization', () => {
    it('normalizes string teamId from WebSocket to number', () => {
      const deps = makeDeps()
      const { handleRealtimeUpdate } = createRealtimeHandler(deps)

      handleRealtimeUpdate(makeWsMessage('conversation_transferred', {
        action: 'team_changed',
        toTeamId: '42',
        toTeamName: 'Normalized Team'
      }, 'conv-1'))

      expect(deps.updateConversationStatus).toHaveBeenCalledWith('conv-1', {
        assignedTeamId: 42,
        assignedTeam: { id: 42, name: 'Normalized Team', description: null }
      })
    })
  })
})
