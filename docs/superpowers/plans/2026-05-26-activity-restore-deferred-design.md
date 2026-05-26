# Activity Restore — Deferred Items Design + Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. This document is dual-purpose — it contains the design rationale for the deferred items AND the task list to land them.

**Goal:** Unblock the two activity-restore targets that were deferred from Phase 2a and Phase 2b: customer CRUD endpoints (currently documented but absent) and `delayed_message_cancel` (currently a Durable Object mutation that cannot participate in `db.batch`).

**Architecture:** Two independent tracks. Track A adds the missing customer HTTP endpoints and immediately wires them as reversible per the Phase 2 pattern. Track B introduces a DO-coupled reliability pattern — snapshot the DO state in D1 before the cancel, then call the DO; restore replays the original schedule into the DO. Each track is shippable independently.

**Tech Stack:** Hono + raw D1 + Drizzle (Track A); plus DO RPC API (Track B). Vitest. TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-05-26-activity-restore-design.md` (Sections 1 and 8 — Out of Scope items)

**Prior plans:**
- Phase 1, 2a (merged), 2b (planned) — the existing pattern this design extends

> **Note on commit policy.** Track A and Track B never share a commit. Within each track, one commit per task.

> **Note on naming.** `delayed_message_cancel` restore needs a new RestoreHandler factory (`reschedule-delayed-message`) that talks to the DO; this lives in `restore-helpers.ts` alongside the table-based factories but uses a different mechanism. Documented explicitly so future authors understand why it doesn't fit the `restoreSoftDeleted` family.

---

## Track A — Customer CRUD Endpoints

### Problem

`src/modules/customer/index.ts:33-58` documents these endpoints:
- `DELETE /:id` — soft delete customer
- (Implicit) POST, PUT for create / update — referenced by activity action constants and the customer-crud.ts service layer

But `src/modules/customer/handlers/customer-main.ts` has no matching POST / PUT / DELETE routes. Only GET (list, get, by-platform) and the tag-relationship endpoints (POST/PUT/DELETE `/:customerId/tags`) are wired.

Meanwhile `src/modules/customer/services/customer-crud.ts` already has:
- `findById`, `findByPlatform` (GET path — wired)
- `update(customerId, data)` (line ~280) — NOT wired
- `softDelete(customerId)` (line 369) — NOT wired
- Likely a `create` (need to verify) — NOT wired

The activity-restore work surfaces this gap: we cannot make `customer_delete` reversible because no caller exists.

### Approach

Wire the existing service-layer methods through `customer-main.ts` HTTP handlers using the **same Phase 2a pattern** (`db.batch([log, mutation])`). Because the service layer exists, this is mostly routing + caller-context plumbing.

**Open design question:** Should the service-layer `softDelete()` method stay (it currently stores `_deleted: true` inside `customers.metadata` JSON) or migrate to the standard `deleted_at` column? The schema HAS a `deleted_at` column (Migration 0027, confirmed at `schema.ts:64`). The service-layer implementation predates that migration. Recommend the new HTTP endpoint uses the canonical `deleted_at` column directly, leaving the legacy metadata-flag path untouched for now.

### Permission model

Customers are platform-owned (created via webhook), not user-owned. So:
- **DELETE /:id** — admin only. Agents shouldn't be able to soft-delete customer records.
- **PUT /:id** — admin or team-lead of the customer's source team. Agents can update displayName/avatar (their customers); not metadata.
- **POST /** — admin only (manual customer creation is unusual; webhooks handle the common path).

Existing middleware in `src/modules/customer/middleware/customer-auth.ts` already has `checkCustomerDeletePermission` and similar — reuse them.

### Task A1: POST /api/customers

**Files:**
- Modify: `src/modules/customer/handlers/customer-main.ts`
- Reference: `src/modules/customer/services/customer-crud.ts` (has the validation logic)

**Migration sketch:**

Add to `customer-main.ts` (after the tag-relationship endpoints, before the closing `export default`):

```typescript
// Admin-only manual customer creation (webhooks use webhook-customer-service)
customerHandler.post('/', requireRole('admin'), async (c) => {
  try {
    const body = await c.req.json() as {
      platform: string
      platformUserId: string
      displayName?: string
      email?: string
      phone?: string
      sourceTeamId?: number
      metadata?: Record<string, unknown>
    }

    // Validate required fields
    if (!body.platform || !body.platformUserId) {
      return badRequestResponse(c, 'platform and platformUserId are required')
    }

    // Check duplicate (unique constraint on platform + platform_user_id)
    const existing = await c.env.DB
      .prepare('SELECT id FROM customers WHERE platform = ? AND platform_user_id = ?')
      .bind(body.platform, body.platformUserId)
      .first()
    if (existing) {
      return c.json({ success: false, error: 'Customer already exists for this platform user' },
        HTTP_STATUS.CONFLICT)
    }

    const now = nowISO()
    const insertStmt = c.env.DB
      .prepare(`INSERT INTO customers
                  (platform, platform_user_id, display_name, email, phone, source_team_id, metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id`)
      .bind(
        body.platform, body.platformUserId,
        body.displayName ?? null, body.email ?? null, body.phone ?? null,
        body.sourceTeamId ?? null,
        body.metadata ? JSON.stringify(body.metadata) : null,
        now, now
      )

    const inserted = await insertStmt.first<{ id: number }>()
    if (!inserted) return errorResponse(c, 'Failed to insert customer', 500)
    const newCustomerId = inserted.id

    // Log reversibly (INSERT-then-log pattern, see Phase 2b Task 6 tag_create
    // for the atomicity caveat — accepted for v1)
    const user = c.get('user')
    const capture = new ActivityCapture(c.env.DB)
    await capture.logOnly(capture.buildReversibleLog({
      request: {
        userId: String(user.id), userName: user.displayName ?? user.id, userRole: user.role,
        action: ACTIVITY_ACTIONS.CUSTOMER_CREATE,
        resourceType: RESOURCE_TYPES.CUSTOMER,
        resourceId: String(newCustomerId),
        ipAddress: c.req.header('CF-Connecting-IP') ?? undefined,
        userAgent: c.req.header('User-Agent') ?? undefined,
        details: { platform: body.platform, displayName: body.displayName }
      },
      restoreHandler: 'customer.create',
      previousState: { id: newCustomerId, deleted_at: null },
      newState:      { id: newCustomerId, deleted_at: null }
    }))

    return successResponse(c, { id: newCustomerId, ...body, createdAt: now }, 'Customer created')
  } catch (error) {
    return handleApiError(error, c)
  }
})
```

**Imports needed** at the top of `customer-main.ts`:

```typescript
import { ActivityCapture, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@modules/activities'
import { requireRole } from '@/middleware/auth'
import { badRequestResponse, errorResponse, successResponse } from '@/utils/api-response'
```

`requireRole('admin')` should exist in `src/middleware/auth.ts`. If it doesn't, see what the existing admin-only endpoints use (`router.post('/cleanup', jwtAuth, ...)` in `activity.ts` for example — there's likely a role-check pattern already).

**Test sketch:**

```typescript
// tests/integration/handlers/customer-crud.integration.test.ts
it('admin can create a customer and the log carries restoreHandler=customer.create', async () => { /* ... */ })
it('non-admin returns 403', async () => { /* ... */ })
it('duplicate platform_user_id returns 409', async () => { /* ... */ })
it('missing platform returns 400', async () => { /* ... */ })
```

### Task A2: PUT /api/customers/:customerId

**Files:**
- Modify: `src/modules/customer/handlers/customer-main.ts`

**Migration sketch:** Mirror of Phase 2a's `tag_update` (capture only changed fields, dynamic SET clause). Allowed columns: `display_name`, `email`, `phone`, `source_team_id`, `metadata`. Use `RestoreRegistry["customer.update"]` (already wired to `restoreFields("customers")`).

```typescript
customerHandler.put('/:customerId', requireIntId('customerId'), async (c) => {
  // ... permission check (admin OR team-lead of customer's source_team)
  // ... read pre-state via DB.prepare('SELECT * FROM customers WHERE id = ?')
  // ... diff input vs existing — capture only changed columns
  // ... build [logStmt, mutationStmt], db.batch
})
```

Imports / commit / test pattern identical to Task A1.

### Task A3: DELETE /api/customers/:customerId

**Files:**
- Modify: `src/modules/customer/handlers/customer-main.ts`

**Migration sketch:** Standard soft-delete via `deleted_at` column. Uses `RestoreRegistry["customer.delete"]` (`restoreSoftDeleted("customers")`).

**IMPORTANT** — the legacy `customer-crud.ts:softDelete()` stores the flag in `metadata` JSON. The new HTTP endpoint should NOT use that method; it should directly set the `deleted_at` column. The legacy method can be deprecated in a follow-up cleanup.

```typescript
customerHandler.delete('/:customerId', requireIntId('customerId'), requireRole('admin'), async (c) => {
  const customerId = getValidatedParam<number>(c, 'customerId')

  const existing = await c.env.DB
    .prepare('SELECT id, deleted_at, updated_at FROM customers WHERE id = ?')
    .bind(customerId)
    .first<{ id: number; deleted_at: string | null; updated_at: string }>()
  if (!existing || existing.deleted_at !== null) {
    return notFoundResponse(c, 'Customer')
  }

  const now = nowISO()
  const mutationStmt = c.env.DB
    .prepare('UPDATE customers SET deleted_at = ?, updated_at = ? WHERE id = ?')
    .bind(now, now, customerId)

  // log + batch using restoreHandler 'customer.delete'
  // ...
})
```

### Track A summary

| Task | Action | Restore handler key | Atomicity |
|------|--------|---------------------|-----------|
| A1 POST / | customer_create | customer.create | INSERT-then-log (caveat) |
| A2 PUT /:id | customer_update | customer.update | log + UPDATE batched |
| A3 DELETE /:id | customer_delete | customer.delete | log + UPDATE batched |

3 commits for Track A.

---

## Track B — Delayed Message Cancel Restore

### Problem

`src/modules/delayed-message/handlers/delayed-message-buffer.ts:162` cancels a scheduled message by calling the `DelayedMessageScheduler` Durable Object:

```typescript
const response = await doStub.fetch('https://do/cancel', {
  method: 'POST',
  body: JSON.stringify({ messageId, reason })
})
```

The DO mutates its own internal `Storage` (the cancel is recorded as state inside the DO). D1 batch cannot include this mutation — they are two different storage systems.

If we want `delayed_message_cancel` to be reversible, we need:
1. A way to capture the original message schedule (so restore can recreate it).
2. A way to abort the restore if the original send time has already passed.
3. A way to undo the cancel (re-insert the message into the DO).

### Approach

**Two-phase capture with DO-side cooperation:**

Phase 1 (cancel path):
1. Query the DO for the FULL pending message record (a new `GET /pending/:messageId` DO endpoint).
2. Write the reversible activity log in D1 with `previousState` carrying the captured schedule + sendAt timestamp.
3. Call the DO's existing `/cancel` endpoint.

Phase 2 (restore path):
1. The restore endpoint loads the activity log's `previousState`.
2. `restoreHandler: 'delayed_message.cancel'` is wired to a new RestoreHandler that:
   - Validates `previousState.sendAt > now` — if the original send time has passed, the cancel CANNOT be undone (the message would have been sent and is gone). Return 422 `RESTORE_TOO_LATE` from the endpoint.
   - Calls a new DO endpoint `POST /reschedule` with the captured payload.
3. The DO inserts the message back into its scheduling map and re-arms its Alarm.

### Why this requires `allowMissingCurrentState: true`

After cancel, the DO has no pending message for the given id. `getCurrentState` would return null. We need the existing Phase 1 extension to handle this — the endpoint falls back to `details.newState` for the conflict-diff and proceeds to dispatch. Already shipped.

### Why this isn't a clean batch

The reverse mutation lives in the DO, not D1. The Phase 1 endpoint's `db.batch([mutationStmt, restoreLogStmt])` model can't include the DO call. We have two options:

**Option B.1 (recommended):** Special-case the dispatch in `activity-restore.ts`. If the registry entry exposes a new optional method `dispatchExternal(db, env, previousState)`, the endpoint calls THAT instead of running a batch. Failure of the external call results in 500 — but unlike D1 batch failures, partial state CAN occur (DO call succeeded but log INSERT failed). For this specific case the partial state is benign — re-scheduling a message that was already cancelled produces a duplicate alarm at worst, and the DO's idempotency check on `messageId` would reject the second.

**Option B.2:** Keep the restore inside D1 entirely by writing a "pending restore" marker that the next DO interaction picks up. More complex; not worth it for a single use case.

Go with B.1.

### Required code changes

**1. New DO endpoints** (`src/durable-objects/DelayedMessageScheduler.ts`):

- `GET /pending/:messageId` — returns the full pending message record so the cancel handler can capture it
- `POST /reschedule` — accepts a captured payload and re-inserts the message into the scheduling map

These are additive to the existing `/schedule`, `/cancel`, `/status` endpoints.

**2. Extend `RestoreHandler` interface** (`src/modules/activities/services/restore-registry.ts`):

```typescript
export interface RestoreHandler {
  allowMissingCurrentState?: boolean
  buildMutation(db: D1Database, previousState: Record<string, unknown>): D1PreparedStatement
  getCurrentState(db: D1Database, resourceId: string): Promise<Record<string, unknown> | null>

  /** NEW: optional external dispatcher. When set, the activity-restore endpoint
   *  calls this INSTEAD of running buildMutation through db.batch — used for
   *  cross-storage reversals (e.g. Durable Object state). */
  dispatchExternal?(
    db: D1Database,
    env: Bindings,
    previousState: Record<string, unknown>
  ): Promise<void>
}
```

**3. New factory** (`src/modules/activities/services/restore-helpers.ts`):

```typescript
export const rescheduleDelayedMessage: RestoreHandler = {
  allowMissingCurrentState: true,

  buildMutation(_db, _previousState) {
    // Not used — dispatchExternal handles it
    throw new Error('rescheduleDelayedMessage: use dispatchExternal')
  },

  async getCurrentState(_db, _resourceId) {
    // The cancel was already executed; the DO has no record. Return null.
    return null
  },

  async dispatchExternal(_db, env, previousState) {
    const conversationId = previousState.conversation_id as string
    const messageId = previousState.message_id as string
    const sendAt = previousState.send_at as number   // ms timestamp
    if (sendAt <= Date.now()) {
      throw new Error('RESTORE_TOO_LATE')
    }
    const doId = env.DELAYED_MESSAGE_SCHEDULER.idFromName(conversationId)
    const doStub = env.DELAYED_MESSAGE_SCHEDULER.get(doId)
    const response = await doStub.fetch('https://do/reschedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(previousState)
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(`reschedule failed: ${(body as { reason?: string }).reason ?? response.status}`)
    }
  }
}
```

**4. Registry entry:**

```typescript
'delayed_message.cancel': rescheduleDelayedMessage
```

**5. Endpoint branch** (`src/modules/activities/handlers/activity-restore.ts`):

Where step 9 currently builds and runs `[mutationStmt, restoreLogStmt]` in `db.batch`, add a guard:

```typescript
if (restoreHandler.dispatchExternal) {
  // External-dispatch path — cannot batch with log INSERT.
  // 1. Dispatch external first
  try {
    await restoreHandler.dispatchExternal(c.env.DB, c.env, previousState)
  } catch (err) {
    // Compensate slot
    await c.env.DB.prepare("UPDATE activities SET details = json_set(details, '$.restoredByActivityId', NULL) WHERE id = ?").bind(id).run()
    const msg = err instanceof Error ? err.message : 'External restore failed'
    const code = msg.includes('RESTORE_TOO_LATE') ? 'RESTORE_TOO_LATE' : 'EXTERNAL_FAILED'
    return c.json({ success: false, error: msg, code }, code === 'RESTORE_TOO_LATE' ? 422 : 500)
  }
  // 2. Then log (best-effort — caveat documented above)
  const logResult = await capture.logOnly(restoreLogStmt)
  newRestoreLogId = logResult ?? null
} else {
  // Existing batch path (UNCHANGED)
  const batchResult = await c.env.DB.batch([mutationStmt, restoreLogStmt])
  // ...
}
```

**6. Cancel handler captures the snapshot** (`delayed-message-buffer.ts:162`):

Before calling the DO cancel, query the DO for the pending record:

```typescript
const peek = await doStub.fetch('https://do/pending/' + messageId, { method: 'GET' })
const pending = await peek.json() as { found: boolean; message?: PendingMessage }
if (!pending.found || !pending.message) {
  return badRequestResponse(c, 'Message not found in scheduler')
}

const snapshot = pending.message    // contains conversationId, content, sendAt, platform, etc.

// Now do the cancel
const cancelResp = await doStub.fetch('https://do/cancel', { ... })

// Log REVERSIBLY (single-statement INSERT — no D1 mutation to pair with)
const capture = new ActivityCapture(c.env.DB)
await capture.logOnly(capture.buildReversibleLog({
  request: {
    userId: String(user.id), userName: user.displayName ?? 'Unknown', userRole: user.role,
    action: ACTIVITY_ACTIONS.DELAYED_MESSAGE_CANCEL,
    resourceType: RESOURCE_TYPES.DELAYED_MESSAGE,
    resourceId: messageId,
    ipAddress: c.req.header('CF-Connecting-IP') ?? undefined,
    userAgent: c.req.header('User-Agent') ?? undefined,
    details: { conversationId, reason }
  },
  restoreHandler: 'delayed_message.cancel',
  previousState: {
    message_id: messageId,
    conversation_id: snapshot.conversationId,
    content: snapshot.content,
    platform: snapshot.platform,
    recipient_platform_id: snapshot.recipientPlatformId,
    message_type: snapshot.messageType,
    send_at: snapshot.sendAt,
    scheduled_by: snapshot.scheduledBy
  },
  newState: { message_id: messageId, cancelled_at: new Date().toISOString() }
}))
```

**Atomicity caveat for this path:** Because the DO cancel and the log INSERT cannot batch together, there is a small window where the cancel succeeds but the log write fails. The user-visible effect: the message is cancelled but it cannot be undone via the UI. The DO retains an internal record of cancellation, so the message will NOT be sent. This is an acceptable degradation — the worst case is a successful cancel that the user cannot reverse. Mitigation: best-effort log first, then cancel.

Actually re-order to favor reversibility:

1. Capture snapshot (DO GET /pending)
2. Log INSERT (D1)
3. Cancel (DO POST /cancel)
4. If 3 fails, DELETE the log row

This makes the cancel reversible if it succeeds, at the cost of one extra D1 write on failure paths.

### Track B summary

| Task | File | Notes |
|------|------|-------|
| B1 | `DelayedMessageScheduler.ts` (+ `schedule-manager.ts`) | Add `/pending/:id` GET + `/reschedule` POST endpoints |
| B2 | `restore-registry.ts` + `restore-helpers.ts` | Add `dispatchExternal` to interface + `rescheduleDelayedMessage` factory + registry entry |
| B3 | `activity-restore.ts` | Branch for `dispatchExternal` external-dispatch path |
| B4 | `delayed-message-buffer.ts` | Migrate cancel handler to capture snapshot + reversible log |
| B5 | `tests/integration/handlers/delayed-message-restore.integration.test.ts` | E2E: cancel → restore → DO has the message back |

5 commits for Track B.

---

## Combined Commit Plan

| Order | Commit |
|-------|--------|
| 1 | A1 — POST /customers + customer_create reversible log |
| 2 | A2 — PUT /customers/:id + customer_update reversible log |
| 3 | A3 — DELETE /customers/:id + customer_delete reversible log |
| 4 | B1 — DO pending GET + reschedule POST endpoints |
| 5 | B2 — RestoreHandler.dispatchExternal + rescheduleDelayedMessage factory |
| 6 | B3 — activity-restore endpoint branch for external dispatch |
| 7 | B4 — delayed-message cancel handler captures snapshot + reversible log |
| 8 | B5 — Integration test: cancel → restore round trip |
| 9 | docs(activities): record deferred-items completion |

9 commits total. Track A and Track B are independent; Track B has its own intra-track dependency chain (B1 → B2 → B3 → B4 → B5).

---

## Out of Scope (this design)

- **Customer hard-delete or GDPR erasure.** Soft-delete is sufficient for v1. A separate GDPR-deletion endpoint (irreversible by design) needs its own design.
- **DO state migration** from `_deleted: true` in metadata to canonical `deleted_at` column for legacy data. Tracked separately.
- **Bulk customer operations.** The existing `bulkRemoveMembers` pattern (teams module) could be replicated here but is out of scope for v1 reversibility.
- **Message send "undo" before send time.** This is essentially what `delayed_message_cancel` already provides for delayed messages. For immediate sends there is no buffer to cancel; the message hits LINE/FB instantly.

---

## Open Questions

1. **Should customer_update allow editing `platform_user_id`?** Schema marks it `notNull` and the unique constraint pairs with `platform`. Recommend NO — these are immutable identity fields. Add to the allow-list exclusion in Task A2's diff-and-capture logic.

2. **Reschedule capture timing — can the DO be queried for pending messages?** The current `DelayedMessageScheduler` exposes `/status/:messageId` but it may not return the full payload needed for restore. Confirm during Task B1 implementation that the existing `/status` route returns enough, OR add the new `/pending/:id` endpoint that returns the full record.

3. **What if the DO restarts between snapshot capture and cancel?** Cloudflare DOs persist via Durable Storage; restart preserves the state. Snapshot consistency is not at risk here.
