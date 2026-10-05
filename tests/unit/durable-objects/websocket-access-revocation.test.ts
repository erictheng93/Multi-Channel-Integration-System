import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SQLite from 'better-sqlite3'
import { ConversationRoom } from '@/durable-objects/ConversationRoom'
import { UserConnection } from '@/durable-objects/UserConnection'
import { AgentTeamsService } from '@/modules/teams/services/agent-teams-service'
import { transferConversationToTeam } from '@/utils/team'
import { AgentService } from '@/modules/agents/services/agent-crud'
import { MemberService } from '@/modules/teams/services/member-service'
import { TeamService } from '@/modules/teams/services/team-service'
import { createDbClient } from '@/db/drizzle-factory'
import { ConversationEventBroadcaster } from '@/modules/websocket/services/conversation-events'
import type { DurableObjectClient } from '@/modules/websocket/services/durable-object-client'
import type { BatchQueueManager } from '@/modules/websocket/services/batch-queue-manager'
import type { Bindings } from '@/types'

// Exercise real Drizzle queries; only the Cloudflare D1/WebSocket boundary is replaced.
function d1(sqlite: SQLite.Database): D1Database {
  return {
    prepare(query: string) {
      let params: unknown[] = []
      const statement = {
        bind(...values: unknown[]) { params = values; return statement },
        async raw() { return sqlite.prepare(query).raw().all(...params) },
        async all() { return { results: sqlite.prepare(query).all(...params) } },
        async run() { return { success: true, meta: sqlite.prepare(query).run(...params) } }
      }
      return statement
    }
  } as unknown as D1Database
}

function socket(userId: string, role: 'agent' | 'admin' = 'agent') {
  const attachment = {
    connectionId: `connection-${userId}`, userId, role, conversationId: 'conv',
    connectedAt: 1000, lastActivity: 2000, tokenExp: 2000000000
  }
  return {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(function (this: { readyState: number }) { this.readyState = 2 }),
    deserializeAttachment: () => attachment,
    serializeAttachment: vi.fn()
  }
}

function state(sockets: ReturnType<typeof socket>[] = [], stored = new Map<string, unknown>()) {
  return {
    getWebSockets: vi.fn((tag?: string) => sockets.filter(ws =>
      !tag || ws.deserializeAttachment().userId === tag)),
    acceptWebSocket: vi.fn(), setWebSocketAutoResponse: vi.fn(),
    storage: {
      get: vi.fn(async (key: string) => stored.get(key)),
      put: vi.fn(async (key: string, value: unknown) => { stored.set(key, value) }),
      delete: vi.fn(async (key: string) => stored.delete(key)),
      list: vi.fn(async ({ prefix }: { prefix: string }) =>
        new Map([...stored].filter(([key]) => key.startsWith(prefix)))),
      getAlarm: vi.fn(async () => null), setAlarm: vi.fn(), deleteAlarm: vi.fn()
    }
  } as unknown as DurableObjectState
}

function post(path: string, body: unknown = {}) {
  return new Request(`https://internal${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  })
}

describe('WebSocket access revocation (#25)', () => {
  let sqlite: SQLite.Database
  let env: Bindings
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-05T00:00:00Z'))
    vi.stubGlobal('WebSocketRequestResponsePair', class {})
    vi.stubGlobal('WebSocket', { OPEN: 1 })
    sqlite = new SQLite(':memory:')
    sqlite.exec(`
      CREATE TABLE agents (id TEXT PRIMARY KEY, email TEXT, display_name TEXT, role TEXT,
        is_active INTEGER, created_at TEXT, updated_at TEXT, deleted_at TEXT,
        password_hash TEXT, password_policy TEXT, last_active TEXT, last_login_at TEXT);
      CREATE TABLE teams (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE agent_teams (id INTEGER PRIMARY KEY, agent_id TEXT, team_id INTEGER,
        role_in_team TEXT, is_primary INTEGER, joined_at TEXT, created_at TEXT);
      CREATE TABLE conversations (id TEXT PRIMARY KEY, customer_id INTEGER,
        assigned_team_id INTEGER, updated_at TEXT);
      CREATE TABLE conversation_transfers (id INTEGER PRIMARY KEY, conversation_id TEXT,
        from_team_id INTEGER, to_team_id INTEGER, transferred_by TEXT,
        transfer_reason TEXT, transfer_type TEXT, created_at TEXT);
      INSERT INTO teams VALUES (1, 'old'), (2, 'new');
      INSERT INTO agents (id, email, display_name, role, is_active, created_at, updated_at, deleted_at) VALUES
        ('old', 'old@test', 'old', 'agent', 1, '', '', NULL),
        ('new', 'new@test', 'new', 'agent', 1, '', '', NULL),
        ('admin', 'admin@test', 'admin', 'admin', 1, '', '', NULL);
      INSERT INTO agent_teams (agent_id, team_id, is_primary) VALUES ('old', 1, 1), ('new', 2, 1);
      INSERT INTO conversations VALUES ('conv', 99, 1, '');
    `)
    env = { DB: d1(sqlite) } as Bindings
  })
  afterEach(() => { sqlite.close(); vi.useRealTimers(); vi.unstubAllGlobals() })

  it('evicts old-team sockets after transfer while retaining admin and new-team members', async () => {
    const old = socket('old'), next = socket('new'), admin = socket('admin', 'admin')
    const room = new ConversationRoom(state([old, next, admin]), env, { mode: 'simplified' })
    sqlite.exec("UPDATE conversations SET assigned_team_id = 2 WHERE id = 'conv'")
    expect((await room.fetch(post('/evict'))).status).toBe(200)
    expect(old.close).toHaveBeenCalledWith(4403, 'Access revoked')
    expect(next.close).not.toHaveBeenCalled()
    expect(admin.close).not.toHaveBeenCalled()
    old.send.mockClear()
    await room.fetch(post('/broadcast', { type: 'message_created', timestamp: Date.now() }))
    expect(old.send).not.toHaveBeenCalled()
    const metrics = await (await room.fetch(new Request('https://room/metrics'))).json()
    expect(metrics.activeConnections).toBe(2)
  })

  it('rechecks hibernated sockets added after construction and removes every device of the targeted user', async () => {
    const ws = socket('old'), second = socket('old')
    second.deserializeAttachment = () => ({ ...ws.deserializeAttachment(), connectionId: 'device-2' })
    const ctx = state()
    const room = new ConversationRoom(ctx, env, { mode: 'simplified' })
    vi.mocked(ctx.getWebSockets).mockReturnValue([ws, second] as unknown as WebSocket[])
    sqlite.exec("DELETE FROM agent_teams WHERE agent_id = 'old'")
    await room.fetch(post('/evict', { userIds: ['old'] }))
    expect(ws.close).toHaveBeenCalledWith(4403, 'Access revoked')
    expect(second.close).toHaveBeenCalledWith(4403, 'Access revoked')
  })

  it.each(['is_active = 0', "deleted_at = '2026-10-05'"])(
    'evicts even an admin when their account has %s', async change => {
      const ws = socket('admin', 'admin')
      const room = new ConversationRoom(state([ws]), env, { mode: 'simplified' })
      sqlite.exec(`UPDATE agents SET ${change} WHERE id = 'admin'`)
      await room.fetch(post('/evict'))
      expect(ws.close).toHaveBeenCalledWith(4403, 'Access revoked')
    }
  )

  it('expires access within five minutes across hibernation without a mutation notification', async () => {
    const ws = socket('old'), stored = new Map<string, unknown>(), ctx = state([ws], stored)
    const room = new ConversationRoom(ctx, env, { mode: 'simplified' })
    await room.fetch(new Request('https://room/metrics'))
    expect(ctx.storage.setAlarm).toHaveBeenCalledWith(Date.now() + 300000)
    sqlite.exec("DELETE FROM agent_teams WHERE agent_id = 'old'")
    vi.setSystemTime(Date.now() + 300000)
    const restored = new ConversationRoom(ctx, env, { mode: 'simplified' })
    await restored.alarm()
    expect(ws.close).toHaveBeenCalledWith(4403, 'Access revoked')
    expect(ctx.storage.deleteAlarm).toHaveBeenCalled()
  })

  it('rejects malformed eviction requests without closing sockets', async () => {
    const ws = socket('old')
    const room = new ConversationRoom(state([ws]), env, { mode: 'simplified' })
    expect((await room.fetch(post('/evict', { userIds: 'old' }))).status).toBe(400)
    expect((await room.fetch(new Request('https://room/evict'))).status).toBe(405)
    expect(ws.close).not.toHaveBeenCalled()
  })

  it('membership removal reaches tracked rooms and closes the global socket after hibernation', async () => {
    const ws = socket('old'), global = socket('old')
    const room = new ConversationRoom(state([ws]), env, { mode: 'simplified' })
    const stored = new Map<string, unknown>([['room:connection-old', 'conv'], ['subscriptions', ['conv']]])
    env.CONVERSATION_ROOM = {
      idFromName: (id: string) => id,
      get: () => ({ fetch: (req: Request) => room.fetch(req) })
    } as unknown as DurableObjectNamespace
    const user = new UserConnection(state([global], stored), { ...env, userId: 'old' })
    env.USER_CONNECTION = {
      idFromName: (id: string) => id,
      get: () => ({ fetch: (req: Request) => user.fetch(req) })
    } as unknown as DurableObjectNamespace
    await new AgentTeamsService(env.DB, env).removeAgentFromTeam('old', 1)
    expect(ws.close).toHaveBeenCalledWith(4403, 'Access revoked')
    expect(global.close).toHaveBeenCalledWith(4403, 'Access revoked')
    expect(stored.get('subscriptions')).toEqual([])
  })

  it('the transfer utility notifies the room before returning', async () => {
    const ws = socket('old')
    const room = new ConversationRoom(state([ws]), env, { mode: 'simplified' })
    env.CONVERSATION_ROOM = {
      idFromName: (id: string) => id,
      get: () => ({ fetch: (req: Request) => room.fetch(req) })
    } as unknown as DurableObjectNamespace
    await transferConversationToTeam(env.DB, 'conv', 1, 2, 'admin', undefined, env)
    expect(ws.close).toHaveBeenCalledWith(4403, 'Access revoked')
  })

  it('tracks direct room connections durably without a global socket and untracks the last device', async () => {
    const userStorage = new Map<string, unknown>()
    const user = new UserConnection(state([], userStorage), { ...env, userId: 'old' })
    env.USER_CONNECTION = {
      idFromName: (id: string) => id,
      get: () => ({ fetch: (req: Request) => user.fetch(req) })
    } as unknown as DurableObjectNamespace
    // Use the existing connection lifecycle, with WebSocketPair replaced at its boundary.
    const server = socket('old')
    vi.stubGlobal('WebSocketPair', class { 0 = socket('old'); 1 = server })
    const room = new ConversationRoom(state(), env, { mode: 'simplified' })
    await room.fetch(new Request(
      'https://room/ws?conversationId=conv&userId=old&role=agent&token=test',
      { headers: { Upgrade: 'websocket' } }
    ))
    expect([...userStorage.values()]).toContain('conv')
    // serializeAttachment receives the generated connection ID.
    const attachment = server.serializeAttachment.mock.calls.at(-1)![0]
    server.deserializeAttachment = () => attachment
    await room.webSocketClose(server as unknown as WebSocket, 1000, '', true)
    await Promise.resolve()
    expect([...userStorage.values()]).not.toContain('conv')
  })

  it('agent deactivation through AgentService closes both room and global sockets', async () => {
    const ws = socket('old'), global = socket('old')
    const room = new ConversationRoom(state([ws]), env, { mode: 'simplified' })
    env.CONVERSATION_ROOM = {
      idFromName: (id: string) => id,
      get: () => ({ fetch: (req: Request) => room.fetch(req) })
    } as unknown as DurableObjectNamespace
    const user = new UserConnection(state([global], new Map([['room:connection-old', 'conv']])), { ...env, userId: 'old' })
    env.USER_CONNECTION = {
      idFromName: (id: string) => id,
      get: () => ({ fetch: (req: Request) => user.fetch(req) })
    } as unknown as DurableObjectNamespace
    await new AgentService(createDbClient(env.DB), env).updateAgent('old', { isActive: false })
    expect(ws.close).toHaveBeenCalledWith(4403, 'Access revoked')
    expect(global.close).toHaveBeenCalledWith(4403, 'Access revoked')
  })

  it('bulk deactivation through MemberService closes global sockets immediately', async () => {
    const ws = socket('old')
    const user = new UserConnection(state([ws]), { ...env, userId: 'old' })
    env.USER_CONNECTION = {
      idFromName: (id: string) => id,
      get: () => ({ fetch: (req: Request) => user.fetch(req) })
    } as unknown as DurableObjectNamespace
    await new MemberService(env.DB, env).bulkUpdateMembers(['old'], { isActive: false }, 'admin')
    expect(ws.close).toHaveBeenCalledWith(4403, 'Access revoked')
  })

  it('bulk removal through the team member API service closes global sockets immediately', async () => {
    const ws = socket('old')
    const user = new UserConnection(state([ws]), { ...env, userId: 'old' })
    env.USER_CONNECTION = {
      idFromName: (id: string) => id,
      get: () => ({ fetch: (req: Request) => user.fetch(req) })
    } as unknown as DurableObjectNamespace
    await new TeamService(env.DB, env).bulkRemoveMembers(1, ['old'])
    expect(ws.close).toHaveBeenCalledWith(4403, 'Access revoked')
  })

  it('transfer broadcasts revoke room access before sending the transfer event', async () => {
    const ws = socket('old')
    const room = new ConversationRoom(state([ws]), env, { mode: 'simplified' })
    env.CONVERSATION_ROOM = {
      idFromName: (id: string) => id,
      get: () => ({ fetch: (req: Request) => room.fetch(req) })
    } as unknown as DurableObjectNamespace
    sqlite.exec("UPDATE conversations SET assigned_team_id = 2 WHERE id = 'conv'")
    const client = {
      broadcastToTeamMembers: async () => true,
      broadcastToConversationRooms: async () => {
        expect(ws.close).toHaveBeenCalledWith(4403, 'Access revoked')
        return true
      }
    } as unknown as DurableObjectClient
    const events = new ConversationEventBroadcaster(env, client, {} as BatchQueueManager, 'test')
    const result = await events.broadcastConversationTransferred({
      conversationId: 'conv', fromTeamId: 1, toTeamId: 2,
      conversation: { id: 'conv' }, transferredBy: { id: 'admin', name: 'Admin' }
    })
    expect(result.conversationRoomNotified).toBe(true)
  })

  it('global account alarms revoke a deleted account across hibernation', async () => {
    const ws = socket('admin', 'admin'), stored = new Map<string, unknown>(), ctx = state([ws], stored)
    const user = new UserConnection(ctx, { ...env, userId: 'admin' })
    await user.fetch(new Request('https://user/metrics'))
    sqlite.exec("DELETE FROM agents WHERE id = 'admin'")
    vi.setSystemTime(Date.now() + 300000)
    const restored = new UserConnection(ctx, { ...env, userId: 'admin' })
    await restored.alarm()
    expect(ws.close).toHaveBeenCalledWith(4403, 'Access revoked')
    expect(ctx.storage.deleteAlarm).toHaveBeenCalled()
  })

  it('a late unregistration of an old device cannot erase the reconnected device', async () => {
    const ws = socket('old'), stored = new Map<string, unknown>()
    const room = new ConversationRoom(state([ws]), env, { mode: 'simplified' })
    env.CONVERSATION_ROOM = {
      idFromName: (id: string) => id,
      get: () => ({ fetch: (req: Request) => room.fetch(req) })
    } as unknown as DurableObjectNamespace
    const user = new UserConnection(state([], stored), { ...env, userId: 'old' })
    for (const [connectionId, connected] of [['device-a', true], ['device-b', true], ['device-a', false]]) {
      await user.fetch(post('/rooms', { userId: 'old', conversationId: 'conv', connectionId, connected }))
    }
    sqlite.exec("DELETE FROM agent_teams WHERE agent_id = 'old'")
    await user.fetch(post('/evict', { userId: 'old' }))
    expect(ws.close).toHaveBeenCalledWith(4403, 'Access revoked')
  })
})
