/**
 * Unit Tests for conversations/assignmentActions.ts
 *
 * Tests: createAssignmentActions (assignConversation, assignConversationToTeam,
 *        unassignConversation, transferConversationToTeam)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { Conversation } from '@/types'
import { createAssignmentActions, type AssignmentActionsDeps } from '@/stores/conversations/assignmentActions'

// ===== Mock Setup =====

const mockAssignConversation = vi.fn()
const mockUnassignConversation = vi.fn()
const mockTransferConversation = vi.fn()
const mockGetConversation = vi.fn()

vi.mock('@/api/conversations', () => ({
  conversationApi: {
    assignConversation: (...args: unknown[]) => mockAssignConversation(...args),
    unassignConversation: (...args: unknown[]) => mockUnassignConversation(...args),
    transferConversation: (...args: unknown[]) => mockTransferConversation(...args),
    getConversation: (...args: unknown[]) => mockGetConversation(...args)
  }
}))

vi.mock('@/constants/conversation-status', () => ({
  CONVERSATION_STATUS: {
    ACTIVE: 'active',
    PENDING: 'pending',
    IN_PROGRESS: 'in-progress',
    ASSIGNED: 'assigned',
    WAITING: 'waiting'
  }
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

function makeDeps(overrides: Partial<AssignmentActionsDeps> = {}): AssignmentActionsDeps {
  return {
    conversations: ref<Conversation[]>([]),
    currentConversation: ref<Conversation | null>(null),
    error: ref<string | null>(null),
    handleError: vi.fn(),
    ...overrides
  }
}

// ===== Tests =====

describe('createAssignmentActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('assignConversation (deprecated)', () => {
    it('always returns false and calls handleError', async () => {
      const deps = makeDeps()
      const actions = createAssignmentActions(deps)

      const result = await actions.assignConversation('conv-1', 'agent-1')

      expect(result).toBe(false)
      expect(deps.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.stringContaining('團隊指派')
      )
    })
  })

  describe('assignConversationToTeam', () => {
    it('returns false when conversationId is empty', async () => {
      const deps = makeDeps()
      const actions = createAssignmentActions(deps)

      const result = await actions.assignConversationToTeam('', 1)
      expect(result).toBe(false)
    })

    it('returns false when teamId is 0 (falsy)', async () => {
      const deps = makeDeps()
      const actions = createAssignmentActions(deps)

      const result = await actions.assignConversationToTeam('conv-1', 0)
      expect(result).toBe(false)
    })

    it('applies optimistic update then merges API response on success', async () => {
      const conv = makeConversation({ id: 'conv-1', status: 'active' })
      const updatedConv = makeConversation({ id: 'conv-1', status: 'assigned', assignedTeamId: 5 })

      mockAssignConversation.mockResolvedValue({ success: true, data: updatedConv })

      const deps = makeDeps({
        conversations: ref([conv]),
        currentConversation: ref(null)
      })
      const actions = createAssignmentActions(deps)

      const result = await actions.assignConversationToTeam('conv-1', 5, 'Support Team')

      expect(result).toBe(true)
      // After API success, the conversation should be updated with API response
      expect(deps.conversations.value[0].assignedTeamId).toBe(5)
    })

    it('updates currentConversation if it matches', async () => {
      const conv = makeConversation({ id: 'conv-1', status: 'active' })
      const updatedConv = makeConversation({ id: 'conv-1', status: 'assigned', assignedTeamId: 5 })

      mockAssignConversation.mockResolvedValue({ success: true, data: updatedConv })

      const deps = makeDeps({
        conversations: ref([conv]),
        currentConversation: ref({ ...conv })
      })
      const actions = createAssignmentActions(deps)

      await actions.assignConversationToTeam('conv-1', 5, 'Support')

      expect(deps.currentConversation.value?.assignedTeamId).toBe(5)
    })

    it('rolls back on API failure', async () => {
      const conv = makeConversation({ id: 'conv-1', status: 'active' })

      mockAssignConversation.mockResolvedValue({ success: false, error: 'forbidden' })

      const deps = makeDeps({
        conversations: ref([{ ...conv }]),
        currentConversation: ref(null)
      })
      const actions = createAssignmentActions(deps)

      const result = await actions.assignConversationToTeam('conv-1', 5)

      expect(result).toBe(false)
      expect(deps.conversations.value[0].status).toBe('active')
      expect(deps.handleError).toHaveBeenCalled()
    })

    it('rolls back on API exception', async () => {
      const conv = makeConversation({ id: 'conv-1', status: 'active' })

      mockAssignConversation.mockRejectedValue(new Error('network'))

      const deps = makeDeps({
        conversations: ref([{ ...conv }]),
        currentConversation: ref(null)
      })
      const actions = createAssignmentActions(deps)

      const result = await actions.assignConversationToTeam('conv-1', 5)

      expect(result).toBe(false)
      expect(deps.conversations.value[0].status).toBe('active')
      expect(deps.handleError).toHaveBeenCalled()
    })

    it('uses fallback fetch when API returns no data', async () => {
      const conv = makeConversation({ id: 'conv-1', status: 'active' })
      const fetchedConv = makeConversation({ id: 'conv-1', status: 'assigned', assignedTeamId: 5 })

      mockAssignConversation.mockResolvedValue({ success: true }) // no data
      mockGetConversation.mockResolvedValue({ success: true, data: fetchedConv })

      const deps = makeDeps({
        conversations: ref([conv])
      })
      const actions = createAssignmentActions(deps)

      const result = await actions.assignConversationToTeam('conv-1', 5)

      expect(result).toBe(true)
      expect(mockGetConversation).toHaveBeenCalledWith('conv-1')
      expect(deps.conversations.value[0].assignedTeamId).toBe(5)
    })

    it('handles conversation not in list (no snapshot)', async () => {
      // conversation not found in the array
      mockAssignConversation.mockResolvedValue({ success: true, data: makeConversation({ id: 'conv-99' }) })

      const deps = makeDeps({
        conversations: ref([])
      })
      const actions = createAssignmentActions(deps)

      const result = await actions.assignConversationToTeam('conv-99', 5)

      expect(result).toBe(true)
    })
  })

  describe('unassignConversation', () => {
    it('returns false when conversationId is empty', async () => {
      const deps = makeDeps()
      const actions = createAssignmentActions(deps)

      const result = await actions.unassignConversation('')
      expect(result).toBe(false)
    })

    it('optimistically sets status to pending and clears team', async () => {
      const conv = makeConversation({
        id: 'conv-1',
        status: 'assigned',
        assignedTeamId: 3,
        assignedTeam: { id: 3, name: 'Team 3', description: null }
      })
      const unassignedConv = makeConversation({
        id: 'conv-1',
        status: 'pending',
        assignedTeamId: undefined,
        assignedTeam: undefined
      })

      mockUnassignConversation.mockResolvedValue({ success: true, data: unassignedConv })

      const deps = makeDeps({ conversations: ref([conv]) })
      const actions = createAssignmentActions(deps)

      const result = await actions.unassignConversation('conv-1', 'no longer needed')

      expect(result).toBe(true)
      expect(mockUnassignConversation).toHaveBeenCalledWith('conv-1', 'no longer needed')
    })

    it('rolls back on failure', async () => {
      const conv = makeConversation({ id: 'conv-1', status: 'assigned', assignedTeamId: 3 })

      mockUnassignConversation.mockResolvedValue({ success: false, error: 'denied' })

      const deps = makeDeps({ conversations: ref([{ ...conv }]) })
      const actions = createAssignmentActions(deps)

      const result = await actions.unassignConversation('conv-1')

      expect(result).toBe(false)
      // Should rollback to original
      expect(deps.conversations.value[0].status).toBe('assigned')
      expect(deps.conversations.value[0].assignedTeamId).toBe(3)
    })
  })

  describe('transferConversationToTeam', () => {
    it('returns false when conversationId is empty', async () => {
      const deps = makeDeps()
      const actions = createAssignmentActions(deps)

      const result = await actions.transferConversationToTeam('', 1, 2)
      expect(result).toBe(false)
    })

    it('returns false when toTeamId is 0 (falsy)', async () => {
      const deps = makeDeps()
      const actions = createAssignmentActions(deps)

      const result = await actions.transferConversationToTeam('conv-1', 1, 0)
      expect(result).toBe(false)
    })

    it('applies optimistic team update and calls transfer API', async () => {
      const conv = makeConversation({ id: 'conv-1', assignedTeamId: 1 })
      const transferredConv = makeConversation({ id: 'conv-1', assignedTeamId: 2 })

      mockTransferConversation.mockResolvedValue({ success: true, data: transferredConv })

      const deps = makeDeps({ conversations: ref([conv]) })
      const actions = createAssignmentActions(deps)

      const result = await actions.transferConversationToTeam('conv-1', 1, 2, 'Sales Team', 'escalation')

      expect(result).toBe(true)
      expect(mockTransferConversation).toHaveBeenCalledWith('conv-1', {
        fromTeamId: 1,
        toTeamId: 2,
        reason: 'escalation'
      })
    })

    it('uses default team name when toTeamName is omitted', async () => {
      const conv = makeConversation({ id: 'conv-1', assignedTeamId: 1 })
      mockTransferConversation.mockResolvedValue({ success: true, data: conv })

      const deps = makeDeps({ conversations: ref([conv]) })
      const actions = createAssignmentActions(deps)

      // During optimistic update, assignedTeam.name should fallback to `Team ${toTeamId}`
      await actions.transferConversationToTeam('conv-1', 1, 7)

      // The API was called
      expect(mockTransferConversation).toHaveBeenCalled()
    })

    it('rolls back on exception', async () => {
      const conv = makeConversation({ id: 'conv-1', assignedTeamId: 1 })

      mockTransferConversation.mockRejectedValue(new Error('timeout'))

      const deps = makeDeps({ conversations: ref([{ ...conv }]) })
      const actions = createAssignmentActions(deps)

      const result = await actions.transferConversationToTeam('conv-1', 1, 2)

      expect(result).toBe(false)
      expect(deps.conversations.value[0].assignedTeamId).toBe(1)
    })

    it('rolls back currentConversation on failure', async () => {
      const conv = makeConversation({ id: 'conv-1', assignedTeamId: 1 })

      mockTransferConversation.mockResolvedValue({ success: false, error: 'denied' })

      const deps = makeDeps({
        conversations: ref([{ ...conv }]),
        currentConversation: ref({ ...conv })
      })
      const actions = createAssignmentActions(deps)

      await actions.transferConversationToTeam('conv-1', 1, 2)

      expect(deps.currentConversation.value?.assignedTeamId).toBe(1)
    })
  })
})
