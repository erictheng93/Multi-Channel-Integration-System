import { describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { BroadcasterDeliveryService } from '@/durable-objects/services/broadcaster-delivery-service'
import { BroadcasterHelpers, type BroadcasterContext } from '@/durable-objects/services/broadcaster-helpers'

function setup() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE agents (id TEXT PRIMARY KEY, role TEXT, is_active INTEGER, deleted_at TEXT);
    CREATE TABLE agent_teams (agent_id TEXT, team_id INTEGER);
    CREATE TABLE conversations (id TEXT PRIMARY KEY, assigned_team_id INTEGER);
    INSERT INTO agents VALUES ('owner', 'agent', 1, NULL), ('other', 'agent', 1, NULL),
      ('admin', 'admin', 1, NULL), ('customer', 'customer', 1, NULL), ('inactive', 'agent', 0, NULL);
    INSERT INTO agent_teams VALUES ('owner', 1), ('other', 2), ('inactive', 1);
    INSERT INTO conversations VALUES ('assigned', 1), ('unassigned', NULL);
  `)
  const users = new Map(['owner', 'other', 'admin', 'customer', 'inactive'].map(id => [id, {
    fetch: vi.fn().mockResolvedValue(Response.json({ deliveredCount: 1 }))
  }]))
  const rooms = new Map(['assigned', 'unassigned'].map(id => [id, {
    fetch: vi.fn().mockResolvedValue(Response.json({ deliveredCount: 1 }))
  }]))
  const ctx = {
    env: { DB: { prepare: (query: string) => ({ bind: (...params: unknown[]) => ({
      all: async () => ({ results: db.prepare(query).all(...params) })
    }) }) } }, userConnections: users, conversationRooms: rooms
  } as unknown as BroadcasterContext
  const delivery = new BroadcasterDeliveryService(ctx, new BroadcasterHelpers(ctx), {} as never)
  const event = (conversationId?: string) => ({ id: 'event', type: 'new_message' as const,
    source: 'api' as const, timestamp: Date.now(), priority: 'normal' as const,
    data: { conversationId, content: 'private' }, targets: [], options: {}, queuedAt: 0, retryCount: 0 })
  return { db, users, rooms, delivery, event, helpers: new BroadcasterHelpers(ctx) }
}

describe('global conversation broadcast visibility', () => {
  it('delivers assigned content only to active team members, admins and the matching room', async () => {
    const { db, users, rooms, delivery, event } = setup()
    await delivery.deliverGlobalBroadcast([event('assigned')])
    expect(users.get('owner')!.fetch).toHaveBeenCalledOnce()
    expect(users.get('admin')!.fetch).toHaveBeenCalledOnce()
    for (const id of ['other', 'customer', 'inactive']) expect(users.get(id)!.fetch).not.toHaveBeenCalled()
    expect(rooms.get('assigned')!.fetch).toHaveBeenCalledOnce()
    expect(rooms.get('unassigned')!.fetch).not.toHaveBeenCalled()
    db.close()
  })

  it('preserves the unassigned pool for agents and admins, excluding customers', async () => {
    const { db, users, delivery, event } = setup()
    await delivery.deliverGlobalBroadcast([event('unassigned')])
    for (const id of ['owner', 'other', 'admin']) expect(users.get(id)!.fetch).toHaveBeenCalledOnce()
    expect(users.get('customer')!.fetch).not.toHaveBeenCalled()
    expect(users.get('inactive')!.fetch).not.toHaveBeenCalled()
    db.close()
  })

  it('fails closed for unknown conversations and missing message context', async () => {
    const { db, users, rooms, delivery, event } = setup()
    await delivery.deliverGlobalBroadcast([event('missing'), event(), {
      ...event('assigned'), conversationId: 'unassigned'
    }])
    for (const stub of [...users.values(), ...rooms.values()]) expect(stub.fetch).not.toHaveBeenCalled()
    db.close()
  })

  it('queries current multi-team membership without the removed agents.team_id column', async () => {
    const { db, helpers } = setup()
    expect(await helpers.getTeamMembers('1')).toEqual(['owner'])
    db.close()
  })
})
