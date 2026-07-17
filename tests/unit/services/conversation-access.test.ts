import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Bindings } from '@/types'
import { canConversationBeAccessedBy } from '@/services/conversation-access'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ get: mocks.get })),
      })),
    })),
  })),
}))

const env = { DB: {} } as Bindings

describe('canConversationBeAccessedBy', () => {
  beforeEach(() => {
    mocks.get.mockReset()
  })

  const conversationRow = (overrides: Partial<{ customerId: string | number | null; assignedTeamId: string | number | null }> = {}) => ({
    id: 'conv-1',
    customerId: 'customer-1',
    assignedTeamId: null,
    ...overrides,
  })

  it('allows the owning customer', async () => {
    mocks.get.mockResolvedValue(conversationRow({ assignedTeamId: 7 }))

    const decision = await canConversationBeAccessedBy(env, {
      userId: 'customer-1',
      role: 'customer',
    }, 'conv-1')

    expect(decision.allowed).toBe(true)
  })

  // IDOR regression: the unassigned pool is an agent workflow concept and
  // must never let one customer read another customer's conversation.
  it('denies a non-owner customer access to an unassigned conversation', async () => {
    mocks.get.mockResolvedValue(conversationRow({ customerId: 'customer-2', assignedTeamId: null }))

    const decision = await canConversationBeAccessedBy(env, {
      userId: 'customer-1',
      role: 'customer',
    }, 'conv-1')

    expect(decision.allowed).toBe(false)
  })

  it('denies a roleless principal access to an unassigned conversation it does not own', async () => {
    mocks.get.mockResolvedValue(conversationRow({ customerId: 'customer-2', assignedTeamId: null }))

    const decision = await canConversationBeAccessedBy(env, {
      userId: 'someone-else',
    }, 'conv-1')

    expect(decision.allowed).toBe(false)
  })

  it('allows agents to pick up unassigned pool conversations', async () => {
    mocks.get.mockResolvedValue(conversationRow({ assignedTeamId: null }))

    const decision = await canConversationBeAccessedBy(env, {
      userId: 'agent-1',
      role: 'agent',
      allowedTeamIds: [7],
    }, 'conv-1')

    expect(decision.allowed).toBe(true)
  })

  it('allows agents in the assigned team', async () => {
    mocks.get.mockResolvedValue(conversationRow({ assignedTeamId: 7 }))

    const decision = await canConversationBeAccessedBy(env, {
      userId: 'agent-1',
      role: 'agent',
      allowedTeamIds: [7],
    }, 'conv-1')

    expect(decision.allowed).toBe(true)
  })

  it('denies agents outside the assigned team', async () => {
    mocks.get.mockResolvedValue(conversationRow({ assignedTeamId: 9 }))

    const decision = await canConversationBeAccessedBy(env, {
      userId: 'agent-1',
      role: 'agent',
      allowedTeamIds: [7],
    }, 'conv-1')

    expect(decision.allowed).toBe(false)
  })

  it('always allows admins', async () => {
    mocks.get.mockResolvedValue(conversationRow({ customerId: 'customer-2', assignedTeamId: 9 }))

    const decision = await canConversationBeAccessedBy(env, {
      userId: 'admin-1',
      role: 'admin',
    }, 'conv-1')

    expect(decision.allowed).toBe(true)
  })

  it('reports missing conversations as not allowed with no conversation', async () => {
    mocks.get.mockResolvedValue(undefined)

    const decision = await canConversationBeAccessedBy(env, {
      userId: 'agent-1',
      role: 'agent',
    }, 'conv-missing')

    expect(decision).toEqual({ allowed: false, conversation: null })
  })
})
