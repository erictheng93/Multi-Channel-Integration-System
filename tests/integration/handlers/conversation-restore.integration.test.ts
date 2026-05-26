import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

let currentUser = {
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  displayName: 'Admin User',
  role: 'admin',
  isActive: true
}

let permissionCheckResult = true

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: any, next: any) => {
    c.set('user', { ...currentUser })
    c.set('jwtPayload', {
      userId: String(currentUser.id),
      username: currentUser.username,
      role: currentUser.role
    })
    return next()
  })
}))

vi.mock('@/services/permission-service', () => ({
  PermissionService: {
    checkPermission: vi.fn(() => Promise.resolve(permissionCheckResult))
  }
}))

vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastConversationEvent: vi.fn().mockResolvedValue(undefined),
    broadcastConversationTransferred: vi.fn().mockResolvedValue(undefined)
  }))
}))

interface DrizzleMockState {
  selectLimitResults: unknown[]
  selectGetResults: unknown[]
  inserts: unknown[]
  updates: unknown[]
}

let drizzleState: DrizzleMockState

function createDrizzleMock() {
  const makeSelectChain = () => {
    const chain: any = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      limit: vi.fn(() => Promise.resolve(drizzleState.selectLimitResults.shift() ?? [])),
      get: vi.fn(() => Promise.resolve(drizzleState.selectGetResults.shift()))
    }
    return chain
  }

  const makeUpdateChain = () => {
    const chain: any = {
      set: vi.fn((value) => {
        drizzleState.updates.push(value)
        return chain
      }),
      where: vi.fn(() => Promise.resolve({ changes: 1 }))
    }
    return chain
  }

  const makeInsertChain = () => ({
    values: vi.fn((value) => {
      drizzleState.inserts.push(value)
      return Promise.resolve({ success: true })
    })
  })

  return {
    select: vi.fn(() => makeSelectChain()),
    update: vi.fn(() => makeUpdateChain()),
    insert: vi.fn(() => makeInsertChain())
  }
}

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => createDrizzleMock())
}))

import conversationAssignmentHandler from '@/modules/conversations/handlers/conversation-assignment'

interface PreparedStatement {
  sql: string
  params: unknown[]
  bind: (...params: unknown[]) => PreparedStatement
  first: ReturnType<typeof vi.fn>
  run: ReturnType<typeof vi.fn>
}

function makeD1Mock(firstResults: Record<string, unknown>[]) {
  const prepared: PreparedStatement[] = []
  const batch = vi.fn(async (_statements: PreparedStatement[]) => [{ success: true }])

  const db = {
    prepared,
    batch,
    prepare: vi.fn((sql: string): PreparedStatement => {
      const statement: PreparedStatement = {
        sql,
        params: [],
        bind: vi.fn((...params: unknown[]) => {
          statement.params = params
          return statement
        }),
        first: vi.fn(async () => firstResults.shift() ?? null),
        run: vi.fn(async () => ({ success: true, changes: 1 }))
      }
      prepared.push(statement)
      return statement
    })
  }

  return db
}

function makeApp(db: ReturnType<typeof makeD1Mock>) {
  const app = new Hono()
  app.route('/api/conversations', conversationAssignmentHandler)
  return {
    app,
    env: {
      DB: db,
      JWT_SECRET: 'test-secret'
    }
  }
}

function extractActivityDetailsFromBatch(db: ReturnType<typeof makeD1Mock>) {
  const activityStmt = db.batch.mock.calls[0][0].find((stmt: PreparedStatement) =>
    stmt.sql.includes('INSERT INTO activities')
  )
  expect(activityStmt).toBeTruthy()

  const detailsParam = activityStmt.params.find(
    (param) => typeof param === 'string' && (param as string).includes('restoreHandler')
  )
  expect(detailsParam).toBeTruthy()
  return JSON.parse(detailsParam as string)
}

describe('conversation assignment reversible activity capture', () => {
  beforeEach(() => {
    currentUser = {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      displayName: 'Admin User',
      role: 'admin',
      isActive: true
    }
    permissionCheckResult = true
    drizzleState = {
      selectGetResults: [{ name: 'Support' }],
      selectLimitResults: [
        [
          {
            conversations: {
              id: 'conv-1',
              customerId: 'customer-1',
              assignedTeamId: 7,
              status: 'assigned',
              updatedAt: '2026-05-26T00:00:00.000Z'
            },
            teams: { id: 7, name: 'Support' },
            customers: { id: 'customer-1', displayName: 'Customer One' }
          }
        ]
      ],
      inserts: [],
      updates: []
    }
  })

  it('captures assign mutation and reversible activity in one D1 batch', async () => {
    const db = makeD1Mock([
      {
        id: 'conv-1',
        assigned_team_id: 3,
        status: 'active',
        updated_at: '2026-05-25T00:00:00.000Z'
      }
    ])
    const { app, env } = makeApp(db)

    const response = await app.request(
      '/api/conversations/conv-1/assign',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: 7, reason: 'handoff' })
      },
      env
    )

    expect(response.status).toBe(200)
    expect(db.batch).toHaveBeenCalledTimes(1)
    expect(db.batch.mock.calls[0][0]).toHaveLength(3)

    const details = extractActivityDetailsFromBatch(db)
    expect(details.restoreHandler).toBe('conversation.assign')
    expect(details.previousState).toMatchObject({
      assigned_team_id: 3,
      status: 'active'
    })
    expect(details.newState).toMatchObject({
      assigned_team_id: 7,
      status: 'assigned'
    })
  })

  it('captures unassign mutation and reversible activity in one D1 batch', async () => {
    drizzleState.selectLimitResults = [
      [
        {
          conversations: {
            id: 'conv-1',
            customerId: 'customer-1',
            assignedTeamId: 7,
            status: 'assigned',
            updatedAt: '2026-05-25T00:00:00.000Z'
          },
          teams: { id: 7, name: 'Support' }
        }
      ],
      [
        {
          conversations: {
            id: 'conv-1',
            customerId: 'customer-1',
            assignedTeamId: null,
            status: 'active',
            updatedAt: '2026-05-26T00:00:00.000Z'
          },
          teams: null,
          customers: { id: 'customer-1', displayName: 'Customer One' }
        }
      ]
    ]

    const db = makeD1Mock([])
    const { app, env } = makeApp(db)

    const response = await app.request(
      '/api/conversations/conv-1/unassign',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'done' })
      },
      env
    )

    expect(response.status).toBe(200)
    expect(db.batch).toHaveBeenCalledTimes(1)
    expect(db.batch.mock.calls[0][0]).toHaveLength(3)

    const details = extractActivityDetailsFromBatch(db)
    expect(details.restoreHandler).toBe('conversation.unassign')
    expect(details.previousState).toMatchObject({
      assigned_team_id: 7,
      status: 'assigned'
    })
    expect(details.newState).toMatchObject({
      assigned_team_id: null,
      status: 'active'
    })
  })
})
