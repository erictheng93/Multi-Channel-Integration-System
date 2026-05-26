# Activity Restore — Phase 2b (Medium-Risk Handler Migration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Phase 2a migration pattern to the remaining write handlers covered by the design spec so the `[還原]` button works across the full CRUD surface — not just the high-risk operations.

**Architecture:** Identical to Phase 2a — `read pre-state -> build [ActivityCapture.buildReversibleLog, mutation stmt(s)] -> c.env.DB.batch([...])`. Per-handler details vary in the captured snapshot shape and the existing `RestoreRegistry` key.

**Tech Stack:** Hono + raw D1 batch on Cloudflare Workers, Vitest, TypeScript strict mode.

**Spec:** `docs/superpowers/specs/2026-05-26-activity-restore-design.md`

**Prior plans:**
- `docs/superpowers/plans/2026-05-26-activity-restore-phase-1.md` (infrastructure — merged)
- `docs/superpowers/plans/2026-05-26-activity-restore-phase-2a.md` (high-risk migration — merged)

> **Note on plan format.** Each task in this plan provides the full final code, the captured snapshot shape, and the critical test assertions — but does NOT rewrite the generic TDD step structure (red → green → commit) since Phase 2a's plan already documents it in detail and the pattern is now established. Engineers should follow the same red-green-commit cadence per task.

> **Note on Drizzle vs raw D1.** Several Phase 2b targets currently use Drizzle (`drizzleDb.run(sql\`...\`)`). The migration translates them into `c.env.DB.prepare(...).bind(...)` raw D1 statements so they can participate in a `db.batch([...])` together with the activity log INSERT.

> **Note on atomic commits.** One commit per task. Tag, conversation, team, agent CRUD migrations stay separate. Never bundle two handlers in one commit.

---

## Scope Adjustments from the Original Spec

Two targets advertised in Section 1's Phase 2b table do not exist as HTTP endpoints. Audit run 2026-05-26:

| Target | Status | Reason |
|--------|--------|--------|
| `customer_create` | **Deferred** | No POST endpoint in `src/modules/customer/handlers/`. Webhook layer auto-creates customers via `webhook-customer-service.ts`; no admin HTTP path. |
| `customer_update` | **Deferred** | No PUT/PATCH endpoint either. `customer-crud.ts:update()` exists in the service layer with no route binding. |
| `tag_create` | **In** | `tag-service.ts:create` |
| `tag_assign` | **In** | `customer-tags.ts:addTagsToCustomer` |
| `tag_unassign` | **In** | `customer-tags.ts:removeTagsFromCustomer` |
| `conversation_assign` | **In** | `conversation-assignment.ts:POST /:id/assign` |
| `conversation_unassign` | **In** | `conversation-assignment.ts:POST /:id/unassign` |
| `conversation_close` | **In** | `conversation-bulk.ts:POST /:id/close` |
| `conversation_reopen` | **In** | `conversation-bulk.ts:POST /:id/reopen` |
| `conversation_delete` | **In** | `conversation-bulk.ts:DELETE /:id` |
| `team_create` | **In** | `team-crud.ts:POST /` |
| `team_update` | **In** | `team-crud.ts:PUT /:id` |
| `team_delete` | **In** | `team-crud.ts:DELETE /:id` |
| `user_create` | **In** | `auth-main.ts` |
| `user_update` | **In** | `auth-main.ts` |
| `user_delete` | **In** | `auth-main.ts` |

`customer_create` and `customer_update` join `customer_delete` and `delayed_message_cancel` as deferred items pending separate design work (see the design notes plan at `docs/superpowers/plans/2026-05-26-activity-restore-deferred-design.md` once it lands).

Net Phase 2b scope: **14 handler migrations** grouped into 4 waves.

---

## Pattern Overview (one place, applies to every task)

```typescript
// 1. Read pre-state (only the columns the mutation will touch)
const existing = await c.env.DB
  .prepare('SELECT <columns> FROM <table> WHERE id = ?')
  .bind(id)
  .first<RowType>()
if (!existing) return notFoundResponse(c, '<resource>')

// 2. Build the mutation statement (do not run)
const mutationStmt = c.env.DB
  .prepare('UPDATE <table> SET <cols> = ? WHERE id = ?')
  .bind(...newValues, id)

// 3. Build the reversible log statement
const meta = extractCallerMeta(c)
const capture = new ActivityCapture(c.env.DB)
const logStmt = capture.buildReversibleLog({
  request: { ...meta, action: ACTIVITY_ACTIONS.<NAME>, resourceType: RESOURCE_TYPES.<TYPE>, resourceId: String(id), details: { /* enrichment */ } },
  restoreHandler: '<dot-key>',
  previousState: { id, ...captured },
  newState:      { id, ...newValues }
})

// 4. Atomic batch
await c.env.DB.batch([logStmt, mutationStmt])
```

For complex operations (multiple mutation statements, side effects), append additional `D1PreparedStatement` to the batch array. Both `restoreFields('<table>')` (already registered) and `restoreSoftDeleted('<table>')` handle the reverse direction provided the captured snapshot includes the right columns.

`extractCallerMeta(c)` is a tiny per-file helper — see the canonical implementation in `tag-service.ts:142-155` (lines may shift; search for `extractActivityMeta`). Most Phase 2b files already have an equivalent or can reuse the structured-logging context. Each task below names the helper it expects.

### `RestoreRegistry` keys already wired (no Phase 1 changes needed)

| Handler key | Factory | Reverse semantics |
|-------------|---------|-------------------|
| `customer.tag-assign` | `removeTagFromCustomer` | DELETE customer_tags row |
| `customer.tag-unassign` | `addTagToCustomer` | INSERT customer_tags row |
| `conversation.assign` | `restoreAssignedAgent` | UPDATE conversations.assigned_team_id |
| `conversation.unassign` | `restoreAssignedAgent` | Same — null vs id captured in previousState |
| `conversation.status` | `restoreField('conversations', 'status')` | UPDATE conversations.status |
| `conversation.delete` | `restoreSoftDeleted('conversations')` | UPDATE conversations.deleted_at = NULL |
| `tag.create` | `softDelete('tags')` | UPDATE tags.deleted_at = NOW (reverse of create) |
| `team.create` | `softDelete('teams')` | Same pattern |
| `team.update` | `restoreFields('teams')` | UPDATE every captured column |
| `team.delete` | `restoreSoftDeleted('teams')` | Clear deleted_at |
| `agent.update` | `restoreFields('agents')` | UPDATE every captured column |
| `agent.delete` | `restoreSoftDeleted('agents')` | Clear deleted_at |
| `agent.create` | `softDelete('agents')` | UPDATE agents.deleted_at = NOW |

`conversation.close` and `conversation.reopen` both map to `conversation.status` (the captured status changes from `assigned` to `closed` or vice versa). No new registry entries needed.

---

## Wave A — Conversation Lifecycle (5 handlers)

These migrations share the same conversations table and the same caller-context extraction. The variation is which column(s) the mutation touches.

### Task 1: `conversation_assign`

**Files:**
- Modify: `src/modules/conversations/handlers/conversation-assignment.ts` — the `POST /:id/assign` handler near line 29.

**Migration sketch:**

Replace the existing mutation + fire-and-forget log path with:

```typescript
// Pre-state for restore
const existing = await c.env.DB
  .prepare('SELECT id, assigned_team_id, status, updated_at FROM conversations WHERE id = ?')
  .bind(conversationId)
  .first<{ id: string; assigned_team_id: number | null; status: string; updated_at: string }>()
if (!existing) return c.json({ error: 'Conversation not found' }, HTTP_STATUS.NOT_FOUND)

const timestamp = nowISO()
const mutationStmt = c.env.DB
  .prepare(`UPDATE conversations
              SET assigned_team_id = ?, status = ?, updated_at = ?
            WHERE id = ?`)
  .bind(teamId, 'assigned', timestamp, conversationId)

const capture = new ActivityCapture(c.env.DB)
const logStmt = capture.buildReversibleLog({
  request: {
    userId: String(user.id),
    userName: user.displayName || user.email,
    userRole: user.role,
    action: ACTIVITY_ACTIONS.CONVERSATION_ASSIGN,
    resourceType: RESOURCE_TYPES.CONVERSATION,
    resourceId: conversationId,
    ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
    userAgent: c.req.header('User-Agent'),
    details: { teamName: assignedTeamName || String(teamId), teamId, reason }
  },
  restoreHandler: 'conversation.assign',
  previousState: {
    id: conversationId,
    assigned_team_id: existing.assigned_team_id,
    status: existing.status,
    updated_at: existing.updated_at
  },
  newState: {
    id: conversationId,
    assigned_team_id: teamId,
    status: 'assigned',
    updated_at: timestamp
  }
})

// conversation_transfers INSERT (when reason present) stays Drizzle but moves
// into the same batch — translate to raw D1 statement:
const stmts: D1PreparedStatement[] = [logStmt, mutationStmt]
if (reason) {
  stmts.push(c.env.DB
    .prepare(`INSERT INTO conversation_transfers
                (conversation_id, to_team_id, transfer_reason, transferred_by, created_at)
              VALUES (?, ?, ?, ?, ?)`)
    .bind(conversationId, teamId, reason, String(user.id), timestamp))
}

await c.env.DB.batch(stmts)
```

**Registry key used:** `conversation.assign` (already wired to `restoreAssignedAgent`).

**Critical test assertions** (integration test new file `tests/integration/handlers/conversation-restore.integration.test.ts`):

```typescript
it('captures the prior assigned_team_id for restore', async () => {
  // current: assigned_team_id = 3
  // assign to team 7
  // assert details.previousState.assigned_team_id === 3
})

it('batches log + conversation UPDATE in one transaction', async () => {
  // assert db.batch called once with at least 2 statements
})

it('emits conversation.assign restoreHandler key', async () => {
  // assert details.restoreHandler === 'conversation.assign'
})
```

### Task 2: `conversation_unassign`

**Files:**
- Modify: `src/modules/conversations/handlers/conversation-assignment.ts` — the `POST /:id/unassign` handler.

**Migration sketch:** Identical structure to Task 1; the mutation sets `assigned_team_id = NULL, status = 'unassigned'`. Capture the SAME columns. Registry key: `conversation.unassign` (same `restoreAssignedAgent` handler).

**Critical assertions:**
- `previousState.assigned_team_id` is the team id that was assigned before
- `newState.assigned_team_id` is `null`

### Task 3: `conversation_close`

**Files:**
- Modify: `src/modules/conversations/handlers/conversation-bulk.ts` — find the close handler (search for `CONVERSATION_CLOSE`).

**Migration sketch:**

```typescript
const existing = await c.env.DB
  .prepare('SELECT id, status, closed_at, updated_at FROM conversations WHERE id = ?')
  .bind(conversationId).first()
if (!existing) return notFoundResponse(c, 'Conversation')

const timestamp = nowISO()
const mutationStmt = c.env.DB
  .prepare(`UPDATE conversations
              SET status = 'closed', closed_at = ?, updated_at = ?
            WHERE id = ?`)
  .bind(timestamp, timestamp, conversationId)

// log + batch as in Task 1
// restoreHandler: 'conversation.status'
// previousState: { id, status: existing.status, closed_at: existing.closed_at, updated_at: existing.updated_at }
// newState:      { id, status: 'closed', closed_at: timestamp, updated_at: timestamp }
```

Note: the existing registry maps `conversation.status` to `restoreField('conversations', 'status')` — it only restores the status column. For close/reopen we want to ALSO restore `closed_at`. Two options:

a) **Use `conversation.update` instead** (registered as `restoreFields('conversations')` — restores every captured column). Recommended.
b) Extend the registry with a new entry `conversation.close` → `restoreFields('conversations')` and register it.

Option (a) is the simplest path — the captured snapshot includes status + closed_at + updated_at, and `restoreFields` writes them all back. **Use `restoreHandler: 'conversation.update'` for both close and reopen.**

### Task 4: `conversation_reopen`

**Files:** `conversation-bulk.ts` (or wherever reopen lives).

**Migration sketch:** Mirror of Task 3. Mutation sets `status = 'assigned', closed_at = NULL, updated_at = ?`. Capture the same three columns. Registry key: `conversation.update`.

### Task 5: `conversation_delete`

**Files:** `conversation-bulk.ts` (the `DELETE /:id` handler).

**Migration sketch:**

```typescript
const existing = await c.env.DB
  .prepare('SELECT id, status, deleted_at, updated_at FROM conversations WHERE id = ?')
  .bind(conversationId).first()
if (!existing || existing.deleted_at !== null) return notFoundResponse(c, 'Conversation')

const timestamp = nowISO()
const mutationStmt = c.env.DB
  .prepare(`UPDATE conversations
              SET deleted_at = ?, updated_at = ?
            WHERE id = ?`)
  .bind(timestamp, timestamp, conversationId)

// restoreHandler: 'conversation.delete'  (restoreSoftDeleted('conversations'))
// previousState: { id, deleted_at: null, updated_at: existing.updated_at }
// newState:      { id, deleted_at: timestamp, updated_at: timestamp }
```

Note: `restoreSoftDeleted` only clears `deleted_at`. For conversations the existing schema doesn't have an `is_active` flag like tags do, so single-column restore is sufficient. If a downstream consumer wants `updated_at` restored too, switch to `conversation.update` and `restoreFields`.

---

## Wave B — Tag Relationships (3 handlers)

### Task 6: `tag_create`

**Files:**
- Modify: `src/modules/tags/services/tag-service.ts` — the `create` method (search for `async create`).

**Migration sketch:**

```typescript
async create(c: Context<{ Bindings: Bindings }>) {
  try {
    const { name, color, description, teamId, createdBy } = await c.req.json()
    if (!name) return badRequestResponse(c, 'name required')
    // ... existing validation (duplicate name, color format, etc.) stays unchanged

    const now = nowISO()
    const insertStmt = c.env.DB
      .prepare(`INSERT INTO tags (name, color, description, team_id, is_active, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, ?, ?)
                RETURNING id`)
      .bind(name, normalizedColor, description ?? null, teamId ?? null, createdBy, now, now)

    // For create, we need the new id BEFORE we can capture it. Because INSERT returns
    // the id via RETURNING, and D1 batch lets each statement reference its previous
    // result indirectly, the simplest approach is:
    //
    //   1. Run the INSERT alone to capture the id
    //   2. Build the log with previousState = { id, deleted_at: null } (so restore
    //      can later set deleted_at = NOW) and newState = full new row
    //   3. INSERT the log row alone
    //
    // This is NOT atomic the same way UPDATE+log is — but it's still safer than the
    // current fire-and-forget because the log write is awaited and its failure causes
    // the response to return 500 (caller knows the tag exists but is unrecoverable).
    //
    // A future hardening would wrap both in a transaction (D1 transactions API
    // is coming) or accept this small atomicity gap as the cost of needing the
    // newly-generated id.

    const inserted = await insertStmt.first<{ id: number }>()
    if (!inserted) return errorResponse(c, 'Failed to insert tag', 500)
    const newTagId = inserted.id

    const meta = extractActivityMeta(c)
    const capture = new ActivityCapture(c.env.DB)
    await capture.logOnly(capture.buildReversibleLog({
      request: {
        userId: meta.userId, userName: meta.userName, userRole: meta.userRole,
        action: ACTIVITY_ACTIONS.TAG_CREATE,
        resourceType: RESOURCE_TYPES.TAG,
        resourceId: String(newTagId),
        ipAddress: meta.ipAddress ?? undefined,
        userAgent: meta.userAgent ?? undefined,
        details: { tagName: name }
      },
      restoreHandler: 'tag.create',
      previousState: { id: newTagId, deleted_at: null },
      newState:      { id: newTagId, deleted_at: null }   // create doesn't change deleted_at; reverse sets it
    }))

    return successResponse(c, { id: newTagId, name, color: normalizedColor, ... }, 'Tag created')
  } catch (error) {
    return handleApiError(error, c)
  }
}
```

**Atomicity caveat for CREATE operations:** Because we need the new row's id BEFORE we can log it, the INSERT runs first and the log INSERT runs second. If the log INSERT fails after the tag was created, the tag exists but is irrecoverable. This is the same boundary as Phase 1's `logOnly` path — accepted for v1.

**Registry key:** `tag.create` (`softDelete('tags')` — reverse-restore marks the new tag as deleted).

### Task 7: `tag_assign`

**Files:**
- Modify: `src/modules/customer/handlers/customer-tags.ts` — `addTagsToCustomer` (or per-tag variant). This handler can assign multiple tag ids in one request — each assignment becomes one separate activity log entry.

**Migration sketch (per-tag iteration inside a single batch):**

```typescript
const newAssignments: D1PreparedStatement[] = []
const logStatements: D1PreparedStatement[] = []
const capture = new ActivityCapture(c.env.DB)
const meta = extractCallerMeta(c)

for (const tagId of tagIds) {
  // Check if already assigned — skip duplicates
  const existing = await c.env.DB
    .prepare('SELECT 1 FROM customer_tags WHERE customer_id = ? AND tag_id = ?')
    .bind(customerId, tagId).first()
  if (existing) continue

  newAssignments.push(c.env.DB
    .prepare(`INSERT INTO customer_tags (customer_id, tag_id, assigned_by, assigned_at)
              VALUES (?, ?, ?, ?)`)
    .bind(customerId, tagId, meta.userId, nowISO()))

  logStatements.push(capture.buildReversibleLog({
    request: {
      userId: meta.userId, userName: meta.userName, userRole: meta.userRole,
      action: ACTIVITY_ACTIONS.TAG_ASSIGN,
      resourceType: RESOURCE_TYPES.CUSTOMER,
      resourceId: `${customerId}:${tagId}`,         // matches handler.getCurrentState shape
      ipAddress: meta.ipAddress, userAgent: meta.userAgent,
      details: { customerId, tagId }
    },
    restoreHandler: 'customer.tag-assign',
    previousState: { customerId, tagId },               // these drive removeTagFromCustomer.buildMutation
    newState:      { customerId, tagId, assigned_by: meta.userId }
  }))
}

if (newAssignments.length > 0) {
  await c.env.DB.batch([...logStatements, ...newAssignments])
}
```

**Registry key:** `customer.tag-assign` (already wired to `removeTagFromCustomer`).

**Critical test:** assigning 3 tags emits 3 log INSERTs + 3 customer_tags INSERTs in one batch (6 statements).

### Task 8: `tag_unassign`

**Files:** `customer-tags.ts:removeTagsFromCustomer`.

**Migration sketch:** Same per-tag iteration as Task 7. Each removal captures `{ customerId, tagId, assignedBy }` (read from existing row first), DELETE statement, and a log per removal. Registry key: `customer.tag-unassign` (uses `addTagToCustomer` which needs `assignedBy` in previousState).

```typescript
// Per tag id in the request body
const row = await c.env.DB
  .prepare('SELECT assigned_by FROM customer_tags WHERE customer_id = ? AND tag_id = ?')
  .bind(customerId, tagId).first<{ assigned_by: string }>()
if (!row) continue   // already unassigned

logStatements.push(capture.buildReversibleLog({
  request: { ...meta, action: ACTIVITY_ACTIONS.TAG_UNASSIGN, resourceType: RESOURCE_TYPES.CUSTOMER, resourceId: `${customerId}:${tagId}`, details: { customerId, tagId } },
  restoreHandler: 'customer.tag-unassign',
  previousState: { customerId, tagId, assignedBy: row.assigned_by },
  newState:      { customerId, tagId, removed_at: nowISO() }
}))
deletes.push(c.env.DB
  .prepare('DELETE FROM customer_tags WHERE customer_id = ? AND tag_id = ?')
  .bind(customerId, tagId))
```

---

## Wave C — Team CRUD (3 handlers)

### Task 9: `team_create`

**Files:** `src/modules/teams/handlers/team-crud.ts` — POST `/`.

**Migration sketch:** Same "INSERT first, log second" pattern as `tag_create`. Capture `previousState: { id: newTeamId, deleted_at: null }` and emit `restoreHandler: 'team.create'`.

Registry key: `team.create` (`softDelete('teams')`).

### Task 10: `team_update`

**Files:** `team-crud.ts` — PUT `/:id`.

**Migration sketch:** Same dynamic-SET pattern as Phase 2a's `tag_update` (Task 3 of Phase 2a). Capture only the columns that actually change. Registry key: `team.update` (`restoreFields('teams')`).

```typescript
const captured: Record<string, unknown> = {}
const newValues: Record<string, unknown> = {}
if (name !== undefined && name !== existing.name) {
  captured.name = existing.name; newValues.name = name
}
if (description !== undefined && description !== existing.description) {
  captured.description = existing.description; newValues.description = description
}
// ... repeat for is_active, qr_code, etc.

if (Object.keys(captured).length === 0) return successResponse(c, existing, 'Team unchanged')

const now = nowISO()
captured.updated_at = existing.updated_at
newValues.updated_at = now

const setClause = Object.keys(newValues).map(k => `${k} = ?`).join(', ')
const mutationStmt = c.env.DB
  .prepare(`UPDATE teams SET ${setClause} WHERE id = ?`)
  .bind(...Object.values(newValues), teamId)
// build log with previousState/newState as above
await c.env.DB.batch([logStmt, mutationStmt])
```

### Task 11: `team_delete`

**Files:** `team-crud.ts` — DELETE `/:id`.

**Migration sketch:** Soft-delete pattern. Capture `{ id, deleted_at: null, updated_at: existing.updated_at }`, mutation sets `deleted_at = NOW, updated_at = NOW`. Registry key: `team.delete` (`restoreSoftDeleted('teams')` — clears deleted_at; if updated_at restoration also matters, switch to `restoreFields` and capture both).

---

## Wave D — User / Agent CRUD (3 handlers)

### Task 12: `user_create`

**Files:** `src/modules/auth/handlers/auth-main.ts` — around line 316 (search for `ACTIVITY_ACTIONS.USER_CREATE`).

**Migration sketch:** Same "INSERT first, log second" as `tag_create` and `team_create`. Capture only what's needed to undo: `{ id: newAgentId, deleted_at: null }`. Registry key: `agent.create` (`softDelete('agents')`).

**Caveat:** Agent creation often goes through PBKDF2 password hashing which can be slow. Keep the hash computation BEFORE the INSERT (as today) so the INSERT statement is cheap.

### Task 13: `user_update`

**Files:** `auth-main.ts` — around line 527.

**Migration sketch:** Dynamic-SET pattern as `team_update`. Capture only the fields that change. Registry key: `agent.update` (`restoreFields('agents')`).

**Sensitive field exclusion:** Do NOT include `password_hash`, `password_salt`, or `password_iterations` in the captured snapshot. These should be excluded explicitly via a deny-list before building previousState. Restoring an old password hash would resurrect compromised credentials.

```typescript
const SENSITIVE_FIELDS = new Set(['password_hash', 'password_salt', 'password_iterations'])
const captured: Record<string, unknown> = {}
const newValues: Record<string, unknown> = {}
for (const [key, value] of Object.entries(updateBody)) {
  if (SENSITIVE_FIELDS.has(key)) continue   // never snapshot
  if (existing[key] !== value) {
    captured[key] = existing[key]
    newValues[key] = value
  }
}
```

### Task 14: `user_delete`

**Files:** `auth-main.ts` — search for `ACTIVITY_ACTIONS.USER_DELETE` (or `USER_BULK_DELETE` if single-delete shares code).

**Migration sketch:** Soft-delete. Capture `{ id, deleted_at: null, updated_at: existing.updated_at }`. Registry key: `agent.delete` (`restoreSoftDeleted('agents')`).

---

## Per-Wave Commit Strategy

Each task in a wave gets its own commit. Wave order matters because some waves share files:

```
Wave A (5 commits)  ← conversations
Wave B (3 commits)  ← tags + customer_tags
Wave C (3 commits)  ← teams
Wave D (3 commits)  ← auth/agents
```

For `tag_create` (Wave B), it shares `tag-service.ts` with Phase 2a's already-migrated `tag_delete` and `tag_update`. The migration is additive — no risk of stomping the earlier work.

For `conversation_close` and `conversation_reopen` (Wave A Tasks 3 and 4), they share `conversation-bulk.ts`. Each gets its own commit; the second commit's pre-state should reflect the first commit's changes.

---

## Testing Approach

Each task adds OR extends an integration test file matching the spec naming:

| Wave | Test file |
|------|-----------|
| A | `tests/integration/handlers/conversation-restore.integration.test.ts` (new) |
| B | `tests/integration/handlers/tag-restore.integration.test.ts` (extend) + `tests/integration/handlers/customer-tags-restore.integration.test.ts` (new) |
| C | `tests/integration/handlers/team-restore.integration.test.ts` (new) |
| D | `tests/integration/handlers/agent-restore.integration.test.ts` (new) |

Per task, the minimum test set is:
1. `db.batch` called once with the expected statement count
2. `details.restoreHandler` matches the planned key
3. `details.previousState` carries the captured columns and values

Add edge-case tests where the handler has them (e.g., conversation_close should not double-close — assert 404 / 400 if already closed).

---

## Out of Scope (Phase 2b)

- `customer_create`, `customer_update`, `customer_delete` — need HTTP endpoints first; tracked in the deferred-design plan
- `delayed_message_cancel` — DO mutation; tracked in the deferred-design plan
- Settings-related actions — explicitly out of v1 (heterogeneous keys, some hold credentials)
- Bulk operations (`team_bulk_remove`, `user_bulk_delete`) — each bulk call would emit one log per affected row; defer until Phase 2c if we want bulk-restore UX

---

## Open Questions

None blocking. Recommended order of execution:

1. Wave A — conversation lifecycle (highest user-facing recovery value)
2. Wave B — tags (already touches Phase 2a code, easiest validation path)
3. Wave C — team CRUD (lowest urgency; team changes are rare)
4. Wave D — user/agent CRUD (sensitive — password exclusion noted)
