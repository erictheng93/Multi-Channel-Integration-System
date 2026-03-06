/**
 * Unit Tests for conversations/helpers.ts
 *
 * Tests: hasConversationChanged, computeStatsFromConversations
 */

import { describe, it, expect } from 'vitest'
import { hasConversationChanged, computeStatsFromConversations } from '@/stores/conversations/helpers'
import type { Conversation } from '@/types'

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

// ===== Tests =====

describe('hasConversationChanged', () => {
  it('returns false when two conversations are identical', () => {
    const a = makeConversation()
    const b = makeConversation()
    expect(hasConversationChanged(a, b)).toBe(false)
  })

  it('returns true when status differs', () => {
    const a = makeConversation({ status: 'active' })
    const b = makeConversation({ status: 'pending' })
    expect(hasConversationChanged(a, b)).toBe(true)
  })

  it('returns true when unreadCount differs', () => {
    const a = makeConversation({ unreadCount: 0 })
    const b = makeConversation({ unreadCount: 3 })
    expect(hasConversationChanged(a, b)).toBe(true)
  })

  it('returns true when lastMessageAt differs', () => {
    const a = makeConversation({ lastMessageAt: 1000 })
    const b = makeConversation({ lastMessageAt: 2000 })
    expect(hasConversationChanged(a, b)).toBe(true)
  })

  it('returns true when assignedTeamId differs', () => {
    const a = makeConversation({ assignedTeamId: 1 })
    const b = makeConversation({ assignedTeamId: 2 })
    expect(hasConversationChanged(a, b)).toBe(true)
  })

  it('returns true when priority differs', () => {
    const a = makeConversation()
    const b = makeConversation()
    ;(a as Record<string, unknown>).priority = 'low'
    ;(b as Record<string, unknown>).priority = 'high'
    expect(hasConversationChanged(a, b)).toBe(true)
  })

  it('returns true when updatedAt differs', () => {
    const a = makeConversation({ updatedAt: 1000 })
    const b = makeConversation({ updatedAt: 2000 })
    expect(hasConversationChanged(a, b)).toBe(true)
  })

  it('returns true when platform differs', () => {
    const a = makeConversation({ platform: 'line' })
    const b = makeConversation({ platform: 'facebook' })
    expect(hasConversationChanged(a, b)).toBe(true)
  })

  it('returns true when existing is null-ish (guard)', () => {
    const b = makeConversation()
    expect(hasConversationChanged(null as unknown as Conversation, b)).toBe(true)
  })

  it('returns true when updated is null-ish (guard)', () => {
    const a = makeConversation()
    expect(hasConversationChanged(a, null as unknown as Conversation)).toBe(true)
  })

  it('returns true when both are null-ish', () => {
    expect(
      hasConversationChanged(null as unknown as Conversation, null as unknown as Conversation)
    ).toBe(true)
  })

  it('returns false when non-key fields differ', () => {
    // userId is NOT in keyFields
    const a = makeConversation({ userId: 'user-1' })
    const b = makeConversation({ userId: 'user-2' })
    expect(hasConversationChanged(a, b)).toBe(false)
  })

  it('detects change in nested lastMessage object', () => {
    const a = makeConversation({
      lastMessage: { id: 'm1', content: 'hello', senderType: 'customer' } as Conversation['lastMessage']
    })
    const b = makeConversation({
      lastMessage: { id: 'm2', content: 'world', senderType: 'agent' } as Conversation['lastMessage']
    })
    expect(hasConversationChanged(a, b)).toBe(true)
  })

  it('detects change in assignedTeam object', () => {
    const a = makeConversation({
      assignedTeam: { id: 1, name: 'Team A', description: null }
    })
    const b = makeConversation({
      assignedTeam: { id: 2, name: 'Team B', description: null }
    })
    expect(hasConversationChanged(a, b)).toBe(true)
  })
})

describe('computeStatsFromConversations', () => {
  it('returns zero stats for empty array', () => {
    const stats = computeStatsFromConversations([])
    expect(stats).toEqual({
      total: 0,
      active: 0,
      assigned: 0,
      pending: 0,
      unreadCount: 0
    })
  })

  it('counts active conversations', () => {
    const list = [
      makeConversation({ id: 'c1', status: 'active' }),
      makeConversation({ id: 'c2', status: 'active' })
    ]
    const stats = computeStatsFromConversations(list)
    expect(stats.total).toBe(2)
    expect(stats.active).toBe(2)
    expect(stats.assigned).toBe(0)
    expect(stats.pending).toBe(0)
  })

  it('counts in-progress as assigned', () => {
    const list = [
      makeConversation({ id: 'c1', status: 'in-progress' })
    ]
    const stats = computeStatsFromConversations(list)
    expect(stats.assigned).toBe(1)
  })

  it('counts pending conversations', () => {
    const list = [
      makeConversation({ id: 'c1', status: 'pending' }),
      makeConversation({ id: 'c2', status: 'pending' }),
      makeConversation({ id: 'c3', status: 'active' })
    ]
    const stats = computeStatsFromConversations(list)
    expect(stats.pending).toBe(2)
    expect(stats.active).toBe(1)
    expect(stats.total).toBe(3)
  })

  it('sums unreadCount across all conversations', () => {
    const list = [
      makeConversation({ id: 'c1', unreadCount: 3 }),
      makeConversation({ id: 'c2', unreadCount: 5 }),
      makeConversation({ id: 'c3', unreadCount: 0 })
    ]
    const stats = computeStatsFromConversations(list)
    expect(stats.unreadCount).toBe(8)
  })

  it('treats falsy unreadCount as 0', () => {
    const list = [
      makeConversation({ id: 'c1', unreadCount: undefined as unknown as number }),
      makeConversation({ id: 'c2', unreadCount: 0 })
    ]
    const stats = computeStatsFromConversations(list)
    expect(stats.unreadCount).toBe(0)
  })

  it('handles mixed statuses correctly', () => {
    const list = [
      makeConversation({ id: 'c1', status: 'active', unreadCount: 2 }),
      makeConversation({ id: 'c2', status: 'pending', unreadCount: 1 }),
      makeConversation({ id: 'c3', status: 'in-progress', unreadCount: 0 }),
      makeConversation({ id: 'c4', status: 'assigned', unreadCount: 4 }),
      makeConversation({ id: 'c5', status: 'waiting', unreadCount: 0 })
    ]
    const stats = computeStatsFromConversations(list)
    expect(stats.total).toBe(5)
    expect(stats.active).toBe(1)
    expect(stats.assigned).toBe(1) // in-progress
    expect(stats.pending).toBe(1)
    expect(stats.unreadCount).toBe(7)
  })

  it('does not count "assigned" status as assigned (only in-progress)', () => {
    // The function maps CONVERSATION_STATUS.IN_PROGRESS -> assigned stat
    const list = [
      makeConversation({ id: 'c1', status: 'assigned' })
    ]
    const stats = computeStatsFromConversations(list)
    expect(stats.assigned).toBe(0) // 'assigned' status != IN_PROGRESS
    expect(stats.active).toBe(0)
    expect(stats.pending).toBe(0)
  })
})
