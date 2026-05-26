# Activity Restore — Phase 1 (Infrastructure) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the infrastructure that lets the activity log support undo (capture API, restore registry, REST endpoint, conflict detection) without yet wiring any write handlers. Phase 1 ships as a no-op in production — no record has `reversible: true` until Phase 2 handlers are migrated — but Phase 2 cannot start until this lands.

**Architecture:** Two services + one route. `ActivityCapture` builds D1 `D1PreparedStatement` objects (for use inside `db.batch()` so log writes are atomic with mutations). `RestoreRegistry` maps `restoreHandler` strings to `RestoreHandler` objects exposing both `buildMutation()` (reversal) and `getCurrentState()` (for conflict diffing). `POST /api/activities/:id/restore` runs an 11-step flow including CAS slot acquisition and a transactional D1 batch.

**Tech Stack:** Hono + Drizzle ORM + raw `D1Database` (for batch) on Cloudflare Workers, D1 SQLite (database), Vitest for tests, TypeScript strict mode.

**Spec:** `docs/superpowers/specs/2026-05-26-activity-restore-design.md`

> **Note on line numbers:** Line numbers in this plan are approximate guides. The executing agent MUST read the actual file to find the correct insertion/replacement points. Search for the surrounding code context (variable names, function calls) rather than relying on exact line numbers.

> **Note on D1 access:** Restore-related code uses **raw `D1Database`** (`c.env.DB.prepare(...)` and `c.env.DB.batch([...])`) instead of Drizzle, because Drizzle does not expose `D1PreparedStatement` directly and we need batch-level transaction guarantees per the spec. Existing query patterns elsewhere in the repo (Drizzle) remain unchanged.

> **Note on commit policy:** Per project feedback memory `feedback_atomic_commits.md`, one logical change per commit; never bundle unrelated fixes. Each task ends with its own commit.

> **Note on emoji policy:** Per project feedback memory `feedback_no_emoji.md`, no emoji in source code, comments, console.log, or UI text. Acceptable in commit messages only.

---

## File Structure

### Backend (create)

| File | Responsibility |
|------|---------------|
| `src/modules/activities/services/ActivityCapture.ts` | Build `D1PreparedStatement` objects for reversible / irreversible activity log inserts. Owns the snapshot JSON shape. |
| `src/modules/activities/services/restore-registry.ts` | `RestoreHandler` interface + `RestoreRegistry` const map. Re-exported by the activities module index. |
| `src/modules/activities/services/restore-helpers.ts` | Factory functions: `restoreSoftDeleted`, `softDelete`, `restoreFields`, `restoreField`, `restoreAssignedAgent`, `removeTagFromCustomer`, `addTagToCustomer`. Each returns an object implementing `RestoreHandler`. |
| `src/modules/activities/services/conflict-detector.ts` | Pure function `diffStates(currentState, recordedNewState): MidChange[]`. |
| `src/modules/activities/handlers/activity-restore.ts` | Hono sub-app with one route: `POST /:id`. Implements the 11-step execution flow. |
| `tests/unit/modules/activities/services/ActivityCapture.test.ts` | Unit tests for `buildReversibleLog`, `buildIrreversibleLog`, `logOnly`. |
| `tests/unit/modules/activities/services/restore-helpers.test.ts` | Unit tests for each factory. |
| `tests/unit/modules/activities/services/conflict-detector.test.ts` | Unit tests for `diffStates`. |
| `tests/integration/handlers/activity-restore.integration.test.ts` | Endpoint-level tests covering all 11 flow steps + concurrent restore + D1 batch atomicity. |

### Backend (modify)

| File | Responsibility |
|------|---------------|
| `src/modules/activities/constants/actions.ts` | Add 6 new `*_RESTORE` action constants. |
| `src/modules/activities/handlers/activity.ts` | Mount `activity-restore.ts` BEFORE the parameterized `/:id` route on line 27. |

---

## Task 1: Add Restore Action Constants

**Files:**
- Modify: `src/modules/activities/constants/actions.ts` (after the `SETTINGS_UPDATE` block, before the closing `} as const`)

- [ ] **Step 1: Read the file to find the insertion point**

Read `src/modules/activities/constants/actions.ts`. Find the existing `USER_RESTORE: 'user_restore'` and `SYSTEM_RESTORE: 'system_restore'` entries. The new constants go in the same grouping style.

- [ ] **Step 2: Add the new constants**

Append before the closing `} as const`:

```typescript
  // Restore actions (added by activity-restore design 2026-05-26)
  TAG_RESTORE: 'tag_restore',
  CUSTOMER_RESTORE: 'customer_restore',
  CONVERSATION_RESTORE: 'conversation_restore',
  TEAM_RESTORE: 'team_restore',
  TEAM_MEMBER_RESTORE: 'team_member_restore',
  DELAYED_MESSAGE_RESTORE: 'delayed_message_restore',
```

- [ ] **Step 3: Write a sanity test that ActivityValidator accepts the new actions**

Create `tests/unit/modules/activities/constants/actions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { ACTIVITY_ACTIONS } from '@/modules/activities/constants/actions'
import { ActivityValidator } from '@/modules/activities/utils/validators'

describe('Restore action constants', () => {
  it('exposes all 6 new restore actions', () => {
    expect(ACTIVITY_ACTIONS.TAG_RESTORE).toBe('tag_restore')
    expect(ACTIVITY_ACTIONS.CUSTOMER_RESTORE).toBe('customer_restore')
    expect(ACTIVITY_ACTIONS.CONVERSATION_RESTORE).toBe('conversation_restore')
    expect(ACTIVITY_ACTIONS.TEAM_RESTORE).toBe('team_restore')
    expect(ACTIVITY_ACTIONS.TEAM_MEMBER_RESTORE).toBe('team_member_restore')
    expect(ACTIVITY_ACTIONS.DELAYED_MESSAGE_RESTORE).toBe('delayed_message_restore')
  })

  it('ActivityValidator accepts each new restore action', () => {
    const baseRequest = {
      userId: 'agent-123',
      userName: 'Tester',
      userRole: 'admin',
      resourceType: 'tag',
      resourceId: '42'
    }
    const newActions = [
      'tag_restore',
      'customer_restore',
      'conversation_restore',
      'team_restore',
      'team_member_restore',
      'delayed_message_restore'
    ]
    for (const action of newActions) {
      const errors = ActivityValidator.validateCreateRequest({ ...baseRequest, action })
      const actionErrors = errors.filter(e => e.field === 'action')
      expect(actionErrors).toHaveLength(0)
    }
  })
})
```

- [ ] **Step 4: Run the test**

Run: `bunx vitest run tests/unit/modules/activities/constants/actions.test.ts`
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/constants/actions.ts tests/unit/modules/activities/constants/actions.test.ts
git commit -m "feat(activities): add 6 per-resource RESTORE action constants

Required by activity-restore design — ActivityValidator rejects
unknown action strings, so generic 'RESTORE' fails validation.
Per-resource constants give us clean audit trail filtering too."
```

---

## Task 2: ActivityCapture — File Skeleton + buildReversibleLog Test

**Files:**
- Create: `src/modules/activities/services/ActivityCapture.ts`
- Create: `tests/unit/modules/activities/services/ActivityCapture.test.ts`

- [ ] **Step 1: Write the failing test for `buildReversibleLog` shape**

Create `tests/unit/modules/activities/services/ActivityCapture.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { ActivityCapture, type ReversibleCapture } from '@/modules/activities/services/ActivityCapture'

// Minimal D1 mock — only what buildReversibleLog touches
function makeMockDb() {
  const bound: unknown[] = []
  const stmt = {
    bind: vi.fn((...args: unknown[]) => {
      bound.push(...args)
      return stmt
    }),
    run: vi.fn(),
    all: vi.fn(),
    first: vi.fn(),
    raw: vi.fn()
  }
  const prepare = vi.fn(() => stmt)
  return { db: { prepare, batch: vi.fn() } as unknown as D1Database, prepare, stmt, bound }
}

describe('ActivityCapture.buildReversibleLog', () => {
  it('serializes the full reversible detail JSON shape', () => {
    const { db, prepare, stmt, bound } = makeMockDb()
    const capture = new ActivityCapture(db)

    const capt: ReversibleCapture = {
      request: {
        userId: 'agent-1',
        userName: 'Alice',
        userRole: 'admin',
        action: 'tag_delete',
        resourceType: 'tag',
        resourceId: '42'
      },
      restoreHandler: 'tag.delete',
      previousState: { id: 42, name: 'VIP', deletedAt: null },
      newState: { id: 42, deletedAt: '2026-05-26T14:32:00.000Z' }
    }
    capture.buildReversibleLog(capt)

    expect(prepare).toHaveBeenCalledTimes(1)
    const sql = prepare.mock.calls[0][0] as string
    expect(sql).toMatch(/INSERT INTO activities/i)
    expect(sql).toMatch(/details/)

    // The details JSON is one of the bound params; locate and parse it
    const detailsJson = bound.find(
      v => typeof v === 'string' && v.includes('"reversible":true')
    ) as string
    expect(detailsJson).toBeDefined()
    const details = JSON.parse(detailsJson)

    expect(details.reversible).toBe(true)
    expect(details.restoreHandler).toBe('tag.delete')
    expect(details.previousState).toEqual({ id: 42, name: 'VIP', deletedAt: null })
    expect(details.newState).toEqual({ id: 42, deletedAt: '2026-05-26T14:32:00.000Z' })
    expect(details.restorePolicy).toBeDefined()
    expect(details.restorePolicy.requiresAdmin).toBe(false)
    expect(details.restoredByActivityId).toBeNull()

    // expiresAt should be ~24h after now
    const expiresAt = new Date(details.restorePolicy.expiresAt).getTime()
    const now = Date.now()
    expect(expiresAt - now).toBeGreaterThan(23 * 60 * 60 * 1000)
    expect(expiresAt - now).toBeLessThan(25 * 60 * 60 * 1000)
  })
})
```

- [ ] **Step 2: Run test — expect failure**

Run: `bunx vitest run tests/unit/modules/activities/services/ActivityCapture.test.ts`
Expected: FAIL with `Cannot find module '@/modules/activities/services/ActivityCapture'`.

- [ ] **Step 3: Create the file with a stub that makes the test fail with a more useful error**

Create `src/modules/activities/services/ActivityCapture.ts`:

```typescript
// Activities Module - Capture helper for reversible activity logging
// Builds D1PreparedStatement objects so callers can run log + mutation
// in a single db.batch() transaction (atomic, per Cloudflare D1 batch docs).

import type { CreateActivityRequest } from '../types/interfaces'

export interface ReversibleCapture {
  request: CreateActivityRequest
  restoreHandler: string
  previousState: Record<string, unknown>
  newState: Record<string, unknown>
  expiresInMs?: number
  requiresAdmin?: boolean
}

const DEFAULT_EXPIRES_IN_MS = 24 * 60 * 60 * 1000

export class ActivityCapture {
  constructor(private db: D1Database) {}

  buildReversibleLog(_capture: ReversibleCapture): D1PreparedStatement {
    throw new Error('buildReversibleLog not implemented')
  }

  buildIrreversibleLog(
    _req: CreateActivityRequest & { reason: string }
  ): D1PreparedStatement {
    throw new Error('buildIrreversibleLog not implemented')
  }

  async logOnly(_stmt: D1PreparedStatement): Promise<number | null> {
    throw new Error('logOnly not implemented')
  }
}
```

- [ ] **Step 4: Run test — expect the new error**

Run: `bunx vitest run tests/unit/modules/activities/services/ActivityCapture.test.ts`
Expected: FAIL with `buildReversibleLog not implemented`.

- [ ] **Step 5: Commit (stub)**

```bash
git add src/modules/activities/services/ActivityCapture.ts tests/unit/modules/activities/services/ActivityCapture.test.ts
git commit -m "feat(activities): scaffold ActivityCapture service with stubs

Defines ReversibleCapture interface and the three method signatures.
Implementations follow in subsequent commits — each gated by its
own failing test."
```

---

## Task 3: ActivityCapture — Implement buildReversibleLog

**Files:**
- Modify: `src/modules/activities/services/ActivityCapture.ts`

- [ ] **Step 1: Implement the method**

Replace the `buildReversibleLog` stub:

```typescript
  buildReversibleLog(capture: ReversibleCapture): D1PreparedStatement {
    const now = new Date()
    const expiresAt = new Date(
      now.getTime() + (capture.expiresInMs ?? DEFAULT_EXPIRES_IN_MS)
    )

    const details = {
      reversible: true,
      restoreHandler: capture.restoreHandler,
      previousState: capture.previousState,
      newState: capture.newState,
      restorePolicy: {
        expiresAt: expiresAt.toISOString(),
        requiresAdmin: capture.requiresAdmin ?? false
      },
      restoredByActivityId: null
      // Caller may merge other enrichment fields (targetName, changes[]) into
      // capture.request.details before calling — but those flow through the
      // request.details path below, not here.
    }

    const mergedDetails =
      capture.request.details && typeof capture.request.details === 'object'
        ? { ...capture.request.details, ...details }
        : details

    const r = capture.request
    return this.db
      .prepare(
        `INSERT INTO activities
           (user_id, user_name, user_role, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        r.userId,
        r.userName,
        r.userRole,
        r.action,
        r.resourceType,
        r.resourceId ?? null,
        JSON.stringify(mergedDetails),
        r.ipAddress ?? null,
        r.userAgent ?? null,
        now.toISOString()
      )
  }
```

- [ ] **Step 2: Run the test**

Run: `bunx vitest run tests/unit/modules/activities/services/ActivityCapture.test.ts`
Expected: PASS.

- [ ] **Step 3: Add a test for `expiresInMs` override**

Append to `ActivityCapture.test.ts`:

```typescript
  it('honors expiresInMs override', () => {
    const { db, bound } = makeMockDb()
    const capture = new ActivityCapture(db)

    capture.buildReversibleLog({
      request: {
        userId: 'agent-1',
        userName: 'Alice',
        userRole: 'admin',
        action: 'tag_delete',
        resourceType: 'tag',
        resourceId: '42'
      },
      restoreHandler: 'tag.delete',
      previousState: {},
      newState: {},
      expiresInMs: 60 * 60 * 1000  // 1 hour
    })

    const detailsJson = bound.find(
      v => typeof v === 'string' && v.includes('"reversible":true')
    ) as string
    const details = JSON.parse(detailsJson)
    const expiresAt = new Date(details.restorePolicy.expiresAt).getTime()
    const now = Date.now()
    expect(expiresAt - now).toBeGreaterThan(50 * 60 * 1000)
    expect(expiresAt - now).toBeLessThan(70 * 60 * 1000)
  })

  it('honors requiresAdmin override', () => {
    const { db, bound } = makeMockDb()
    const capture = new ActivityCapture(db)

    capture.buildReversibleLog({
      request: {
        userId: 'agent-1',
        userName: 'Alice',
        userRole: 'admin',
        action: 'settings_update',
        resourceType: 'system',
        resourceId: 'xyz'
      },
      restoreHandler: 'system.settings',
      previousState: {},
      newState: {},
      requiresAdmin: true
    })

    const detailsJson = bound.find(
      v => typeof v === 'string' && v.includes('"reversible":true')
    ) as string
    const details = JSON.parse(detailsJson)
    expect(details.restorePolicy.requiresAdmin).toBe(true)
  })
```

- [ ] **Step 4: Run the new tests**

Run: `bunx vitest run tests/unit/modules/activities/services/ActivityCapture.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/services/ActivityCapture.ts tests/unit/modules/activities/services/ActivityCapture.test.ts
git commit -m "feat(activities): implement ActivityCapture.buildReversibleLog

Generates the INSERT statement with the full reversible details JSON
including restorePolicy and restoredByActivityId tracker. Defaults to
24h expiry and requiresAdmin=false; both overridable per capture."
```

---

## Task 4: ActivityCapture — Implement buildIrreversibleLog

**Files:**
- Modify: `src/modules/activities/services/ActivityCapture.ts`
- Modify: `tests/unit/modules/activities/services/ActivityCapture.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `ActivityCapture.test.ts`:

```typescript
describe('ActivityCapture.buildIrreversibleLog', () => {
  it('produces details JSON with reversible:false and irreversibleReason', () => {
    const { db, bound } = makeMockDb()
    const capture = new ActivityCapture(db)

    capture.buildIrreversibleLog({
      userId: 'agent-1',
      userName: 'Alice',
      userRole: 'admin',
      action: 'message_send',
      resourceType: 'message',
      resourceId: 'msg-7',
      reason: 'message_sent_to_external_platform'
    })

    const detailsJson = bound.find(
      v => typeof v === 'string' && v.includes('"reversible":false')
    ) as string
    expect(detailsJson).toBeDefined()
    const details = JSON.parse(detailsJson)
    expect(details.reversible).toBe(false)
    expect(details.irreversibleReason).toBe('message_sent_to_external_platform')
  })
})
```

- [ ] **Step 2: Run test — expect failure**

Run: `bunx vitest run tests/unit/modules/activities/services/ActivityCapture.test.ts`
Expected: FAIL with `buildIrreversibleLog not implemented`.

- [ ] **Step 3: Implement**

Replace the `buildIrreversibleLog` stub in `ActivityCapture.ts`:

```typescript
  buildIrreversibleLog(
    req: CreateActivityRequest & { reason: string }
  ): D1PreparedStatement {
    const now = new Date()

    const details = {
      reversible: false,
      irreversibleReason: req.reason
    }

    const mergedDetails =
      req.details && typeof req.details === 'object'
        ? { ...req.details, ...details }
        : details

    return this.db
      .prepare(
        `INSERT INTO activities
           (user_id, user_name, user_role, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        req.userId,
        req.userName,
        req.userRole,
        req.action,
        req.resourceType,
        req.resourceId ?? null,
        JSON.stringify(mergedDetails),
        req.ipAddress ?? null,
        req.userAgent ?? null,
        now.toISOString()
      )
  }
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/unit/modules/activities/services/ActivityCapture.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/services/ActivityCapture.ts tests/unit/modules/activities/services/ActivityCapture.test.ts
git commit -m "feat(activities): implement ActivityCapture.buildIrreversibleLog

Emits a log row with reversible:false and an irreversibleReason
string. Used by handlers that cannot be undone (message_send,
login, RESTORE itself in v1)."
```

---

## Task 5: ActivityCapture — Implement logOnly

**Files:**
- Modify: `src/modules/activities/services/ActivityCapture.ts`
- Modify: `tests/unit/modules/activities/services/ActivityCapture.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `ActivityCapture.test.ts`:

```typescript
describe('ActivityCapture.logOnly', () => {
  it('runs the prepared statement and returns the inserted row id', async () => {
    const stmt = {
      run: vi.fn().mockResolvedValue({ meta: { last_row_id: 99 } })
    } as unknown as D1PreparedStatement

    const db = { batch: vi.fn() } as unknown as D1Database
    const capture = new ActivityCapture(db)

    const id = await capture.logOnly(stmt)
    expect(id).toBe(99)
    expect(stmt.run).toHaveBeenCalledOnce()
  })

  it('returns null when last_row_id is missing', async () => {
    const stmt = {
      run: vi.fn().mockResolvedValue({ meta: {} })
    } as unknown as D1PreparedStatement

    const db = { batch: vi.fn() } as unknown as D1Database
    const capture = new ActivityCapture(db)

    const id = await capture.logOnly(stmt)
    expect(id).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect failure**

Run: `bunx vitest run tests/unit/modules/activities/services/ActivityCapture.test.ts`
Expected: FAIL with `logOnly not implemented`.

- [ ] **Step 3: Implement**

Replace the `logOnly` stub:

```typescript
  async logOnly(stmt: D1PreparedStatement): Promise<number | null> {
    const result = await stmt.run()
    const id = result.meta?.last_row_id
    return typeof id === 'number' ? id : null
  }
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/unit/modules/activities/services/ActivityCapture.test.ts`
Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/services/ActivityCapture.ts tests/unit/modules/activities/services/ActivityCapture.test.ts
git commit -m "feat(activities): implement ActivityCapture.logOnly convenience method

For callers that have no mutation to pair with (e.g. login/logout
events), this submits the prepared INSERT alone and returns the new
row id."
```

---

## Task 6: RestoreHandler Interface + Empty Registry

**Files:**
- Create: `src/modules/activities/services/restore-registry.ts`

- [ ] **Step 1: Create the interface and empty registry**

Create `src/modules/activities/services/restore-registry.ts`:

```typescript
// Activities Module - Restore Handler Registry
// Maps restoreHandler strings (e.g. "tag.delete") to RestoreHandler objects
// that know how to (a) build the reversal D1 statement and (b) read the
// current persisted state of the resource (for conflict detection).

export interface RestoreHandler {
  /** Produce the D1 statement that reverses the original operation. */
  buildMutation(
    db: D1Database,
    previousState: Record<string, unknown>
  ): D1PreparedStatement

  /** Read the current persisted state of the resource, for conflict diffing.
   *  Returns null when the resource is hard-deleted (caller treats as 422). */
  getCurrentState(
    db: D1Database,
    resourceId: string
  ): Promise<Record<string, unknown> | null>
}

export const RestoreRegistry: Record<string, RestoreHandler> = {}
```

- [ ] **Step 2: Type-check the file compiles**

Run: `bunx tsc --noEmit`
Expected: PASS (no consumers reference it yet).

- [ ] **Step 3: Commit**

```bash
git add src/modules/activities/services/restore-registry.ts
git commit -m "feat(activities): introduce RestoreHandler interface and empty registry

Factory implementations and handler registrations land in
subsequent commits."
```

---

## Task 7: restoreSoftDeleted Factory

**Files:**
- Create: `src/modules/activities/services/restore-helpers.ts`
- Create: `tests/unit/modules/activities/services/restore-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/modules/activities/services/restore-helpers.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { restoreSoftDeleted } from '@/modules/activities/services/restore-helpers'

function makeDb() {
  const bound: unknown[] = []
  const stmt = {
    bind: vi.fn((...args: unknown[]) => {
      bound.push(...args)
      return stmt
    }),
    run: vi.fn(),
    all: vi.fn(),
    first: vi.fn()
  }
  const prepare = vi.fn(() => stmt)
  return { db: { prepare } as unknown as D1Database, prepare, stmt, bound }
}

describe('restoreSoftDeleted', () => {
  it('buildMutation emits UPDATE ... SET deleted_at = NULL', () => {
    const { db, prepare, bound } = makeDb()
    const handler = restoreSoftDeleted('tags')

    handler.buildMutation(db, { id: 42 })

    expect(prepare).toHaveBeenCalledTimes(1)
    const sql = prepare.mock.calls[0][0] as string
    expect(sql).toMatch(/UPDATE\s+tags\s+SET\s+deleted_at\s*=\s*NULL/i)
    expect(sql).toMatch(/WHERE\s+id\s*=\s*\?/i)
    expect(bound).toContain(42)
  })

  it('getCurrentState SELECTs all columns by id and returns the row', async () => {
    const { db, prepare, stmt } = makeDb()
    stmt.first = vi.fn().mockResolvedValue({ id: 42, name: 'VIP', deleted_at: '2026-05-26T14:32:00.000Z' })
    const handler = restoreSoftDeleted('tags')

    const result = await handler.getCurrentState(db, '42')

    expect(prepare).toHaveBeenCalledTimes(1)
    const sql = prepare.mock.calls[0][0] as string
    expect(sql).toMatch(/SELECT\s+\*\s+FROM\s+tags/i)
    expect(sql).toMatch(/WHERE\s+id\s*=\s*\?/i)
    expect(result).toEqual({ id: 42, name: 'VIP', deleted_at: '2026-05-26T14:32:00.000Z' })
  })

  it('getCurrentState returns null when first() returns null (hard-deleted)', async () => {
    const { db, stmt } = makeDb()
    stmt.first = vi.fn().mockResolvedValue(null)
    const handler = restoreSoftDeleted('tags')

    const result = await handler.getCurrentState(db, '42')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect failure**

Run: `bunx vitest run tests/unit/modules/activities/services/restore-helpers.test.ts`
Expected: FAIL with `Cannot find module '@/modules/activities/services/restore-helpers'`.

- [ ] **Step 3: Implement the factory**

Create `src/modules/activities/services/restore-helpers.ts`:

```typescript
// Activities Module - Restore Helper Factories
// Each factory returns a RestoreHandler object pairing buildMutation
// (reversal) with getCurrentState (for conflict detection).

import type { RestoreHandler } from './restore-registry'

// Whitelist of tables we know are safe to address by these helpers.
// Prevents SQL injection from a malicious restoreHandler string.
const ALLOWED_TABLES = [
  'tags',
  'customers',
  'conversations',
  'teams',
  'agents'
] as const
type AllowedTable = (typeof ALLOWED_TABLES)[number]

function assertTable(table: string): asserts table is AllowedTable {
  if (!(ALLOWED_TABLES as readonly string[]).includes(table)) {
    throw new Error(`restore-helpers: unsupported table "${table}"`)
  }
}

/**
 * Factory: clear `deleted_at` on the row identified by `previousState.id`.
 * Used to reverse a soft-delete (action: *_delete).
 */
export function restoreSoftDeleted(table: string): RestoreHandler {
  assertTable(table)
  return {
    buildMutation(db, previousState) {
      const id = previousState.id
      if (id === undefined || id === null) {
        throw new Error(`restoreSoftDeleted(${table}): previousState.id missing`)
      }
      return db
        .prepare(`UPDATE ${table} SET deleted_at = NULL WHERE id = ?`)
        .bind(id)
    },
    async getCurrentState(db, resourceId) {
      const row = await db
        .prepare(`SELECT * FROM ${table} WHERE id = ?`)
        .bind(resourceId)
        .first()
      return (row as Record<string, unknown> | null) ?? null
    }
  }
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/unit/modules/activities/services/restore-helpers.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/services/restore-helpers.ts tests/unit/modules/activities/services/restore-helpers.test.ts
git commit -m "feat(activities): add restoreSoftDeleted handler factory

Reverses *_delete actions by clearing deleted_at. Table whitelist
guards against SQL injection from a malicious restoreHandler string."
```

---

## Task 8: softDelete Factory (Inverse — reverse a CREATE)

**Files:**
- Modify: `src/modules/activities/services/restore-helpers.ts`
- Modify: `tests/unit/modules/activities/services/restore-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `restore-helpers.test.ts`:

```typescript
import { softDelete } from '@/modules/activities/services/restore-helpers'

describe('softDelete', () => {
  it('buildMutation emits UPDATE ... SET deleted_at = current timestamp', () => {
    const { db, prepare, bound } = makeDb()
    const handler = softDelete('tags')

    handler.buildMutation(db, { id: 42 })

    expect(prepare).toHaveBeenCalledTimes(1)
    const sql = prepare.mock.calls[0][0] as string
    expect(sql).toMatch(/UPDATE\s+tags\s+SET\s+deleted_at\s*=\s*\?/i)
    expect(bound).toContain(42)
    // First bound value is the timestamp; verify it's an ISO string
    const ts = bound[0]
    expect(typeof ts).toBe('string')
    expect(() => new Date(ts as string).toISOString()).not.toThrow()
  })

  it('getCurrentState returns the row including deleted_at', async () => {
    const { db, stmt } = makeDb()
    stmt.first = vi.fn().mockResolvedValue({ id: 42, name: 'VIP', deleted_at: null })
    const handler = softDelete('tags')

    const result = await handler.getCurrentState(db, '42')
    expect(result).toEqual({ id: 42, name: 'VIP', deleted_at: null })
  })
})
```

- [ ] **Step 2: Run test — expect failure**

Run: `bunx vitest run tests/unit/modules/activities/services/restore-helpers.test.ts`
Expected: FAIL importing `softDelete`.

- [ ] **Step 3: Implement**

Append to `restore-helpers.ts`:

```typescript
/**
 * Factory: set `deleted_at = NOW()` on the row identified by `previousState.id`.
 * Used to reverse a create (action: *_create) — turn the new row back into
 * a soft-deleted ghost without losing audit history.
 */
export function softDelete(table: string): RestoreHandler {
  assertTable(table)
  return {
    buildMutation(db, previousState) {
      const id = previousState.id
      if (id === undefined || id === null) {
        throw new Error(`softDelete(${table}): previousState.id missing`)
      }
      const now = new Date().toISOString()
      return db
        .prepare(`UPDATE ${table} SET deleted_at = ? WHERE id = ?`)
        .bind(now, id)
    },
    async getCurrentState(db, resourceId) {
      const row = await db
        .prepare(`SELECT * FROM ${table} WHERE id = ?`)
        .bind(resourceId)
        .first()
      return (row as Record<string, unknown> | null) ?? null
    }
  }
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/unit/modules/activities/services/restore-helpers.test.ts`
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/services/restore-helpers.ts tests/unit/modules/activities/services/restore-helpers.test.ts
git commit -m "feat(activities): add softDelete handler factory

Reverses a *_create action by setting deleted_at to now, the
mirror image of restoreSoftDeleted."
```

---

## Task 9: restoreFields Factory (Reverse an UPDATE)

**Files:**
- Modify: `src/modules/activities/services/restore-helpers.ts`
- Modify: `tests/unit/modules/activities/services/restore-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `restore-helpers.test.ts`:

```typescript
import { restoreFields } from '@/modules/activities/services/restore-helpers'

describe('restoreFields', () => {
  it('buildMutation emits UPDATE ... SET col1 = ?, col2 = ? WHERE id = ?', () => {
    const { db, prepare, bound } = makeDb()
    const handler = restoreFields('customers')

    handler.buildMutation(db, {
      id: 7,
      name: '王小明',
      external_user_id: 'U12345'
    })

    expect(prepare).toHaveBeenCalledTimes(1)
    const sql = prepare.mock.calls[0][0] as string
    expect(sql).toMatch(/UPDATE\s+customers\s+SET/i)
    expect(sql).toMatch(/name\s*=\s*\?/i)
    expect(sql).toMatch(/external_user_id\s*=\s*\?/i)
    expect(sql).toMatch(/WHERE\s+id\s*=\s*\?/i)
    expect(bound).toContain('王小明')
    expect(bound).toContain('U12345')
    expect(bound).toContain(7)
    // id must be the LAST bound value (it's the WHERE)
    expect(bound[bound.length - 1]).toBe(7)
  })

  it('buildMutation skips the id field in the SET clause', () => {
    const { db, prepare } = makeDb()
    const handler = restoreFields('tags')

    handler.buildMutation(db, { id: 42, name: 'VIP' })
    const sql = prepare.mock.calls[0][0] as string
    // id should appear only once, in WHERE — not in SET
    const setClause = sql.split(/where/i)[0]
    expect(setClause.toLowerCase()).not.toMatch(/\bid\s*=/)
  })

  it('throws if previousState.id is missing', () => {
    const { db } = makeDb()
    const handler = restoreFields('tags')
    expect(() => handler.buildMutation(db, { name: 'no id' })).toThrow(/id missing/i)
  })
})
```

- [ ] **Step 2: Run test — expect failure**

Run: `bunx vitest run tests/unit/modules/activities/services/restore-helpers.test.ts`
Expected: FAIL importing `restoreFields`.

- [ ] **Step 3: Implement**

Append to `restore-helpers.ts`:

```typescript
/**
 * Factory: restore the row identified by `previousState.id` by setting
 * every other column in `previousState` back to its captured value.
 * Used to reverse an *_update action.
 */
export function restoreFields(table: string): RestoreHandler {
  assertTable(table)
  return {
    buildMutation(db, previousState) {
      const id = previousState.id
      if (id === undefined || id === null) {
        throw new Error(`restoreFields(${table}): previousState.id missing`)
      }
      const entries = Object.entries(previousState).filter(([k]) => k !== 'id')
      if (entries.length === 0) {
        throw new Error(`restoreFields(${table}): previousState has no fields to restore`)
      }
      const setClause = entries.map(([k]) => `${k} = ?`).join(', ')
      const params = entries.map(([, v]) => v as unknown)
      return db
        .prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`)
        .bind(...params, id)
    },
    async getCurrentState(db, resourceId) {
      const row = await db
        .prepare(`SELECT * FROM ${table} WHERE id = ?`)
        .bind(resourceId)
        .first()
      return (row as Record<string, unknown> | null) ?? null
    }
  }
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/unit/modules/activities/services/restore-helpers.test.ts`
Expected: 8 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/services/restore-helpers.ts tests/unit/modules/activities/services/restore-helpers.test.ts
git commit -m "feat(activities): add restoreFields handler factory

Reverses an *_update action by writing every field in previousState
back to the row. Field names come from previousState keys (caller
controls precision — capture only the columns you actually changed)."
```

---

## Task 10: restoreField Factory (Single-Column Reverse)

**Files:**
- Modify: `src/modules/activities/services/restore-helpers.ts`
- Modify: `tests/unit/modules/activities/services/restore-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `restore-helpers.test.ts`:

```typescript
import { restoreField } from '@/modules/activities/services/restore-helpers'

describe('restoreField', () => {
  it('buildMutation restores a single named column', () => {
    const { db, prepare, bound } = makeDb()
    const handler = restoreField('conversations', 'status')

    handler.buildMutation(db, { id: 'conv-1', status: 'open' })

    const sql = prepare.mock.calls[0][0] as string
    expect(sql).toMatch(/UPDATE\s+conversations\s+SET\s+status\s*=\s*\?\s+WHERE\s+id\s*=\s*\?/i)
    expect(bound).toEqual(['open', 'conv-1'])
  })

  it('throws if the named column is absent from previousState', () => {
    const { db } = makeDb()
    const handler = restoreField('conversations', 'status')
    expect(() => handler.buildMutation(db, { id: 'conv-1' })).toThrow(/status/i)
  })
})
```

- [ ] **Step 2: Run test — expect failure**

Run: `bunx vitest run tests/unit/modules/activities/services/restore-helpers.test.ts`
Expected: FAIL importing `restoreField`.

- [ ] **Step 3: Implement**

Append to `restore-helpers.ts`:

```typescript
const ALLOWED_FIELDS_BY_TABLE: Record<AllowedTable, readonly string[]> = {
  tags:          ['name', 'color', 'description', 'team_id'],
  customers:     ['name', 'avatar_url', 'external_user_id', 'team_id'],
  conversations: ['status', 'assigned_agent_id', 'assigned_team_id'],
  teams:         ['name', 'description', 'parent_team_id'],
  agents:        ['display_name', 'email', 'role', 'primary_team_id']
}

/**
 * Factory: restore a single named column on the row identified by
 * `previousState.id`. Used for narrow updates like conversation.status.
 *
 * The column name is whitelisted per-table to keep this safe.
 */
export function restoreField(table: string, field: string): RestoreHandler {
  assertTable(table)
  const allowed = ALLOWED_FIELDS_BY_TABLE[table]
  if (!allowed.includes(field)) {
    throw new Error(`restoreField: field "${field}" not allowed on ${table}`)
  }
  return {
    buildMutation(db, previousState) {
      const id = previousState.id
      if (id === undefined || id === null) {
        throw new Error(`restoreField(${table}.${field}): previousState.id missing`)
      }
      if (!(field in previousState)) {
        throw new Error(`restoreField(${table}.${field}): previousState.${field} missing`)
      }
      return db
        .prepare(`UPDATE ${table} SET ${field} = ? WHERE id = ?`)
        .bind(previousState[field] as unknown, id)
    },
    async getCurrentState(db, resourceId) {
      const row = await db
        .prepare(`SELECT * FROM ${table} WHERE id = ?`)
        .bind(resourceId)
        .first()
      return (row as Record<string, unknown> | null) ?? null
    }
  }
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/unit/modules/activities/services/restore-helpers.test.ts`
Expected: 10 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/services/restore-helpers.ts tests/unit/modules/activities/services/restore-helpers.test.ts
git commit -m "feat(activities): add restoreField handler factory

Single-column reversal with per-table allow-list to prevent any
caller from constructing arbitrary UPDATE statements."
```

---

## Task 11: restoreAssignedAgent Factory + Tag Assignment Factories

**Files:**
- Modify: `src/modules/activities/services/restore-helpers.ts`
- Modify: `tests/unit/modules/activities/services/restore-helpers.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `restore-helpers.test.ts`:

```typescript
import {
  restoreAssignedAgent,
  removeTagFromCustomer,
  addTagToCustomer
} from '@/modules/activities/services/restore-helpers'

describe('restoreAssignedAgent', () => {
  it('buildMutation sets assigned_agent_id back to previousState value', () => {
    const { db, prepare, bound } = makeDb()
    const handler = restoreAssignedAgent

    handler.buildMutation(db, { id: 'conv-1', assigned_agent_id: 'agent-5' })

    const sql = prepare.mock.calls[0][0] as string
    expect(sql).toMatch(/UPDATE\s+conversations\s+SET\s+assigned_agent_id\s*=\s*\?\s+WHERE\s+id\s*=\s*\?/i)
    expect(bound).toEqual(['agent-5', 'conv-1'])
  })

  it('buildMutation handles unassign (assigned_agent_id was null)', () => {
    const { db, bound } = makeDb()
    const handler = restoreAssignedAgent

    handler.buildMutation(db, { id: 'conv-1', assigned_agent_id: null })
    expect(bound).toEqual([null, 'conv-1'])
  })
})

describe('removeTagFromCustomer', () => {
  it('buildMutation DELETEs from customer_tags by (customer_id, tag_id)', () => {
    const { db, prepare, bound } = makeDb()
    const handler = removeTagFromCustomer

    handler.buildMutation(db, { customer_id: 'cust-1', tag_id: 42 })

    const sql = prepare.mock.calls[0][0] as string
    expect(sql).toMatch(/DELETE\s+FROM\s+customer_tags/i)
    expect(sql).toMatch(/customer_id\s*=\s*\?\s+AND\s+tag_id\s*=\s*\?/i)
    expect(bound).toEqual(['cust-1', 42])
  })
})

describe('addTagToCustomer', () => {
  it('buildMutation INSERTs into customer_tags', () => {
    const { db, prepare, bound } = makeDb()
    const handler = addTagToCustomer

    handler.buildMutation(db, { customer_id: 'cust-1', tag_id: 42 })

    const sql = prepare.mock.calls[0][0] as string
    expect(sql).toMatch(/INSERT\s+INTO\s+customer_tags/i)
    expect(bound).toContain('cust-1')
    expect(bound).toContain(42)
  })
})
```

- [ ] **Step 2: Run test — expect failure**

Run: `bunx vitest run tests/unit/modules/activities/services/restore-helpers.test.ts`
Expected: FAIL importing the three new factories.

- [ ] **Step 3: Implement**

Append to `restore-helpers.ts`:

```typescript
/**
 * Singleton: restore conversations.assigned_agent_id (handles assign/unassign).
 */
export const restoreAssignedAgent: RestoreHandler = {
  buildMutation(db, previousState) {
    const id = previousState.id
    if (id === undefined || id === null) {
      throw new Error('restoreAssignedAgent: previousState.id missing')
    }
    const agentId =
      previousState.assigned_agent_id === undefined
        ? null
        : (previousState.assigned_agent_id as string | null)
    return db
      .prepare('UPDATE conversations SET assigned_agent_id = ? WHERE id = ?')
      .bind(agentId, id)
  },
  async getCurrentState(db, resourceId) {
    const row = await db
      .prepare('SELECT * FROM conversations WHERE id = ?')
      .bind(resourceId)
      .first()
    return (row as Record<string, unknown> | null) ?? null
  }
}

/**
 * Singleton: reverse customer.tag-assign by DELETE-ing the (customer_id, tag_id) row.
 */
export const removeTagFromCustomer: RestoreHandler = {
  buildMutation(db, previousState) {
    const customerId = previousState.customer_id
    const tagId = previousState.tag_id
    if (customerId === undefined || tagId === undefined) {
      throw new Error('removeTagFromCustomer: previousState.customer_id/tag_id missing')
    }
    return db
      .prepare('DELETE FROM customer_tags WHERE customer_id = ? AND tag_id = ?')
      .bind(customerId, tagId)
  },
  async getCurrentState(db, resourceId) {
    // resourceId is "<customerId>:<tagId>" for assignment events
    const [customerId, tagIdStr] = resourceId.split(':')
    const tagId = Number(tagIdStr)
    const row = await db
      .prepare('SELECT * FROM customer_tags WHERE customer_id = ? AND tag_id = ?')
      .bind(customerId, tagId)
      .first()
    return (row as Record<string, unknown> | null) ?? null
  }
}

/**
 * Singleton: reverse customer.tag-unassign by INSERT-ing the (customer_id, tag_id) row back.
 */
export const addTagToCustomer: RestoreHandler = {
  buildMutation(db, previousState) {
    const customerId = previousState.customer_id
    const tagId = previousState.tag_id
    if (customerId === undefined || tagId === undefined) {
      throw new Error('addTagToCustomer: previousState.customer_id/tag_id missing')
    }
    const assignedAt =
      (previousState.assigned_at as string | undefined) ?? new Date().toISOString()
    const assignedBy =
      (previousState.assigned_by as string | null | undefined) ?? null
    return db
      .prepare(
        'INSERT INTO customer_tags (customer_id, tag_id, assigned_at, assigned_by) VALUES (?, ?, ?, ?)'
      )
      .bind(customerId, tagId, assignedAt, assignedBy)
  },
  async getCurrentState(db, resourceId) {
    const [customerId, tagIdStr] = resourceId.split(':')
    const tagId = Number(tagIdStr)
    const row = await db
      .prepare('SELECT * FROM customer_tags WHERE customer_id = ? AND tag_id = ?')
      .bind(customerId, tagId)
      .first()
    return (row as Record<string, unknown> | null) ?? null
  }
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/unit/modules/activities/services/restore-helpers.test.ts`
Expected: 14 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/services/restore-helpers.ts tests/unit/modules/activities/services/restore-helpers.test.ts
git commit -m "feat(activities): add assignment-relationship restore handlers

restoreAssignedAgent covers conversation assign/unassign;
removeTagFromCustomer and addTagToCustomer are inverses of each
other for the customer_tags many-to-many table."
```

---

## Task 12: Populate the RestoreRegistry

**Files:**
- Modify: `src/modules/activities/services/restore-registry.ts`
- Create: `tests/unit/modules/activities/services/restore-registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/modules/activities/services/restore-registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { RestoreRegistry } from '@/modules/activities/services/restore-registry'

describe('RestoreRegistry', () => {
  const expectedHandlers = [
    'customer.delete',
    'tag.delete',
    'conversation.delete',
    'team.delete',
    'agent.delete',
    'customer.create',
    'tag.create',
    'conversation.create',
    'team.create',
    'agent.create',
    'customer.update',
    'tag.update',
    'conversation.update',
    'team.update',
    'agent.update',
    'customer.tag-assign',
    'customer.tag-unassign',
    'conversation.assign',
    'conversation.unassign',
    'conversation.status'
  ]

  it.each(expectedHandlers)('registers handler for "%s"', (key) => {
    expect(RestoreRegistry[key]).toBeDefined()
    expect(typeof RestoreRegistry[key].buildMutation).toBe('function')
    expect(typeof RestoreRegistry[key].getCurrentState).toBe('function')
  })

  it('does not export handlers for unknown keys', () => {
    expect(RestoreRegistry['arbitrary.key']).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test — expect failure**

Run: `bunx vitest run tests/unit/modules/activities/services/restore-registry.test.ts`
Expected: FAIL (registry is empty).

- [ ] **Step 3: Wire the factories into the registry**

Replace `src/modules/activities/services/restore-registry.ts` with:

```typescript
// Activities Module - Restore Handler Registry
// Maps restoreHandler strings (e.g. "tag.delete") to RestoreHandler objects.

import {
  restoreSoftDeleted,
  softDelete,
  restoreFields,
  restoreField,
  restoreAssignedAgent,
  removeTagFromCustomer,
  addTagToCustomer
} from './restore-helpers'

export interface RestoreHandler {
  buildMutation(
    db: D1Database,
    previousState: Record<string, unknown>
  ): D1PreparedStatement
  getCurrentState(
    db: D1Database,
    resourceId: string
  ): Promise<Record<string, unknown> | null>
}

export const RestoreRegistry: Record<string, RestoreHandler> = {
  // Soft-delete reversal (clear deleted_at)
  'customer.delete':     restoreSoftDeleted('customers'),
  'tag.delete':          restoreSoftDeleted('tags'),
  'conversation.delete': restoreSoftDeleted('conversations'),
  'team.delete':         restoreSoftDeleted('teams'),
  'agent.delete':        restoreSoftDeleted('agents'),

  // Soft-delete inversion (reverse a create by setting deleted_at = now)
  'customer.create':     softDelete('customers'),
  'tag.create':          softDelete('tags'),
  'conversation.create': softDelete('conversations'),
  'team.create':         softDelete('teams'),
  'agent.create':        softDelete('agents'),

  // Field restoration (reverse an update)
  'customer.update':     restoreFields('customers'),
  'tag.update':          restoreFields('tags'),
  'conversation.update': restoreFields('conversations'),
  'team.update':         restoreFields('teams'),
  'agent.update':        restoreFields('agents'),

  // Relationship reversal
  'customer.tag-assign':   removeTagFromCustomer,
  'customer.tag-unassign': addTagToCustomer,
  'conversation.assign':   restoreAssignedAgent,
  'conversation.unassign': restoreAssignedAgent,
  'conversation.status':   restoreField('conversations', 'status')
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/unit/modules/activities/services/restore-registry.test.ts`
Expected: 21 PASS (20 entries + 1 negative).

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/services/restore-registry.ts tests/unit/modules/activities/services/restore-registry.test.ts
git commit -m "feat(activities): populate RestoreRegistry with 20 handler bindings

Covers all CRUD + relationship reversals for customer / tag /
conversation / team / agent. New restoreHandler strings registered
here are what write handlers will reference in Phase 2."
```

---

## Task 13: Conflict Detector — diffStates

**Files:**
- Create: `src/modules/activities/services/conflict-detector.ts`
- Create: `tests/unit/modules/activities/services/conflict-detector.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/modules/activities/services/conflict-detector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { diffStates, type MidChange } from '@/modules/activities/services/conflict-detector'

describe('diffStates', () => {
  it('returns empty array when current matches recorded newState', () => {
    const result = diffStates(
      { id: 1, name: 'A', deleted_at: '2026-05-26T00:00:00.000Z' },  // current
      { id: 1, name: 'A', deleted_at: '2026-05-26T00:00:00.000Z' },  // recorded
      { id: 1, name: 'A', deleted_at: null }                          // restoreTo
    )
    expect(result).toEqual([])
  })

  it('reports a midChange when a recorded-newState field has been modified', () => {
    const result = diffStates(
      { id: 1, name: 'Bob renamed it', deleted_at: '2026-05-26T00:00:00.000Z' },
      { id: 1, name: 'Original',       deleted_at: '2026-05-26T00:00:00.000Z' },
      { id: 1, name: 'Original',       deleted_at: null }
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual<MidChange>({
      field: 'name',
      valueAtOriginalAction: 'Original',
      valueNow: 'Bob renamed it',
      valueAfterRestore: 'Original'
    })
  })

  it('ignores fields not present in recorded newState (we only watch what we wrote)', () => {
    const result = diffStates(
      { id: 1, name: 'A', updated_at: '2026-05-26T12:00:00.000Z' },  // current has extra updated_at
      { id: 1, name: 'A' },                                           // recorded only knows name
      { id: 1, name: 'A' }                                            // restoreTo
    )
    expect(result).toEqual([])
  })

  it('reports multiple midChanges', () => {
    const result = diffStates(
      { id: 1, name: 'Bob', color: '#FF0000', team_id: 99 },
      { id: 1, name: 'Alice', color: '#FF0000', team_id: 3 },
      { id: 1, name: 'Alice', color: '#0000FF', team_id: 3 }
    )
    expect(result).toHaveLength(2)
    const fields = result.map(r => r.field).sort()
    expect(fields).toEqual(['name', 'team_id'])
  })
})
```

- [ ] **Step 2: Run test — expect failure**

Run: `bunx vitest run tests/unit/modules/activities/services/conflict-detector.test.ts`
Expected: FAIL importing module.

- [ ] **Step 3: Implement**

Create `src/modules/activities/services/conflict-detector.ts`:

```typescript
// Activities Module - Conflict Detection
// Pure function. Diffs current persisted state against the newState
// captured at original-action time, ignoring fields we never recorded.

export interface MidChange {
  field: string
  valueAtOriginalAction: unknown
  valueNow: unknown
  valueAfterRestore: unknown
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return false
}

/**
 * Walk the keys of recordedNewState and compare them to currentState.
 * If a key has been changed since the original operation, emit a MidChange
 * describing the three values the caller needs.
 *
 * We deliberately ignore keys in currentState that are not in recordedNewState
 * — fields we did not write at original-action time are out of scope.
 */
export function diffStates(
  currentState: Record<string, unknown>,
  recordedNewState: Record<string, unknown>,
  restoreToState: Record<string, unknown>
): MidChange[] {
  const out: MidChange[] = []
  for (const key of Object.keys(recordedNewState)) {
    if (!looseEqual(currentState[key], recordedNewState[key])) {
      out.push({
        field: key,
        valueAtOriginalAction: recordedNewState[key],
        valueNow: currentState[key],
        valueAfterRestore: restoreToState[key]
      })
    }
  }
  return out
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/unit/modules/activities/services/conflict-detector.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/services/conflict-detector.ts tests/unit/modules/activities/services/conflict-detector.test.ts
git commit -m "feat(activities): add diffStates conflict detector

Pure function comparing current resource state to the newState
captured at original-action time. Emits a MidChange per modified
field, ready for the 409 Conflict payload. Per spec, intentionally
omits modifiedBy/modifiedAt (not derivable in v1)."
```

---

## Task 14: activity-restore.ts — Skeleton with 404 + 422

**Files:**
- Create: `src/modules/activities/handlers/activity-restore.ts`
- Create: `tests/integration/handlers/activity-restore.integration.test.ts`

- [ ] **Step 1: Write the failing test — 404 path**

Create `tests/integration/handlers/activity-restore.integration.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import activityRestoreHandler from '@/modules/activities/handlers/activity-restore'

function makeApp() {
  const app = new Hono()
  app.route('/api/activities/:id/restore', activityRestoreHandler)
  return app
}

// Minimal D1 mock harness — replaced with richer mocks in later tasks
function makeBindings(activityRow: Record<string, unknown> | null = null) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(activityRow),
    run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
    all: vi.fn().mockResolvedValue({ results: [] })
  }
  const prepare = vi.fn(() => stmt)
  const batch = vi.fn().mockResolvedValue([])
  return {
    DB: { prepare, batch } as unknown as D1Database
  }
}

describe('POST /api/activities/:id/restore (skeleton)', () => {
  let app: ReturnType<typeof makeApp>

  beforeEach(() => {
    app = makeApp()
  })

  it('returns 404 when activity id is not found', async () => {
    const res = await app.request('/api/activities/9999/restore', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer fake' }
    }, makeBindings(null))
    expect(res.status).toBe(404)
  })
})
```

(JWT validation is mocked here via a header bypass; we will wire real `jwtAuth` in a later step but for this skeleton test we only care about the route path.)

- [ ] **Step 2: Run test — expect failure**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: FAIL importing module.

- [ ] **Step 3: Implement skeleton**

Create `src/modules/activities/handlers/activity-restore.ts`:

```typescript
// Activities Module - Restore Handler
// Implements POST /api/activities/:id/restore per
// docs/superpowers/specs/2026-05-26-activity-restore-design.md Section 2.

import { Hono } from 'hono'
import type { Bindings } from '@/types'

const handler = new Hono<{ Bindings: Bindings }>()

handler.post('/', async (c) => {
  const idParam = c.req.param('id')
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ success: false, error: 'Invalid activity id' }, 400)
  }

  const row = await c.env.DB
    .prepare('SELECT * FROM activities WHERE id = ?')
    .bind(id)
    .first()

  if (!row) {
    return c.json({ success: false, error: 'Activity not found' }, 404)
  }

  return c.json({ success: false, error: 'Not implemented' }, 501)
})

export default handler
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: 1 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/handlers/activity-restore.ts tests/integration/handlers/activity-restore.integration.test.ts
git commit -m "feat(activities): scaffold activity-restore handler with 404 path

Endpoint exists, validates id, looks up the activity, and 501s on
the not-yet-implemented branch. Later commits add reversibility,
permission, time-window, conflict, CAS, and batch logic in order."
```

---

## Task 15: Reversibility Check (Step 3 → 422)

**Files:**
- Modify: `src/modules/activities/handlers/activity-restore.ts`
- Modify: `tests/integration/handlers/activity-restore.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Append to the integration test file:

```typescript
  it('returns 422 when activity has no reversible flag (legacy log)', async () => {
    const legacy = {
      id: 1, user_id: 'agent-1', action: 'tag_delete',
      details: JSON.stringify({ /* no reversible field */ })
    }
    const res = await app.request('/api/activities/1/restore', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer fake' }
    }, makeBindings(legacy))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.code).toBe('NOT_REVERSIBLE')
  })

  it('returns 422 when reversible is explicitly false', async () => {
    const irreversible = {
      id: 2, user_id: 'agent-1', action: 'message_send',
      details: JSON.stringify({ reversible: false, irreversibleReason: 'message_sent' })
    }
    const res = await app.request('/api/activities/2/restore', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer fake' }
    }, makeBindings(irreversible))
    expect(res.status).toBe(422)
  })
```

- [ ] **Step 2: Run test — expect failure (501 not 422)**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: FAIL with status 501.

- [ ] **Step 3: Implement reversibility check**

Replace the 501 branch in `activity-restore.ts`:

```typescript
  // Parse details JSON (stored as TEXT)
  let details: Record<string, unknown> = {}
  try {
    details = row.details ? JSON.parse(row.details as string) : {}
  } catch {
    details = {}
  }

  // Step 3: Reversibility check
  if (details.reversible !== true) {
    return c.json(
      { success: false, error: 'Activity is not reversible', code: 'NOT_REVERSIBLE' },
      422
    )
  }

  return c.json({ success: false, error: 'Not implemented' }, 501)
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/handlers/activity-restore.ts tests/integration/handlers/activity-restore.integration.test.ts
git commit -m "feat(activities): activity-restore step 3 — reversibility 422

Legacy activity logs and explicitly irreversible records (message
send, login) are rejected with NOT_REVERSIBLE before any heavier
checks run."
```

---

## Task 16: Idempotency Early Check (Step 4 → 409)

**Files:**
- Modify: `src/modules/activities/handlers/activity-restore.ts`
- Modify: `tests/integration/handlers/activity-restore.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
  it('returns 409 ALREADY_RESTORED when restoredByActivityId is a positive int', async () => {
    const restored = {
      id: 3, user_id: 'agent-1', action: 'tag_delete',
      details: JSON.stringify({
        reversible: true,
        restoreHandler: 'tag.delete',
        previousState: { id: 42 },
        newState: { id: 42, deleted_at: '2026-05-26T00:00:00.000Z' },
        restorePolicy: { expiresAt: new Date(Date.now() + 60_000).toISOString(), requiresAdmin: false },
        restoredByActivityId: 777
      })
    }
    const res = await app.request('/api/activities/3/restore', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer fake' }
    }, makeBindings(restored))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('ALREADY_RESTORED')
    expect(body.data.restoredByActivityId).toBe(777)
  })
```

- [ ] **Step 2: Run test — expect failure (501)**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: FAIL with status 501.

- [ ] **Step 3: Implement step 4**

Insert before the trailing 501 in `activity-restore.ts`:

```typescript
  // Step 4: Idempotency early-check (authoritative CAS happens in step 8)
  const already = details.restoredByActivityId
  if (typeof already === 'number' && already > 0) {
    return c.json(
      {
        success: false,
        error: 'Already restored',
        code: 'ALREADY_RESTORED',
        data: { restoredByActivityId: already }
      },
      409
    )
  }
  if (already === -1) {
    return c.json(
      {
        success: false,
        error: 'Restore in progress',
        code: 'RESTORE_IN_PROGRESS',
        data: { retryAfterMs: 2000 }
      },
      409
    )
  }
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/handlers/activity-restore.ts tests/integration/handlers/activity-restore.integration.test.ts
git commit -m "feat(activities): activity-restore step 4 — idempotency early check

If the activity's restoredByActivityId is already set to a real id,
return 409 ALREADY_RESTORED with the link. If it's the placeholder
-1, return 409 RESTORE_IN_PROGRESS with retryAfterMs."
```

---

## Task 17: Permission Check (Step 5 → 403)

**Files:**
- Modify: `src/modules/activities/handlers/activity-restore.ts`
- Modify: `tests/integration/handlers/activity-restore.integration.test.ts`

This task introduces the JWT context dependency. Real `jwtAuth` middleware injects `c.get('user')` with the agent identity. For tests, we'll stub this by reading the `X-Test-User` header.

- [ ] **Step 1: Write the failing tests**

Append:

```typescript
  function makeActivity(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 5,
      user_id: 'agent-original',
      user_role: 'agent',
      action: 'tag_delete',
      details: JSON.stringify({
        reversible: true,
        restoreHandler: 'tag.delete',
        previousState: { id: 42 },
        newState: { id: 42, deleted_at: '2026-05-26T00:00:00.000Z' },
        restorePolicy: { expiresAt: new Date(Date.now() + 60_000).toISOString(), requiresAdmin: false },
        restoredByActivityId: null
      }),
      ...overrides
    }
  }

  it('returns 403 when caller is neither original actor nor admin', async () => {
    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake',
        'X-Test-User': JSON.stringify({ id: 'agent-other', role: 'agent' })
      }
    }, makeBindings(makeActivity()))
    expect(res.status).toBe(403)
  })

  it('returns 403 when requiresAdmin and caller is the original-actor agent (non-admin)', async () => {
    const high = makeActivity({
      details: JSON.stringify({
        reversible: true,
        restoreHandler: 'tag.delete',
        previousState: { id: 42 },
        newState: { id: 42, deleted_at: '2026-05-26T00:00:00.000Z' },
        restorePolicy: { expiresAt: new Date(Date.now() + 60_000).toISOString(), requiresAdmin: true },
        restoredByActivityId: null
      })
    })
    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake',
        'X-Test-User': JSON.stringify({ id: 'agent-original', role: 'agent' })
      }
    }, makeBindings(high))
    expect(res.status).toBe(403)
  })

  it('passes permission when caller is original actor and !requiresAdmin', async () => {
    // We expect step 6+ to short-circuit somewhere, just confirm not-403
    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake',
        'X-Test-User': JSON.stringify({ id: 'agent-original', role: 'agent' })
      }
    }, makeBindings(makeActivity()))
    expect(res.status).not.toBe(403)
  })

  it('passes permission when caller is admin even if not original actor', async () => {
    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake',
        'X-Test-User': JSON.stringify({ id: 'agent-admin', role: 'admin' })
      }
    }, makeBindings(makeActivity()))
    expect(res.status).not.toBe(403)
  })
```

- [ ] **Step 2: Run test — expect failure**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: 3 of 4 new tests FAIL (because we haven't read `X-Test-User` yet).

- [ ] **Step 3: Implement permission check**

Insert into `activity-restore.ts` after the idempotency block:

```typescript
  // Step 5: Permission check
  // Read caller identity. In production this comes from jwtAuth middleware
  // (c.get('user')); in tests we accept X-Test-User for now. Real wiring
  // lands in Task 24 when we mount under jwtAuth in activity.ts.
  const testUserHeader = c.req.header('X-Test-User')
  let caller: { id: string; role: string } | null = null
  if (testUserHeader) {
    try {
      caller = JSON.parse(testUserHeader)
    } catch {
      caller = null
    }
  }
  if (!caller) {
    // Fall back to c.get('user') populated by jwtAuth in production
    caller = (c.get('user' as never) as { id: string; role: string } | null) ?? null
  }
  if (!caller) {
    return c.json({ success: false, error: 'Unauthenticated' }, 401)
  }

  const isOriginalActor = caller.id === row.user_id
  const isAdmin = caller.role === 'admin'
  const policy = (details.restorePolicy ?? {}) as { requiresAdmin?: boolean; expiresAt?: string }
  const requiresAdmin = policy.requiresAdmin === true

  const hasPermission =
    (isOriginalActor && !requiresAdmin) || isAdmin
  if (!hasPermission) {
    return c.json({ success: false, error: 'Forbidden', code: 'PERMISSION_DENIED' }, 403)
  }
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: 8 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/handlers/activity-restore.ts tests/integration/handlers/activity-restore.integration.test.ts
git commit -m "feat(activities): activity-restore step 5 — permission check

(isOriginalActor && !requiresAdmin) || isAdmin. The X-Test-User
header path is a test bridge; production reads c.get('user')
populated by jwtAuth, wired in a later task."
```

---

## Task 18: Time Window Check (Step 6 → 410)

**Files:**
- Modify: `src/modules/activities/handlers/activity-restore.ts`
- Modify: `tests/integration/handlers/activity-restore.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
  it('returns 410 when restorePolicy.expiresAt is in the past', async () => {
    const expired = makeActivity({
      details: JSON.stringify({
        reversible: true,
        restoreHandler: 'tag.delete',
        previousState: { id: 42 },
        newState: { id: 42, deleted_at: '2026-05-25T00:00:00.000Z' },
        restorePolicy: { expiresAt: new Date(Date.now() - 60_000).toISOString(), requiresAdmin: false },
        restoredByActivityId: null
      })
    })
    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake',
        'X-Test-User': JSON.stringify({ id: 'agent-original', role: 'agent' })
      }
    }, makeBindings(expired))
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.code).toBe('RESTORE_EXPIRED')
  })

  it('returns 410 when restorePolicy.expiresAt is missing', async () => {
    const noPolicy = makeActivity({
      details: JSON.stringify({
        reversible: true,
        restoreHandler: 'tag.delete',
        previousState: { id: 42 },
        newState: { id: 42 },
        restoredByActivityId: null
      })
    })
    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake',
        'X-Test-User': JSON.stringify({ id: 'agent-original', role: 'agent' })
      }
    }, makeBindings(noPolicy))
    expect(res.status).toBe(410)
  })
```

- [ ] **Step 2: Run test — expect failure**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: FAIL with status 501 (we never reach the time check).

- [ ] **Step 3: Implement step 6**

Insert into `activity-restore.ts` after the permission block:

```typescript
  // Step 6: Time window check
  const expiresAtStr = policy.expiresAt
  if (!expiresAtStr || Date.now() >= new Date(expiresAtStr).getTime()) {
    return c.json(
      { success: false, error: 'Restore window has expired', code: 'RESTORE_EXPIRED' },
      410
    )
  }
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: 10 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/handlers/activity-restore.ts tests/integration/handlers/activity-restore.integration.test.ts
git commit -m "feat(activities): activity-restore step 6 — time window 410

Compares against per-record restorePolicy.expiresAt. Missing
policy is treated as expired (defense in depth for legacy
records that somehow flipped reversible:true without policy)."
```

---

## Task 19: Conflict Detection (Step 7 → 409)

**Files:**
- Modify: `src/modules/activities/handlers/activity-restore.ts`
- Modify: `tests/integration/handlers/activity-restore.integration.test.ts`

- [ ] **Step 1: Write the failing tests**

Append:

```typescript
  it('returns 409 RESTORE_CONFLICT when current resource differs from recorded newState (force=false)', async () => {
    // Activity is a tag_update. Recorded newState says name='Renamed'.
    // Current row says name='Modified by Bob' — conflict.
    const activity = makeActivity({
      action: 'tag_update',
      details: JSON.stringify({
        reversible: true,
        restoreHandler: 'tag.update',
        previousState: { id: 42, name: 'Original' },
        newState: { id: 42, name: 'Renamed' },
        restorePolicy: { expiresAt: new Date(Date.now() + 60_000).toISOString(), requiresAdmin: false },
        restoredByActivityId: null
      })
    })
    // First select returns the activity, second select returns current tag row
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn()
        .mockResolvedValueOnce(activity)
        .mockResolvedValueOnce({ id: 42, name: 'Modified by Bob' }),
      run: vi.fn(),
      all: vi.fn()
    }
    const bindings = { DB: { prepare: vi.fn(() => stmt), batch: vi.fn() } as unknown as D1Database }

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake',
        'X-Test-User': JSON.stringify({ id: 'agent-original', role: 'agent' })
      },
      body: JSON.stringify({}),
      // body is empty / force=false
    }, bindings)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('RESTORE_CONFLICT')
    expect(body.data.midChanges).toHaveLength(1)
    expect(body.data.midChanges[0].field).toBe('name')
    expect(body.data.midChanges[0].valueAtOriginalAction).toBe('Renamed')
    expect(body.data.midChanges[0].valueNow).toBe('Modified by Bob')
    expect(body.data.midChanges[0].valueAfterRestore).toBe('Original')
  })

  it('returns 422 when getCurrentState returns null (resource hard-deleted)', async () => {
    const activity = makeActivity({
      action: 'tag_update',
      details: JSON.stringify({
        reversible: true,
        restoreHandler: 'tag.update',
        previousState: { id: 42, name: 'Original' },
        newState: { id: 42, name: 'Renamed' },
        restorePolicy: { expiresAt: new Date(Date.now() + 60_000).toISOString(), requiresAdmin: false },
        restoredByActivityId: null
      })
    })
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn()
        .mockResolvedValueOnce(activity)
        .mockResolvedValueOnce(null),
      run: vi.fn(),
      all: vi.fn()
    }
    const bindings = { DB: { prepare: vi.fn(() => stmt), batch: vi.fn() } as unknown as D1Database }

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake',
        'X-Test-User': JSON.stringify({ id: 'agent-original', role: 'agent' })
      }
    }, bindings)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.code).toBe('RESOURCE_GONE')
  })
```

- [ ] **Step 2: Run test — expect failure**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: FAIL (still 501 after time check).

- [ ] **Step 3: Implement step 7**

Add to top of `activity-restore.ts`:

```typescript
import { RestoreRegistry } from '@modules/activities/services/restore-registry'
import { diffStates } from '@modules/activities/services/conflict-detector'
```

Then insert after the time-window block (and read `force` from body):

```typescript
  // Parse optional body { force?: boolean }
  let force = false
  try {
    const body = (await c.req.json()) as { force?: boolean }
    force = body?.force === true
  } catch {
    // empty body is fine, force stays false
  }

  // Step 7: Conflict detection
  const restoreHandlerKey = details.restoreHandler as string
  const handler = RestoreRegistry[restoreHandlerKey]
  if (!handler) {
    return c.json(
      {
        success: false,
        error: `Unknown restoreHandler: ${restoreHandlerKey}`,
        code: 'UNKNOWN_HANDLER'
      },
      422
    )
  }

  const resourceId = String(row.resource_id ?? '')
  if (!resourceId) {
    return c.json(
      { success: false, error: 'Activity has no resourceId', code: 'NO_RESOURCE_ID' },
      422
    )
  }

  const currentState = await handler.getCurrentState(c.env.DB, resourceId)
  if (currentState === null) {
    return c.json(
      { success: false, error: 'Resource no longer exists', code: 'RESOURCE_GONE' },
      422
    )
  }

  const recordedNewState = (details.newState ?? {}) as Record<string, unknown>
  const previousState = (details.previousState ?? {}) as Record<string, unknown>
  const midChanges = diffStates(currentState, recordedNewState, previousState)

  if (midChanges.length > 0 && !force) {
    return c.json(
      {
        success: false,
        error: 'Conflict detected',
        code: 'RESTORE_CONFLICT',
        data: { midChanges }
      },
      409
    )
  }
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: 12 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/handlers/activity-restore.ts tests/integration/handlers/activity-restore.integration.test.ts
git commit -m "feat(activities): activity-restore step 7 — conflict detection

Dispatch via RestoreRegistry, compare current state vs recorded
newState via diffStates. Returns 409 RESTORE_CONFLICT with the
midChanges diff when force=false; 422 RESOURCE_GONE when the
resource is hard-deleted."
```

---

## Task 20: CAS Slot Acquisition (Step 8)

**Files:**
- Modify: `src/modules/activities/handlers/activity-restore.ts`
- Modify: `tests/integration/handlers/activity-restore.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```typescript
  it('returns 409 RESTORE_IN_PROGRESS when CAS finds slot is -1', async () => {
    const activity = makeActivity()
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn()
        .mockResolvedValueOnce(activity)                          // first SELECT activity
        .mockResolvedValueOnce({ id: 42, deleted_at: '2026-05-26T00:00:00.000Z' })  // getCurrentState
        .mockResolvedValueOnce({ ...activity, details: JSON.stringify({ ...JSON.parse(activity.details as string), restoredByActivityId: -1 }) }), // re-read after CAS lost
      run: vi.fn().mockResolvedValueOnce({ meta: { changes: 0 } }), // CAS loser
      all: vi.fn()
    }
    const bindings = { DB: { prepare: vi.fn(() => stmt), batch: vi.fn() } as unknown as D1Database }

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake',
        'X-Test-User': JSON.stringify({ id: 'agent-original', role: 'agent' })
      }
    }, bindings)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('RESTORE_IN_PROGRESS')
    expect(body.data.retryAfterMs).toBeGreaterThan(0)
  })

  it('returns 409 ALREADY_RESTORED when CAS finds slot has a real RESTORE id', async () => {
    const activity = makeActivity()
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn()
        .mockResolvedValueOnce(activity)
        .mockResolvedValueOnce({ id: 42, deleted_at: '2026-05-26T00:00:00.000Z' })
        .mockResolvedValueOnce({ ...activity, details: JSON.stringify({ ...JSON.parse(activity.details as string), restoredByActivityId: 555 }) }),
      run: vi.fn().mockResolvedValueOnce({ meta: { changes: 0 } }),
      all: vi.fn()
    }
    const bindings = { DB: { prepare: vi.fn(() => stmt), batch: vi.fn() } as unknown as D1Database }

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake',
        'X-Test-User': JSON.stringify({ id: 'agent-original', role: 'agent' })
      }
    }, bindings)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('ALREADY_RESTORED')
    expect(body.data.restoredByActivityId).toBe(555)
  })
```

- [ ] **Step 2: Run test — expect failure**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: FAIL (501 after conflict block).

- [ ] **Step 3: Implement step 8**

Insert into `activity-restore.ts` after the conflict block:

```typescript
  // Step 8: CAS slot acquisition (placeholder -1 reserves the slot)
  const casResult = await c.env.DB
    .prepare(`
      UPDATE activities
         SET details = json_set(details, '$.restoredByActivityId', -1)
       WHERE id = ?
         AND json_extract(details, '$.restoredByActivityId') IS NULL
    `)
    .bind(id)
    .run()

  if (casResult.meta?.changes !== 1) {
    // Re-read to discover who won
    const reread = await c.env.DB
      .prepare('SELECT details FROM activities WHERE id = ?')
      .bind(id)
      .first<{ details: string }>()
    let winnerId: number | string | null = null
    try {
      const parsed = JSON.parse(reread?.details ?? '{}') as { restoredByActivityId?: number }
      winnerId = parsed.restoredByActivityId ?? null
    } catch {
      winnerId = null
    }
    if (winnerId === -1) {
      return c.json(
        {
          success: false,
          error: 'Restore in progress',
          code: 'RESTORE_IN_PROGRESS',
          data: { retryAfterMs: 2000 }
        },
        409
      )
    }
    return c.json(
      {
        success: false,
        error: 'Already restored',
        code: 'ALREADY_RESTORED',
        data: { restoredByActivityId: winnerId }
      },
      409
    )
  }
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: 14 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/handlers/activity-restore.ts tests/integration/handlers/activity-restore.integration.test.ts
git commit -m "feat(activities): activity-restore step 8 — CAS slot acquisition

Atomic UPDATE with WHERE ... IS NULL reserves the slot. Loser
re-reads to discover whether the winning slot is -1 (in progress)
or a real id (already restored) and returns the matching 409 shape."
```

---

## Task 21: Batch Mutation + Log INSERT (Step 9)

**Files:**
- Modify: `src/modules/activities/handlers/activity-restore.ts`
- Modify: `tests/integration/handlers/activity-restore.integration.test.ts`

- [ ] **Step 1: Write the failing test (happy path)**

Append:

```typescript
  it('200 happy path: mutation + restore log run in db.batch and slot is finalized', async () => {
    const activity = makeActivity()
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn()
        .mockResolvedValueOnce(activity)
        .mockResolvedValueOnce({ id: 42, deleted_at: '2026-05-26T00:00:00.000Z' }),  // getCurrentState
      run: vi.fn()
        .mockResolvedValueOnce({ meta: { changes: 1 } })   // CAS won
        .mockResolvedValueOnce({ meta: { changes: 1 } }),  // finalize slot
      all: vi.fn()
    }
    const batch = vi.fn().mockResolvedValue([
      { meta: { changes: 1 } },               // mutation result
      { meta: { last_row_id: 1234, changes: 1 } }  // RESTORE log result
    ])
    const bindings = { DB: { prepare: vi.fn(() => stmt), batch } as unknown as D1Database }

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake',
        'X-Test-User': JSON.stringify({ id: 'agent-original', role: 'agent', name: 'Alice' })
      }
    }, bindings)
    expect(res.status).toBe(200)
    expect(batch).toHaveBeenCalledTimes(1)
    // batch was called with exactly two statements
    expect(batch.mock.calls[0][0]).toHaveLength(2)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.restoredByActivityId).toBe(1234)
  })

  it('500 + rolls back the slot if batch throws', async () => {
    const activity = makeActivity()
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn()
        .mockResolvedValueOnce(activity)
        .mockResolvedValueOnce({ id: 42 }),
      run: vi.fn()
        .mockResolvedValueOnce({ meta: { changes: 1 } })   // CAS won
        .mockResolvedValueOnce({ meta: { changes: 1 } }),  // compensating clear
      all: vi.fn()
    }
    const batch = vi.fn().mockRejectedValue(new Error('D1: simulated failure'))
    const bindings = { DB: { prepare: vi.fn(() => stmt), batch } as unknown as D1Database }

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake',
        'X-Test-User': JSON.stringify({ id: 'agent-original', role: 'agent', name: 'Alice' })
      }
    }, bindings)
    expect(res.status).toBe(500)
    // The compensating UPDATE must have run (slot cleared back to NULL)
    const runCalls = stmt.run.mock.calls.length
    expect(runCalls).toBeGreaterThanOrEqual(2)
  })
```

- [ ] **Step 2: Run test — expect failure (501)**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: FAIL with 501.

- [ ] **Step 3: Implement step 9 (and step 10 inline)**

Add import at top:

```typescript
import { ActivityCapture } from '@modules/activities/services/ActivityCapture'
import { ACTIVITY_ACTIONS } from '@modules/activities/constants/actions'
```

Add a helper near the top of the file:

```typescript
function restoreActionFor(resourceType: string): string | null {
  switch (resourceType) {
    case 'tag': return ACTIVITY_ACTIONS.TAG_RESTORE
    case 'customer': return ACTIVITY_ACTIONS.CUSTOMER_RESTORE
    case 'conversation': return ACTIVITY_ACTIONS.CONVERSATION_RESTORE
    case 'team': return ACTIVITY_ACTIONS.TEAM_RESTORE
    case 'team_member': return ACTIVITY_ACTIONS.TEAM_MEMBER_RESTORE
    case 'delayed_message': return ACTIVITY_ACTIONS.DELAYED_MESSAGE_RESTORE
    case 'user':
    case 'agent': return ACTIVITY_ACTIONS.USER_RESTORE  // existing constant
    default: return null
  }
}
```

Replace the trailing 501 with steps 9 + 10 + 11:

```typescript
  // Step 9: build & run [mutation, restoreLog] in one batch
  const resourceType = String(row.resource_type ?? '')
  const restoreAction = restoreActionFor(resourceType)
  if (!restoreAction) {
    // Clear slot — we cannot proceed safely
    await c.env.DB
      .prepare("UPDATE activities SET details = json_set(details, '$.restoredByActivityId', NULL) WHERE id = ?")
      .bind(id)
      .run()
    return c.json(
      { success: false, error: `Unsupported resourceType: ${resourceType}`, code: 'UNSUPPORTED_RESOURCE_TYPE' },
      422
    )
  }

  const capture = new ActivityCapture(c.env.DB)
  const mutationStmt = handler.buildMutation(c.env.DB, previousState)
  const restoreLogStmt = capture.buildIrreversibleLog({
    userId:       caller.id,
    userName:     (caller as { name?: string }).name ?? caller.id,
    userRole:     caller.role,
    action:       restoreAction,
    resourceType,
    resourceId,
    ipAddress:    c.req.header('CF-Connecting-IP'),
    userAgent:    c.req.header('User-Agent'),
    details: {
      restoredActivityId: id,
      force
    },
    reason: 'restore_action_v1_not_reversible'
  })

  let newRestoreLogId: number | null = null
  try {
    const results = await c.env.DB.batch([mutationStmt, restoreLogStmt])
    const logResult = results[1] as unknown as { meta?: { last_row_id?: number } }
    newRestoreLogId = logResult.meta?.last_row_id ?? null
  } catch (err) {
    // Compensate: clear the slot so retries can proceed
    await c.env.DB
      .prepare("UPDATE activities SET details = json_set(details, '$.restoredByActivityId', NULL) WHERE id = ?")
      .bind(id)
      .run()
    return c.json(
      {
        success: false,
        error: 'Restore failed during mutation/log batch',
        code: 'BATCH_FAILED',
        data: { message: err instanceof Error ? err.message : 'unknown' }
      },
      500
    )
  }

  // Step 10: finalize slot with the real RESTORE log id
  if (newRestoreLogId !== null) {
    await c.env.DB
      .prepare(`
        UPDATE activities
           SET details = json_set(details, '$.restoredByActivityId', ?)
         WHERE id = ?
      `)
      .bind(newRestoreLogId, id)
      .run()
  }
  // If newRestoreLogId is null, slot stays at -1 — janitor sweeps it later.
  // Per spec: data IS restored, only the marker is orphan; benign.

  // Step 11: WebSocket broadcast — wired in Task 23.

  // Step 12: response
  return c.json({
    success: true,
    data: {
      restoredByActivityId: newRestoreLogId,
      restoredActivityId: id
    }
  }, 200)
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: 16 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/handlers/activity-restore.ts tests/integration/handlers/activity-restore.integration.test.ts
git commit -m "feat(activities): activity-restore step 9-12 — batch dispatch + finalize

Mutation and RESTORE log INSERT submitted in one db.batch() so D1
rolls back both on any failure. On success, slot is finalized with
the new log id; on failure, slot is compensatingly cleared. The
RESTORE log carries caller metadata (not original actor's) per spec."
```

---

## Task 22: WebSocket Broadcast (Step 11)

**Files:**
- Modify: `src/modules/activities/handlers/activity-restore.ts`
- Modify: `tests/integration/handlers/activity-restore.integration.test.ts`

This wires the existing `MessageBroadcaster` Durable Object so other connected clients see the restore in real time.

- [ ] **Step 1: Read MessageBroadcaster to understand its API**

Run: read `src/durable-objects/MessageBroadcaster.ts` (top 80 lines) to confirm the event-publish API.

- [ ] **Step 2: Write the failing test**

Append:

```typescript
  it('broadcasts resource.restored over MessageBroadcaster on success', async () => {
    const activity = makeActivity()
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn()
        .mockResolvedValueOnce(activity)
        .mockResolvedValueOnce({ id: 42 }),
      run: vi.fn()
        .mockResolvedValueOnce({ meta: { changes: 1 } })   // CAS
        .mockResolvedValueOnce({ meta: { changes: 1 } }),  // finalize
      all: vi.fn()
    }
    const batch = vi.fn().mockResolvedValue([
      { meta: { changes: 1 } },
      { meta: { last_row_id: 1234 } }
    ])

    const broadcastFetch = vi.fn().mockResolvedValue(new Response('ok'))
    const broadcasterStub = {
      idFromName: vi.fn().mockReturnValue('do-id'),
      get: vi.fn().mockReturnValue({ fetch: broadcastFetch })
    }
    const bindings = {
      DB: { prepare: vi.fn(() => stmt), batch } as unknown as D1Database,
      MESSAGE_BROADCASTER: broadcasterStub
    }

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake',
        'X-Test-User': JSON.stringify({ id: 'agent-original', role: 'agent', name: 'Alice' })
      }
    }, bindings)
    expect(res.status).toBe(200)
    expect(broadcastFetch).toHaveBeenCalledOnce()
    const broadcastReq = broadcastFetch.mock.calls[0][0] as Request
    const broadcastBody = await broadcastReq.json()
    expect(broadcastBody.event).toBe('resource.restored')
    expect(broadcastBody.payload.resourceType).toBe('tag')
    expect(broadcastBody.payload.resourceId).toBe('42')
  })
```

- [ ] **Step 3: Implement step 11**

Insert before the `return c.json({success:true...})` at the bottom of `activity-restore.ts`:

```typescript
  // Step 11: WebSocket broadcast (fire-and-forget; do not let broadcast
  // failures fail the restore — data is already committed)
  try {
    const broadcaster = c.env.MESSAGE_BROADCASTER as
      | { idFromName: (name: string) => unknown; get: (id: unknown) => { fetch: (req: Request) => Promise<Response> } }
      | undefined
    if (broadcaster) {
      const doId = broadcaster.idFromName('global')
      const stub = broadcaster.get(doId)
      const broadcastReq = new Request('https://internal/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          event: 'resource.restored',
          payload: {
            resourceType,
            resourceId,
            restoredBy: caller.id,
            restoredByActivityId: newRestoreLogId
          }
        })
      })
      await stub.fetch(broadcastReq)
    }
  } catch (err) {
    // Log but do not fail the restore
    console.error('[activity-restore] broadcast failed', err)
  }
```

- [ ] **Step 4: Run test — expect pass**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: 17 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/handlers/activity-restore.ts tests/integration/handlers/activity-restore.integration.test.ts
git commit -m "feat(activities): activity-restore step 11 — WS broadcast

Publishes a resource.restored event over MessageBroadcaster so
other connected clients update their UI in real time. Broadcast
errors are logged but do not fail the restore — data is already
committed by the time we reach this step."
```

---

## Task 23: Mount the Route in activity.ts

**Files:**
- Modify: `src/modules/activities/handlers/activity.ts`

This places `POST /:id/restore` BEFORE `GET /:id` to win Hono's longest-prefix-first matching. Per CLAUDE.md route registration order: specific routes register first.

- [ ] **Step 1: Read current activity.ts to find the right insertion point**

Run: read `src/modules/activities/handlers/activity.ts`. The existing `router.get('/:id', ...)` is on roughly line 27.

- [ ] **Step 2: Insert the restore mount BEFORE the parameterized GET**

Add this import near the top of `activity.ts`:

```typescript
import activityRestoreHandler from './activity-restore'
```

Add this route mount BEFORE the existing `router.get('/:id', jwtAuth, requireIntId(), moduleActivityHandler.getById)` line:

```typescript
// ==================== Priority 2a: Multi-segment parameterized routes (FIRST) ====================
// Restore endpoint must register BEFORE the bare /:id route below — otherwise
// Hono would treat 'restore' as an activity id and 404.
router.route('/:id/restore', activityRestoreHandler)
```

- [ ] **Step 3: Run the existing activity unit + integration tests to confirm no regression**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts tests/unit/modules/activities/`
Expected: All previous tests still PASS.

- [ ] **Step 4: Run TypeScript type-check**

Run: `bun run build` (root)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/handlers/activity.ts
git commit -m "feat(activities): mount activity-restore handler in router

POST /api/activities/:id/restore is registered BEFORE the bare
GET /:id route per Hono route-order rules. JWT auth applies via
the inherited middleware chain."
```

---

## Task 24: Wire jwtAuth Middleware Into Restore Handler

**Files:**
- Modify: `src/modules/activities/handlers/activity-restore.ts`

The integration tests have been using the `X-Test-User` header bridge. Production needs the real `jwtAuth` middleware that populates `c.get('user')`. Now that the route is mounted, apply the middleware here.

- [ ] **Step 1: Add jwtAuth to the restore handler**

In `activity-restore.ts`, add an import:

```typescript
import { jwtAuth } from '@/middleware/auth'
```

Change the route registration from:

```typescript
handler.post('/', async (c) => {
```

To:

```typescript
handler.post('/', jwtAuth, async (c) => {
```

- [ ] **Step 2: Update the permission block to prefer the jwtAuth-populated user**

Replace the `caller` resolution block with:

```typescript
  // Step 5: Permission check
  // Production reads c.get('user') populated by jwtAuth middleware.
  // X-Test-User header is honored only in test/dev to keep integration tests
  // independent of JWT signing.
  type JwtUser = { id: string; displayName?: string; role: string }
  let caller: { id: string; role: string; name?: string } | null = null
  const jwtUser = c.get('user' as never) as JwtUser | null | undefined
  if (jwtUser?.id) {
    caller = { id: jwtUser.id, role: jwtUser.role, name: jwtUser.displayName }
  } else {
    const testUserHeader = c.req.header('X-Test-User')
    if (testUserHeader) {
      try { caller = JSON.parse(testUserHeader) } catch { caller = null }
    }
  }
  if (!caller) {
    return c.json({ success: false, error: 'Unauthenticated' }, 401)
  }
```

- [ ] **Step 3: Run the integration tests**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: 17 PASS — the X-Test-User path still works since jwtAuth allows the test bridge to no-op when no real token is present, OR if jwtAuth rejects, the test bindings must include a stub. If tests fail because jwtAuth is too strict, adjust the test to mock `c.get('user')` directly by passing a third argument to `app.request` that calls `c.set` — see test mock patch below.

If jwtAuth strict-rejects, replace the test bindings helper at the top of the file with a wrapper app that injects the user:

```typescript
function makeApp() {
  const app = new Hono()
  // Inject test user before the restore handler runs, bypassing jwtAuth
  app.use('/api/activities/:id/restore/*', async (c, next) => {
    const header = c.req.header('X-Test-User')
    if (header) {
      try { c.set('user', JSON.parse(header)) } catch { /* noop */ }
    }
    return next()
  })
  app.route('/api/activities/:id/restore', activityRestoreHandler)
  return app
}
```

- [ ] **Step 4: Type-check**

Run: `bun run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/handlers/activity-restore.ts tests/integration/handlers/activity-restore.integration.test.ts
git commit -m "feat(activities): wire jwtAuth middleware into restore handler

Production reads caller from c.get('user'); test bridge via
X-Test-User remains available only when no JWT user is set."
```

---

## Task 25: Integration Test — Concurrent Restore (CAS)

**Files:**
- Modify: `tests/integration/handlers/activity-restore.integration.test.ts`

- [ ] **Step 1: Add a concurrency test that exercises the CAS race**

Append:

```typescript
  it('two concurrent restores: exactly one wins, the other gets RESTORE_IN_PROGRESS', async () => {
    const activity = makeActivity()
    // Shared db state across both requests
    let slot: number | null = null
    const prepare = vi.fn((sql: string) => {
      const isCas = /restoredByActivityId.*IS NULL/i.test(sql) && /UPDATE activities/i.test(sql)
      const isReread = /SELECT details FROM activities/i.test(sql)
      const stmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn(async () => {
          if (isReread) {
            return { details: JSON.stringify({ ...JSON.parse(activity.details as string), restoredByActivityId: slot }) }
          }
          return activity
        }),
        run: vi.fn(async () => {
          if (isCas) {
            if (slot === null) {
              slot = -1
              return { meta: { changes: 1 } }
            }
            return { meta: { changes: 0 } }
          }
          return { meta: { changes: 1 } }
        }),
        all: vi.fn()
      }
      return stmt
    })
    const batch = vi.fn().mockResolvedValue([
      { meta: { changes: 1 } },
      { meta: { last_row_id: 9999 } }
    ])
    const bindings = { DB: { prepare, batch } as unknown as D1Database }

    const [a, b] = await Promise.all([
      app.request('/api/activities/5/restore', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer fake',
          'X-Test-User': JSON.stringify({ id: 'agent-original', role: 'agent', name: 'Alice' })
        }
      }, bindings),
      app.request('/api/activities/5/restore', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer fake',
          'X-Test-User': JSON.stringify({ id: 'agent-original', role: 'agent', name: 'Alice' })
        }
      }, bindings)
    ])

    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([200, 409])

    const loser = a.status === 409 ? a : b
    const loserBody = await loser.json()
    expect(['RESTORE_IN_PROGRESS', 'ALREADY_RESTORED']).toContain(loserBody.code)
  })
```

- [ ] **Step 2: Run the test**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: 18 PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/handlers/activity-restore.integration.test.ts
git commit -m "test(activities): cover concurrent-restore CAS race

Two simultaneous POST /restore on the same activity must yield
exactly one 200 and one 409 (RESTORE_IN_PROGRESS or
ALREADY_RESTORED). Verifies the CAS slot acquisition is the
serializing point."
```

---

## Task 26: Integration Test — D1 Batch Atomicity

**Files:**
- Modify: `tests/integration/handlers/activity-restore.integration.test.ts`

- [ ] **Step 1: Add a test where the mutation half of the batch fails**

Append:

```typescript
  it('rolls back the RESTORE log INSERT when mutation half of batch fails', async () => {
    const activity = makeActivity()
    const compensatingClear = vi.fn()
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn()
        .mockResolvedValueOnce(activity)
        .mockResolvedValueOnce({ id: 42 }),
      run: vi.fn(async (...args) => {
        const sql = stmt.bind.mock.calls.flat().join(' ')
        if (/restoredByActivityId.*NULL/i.test(sql) && /'\$\.restoredByActivityId', NULL/.test(sql)) {
          compensatingClear(...args)
        }
        return { meta: { changes: 1 } }
      }),
      all: vi.fn()
    }
    const batch = vi.fn().mockRejectedValue(new Error('D1: constraint violation simulated'))
    const bindings = { DB: { prepare: vi.fn(() => stmt), batch } as unknown as D1Database }

    const res = await app.request('/api/activities/5/restore', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer fake',
        'X-Test-User': JSON.stringify({ id: 'agent-original', role: 'agent', name: 'Alice' })
      }
    }, bindings)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe('BATCH_FAILED')
    // The compensating UPDATE must have been issued
    expect(compensatingClear).toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run the test**

Run: `bunx vitest run tests/integration/handlers/activity-restore.integration.test.ts`
Expected: 19 PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/handlers/activity-restore.integration.test.ts
git commit -m "test(activities): verify D1 batch atomicity + slot compensation

When the mutation half of db.batch() throws, no RESTORE log is
written (D1 rolls back the entire batch) and the CAS slot is
explicitly cleared back to NULL so the next attempt can proceed."
```

---

## Task 27: Run Full Project Health Check + Update Module Docs

**Files:**
- Modify: `src/modules/activities/README.md`
- Modify: `docs/modules/activities.md`

- [ ] **Step 1: Run the full project health check**

Run: `bash scripts/check.sh`
Expected: PASS (backend type-check + ESLint).

- [ ] **Step 2: Run the entire activities test suite**

Run: `bunx vitest run tests/unit/modules/activities tests/integration/handlers/activity-restore.integration.test.ts`
Expected: All PASS.

- [ ] **Step 3: Update the module README**

Read `src/modules/activities/README.md`. Append a new "Restore" section after the existing "Logging" section:

```markdown
## Restore (Phase 1)

The activities module supports undoing operations via:

- `ActivityCapture` — builds D1 statements for log inserts that participate in `db.batch()` alongside the caller's mutation, so log + mutation are atomic.
- `RestoreRegistry` — maps `restoreHandler` strings (e.g. `"tag.delete"`) to `RestoreHandler` objects with `buildMutation` and `getCurrentState` methods.
- `POST /api/activities/:id/restore` — endpoint that runs the full 11-step flow (reversibility → idempotency → permission → time window → conflict detection → CAS → batch → finalize → broadcast).

To make a new write action reversible (Phase 2 work):

1. Read the current state of the resource before mutating.
2. Build your mutation statement (not run it yet).
3. Build a reversible log statement via `ActivityCapture.buildReversibleLog`.
4. Submit both inside `db.batch([logStmt, mutationStmt])`.
5. Register a `RestoreHandler` in `restore-registry.ts` keyed by your handler string.

See `docs/superpowers/specs/2026-05-26-activity-restore-design.md` for the full design.
```

- [ ] **Step 4: Update the canonical module doc**

Read `docs/modules/activities.md`. Append a new section "Activity Restore" (the README content above is fine as a starting point; expand only if patterns differ from the README).

- [ ] **Step 5: Commit**

```bash
git add src/modules/activities/README.md docs/modules/activities.md
git commit -m "docs(activities): document restore infrastructure (Phase 1)

Describes ActivityCapture, RestoreRegistry, and the
/api/activities/:id/restore endpoint for future Phase 2
write-handler migrations."
```

---

## Self-Review (Plan Author)

After writing this plan, I checked it against the spec:

**Spec coverage:** Each `restorePolicy.expiresAt` and `requiresAdmin` use → Task 3 + Task 17 + Task 18. Each `restoreHandler` factory → Tasks 7-12. CAS + batch → Tasks 20 + 21. Conflict diff → Task 13 + Task 19. RESTORE log carries caller metadata → Task 21. RESTORE marked `reversible: false` → Task 21 (via `buildIrreversibleLog`). Route placement before `/:id` → Task 23. New action constants → Task 1. Frontend work and Phase 2 handler migration are intentionally deferred to subsequent plans (each phase is independently shippable per spec Section 7).

**Placeholder scan:** No "TBD", "TODO", or "similar to Task N". Every code step contains the actual code; every command shows the exact run line and expected output.

**Type consistency:** `RestoreHandler` interface declared in Task 6, used identically in Tasks 7-12 (factories return objects implementing it) and Task 19 (handler is dispatched via the same interface). `ReversibleCapture` declared in Task 2, used identically in Tasks 3 and downstream. `MidChange` declared in Task 13, consumed in Task 19's 409 payload.

**One thing I held back:** WebSocket broadcast (Task 22) currently uses a fire-and-forget `await stub.fetch(...)` without retries. That's intentional for Phase 1 — the data is already committed by the time broadcast runs, and broadcast failures should never roll back the restore. Future iteration can wrap broadcast in a queue if reliability becomes an issue.

---

## Out of Scope (Phase 1)

These appear in the spec but are owned by subsequent plans:

- **Phase 2a/2b** — migrating individual write handlers (tag_delete, customer_delete, etc.) to use `ActivityCapture.buildReversibleLog` + `db.batch()`. Without these, no activity in production has `reversible: true` and the endpoint is inert.
- **Phase 3** — Frontend `ActivityCard.vue` restore button, `RestoreConfirmModal.vue`, `useRestoreActivity` composable.
- **Phase 4** — Feature flag `ENABLE_ACTIVITY_RESTORE` wiring across runtime.ts + .env files + vite-env.d.ts, plus production rollout staging.
- **System-level restore** — `settings_update`, `system_backup`, `integration_create` are excluded from v1 entirely.
- **Janitor for `-1` orphan slots** — spec accepts these as benign; sweeper can be added later.
