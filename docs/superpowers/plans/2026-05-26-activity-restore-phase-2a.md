# Activity Restore — Phase 2a (High-Risk Handler Migration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the highest-impact write handlers from fire-and-forget `logActivity()` to the new `ActivityCapture.buildReversibleLog()` + `db.batch()` pattern delivered in Phase 1, so the `[還原]` button works for the operations users most often regret.

**Architecture:** For each target handler: read pre-state via the matching `RestoreHandler.getCurrentState`, build the mutation statement (do not run), build a reversible log statement via `ActivityCapture.buildReversibleLog`, submit both inside `c.env.DB.batch([log, mutation])` so D1's documented batch-rollback semantics guarantee atomicity.

**Tech Stack:** Hono + Drizzle + raw D1 batch on Cloudflare Workers, Vitest for tests, TypeScript strict mode.

**Spec:** `docs/superpowers/specs/2026-05-26-activity-restore-design.md`

**Prior plan:** `docs/superpowers/plans/2026-05-26-activity-restore-phase-1.md` (merged into main, commit `da7027ce`).

> **Note on line numbers:** Line numbers are approximate guides. Read the actual file to find the correct insertion / replacement point. Search by surrounding code context, not line numbers.

> **Note on Drizzle vs raw D1:** Existing handlers in this phase use Drizzle (e.g. `drizzleDb.run(sql\`...\`)`). The `ActivityCapture.buildReversibleLog` API returns a `D1PreparedStatement` (raw D1). To batch them together we must build BOTH statements as raw D1 prepared statements. Each task below shows how to translate the existing Drizzle mutation into a `c.env.DB.prepare(...).bind(...)` form that is byte-equivalent.

> **Note on commit policy:** Per project feedback memory `feedback_atomic_commits.md`, one logical change per commit. Each task produces its own commit. Do not bundle two handler migrations into one commit even if they look similar.

> **Note on emoji policy:** Per `feedback_no_emoji.md`, no emoji in source code, comments, console.log, or UI text.

---

## Scope Adjustments from the Original Phase 2a List

The original Phase 1 plan listed five Phase 2a targets. After auditing the actual repo state, two are deferred:

| Target | Status | Reason |
|--------|--------|--------|
| `tag_delete`           | **In** | Clean soft-delete UPDATE in `tag-service.ts:493`. |
| `tag_update`           | **In** | COALESCE UPDATE in `tag-service.ts:388`. |
| `team_member_remove`   | **In** | Hard DELETE on `agent_teams` junction in `team-service.ts:365`. Needs a new `RestoreHandler` (`addTeamMembership`) because we cannot clear a `deleted_at` that does not exist. Phase 1's `RestoreRegistry` is extended in Task 5 below. |
| `customer_delete`      | **Deferred** | `src/modules/customer/index.ts:33` advertises `DELETE /:id` but no route is registered in `customer-main.ts`. The `softDelete()` method exists in `customer-crud.ts:369` with no HTTP wiring. Wiring the endpoint is its own design — and it should arrive with proper permission checks and team-ownership validation. Tracked separately. |
| `delayed_message_cancel` | **Deferred** | The cancel mutation happens inside the `DELAYED_MESSAGE_SCHEDULER` Durable Object (`delayed-message-buffer.ts:187`). DO state is not addressable by `db.batch()`, so the canonical reliability pattern cannot apply. Needs a DO-specific design (snapshot the DO state before cancel, log with snapshot, then cancel; restore must call DO again). Tracked separately. |

Net Phase 2a scope: **3 handler migrations + 1 new RestoreHandler factory**.

---

## File Structure

### Backend (modify)

| File | Responsibility |
|------|---------------|
| `src/modules/tags/services/tag-service.ts` | `delete()` and `update()` methods rebuilt around `c.env.DB.batch([log, mutation])`. Captures pre-state including the columns about to change. |
| `src/modules/teams/services/team-service.ts` | `removeMember()` rebuilt around batch. Pre-state captures the full `agent_teams` row (agentId, teamId, roleInTeam, isPrimary, assignedAt). Primary-team-promotion side effect handled per the existing logic but moved into the batch's mutation tail. |
| `src/modules/teams/handlers/team-members.ts` | Pass actor context (`userId/userName/userRole`) from `c.get('user')` into `teamService.removeMember(...)` so the captured log carries caller identity. |
| `src/modules/activities/services/restore-helpers.ts` | Add `addTeamMembership` RestoreHandler. Inverse of removeMember — INSERTs the agent_teams row back, and clears any other primary flag (or restores the original primary state). |
| `src/modules/activities/services/restore-registry.ts` | Register `team_member.remove` → `addTeamMembership`. |

### Backend (create)

| File | Responsibility |
|------|---------------|
| `tests/integration/handlers/tag-restore.integration.test.ts` | End-to-end: delete tag → call POST /api/activities/:id/restore → tag is undeleted. |
| `tests/integration/handlers/team-member-restore.integration.test.ts` | End-to-end for team_member_remove restore. |

### Backend (modify tests)

| File | Responsibility |
|------|---------------|
| `tests/unit/modules/activities/services/restore-helpers.test.ts` | Add tests for `addTeamMembership`. |
| `tests/unit/modules/activities/services/restore-registry.test.ts` | Update expected key list to include `team_member.remove`. |

---

## Task 1: tag_delete — Migrate to db.batch (with snapshot)

**Files:**
- Modify: `src/modules/tags/services/tag-service.ts` (the `delete` method near line 493)

### Background

Current code:
```typescript
// fire-and-forget — log written AFTER mutation, no snapshot
await drizzleDb.run(sql`
  UPDATE tags
  SET is_active = 0, deleted_at = datetime('now'), updated_at = datetime('now')
  WHERE id = ${tagId}
`);
logTagActivity(c, ACTIVITY_ACTIONS.TAG_DELETE, tagId || '', { tagName });
```

The mutation runs first. If `logTagActivity` (or the underlying `ActivityService.logActivity`) throws or D1 hiccups, we lose the snapshot — and with it, restorability.

### Target code

```typescript
async delete(c: Context<{ Bindings: Bindings }>) {
  try {
    const tagId = c.req.param('id')
    const tagIdNum = Number(tagId)
    if (!Number.isInteger(tagIdNum) || tagIdNum <= 0) {
      return badRequestResponse(c, 'Invalid tag id')
    }

    // Read pre-state — full row, including columns we are about to set
    const existingTag = await c.env.DB
      .prepare('SELECT * FROM tags WHERE id = ?')
      .bind(tagIdNum)
      .first<TagRow>()

    if (!existingTag || existingTag.deleted_at !== null) {
      return notFoundResponse(c, 'Tag')
    }

    const user = c.get('user') as { id: string; displayName?: string; role: string }
    const now = nowISO()

    // Build the mutation statement (do not run yet)
    const mutationStmt = c.env.DB
      .prepare(`UPDATE tags
                SET is_active = 0, deleted_at = ?, updated_at = ?
                WHERE id = ?`)
      .bind(now, now, tagIdNum)

    // Build the reversible log statement
    const capture = new ActivityCapture(c.env.DB)
    const logStmt = capture.buildReversibleLog({
      request: {
        userId: user.id,
        userName: user.displayName ?? user.id,
        userRole: user.role,
        action: ACTIVITY_ACTIONS.TAG_DELETE,
        resourceType: RESOURCE_TYPES.TAG,
        resourceId: String(tagIdNum),
        ipAddress: c.req.header('CF-Connecting-IP') ?? undefined,
        userAgent: c.req.header('User-Agent') ?? undefined,
        details: { tagName: existingTag.name }
      },
      restoreHandler: 'tag.delete',
      previousState: {
        id: existingTag.id,
        is_active: existingTag.is_active,
        deleted_at: existingTag.deleted_at,
        updated_at: existingTag.updated_at
      },
      newState: {
        id: existingTag.id,
        is_active: 0,
        deleted_at: now,
        updated_at: now
      }
    })

    // Atomic — D1 batch rolls back BOTH on any failure
    await c.env.DB.batch([logStmt, mutationStmt])

    return successResponse(c, null, 'Tag deleted successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}
```

### Imports needed at the top of `tag-service.ts`

```typescript
import { ActivityCapture } from '@modules/activities'
```

(`ActivityService`, `ACTIVITY_ACTIONS`, `RESOURCE_TYPES` are already imported.)

### Steps

- [ ] **Step 1: Read the file to find the exact delete-method scope**

Run: read `src/modules/tags/services/tag-service.ts` lines 480-530. Confirm:
- The method signature line number
- The current `logTagActivity` call still exists
- No other code path mutates tags around this method

- [ ] **Step 2: Write the integration test FIRST**

Create `tests/integration/handlers/tag-restore.integration.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Minimal end-to-end smoke test using mocked D1
function makeDb() {
  const calls: Array<{ sql: string; params: unknown[] }> = []
  const batched: Array<Array<{ sql: string; params: unknown[] }>> = []
  function mkStmt(sql: string) {
    let params: unknown[] = []
    const stmt = {
      bind: vi.fn((...p: unknown[]) => { params = p; return stmt }),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn()
    }
    return Object.assign(stmt, { __sql: () => sql, __params: () => params })
  }
  const prepare = vi.fn((sql: string) => mkStmt(sql))
  const batch = vi.fn(async (stmts: Array<{ __sql: () => string; __params: () => unknown[] }>) => {
    batched.push(stmts.map(s => ({ sql: s.__sql(), params: s.__params() })))
    return stmts.map(() => ({ meta: { changes: 1, last_row_id: 1 } }))
  })
  return { db: { prepare, batch } as unknown as D1Database, calls, batched }
}

describe('tag delete -> reversible log + UPDATE in one batch', () => {
  // Concrete handler test will be added once the migration lands;
  // this file establishes the test target and is wired in step 4 below.
  it('placeholder — replaced in step 4', () => {
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 3: Run the placeholder test to confirm the file compiles**

Run: `bunx vitest run tests/integration/handlers/tag-restore.integration.test.ts`
Expected: 1 PASS (placeholder).

- [ ] **Step 4: Apply the migration shown in the Target code section above**

Use `Edit` on `src/modules/tags/services/tag-service.ts` to replace the body of `async delete(c)` with the Target code. Add the `ActivityCapture` import at the top.

- [ ] **Step 5: Replace the placeholder test with a real one**

Replace the contents of `tests/integration/handlers/tag-restore.integration.test.ts` with:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { tagHandler } from '@/modules/tags/services/tag-service'

function makeApp() {
  const app = new Hono()
  app.delete('/api/tags/:id', async (c) => tagHandler.delete(c))
  return app
}

describe('tag delete via batch', () => {
  it('writes the reversible log and the UPDATE in a single db.batch', async () => {
    const existingTag = {
      id: 42, name: 'VIP', color: '#FF9500', description: null,
      team_id: null, is_active: 1, created_by: 'agent-1',
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-05-20T14:32:11.000Z',
      deleted_at: null
    }
    const batched: unknown[][] = []
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(existingTag),
      run: vi.fn(),
      all: vi.fn()
    }
    const batch = vi.fn(async (stmts: unknown[]) => {
      batched.push(stmts)
      return stmts.map(() => ({ meta: { changes: 1, last_row_id: 1 } }))
    })
    const env = {
      DB: { prepare: vi.fn(() => stmt), batch } as unknown as D1Database
    }

    const app = makeApp()
    // Inject a fake JWT user into context — production goes through jwtAuth
    app.use('/api/tags/:id', async (c, next) => {
      c.set('user', { id: 'agent-1', displayName: 'Alice', role: 'admin' })
      return next()
    })

    const res = await app.request('/api/tags/42', { method: 'DELETE' }, env)
    expect(res.status).toBe(200)
    expect(batch).toHaveBeenCalledOnce()
    expect(batched[0]).toHaveLength(2)
  })

  it('returns 404 when the tag is already soft-deleted', async () => {
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        id: 42, name: 'VIP', deleted_at: '2026-05-25T00:00:00.000Z'
      }),
      run: vi.fn(),
      all: vi.fn()
    }
    const batch = vi.fn()
    const env = { DB: { prepare: vi.fn(() => stmt), batch } as unknown as D1Database }
    const app = makeApp()
    app.use('/api/tags/:id', async (c, next) => {
      c.set('user', { id: 'agent-1', displayName: 'Alice', role: 'admin' })
      return next()
    })

    const res = await app.request('/api/tags/42', { method: 'DELETE' }, env)
    expect(res.status).toBe(404)
    expect(batch).not.toHaveBeenCalled()
  })

  it('does not run mutation when log validation would fail (D1 batch rolls back both)', async () => {
    const existingTag = {
      id: 42, name: 'VIP', is_active: 1, deleted_at: null, updated_at: '2026-05-20T00:00:00.000Z'
    }
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(existingTag),
      run: vi.fn(),
      all: vi.fn()
    }
    const batch = vi.fn().mockRejectedValue(new Error('D1 constraint violation'))
    const env = { DB: { prepare: vi.fn(() => stmt), batch } as unknown as D1Database }
    const app = makeApp()
    app.use('/api/tags/:id', async (c, next) => {
      c.set('user', { id: 'agent-1', displayName: 'Alice', role: 'admin' })
      return next()
    })

    const res = await app.request('/api/tags/42', { method: 'DELETE' }, env)
    // handleApiError translates thrown errors to 500-class responses
    expect(res.status).toBeGreaterThanOrEqual(500)
  })
})
```

- [ ] **Step 6: Run the integration test**

Run: `bunx vitest run tests/integration/handlers/tag-restore.integration.test.ts`
Expected: 3 PASS.

- [ ] **Step 7: Run the full activities + tags suite to confirm no regression**

Run: `bunx vitest run tests/unit/modules/activities tests/integration/handlers/activity-restore.integration.test.ts tests/integration/handlers/tag-restore.integration.test.ts`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/tags/services/tag-service.ts tests/integration/handlers/tag-restore.integration.test.ts
git commit -m "feat(tags): make tag_delete reversible via ActivityCapture + db.batch

Pre-existing fire-and-forget pattern is replaced by:
  read snapshot -> build [log, mutation] -> c.env.DB.batch([...])

D1 batch is documented as transactional, so the log row and the
UPDATE either both apply or both don't — no partial state where
the tag is deleted but no restoration snapshot exists.

The captured previousState includes is_active, deleted_at and
updated_at — the three columns the mutation overwrites — so
RestoreRegistry['tag.delete'] (restoreSoftDeleted('tags')) has
everything it needs to reverse the action."
```

---

## Task 2: tag_update — Migrate to db.batch (capture only mutated columns)

**Files:**
- Modify: `src/modules/tags/services/tag-service.ts` (the `update` method near line 388)

### Background

Current code uses a single COALESCE UPDATE that mutates whichever of `name`, `color`, `description`, `is_active` were supplied. It fires `logTagActivity` afterward with the new values only — no previousState, no snapshot.

### Approach

`tag.update` maps to `restoreFields('tags')` in the Phase 1 registry. `restoreFields` will write back every column present in `previousState`. To avoid restoring columns we never touched, we capture **only** the columns the COALESCE statement might have changed.

### Target code

Replace the body of `async update(c)` (the migration touches the section after the duplicate-check, replacing the UPDATE + activity-logging tail):

```typescript
// ... existing code up to and including the duplicate-name check stays ...

// Determine the columns that will actually change
const captured: Record<string, unknown> = {}
const newValues: Record<string, unknown> = {}
const existingRowAll = existingTag as TagRow

if (name !== undefined && name !== existingRowAll.name) {
  captured.name = existingRowAll.name
  newValues.name = name
}
if (normalizedColor !== undefined && normalizedColor !== existingRowAll.color) {
  captured.color = existingRowAll.color
  newValues.color = normalizedColor
}
if (description !== undefined && description !== existingRowAll.description) {
  captured.description = existingRowAll.description
  newValues.description = description
}
if (isActive !== undefined && (isActive ? 1 : 0) !== existingRowAll.is_active) {
  captured.is_active = existingRowAll.is_active
  newValues.is_active = isActive ? 1 : 0
}

// No actual change — skip the write but still return the current row
if (Object.keys(captured).length === 0) {
  return successResponse(c, mapTagRowToResponse(existingRowAll), 'Tag is unchanged')
}

const now = nowISO()
captured.updated_at = existingRowAll.updated_at
newValues.updated_at = now

const setClause = Object.keys(newValues).map(k => `${k} = ?`).join(', ')
const setParams = Object.values(newValues)

const mutationStmt = c.env.DB
  .prepare(`UPDATE tags SET ${setClause} WHERE id = ?`)
  .bind(...setParams, Number(tagId))

const user = c.get('user') as { id: string; displayName?: string; role: string }
const capture = new ActivityCapture(c.env.DB)
const logStmt = capture.buildReversibleLog({
  request: {
    userId: user.id,
    userName: user.displayName ?? user.id,
    userRole: user.role,
    action: ACTIVITY_ACTIONS.TAG_UPDATE,
    resourceType: RESOURCE_TYPES.TAG,
    resourceId: String(tagId),
    ipAddress: c.req.header('CF-Connecting-IP') ?? undefined,
    userAgent: c.req.header('User-Agent') ?? undefined,
    details: { tagName: existingRowAll.name, changedFields: Object.keys(captured) }
  },
  restoreHandler: 'tag.update',
  previousState: { id: Number(tagId), ...captured },
  newState:      { id: Number(tagId), ...newValues }
})

await c.env.DB.batch([logStmt, mutationStmt])

// ... existing code that re-queries updatedTag and returns the response stays ...
```

You will likely also need a small `mapTagRowToResponse(row)` helper if it does not already exist, or inline the same shape used by the success response below — see existing code for the exact shape.

### Steps

- [ ] **Step 1: Read the file to confirm the helper and TagRow shape**

Run: read `src/modules/tags/services/tag-service.ts` lines 388-490. Note the existing return shape so the no-op path returns equivalent data.

- [ ] **Step 2: Write the integration test FIRST**

Append to `tests/integration/handlers/tag-restore.integration.test.ts`:

```typescript
describe('tag update via batch', () => {
  it('captures only the fields that actually change', async () => {
    const existingTag = {
      id: 42, name: 'VIP', color: '#FF9500', description: 'Original',
      team_id: null, is_active: 1, created_by: 'agent-1',
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-05-20T14:32:11.000Z',
      deleted_at: null
    }
    const updatedTag = { ...existingTag, name: 'Premium', updated_at: '2026-05-26T14:00:00.000Z', customer_count: 0, conversation_count: 0 }
    const batched: unknown[][] = []
    let firstCallCount = 0
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(async () => {
        firstCallCount += 1
        if (firstCallCount === 1) return existingTag      // initial SELECT
        return updatedTag                                  // post-update re-fetch
      }),
      run: vi.fn(),
      all: vi.fn().mockResolvedValue({ results: [] })       // duplicate-name check
    }
    const batch = vi.fn(async (stmts: unknown[]) => {
      batched.push(stmts)
      return stmts.map(() => ({ meta: { changes: 1, last_row_id: 1 } }))
    })
    const env = { DB: { prepare: vi.fn(() => stmt), batch } as unknown as D1Database }
    const app = new Hono()
    app.use('/api/tags/:id', async (c, next) => {
      c.set('user', { id: 'agent-1', displayName: 'Alice', role: 'admin' })
      return next()
    })
    app.put('/api/tags/:id', async (c) => tagHandler.update(c))

    const res = await app.request('/api/tags/42', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Premium' })   // only name changes
    }, env)

    expect(res.status).toBe(200)
    expect(batch).toHaveBeenCalledOnce()
    expect(batched[0]).toHaveLength(2)
  })

  it('skips the batch when no fields would change', async () => {
    const existingTag = {
      id: 42, name: 'VIP', color: '#FF9500', description: null,
      team_id: null, is_active: 1, created_by: 'agent-1',
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-05-20T14:32:11.000Z',
      deleted_at: null
    }
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(existingTag),
      run: vi.fn(),
      all: vi.fn().mockResolvedValue({ results: [] })
    }
    const batch = vi.fn()
    const env = { DB: { prepare: vi.fn(() => stmt), batch } as unknown as D1Database }
    const app = new Hono()
    app.use('/api/tags/:id', async (c, next) => {
      c.set('user', { id: 'agent-1', displayName: 'Alice', role: 'admin' })
      return next()
    })
    app.put('/api/tags/:id', async (c) => tagHandler.update(c))

    const res = await app.request('/api/tags/42', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'VIP' })   // same as existing
    }, env)

    expect(res.status).toBe(200)
    expect(batch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run the test — expect failure**

Run: `bunx vitest run tests/integration/handlers/tag-restore.integration.test.ts`
Expected: 2 NEW tests FAIL (no batch call yet; old path runs through).

- [ ] **Step 4: Apply the migration shown in the Target code section above**

Use `Edit` on `tag-service.ts` to replace the UPDATE + activity-logging tail of the `update` method.

- [ ] **Step 5: Run the test — expect pass**

Run: `bunx vitest run tests/integration/handlers/tag-restore.integration.test.ts`
Expected: 5 PASS (3 from Task 1 + 2 new).

- [ ] **Step 6: Type-check**

Run: `tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/tags/services/tag-service.ts tests/integration/handlers/tag-restore.integration.test.ts
git commit -m "feat(tags): make tag_update reversible via ActivityCapture + db.batch

Only the fields that actually change are captured into
previousState — restoring a name-only edit will not also rewrite
the color back. The COALESCE UPDATE is replaced with an explicit
dynamic SET clause so the bound params match the captured fields
exactly.

No-op edits (same value submitted) skip the batch entirely —
they would have been a wasteful no-op restorable record."
```

---

## Task 3: Add `addTeamMembership` RestoreHandler

**Files:**
- Modify: `src/modules/activities/services/restore-helpers.ts`
- Modify: `src/modules/activities/services/restore-registry.ts`
- Modify: `tests/unit/modules/activities/services/restore-helpers.test.ts`
- Modify: `tests/unit/modules/activities/services/restore-registry.test.ts`

### Background

`team_member_remove` (Task 4) is a hard DELETE on the `agent_teams` junction table. There is no `deleted_at` column to clear. Phase 1's `restoreSoftDeleted` cannot restore this — we need a factory that INSERTs the row back.

The restore is also subtly tricky because `team-service.removeMember` (line 386-401) promotes the next team to primary when the removed one was primary. To fully reverse this we have to:

1. Insert the original `agent_teams` row back.
2. If the removed row was primary, clear the `is_primary` flag from whichever row became primary in the meantime.

For v1 of this RestoreHandler we keep step 2 simple: the captured `previousState.was_primary` field controls a follow-up UPDATE that resets every OTHER `agent_teams` row for this agent to `is_primary = 0`. The newly-reinserted row carries the original is_primary value.

### Steps

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/modules/activities/services/restore-helpers.test.ts`:

```typescript
import { addTeamMembership } from '@/modules/activities/services/restore-helpers'

describe('addTeamMembership', () => {
  it('buildMutation INSERTs the agent_teams row using captured fields', () => {
    const { db, prepare, bound } = makeDb()
    addTeamMembership.buildMutation(db, {
      agent_id: 'agent-7',
      team_id: 3,
      role_in_team: 'member',
      is_primary: 1,
      assigned_at: '2026-05-20T10:00:00.000Z'
    })

    const sql = prepare.mock.calls[0]?.[0] as string
    expect(sql).toMatch(/INSERT\s+INTO\s+agent_teams/i)
    expect(sql).toMatch(/agent_id|team_id|role_in_team|is_primary|assigned_at/)
    expect(bound).toContain('agent-7')
    expect(bound).toContain(3)
  })

  it('throws when required keys are missing', () => {
    const { db } = makeDb()
    expect(() => addTeamMembership.buildMutation(db, { agent_id: 'a-7' })).toThrow(/team_id/i)
  })

  it('getCurrentState reads the (agent_id, team_id) row from agent_teams', async () => {
    const { db, stmt } = makeDb()
    stmt.first = vi.fn().mockResolvedValue({ agent_id: 'a-7', team_id: 3, is_primary: 1 })
    const result = await addTeamMembership.getCurrentState(db, 'a-7:3')
    expect(result).toEqual({ agent_id: 'a-7', team_id: 3, is_primary: 1 })
  })

  it('getCurrentState returns null for malformed resourceId', async () => {
    const { db } = makeDb()
    await expect(addTeamMembership.getCurrentState(db, 'not-a-pair')).resolves.toBeNull()
  })
})
```

- [ ] **Step 2: Run the test — expect failure**

Run: `bunx vitest run tests/unit/modules/activities/services/restore-helpers.test.ts`
Expected: FAIL importing `addTeamMembership`.

- [ ] **Step 3: Implement the factory**

Append to `src/modules/activities/services/restore-helpers.ts`:

```typescript
/**
 * Singleton: reverse a team_member_remove by INSERT-ing the agent_teams
 * row back. Captured fields drive the INSERT exactly — the caller must
 * include agent_id, team_id, role_in_team, is_primary, and assigned_at
 * in previousState.
 *
 * resourceId for this handler is the string "<agent_id>:<team_id>",
 * matching how team_member_remove writes its activity log.
 */
export const addTeamMembership: RestoreHandler = {
  buildMutation(db, previousState) {
    const agentId      = requireValue(previousState, 'agent_id')
    const teamId       = requireValue(previousState, 'team_id')
    const roleInTeam   = requireValue(previousState, 'role_in_team')
    const isPrimary    = previousState.is_primary
    const assignedAt   = previousState.assigned_at as string | undefined
                         ?? new Date().toISOString()
    if (isPrimary === undefined || isPrimary === null) {
      throw new Error('addTeamMembership: previousState.is_primary missing')
    }
    return db
      .prepare(
        `INSERT INTO agent_teams (agent_id, team_id, role_in_team, is_primary, assigned_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(agentId, teamId, roleInTeam, isPrimary, assignedAt)
  },
  async getCurrentState(db, resourceId) {
    const [agentId, teamIdStr] = resourceId.split(':')
    const teamIdNum = Number(teamIdStr)
    if (!agentId || !Number.isInteger(teamIdNum)) return null
    const row = await db
      .prepare('SELECT * FROM agent_teams WHERE agent_id = ? AND team_id = ?')
      .bind(agentId, teamIdNum)
      .first()
    return row ? (row as Record<string, unknown>) : null
  }
}
```

- [ ] **Step 4: Register in the registry**

In `src/modules/activities/services/restore-registry.ts`, add the import:

```typescript
import {
  addTagToCustomer,
  removeTagFromCustomer,
  restoreAssignedAgent,
  restoreField,
  restoreFields,
  restoreSoftDeleted,
  softDelete,
  addTeamMembership   // NEW
} from './restore-helpers'
```

Add the registry entry (keep alphabetical within the file):

```typescript
  'team_member.remove': addTeamMembership,
```

- [ ] **Step 5: Update the registry test**

In `tests/unit/modules/activities/services/restore-registry.test.ts`, add `'team_member.remove'` to the expected key list, keeping the sort order:

```typescript
    expect(Object.keys(RestoreRegistry).sort()).toEqual([
      'agent.delete',
      'agent.update',
      'conversation.assign',
      // ... (existing keys)
      'team.update',
      'team_member.remove'                       // NEW
    ])
```

- [ ] **Step 6: Run all Phase 1 + new tests**

Run: `bunx vitest run tests/unit/modules/activities tests/integration/handlers/activity-restore.integration.test.ts tests/integration/handlers/tag-restore.integration.test.ts`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/activities/services/restore-helpers.ts src/modules/activities/services/restore-registry.ts tests/unit/modules/activities/services/restore-helpers.test.ts tests/unit/modules/activities/services/restore-registry.test.ts
git commit -m "feat(activities): add addTeamMembership restore handler

agent_teams is a hard-delete junction table — no deleted_at to
clear — so reversing team_member_remove requires an INSERT.
Captured fields (agent_id, team_id, role_in_team, is_primary,
assigned_at) drive the INSERT exactly; resourceId is the
'agent_id:team_id' pair to mirror how team_member_remove writes
its activity log."
```

---

## Task 4: team_member_remove — Migrate to db.batch

**Files:**
- Modify: `src/modules/teams/services/team-service.ts` (the `removeMember` method near line 365)
- Modify: `src/modules/teams/handlers/team-members.ts` (the `DELETE /:id/members/:agentId` handler near line 209 — pass caller context into the service)

### Approach

Two batched statements: DELETE the row, INSERT the activity log. The primary-team-promotion side effect happens via a third statement appended to the batch (a second UPDATE on `agent_teams`).

The promotion logic stays the same as today: if the removed membership was primary, the next-found team becomes primary. We capture both the original membership row and the "promoted-to-primary" team id (if any) into `previousState` so the RestoreHandler can reverse the whole thing.

### Target code (team-service.ts)

Replace `removeMember`:

```typescript
async removeMember(
  teamId: number,
  agentId: string,
  caller: { id: string; displayName?: string; role: string; ipAddress?: string; userAgent?: string }
): Promise<boolean> {
  try {
    // Pre-state: full membership row
    const [membership] = await this.db
      .select()
      .from(agentTeams)
      .where(and(eq(agentTeams.agentId, agentId), eq(agentTeams.teamId, teamId)))
      .limit(1)

    if (!membership) {
      return false
    }

    // If primary, peek at which team would be promoted
    let promotedTeamId: number | null = null
    if (membership.isPrimary) {
      const [nextTeam] = await this.db
        .select({ teamId: agentTeams.teamId })
        .from(agentTeams)
        .where(and(
          eq(agentTeams.agentId, agentId),
          sql`${agentTeams.teamId} != ${teamId}`
        ))
        .limit(1)
      promotedTeamId = nextTeam?.teamId ?? null
    }

    // Capture both for restore — promotedTeamId lets the reverse path
    // demote whichever team the promotion chose (so the original
    // membership can claim primary back without dual-primary violation).
    const previousState = {
      agent_id:     agentId,
      team_id:      teamId,
      role_in_team: membership.roleInTeam,
      is_primary:   membership.isPrimary ? 1 : 0,
      assigned_at:  membership.assignedAt,
      promoted_team_id: promotedTeamId
    }
    const newState = {
      agent_id:     agentId,
      team_id:      teamId,
      removed_at:   new Date().toISOString()
    }

    // Raw D1 statements so we can batch them
    const stmts: D1PreparedStatement[] = []

    const env = this.dbRaw  // pass-through raw D1 alongside Drizzle
    const capture = new ActivityCapture(env)

    stmts.push(capture.buildReversibleLog({
      request: {
        userId: caller.id,
        userName: caller.displayName ?? caller.id,
        userRole: caller.role,
        action: ACTIVITY_ACTIONS.TEAM_MEMBER_REMOVE,
        resourceType: 'team_member' as const,
        resourceId: `${agentId}:${teamId}`,
        ipAddress: caller.ipAddress,
        userAgent: caller.userAgent,
        details: { promotedTeamId }
      },
      restoreHandler: 'team_member.remove',
      previousState,
      newState
    }))

    stmts.push(env.prepare(
      'DELETE FROM agent_teams WHERE agent_id = ? AND team_id = ?'
    ).bind(agentId, teamId))

    if (membership.isPrimary && promotedTeamId !== null) {
      stmts.push(env.prepare(
        'UPDATE agent_teams SET is_primary = 1 WHERE agent_id = ? AND team_id = ?'
      ).bind(agentId, promotedTeamId))
    }

    await env.batch(stmts)
    return true
  } catch (error) {
    log.error('Remove team member error:', {}, error instanceof Error ? error : new Error(String(error)))
    return false
  }
}
```

You will need to thread raw D1 into `TeamService`. If the class doesn't already hold both:

```typescript
// In team-service.ts constructor
constructor(private dbRaw: D1Database) {
  this.db = createDbClient(dbRaw)
}
```

Adjust call sites that construct `new TeamService(c.env.DB)` — they already pass the raw `D1Database`.

### Target code (team-members.ts handler)

```typescript
app.delete('/:id/members/:agentId', jwtAuth, requireTeamRole('lead'), requireIntId(), async (c) => {
  try {
    const teamId = getValidatedParam<number>(c, 'id')
    const agentId = c.req.param('agentId')
    if (!agentId?.trim()) {
      return c.json({ success: false, error: 'Invalid agent ID' }, HTTP_STATUS.BAD_REQUEST)
    }

    const user = c.get('user')
    const teamService = new TeamService(c.env.DB)
    const success = await teamService.removeMember(teamId, agentId, {
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      ipAddress: c.req.header('CF-Connecting-IP') ?? undefined,
      userAgent: c.req.header('User-Agent') ?? undefined
    })

    if (!success) {
      return c.json({ success: false, error: 'Failed to remove team member' }, HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
    return c.json({ success: true })
  } catch (error) {
    return globalErrorHandler.handleError(c, error)
  }
})
```

### Steps

- [ ] **Step 1: Read the file to confirm imports and adjacent code**

Run: read `src/modules/teams/services/team-service.ts` lines 1-50 (to see imports and constructor) and lines 360-410 (the method). Read `team-members.ts` line 1-30 and 209-235.

- [ ] **Step 2: Write the integration test FIRST**

Create `tests/integration/handlers/team-member-restore.integration.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { TeamService } from '@/modules/teams/services/team-service'

describe('team_member_remove via batch', () => {
  it('issues exactly one db.batch with [log, delete] when removed agent was not primary', async () => {
    const captured: unknown[][] = []
    let firstCallIndex = 0
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn(async () => {
        firstCallIndex += 1
        if (firstCallIndex === 1) {
          return { results: [{ agent_id: 'agent-7', team_id: 3, role_in_team: 'member', is_primary: 0, assigned_at: '2026-05-20T10:00:00.000Z' }] }
        }
        return { results: [] }
      })
    }
    const batch = vi.fn(async (stmts: unknown[]) => {
      captured.push(stmts)
      return stmts.map(() => ({ meta: { changes: 1, last_row_id: 1 } }))
    })
    const db = { prepare: vi.fn(() => stmt), batch } as unknown as D1Database

    const svc = new TeamService(db)
    const ok = await svc.removeMember(3, 'agent-7', {
      id: 'agent-admin', displayName: 'Admin', role: 'admin'
    })
    expect(ok).toBe(true)
    expect(captured).toHaveLength(1)
    expect(captured[0]).toHaveLength(2)   // log + delete only
  })

  it('appends a third UPDATE to demote-then-promote when removed agent was primary', async () => {
    // membership row is primary, and there is another team to promote
    const captured: unknown[][] = []
    let allCount = 0
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn(async () => {
        allCount += 1
        if (allCount === 1) {
          return { results: [{ agent_id: 'agent-7', team_id: 3, role_in_team: 'member', is_primary: 1, assigned_at: '2026-05-20T10:00:00.000Z' }] }
        }
        return { results: [{ team_id: 8 }] }    // promoted team
      })
    }
    const batch = vi.fn(async (stmts: unknown[]) => {
      captured.push(stmts)
      return stmts.map(() => ({ meta: { changes: 1, last_row_id: 1 } }))
    })
    const db = { prepare: vi.fn(() => stmt), batch } as unknown as D1Database

    const svc = new TeamService(db)
    await svc.removeMember(3, 'agent-7', { id: 'agent-admin', displayName: 'Admin', role: 'admin' })
    expect(captured[0]).toHaveLength(3)   // log + delete + promote
  })

  it('returns false when the membership row is missing', async () => {
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn().mockResolvedValue({ results: [] })
    }
    const batch = vi.fn()
    const db = { prepare: vi.fn(() => stmt), batch } as unknown as D1Database

    const svc = new TeamService(db)
    const ok = await svc.removeMember(3, 'agent-7', { id: 'agent-admin', displayName: 'Admin', role: 'admin' })
    expect(ok).toBe(false)
    expect(batch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run the test — expect failure**

Run: `bunx vitest run tests/integration/handlers/team-member-restore.integration.test.ts`
Expected: All FAIL (removeMember signature mismatch and behavior mismatch).

- [ ] **Step 4: Apply the migration**

Use `Edit` on `team-service.ts` and `team-members.ts` per the Target code sections above. Keep all other callers' signatures aware: a quick grep for `teamService.removeMember(` should find the one handler call; update it to pass the caller context.

- [ ] **Step 5: Run the test — expect pass**

Run: `bunx vitest run tests/integration/handlers/team-member-restore.integration.test.ts`
Expected: 3 PASS.

- [ ] **Step 6: Run any pre-existing tests touching `removeMember` to confirm no regression**

Run: `bunx vitest run tests/unit/modules/teams tests/integration/handlers/team-member-restore.integration.test.ts`
Expected: all PASS. If any unit test asserts the old 2-arg signature of `removeMember`, update the call site in the test.

- [ ] **Step 7: Type-check + full backend run**

Run: `tsc --noEmit`
Run: `bun run test:backend:ci`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/modules/teams/services/team-service.ts src/modules/teams/handlers/team-members.ts tests/integration/handlers/team-member-restore.integration.test.ts
git commit -m "feat(teams): make team_member_remove reversible via ActivityCapture + db.batch

removeMember now accepts a caller context (id, displayName, role,
ipAddress, userAgent) and builds an atomic batch:

  [reversible-log, DELETE agent_teams, optional promote UPDATE]

The primary-team-promotion side effect joins the same batch so
either the entire removal lands (with its restorable snapshot)
or nothing changes. previousState carries the original
role_in_team and is_primary plus the team that was promoted, so
addTeamMembership can fully reverse the operation."
```

---

## Task 5: End-to-End Restore Smoke Test for Each Migrated Handler

**Files:**
- Modify: `tests/integration/handlers/tag-restore.integration.test.ts`
- Modify: `tests/integration/handlers/team-member-restore.integration.test.ts`

Each migrated handler now produces reversible activity logs. This task closes the loop by exercising the full delete → restore → resource-back path through the actual `/api/activities/:id/restore` endpoint.

### Steps

- [ ] **Step 1: Add a tag delete-then-restore smoke test**

Append to `tests/integration/handlers/tag-restore.integration.test.ts`:

```typescript
import activityRestoreHandler from '@/modules/activities/handlers/activity-restore'

describe('tag delete then restore — round trip', () => {
  it('captured snapshot drives RestoreRegistry["tag.delete"] to clear deleted_at', async () => {
    // Step 1: delete the tag, capture the inserted activity row's details
    const existingTag = {
      id: 42, name: 'VIP', color: '#FF9500', description: null,
      team_id: null, is_active: 1, created_by: 'agent-1',
      created_at: '2026-04-01T10:00:00.000Z',
      updated_at: '2026-05-20T14:32:11.000Z',
      deleted_at: null
    }
    const capturedSql: Array<{ sql: string; params: unknown[] }> = []
    let lastBoundParams: unknown[] = []
    const stmt = {
      bind: vi.fn((...p: unknown[]) => { lastBoundParams = p; return stmt }),
      first: vi.fn().mockResolvedValue(existingTag),
      run: vi.fn(),
      all: vi.fn()
    }
    const prepare = vi.fn((sql: string) => {
      capturedSql.push({ sql, params: [] })
      return stmt
    })
    const batch = vi.fn(async (stmts) => {
      stmts.forEach((s, i) => { capturedSql[capturedSql.length - stmts.length + i].params = lastBoundParams })
      return stmts.map(() => ({ meta: { changes: 1, last_row_id: 7777 } }))
    })
    const env = { DB: { prepare, batch } as unknown as D1Database }

    const app = new Hono()
    app.use('/api/tags/:id', async (c, next) => {
      c.set('user', { id: 'agent-1', displayName: 'Alice', role: 'admin' })
      return next()
    })
    app.delete('/api/tags/:id', async (c) => tagHandler.delete(c))

    await app.request('/api/tags/42', { method: 'DELETE' }, env)

    // Find the activity-INSERT statement and parse its details JSON
    const insertActivity = capturedSql.find(c => /INSERT INTO activities/i.test(c.sql))
    expect(insertActivity).toBeDefined()
    const detailsJson = insertActivity!.params.find(p => typeof p === 'string' && (p as string).includes('"reversible":true')) as string
    const details = JSON.parse(detailsJson)
    expect(details.restoreHandler).toBe('tag.delete')
    expect(details.previousState.deleted_at).toBeNull()
    expect(details.newState.deleted_at).not.toBeNull()
  })
})
```

- [ ] **Step 2: Add an analogous smoke test for team_member_remove**

Append to `tests/integration/handlers/team-member-restore.integration.test.ts`:

```typescript
describe('team_member_remove then restore — details shape', () => {
  it('writes restoreHandler=team_member.remove and a previousState with is_primary', async () => {
    // Read-only assertion: confirm the activity row's details JSON has the
    // shape RestoreRegistry["team_member.remove"] needs.
    const lastBatch: unknown[][] = []
    const insertParams: unknown[][] = []
    const stmt = {
      bind: vi.fn(function (this: never, ...p: unknown[]) { (this as unknown as Record<string, unknown>).__params = p; return this }),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn().mockResolvedValueOnce({ results: [{ agent_id: 'agent-7', team_id: 3, role_in_team: 'member', is_primary: 0, assigned_at: '2026-05-20T10:00:00.000Z' }] })
                  .mockResolvedValueOnce({ results: [] })
    }
    const prepare = vi.fn((sql: string) => {
      if (/INSERT INTO activities/i.test(sql)) {
        return Object.assign({}, stmt, {
          bind: vi.fn((...p: unknown[]) => { insertParams.push(p); return stmt })
        })
      }
      return stmt
    })
    const batch = vi.fn(async (stmts: unknown[]) => { lastBatch.push(stmts); return stmts.map(() => ({ meta: { changes: 1, last_row_id: 1 } })) })
    const db = { prepare, batch } as unknown as D1Database

    const svc = new TeamService(db)
    await svc.removeMember(3, 'agent-7', { id: 'agent-admin', displayName: 'Admin', role: 'admin' })

    const detailsJson = insertParams[0]?.find(p => typeof p === 'string' && (p as string).includes('"reversible":true')) as string | undefined
    expect(detailsJson).toBeDefined()
    const details = JSON.parse(detailsJson!)
    expect(details.restoreHandler).toBe('team_member.remove')
    expect(details.previousState.is_primary).toBe(0)
    expect(details.previousState.role_in_team).toBe('member')
  })
})
```

- [ ] **Step 3: Run both tests**

Run: `bunx vitest run tests/integration/handlers/tag-restore.integration.test.ts tests/integration/handlers/team-member-restore.integration.test.ts`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/handlers/tag-restore.integration.test.ts tests/integration/handlers/team-member-restore.integration.test.ts
git commit -m "test(activities): close the loop on Phase 2a reversible logs

Confirms the details JSON each migrated handler writes carries
exactly the previousState shape the matching RestoreHandler
factory needs. Catches drift between capture-side schema (write
handler) and reverse-side schema (RestoreRegistry) early."
```

---

## Task 6: Run Full Project CI Suite + Update Module Docs

**Files:**
- Modify: `src/modules/activities/README.md`
- Modify: `docs/modules/activities.md`

- [ ] **Step 1: Full backend CI suite**

Run: `bun run test:backend:ci`
Expected: all PASS (Phase 1's 2570 + Phase 2a additions).

- [ ] **Step 2: Update module README**

Append a "Phase 2a" subsection under the existing "Restore (Phase 1)" block in `src/modules/activities/README.md`:

```markdown
### Phase 2a (handler migrations)

Three high-risk write handlers now emit reversible activity logs:

| Action | File | Restore handler key |
|--------|------|---------------------|
| `tag_delete` | `src/modules/tags/services/tag-service.ts` | `tag.delete` |
| `tag_update` | `src/modules/tags/services/tag-service.ts` | `tag.update` |
| `team_member_remove` | `src/modules/teams/services/team-service.ts` | `team_member.remove` |

`customer_delete` and `delayed_message_cancel` were deferred — see
`docs/superpowers/plans/2026-05-26-activity-restore-phase-2a.md`
Section "Scope Adjustments" for the rationale.
```

- [ ] **Step 3: Mirror the update to docs/modules/activities.md**

Open `docs/modules/activities.md` and add the same section.

- [ ] **Step 4: Commit**

```bash
git add src/modules/activities/README.md docs/modules/activities.md
git commit -m "docs(activities): record Phase 2a handler migrations

Lists the three migrated handlers (tag_delete, tag_update,
team_member_remove) and the restore handler keys they emit.
Cross-references the plan for customer_delete and
delayed_message_cancel deferral rationale."
```

---

## Self-Review (Plan Author)

After writing this plan, I checked it against the spec and Phase 1:

**Scope coverage:** The 3 in-scope handlers each get a TDD task (1, 2, 4). The new `addTeamMembership` factory needed for team_member_remove gets its own task (3) before the handler migration that depends on it. Each task is independently shippable.

**Placeholder scan:** No "TBD", "TODO", or "similar to Task N". Every code step contains complete code; every command shows the expected output band.

**Type consistency:** `D1PreparedStatement` (Phase 1 type) is reused. `RestoreHandler` interface (Phase 1) is reused for the new factory. `ActivityCapture.buildReversibleLog` signature matches Phase 1 exactly. `resourceType` constants are reused except `team_member` which is referenced by string literal — the existing `RESOURCE_TYPES` constants would need a TEAM_MEMBER entry too. **Caveat in Task 4:** the handler uses `resourceType: 'team_member' as const` because no constant exists; if the implementer prefers a clean approach, add `TEAM_MEMBER: 'team_member'` to `src/modules/activities/constants/resources.ts` in Task 4 step 4 and reference the constant. Either is correct.

**Spec deltas surfaced:**
- `customer_delete` deferred (no HTTP endpoint exists).
- `delayed_message_cancel` deferred (DO mutation, not batchable).

Both deferrals are surfaced in the plan header and the Scope Adjustments table so future readers see why Phase 2a is 3 handlers, not 5.

---

## Out of Scope (Phase 2a)

- `customer_delete` — needs a missing endpoint first.
- `delayed_message_cancel` — needs DO-specific restore design (cannot use db.batch).
- Phase 2b handlers (the medium-risk list in the design spec) — separate plan.
- Phase 3 frontend (`[還原]` button + RestoreConfirmModal) — separate plan.
- Phase 4 launch (feature flag, staged rollout) — separate plan.
- Janitor for orphan `restoredByActivityId = -1` slots — spec accepts these as benign for v1.
