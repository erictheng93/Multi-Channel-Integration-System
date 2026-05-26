# Activity Restore (Undo Operation) — Design Spec

**Date:** 2026-05-26
**Status:** Draft
**Author:** Claude (brainstormed with user)

## Problem

The activity log page (`/activities`) is currently read-only. When users make mistakes — accidentally delete a customer, mis-edit a tag, wrongly reassign a conversation — they have no in-product recovery path. Their only options are:

- Ask an admin to manually recreate the record (lossy, time-consuming)
- Restore from a database backup (heavy, may roll back unrelated changes)
- Live with the mistake

Existing soft-delete infrastructure (`deletedAt` column on `teams/agents/customers/conversations/messages/tags`) makes restoration technically feasible, but no UI or API surface exposes it. Update and create operations have no snapshot at all — they cannot be reversed even in principle.

## Approach

**Approach A: Embed pre-state snapshots in the existing `activities.details` JSON, expose a `POST /api/activities/:id/restore` endpoint, and dispatch reversal through a typed handler registry.**

- No schema migration — `activities.details` is already `TEXT` and holds JSON
- Every write handler captures pre-state before mutating, writes `{previousState, newState, reversible, restoreHandler}` into `details`
- A `RestoreRegistry` maps `restoreHandler` strings (e.g., `"tag.delete"`, `"customer.update"`) to reversal functions
- Frontend shows a `[還原]` button on eligible records, opens a `RestoreConfirmModal` with a 3-column diff (original / current / after restore), warns on conflicts, lets user choose `[取消]` or `[強制還原]`
- Restoration itself writes a new `RESTORE` activity log entry, so audit trail is preserved

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | All CRUD (create / update / delete / assign / status-change) | User-requested full coverage; excludes message send (external API, irreversible) and read actions (nothing to undo) |
| Permission | Original actor + Admin (dual-track) | Original actor handles their own mistakes without admin overhead; admin covers absentee/forgotten/critical cases |
| Time window | 24 hours default, configurable per-operation via `restorePolicy.expiresAt` | Per-record policy beats hard-coded global — `tag_delete` can be 24h while `settings_update` could be 7d if needed later |
| Conflict handling | Detect mid-changes → show diff modal → user picks force/cancel | Avoids silent overwrite of others' work; respects user agency over hidden auto-merge |
| Snapshot storage | Inline JSON in `activities.details` | Zero migration; survives existing 90-day cleanup; simpler than separate `snapshots` table |
| **Log reliability** | **Snapshot + log + mutation issued in one D1 `batch()` transaction** | **Current `tag delete` etc. log after mutation. The earlier draft of this spec proposed "log first, then mutate, then `markFailed` on error" — but if `markFailed` itself fails, state is corrupt. D1 `batch()` is documented to roll back the entire sequence on any failure ([Cloudflare D1 docs](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)). This is the only fully correct option. |
| Idempotency | Conditional-update CAS on `restoredByActivityId`, must assert exactly 1 row changed | A simple `read-then-write` lets two concurrent restores both pass the read. Must use `UPDATE activities SET ... WHERE id = ? AND json_extract(details, '$.restoredByActivityId') IS NULL`. Endpoint asserts `meta.changes === 1`, otherwise returns 409 with link to the winning RESTORE entry. |
| Restore is auditable | `RESTORE` action emitted with link to original `activityId` | Restoration is itself an operation; must appear in audit trail |
| Irreversible actions | Marked `reversible: false` at log time; UI shows `ⓘ 不可還原` | Honest UX — users see why button is missing |
| Non-existent recoverable types | Login/logout/view actions never get restore button | Nothing to undo |

---

## Section 1: Backend — Snapshot Capture

### Extended `details` Schema

Every reversible `logActivity()` call adds restoration fields alongside the existing enrichment fields (`targetName`, `changes[]`, etc. — see `2026-03-23-activity-log-detail-design.md`).

```json
{
  "targetName": "VIP 客戶",
  "changes": [...],

  "reversible": true,
  "restoreHandler": "tag.delete",
  "previousState": {
    "id": 42,
    "name": "VIP 客戶",
    "color": "#FF9500",
    "teamId": 3,
    "deletedAt": null,
    "createdAt": "2026-04-01T10:00:00.000Z",
    "updatedAt": "2026-05-20T14:32:11.000Z"
  },
  "newState": {
    "id": 42,
    "deletedAt": "2026-05-26T14:32:00.000Z"
  }
}
```

With `restorePolicy` (per-operation tunable) and idempotency tracking:

```json
{
  "reversible": true,
  "restoreHandler": "tag.delete",
  "previousState": { ... },
  "newState": { ... },
  "restorePolicy": {
    "expiresAt": "2026-05-27T14:32:00.000Z",
    "requiresAdmin": false
  },
  "restoredByActivityId": null
}
```

- `restorePolicy.expiresAt` — absolute timestamp; default `createdAt + 24h`. Stored explicitly so the policy travels with the record.
- `restorePolicy.requiresAdmin` — if `true`, even the original actor must be Admin to restore (use for high-stakes operations).
- `restoredByActivityId` — `null` if never restored, `-1` if restore is in progress (CAS-acquired slot, see Section 2 step 8), or the integer id of the completed RESTORE activity. Restoration endpoint refuses to start if non-null.

For irreversible actions (LINE/FB message send, login, logout):
```json
{
  "reversible": false,
  "irreversibleReason": "message_sent_to_external_platform"
}
```

### `ActivityCapture` Helper Service

A new service `src/modules/activities/services/ActivityCapture.ts` wraps `logActivity` for write operations and exposes a batch-builder API so caller and log share a single D1 transaction:

```typescript
interface ReversibleCapture {
  request: CreateActivityRequest;
  restoreHandler: string;        // e.g., "tag.delete"
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  expiresInMs?: number;          // optional, defaults to 24h
  requiresAdmin?: boolean;       // optional, defaults to false
}

class ActivityCapture {
  /**
   * Builds the INSERT statement for the activity log entry. The caller
   * concatenates this with their own mutation statement(s) and submits
   * via db.batch([...]) so the whole thing is transactional.
   *
   * Usage (canonical pattern):
   *   const preState = await readCurrentState(id);
   *   const newState = { ...preState, deletedAt: nowISO() };
   *
   *   const logStmt = activityCapture.buildReversibleLog({
   *     request: { ... },
   *     restoreHandler: "tag.delete",
   *     previousState: preState,
   *     newState,
   *   });
   *   const mutateStmt = db.prepare("UPDATE tags SET deleted_at = ? WHERE id = ?")
   *                       .bind(nowISO(), id);
   *
   *   const [logResult, mutateResult] = await db.batch([logStmt, mutateStmt]);
   *   // D1 rolls back BOTH if either fails — no partial state possible.
   */
  buildReversibleLog(capture: ReversibleCapture): D1PreparedStatement;

  /** Same idea, for irreversible / informational actions (no snapshot). */
  buildIrreversibleLog(req: CreateActivityRequest & {reason: string}): D1PreparedStatement;

  /** Convenience: builds and submits a batch with only the log (use when caller has no mutation). */
  async logOnly(stmt: D1PreparedStatement): Promise<number | null>;
}
```

### Reliability Requirement (Critical)

Current `tag delete`, `customer delete`, etc. perform the mutation first and then call `logActivity()` fire-and-forget. **This is incompatible with restoration:** if the log write fails (D1 transient error, validation bug, quota), the operation succeeds but no snapshot exists, leaving the record unrecoverable forever.

For all reversible operations, the new contract is:

```
read snapshot  →  build [log statement, mutation statement] →  db.batch([...])
```

Per [Cloudflare D1 batch documentation](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch), `batch()` runs all statements within an implicit transaction. If any statement fails, the entire sequence is rolled back. This eliminates the partial-state failure mode (mutation succeeded, log failed).

This is enforced via the `ActivityCapture.buildReversibleLog()` API. The existing fire-and-forget pattern remains valid for irreversible / informational actions only (login, view, etc.).

### Write Handlers That Migrate (Phased Priority)

Per user audit, high-risk operations migrate first. Each phase is independently shippable. File paths verified against repo at spec time:

**Phase 2a — high-risk (week 1):**

| Module | File | Action |
|--------|------|--------|
| tag | `src/modules/tags/services/tag-service.ts` (CRUD logic; `tag-main.ts` is just routing) | `tag_delete`, `tag_update` |
| customer | `src/modules/customer/handlers/customer-main.ts` | `customer_delete` |
| team | `src/modules/teams/handlers/team-members.ts` + `src/modules/teams/handlers/members.ts` | `team_member_remove` |
| delayed-message | `src/modules/delayed-message/handlers/delayed-message-buffer.ts` | `delayed_message_cancel` |

`settings_update` is **excluded from Phase 2a** (see Section 8 / Out of Scope). Settings keys are heterogeneous (some safe to restore, some — like integration credentials — never should be); cherry-picking per-key safety is its own design exercise.

**Phase 2b — medium-risk (week 2):**

| Module | File | Action |
|--------|------|--------|
| customer | `src/modules/customer/handlers/customer-main.ts`, `customer-tags.ts` | `customer_create`, `customer_update`, `tag_assign`, `tag_unassign` |
| tag | `src/modules/tags/services/tag-service.ts` | `tag_create` |
| conversation | `src/modules/conversations/handlers/*.ts` | `conversation_assign`, `conversation_unassign`, `conversation_close`, `conversation_reopen`, conversation delete |
| team | `src/modules/teams/handlers/team-crud.ts` | `team_create`, `team_update`, `team_delete` |
| agent | `src/modules/auth/handlers/*.ts` | user_create, user_update, user_delete (paired with existing `user_restore`) |

---

## Section 2: Backend — Restoration Endpoint

### Route

```
POST /api/activities/:id/restore
Body: { force?: boolean }   // force=true bypasses conflict warning
```

**Where the route lives.** Add a new handler file `src/modules/activities/handlers/activity-restore.ts` exporting a Hono sub-app. Mount it inside `src/modules/activities/handlers/ActivityHandler.ts` (the activities Hono app) **before** the existing parameterized route `router.get('/:id')` — otherwise Hono will treat `restore` as an activity id and fall through. Per CLAUDE.md "Route Registration Order" rules:

```typescript
// in ActivityHandler.ts
import activityRestoreHandler from './activity-restore';

// P1: more specific multi-segment routes registered FIRST
router.route('/:id/restore', activityRestoreHandler);   // POST /api/activities/:id/restore
// ...
router.get('/:id', existingGetHandler);                 // must come AFTER
```

JWT auth, time-window, permission, and CAS logic all live inside `activity-restore.ts`. The endpoint is gated by the existing global `jwtAuth` middleware applied to all `/api/activities/*` routes — no extra middleware wiring needed.

### Section 2.1: New Activity Action Constants

`ActivityValidator.validateCreateRequest` (`src/modules/activities/utils/validators.ts:40`) strictly checks `action` against `ACTIVITY_ACTIONS`. Currently only `USER_RESTORE` and `SYSTEM_RESTORE` exist (`src/modules/activities/constants/actions.ts:23,80`); a generic `"RESTORE"` would be rejected.

Add per-resource constants to `src/modules/activities/constants/actions.ts`:

```typescript
// Restore actions (added by activity-restore design)
TAG_RESTORE: 'tag_restore',
CUSTOMER_RESTORE: 'customer_restore',
CONVERSATION_RESTORE: 'conversation_restore',
TEAM_RESTORE: 'team_restore',
TEAM_MEMBER_RESTORE: 'team_member_restore',
DELAYED_MESSAGE_RESTORE: 'delayed_message_restore',
// (USER_RESTORE already exists)
// (SYSTEM_RESTORE already exists — reserved for system-level restore which is out of v1 scope)
```

The dispatcher in `restore.ts` maps `activity.resourceType` to the matching restore-action constant.

### Execution Flow

```
1. Auth check (jwtAuth middleware — already global)
2. Load activity record by id
3. Reversibility check:
     activity.details.reversible === true
     → otherwise 422 Unprocessable
4. Idempotency early-check (optimization only, not authoritative):
     activity.details.restoredByActivityId === null
     → otherwise 409 Already Restored (with link to the restoration activity)
     (Authoritative idempotency enforcement happens in step 10's CAS — this read
      is a cheap early-out for the common single-caller case.)
5. Permission check:
     (userId === activity.userId || userRole === 'admin')
     AND (!restorePolicy.requiresAdmin || userRole === 'admin')
     → otherwise 403
6. Time window check:
     now < activity.details.restorePolicy.expiresAt
     → otherwise 410 Gone (expired)
7. Conflict detection:
     a) handler = RestoreRegistry[activity.details.restoreHandler]
     b) currentState = await handler.getCurrentState(db, activity.resourceId)
     c) Diff currentState vs activity.details.newState (field-level)
     d) If non-empty diff AND !force → return 409 Conflict with diff payload
     (currentState === null means hard-deleted → 422 per Edge Cases table)
8. Acquire the restore slot via CAS — placeholder value `-1` reserves the slot before any mutation:
     stmt = db.prepare(`
       UPDATE activities
          SET details = json_set(details, '$.restoredByActivityId', -1)
        WHERE id = ?
          AND json_extract(details, '$.restoredByActivityId') IS NULL
     `).bind(activity.id)
     result = await stmt.run()
     → if result.meta.changes !== 1, another caller already owns the slot. Re-read
       activity.details.restoredByActivityId:
         - if value is -1: another restore is in progress, return:
             HTTP 409
             { code: "RESTORE_IN_PROGRESS", retryAfterMs: 2000 }
           Client should retry after the delay; the winner will have completed
           step 10 by then and the slot will hold the real RESTORE log id.
         - if value is a positive integer: that's the winning RESTORE entry id, return:
             HTTP 409
             { code: "ALREADY_RESTORED", restoredByActivityId: <that id> }
     → if result.meta.changes === 1, this caller owns the restore

9. Build the mutation + RESTORE-log INSERT, run in one batch (atomic per Cloudflare D1 batch docs):
     handler = RestoreRegistry[activity.details.restoreHandler]
     mutationStmt   = handler.buildMutation(db, activity.details.previousState)
     restoreLogStmt = activityCapture.buildIrreversibleLog({
                        // Actor metadata required by ActivityValidator
                        // (src/modules/activities/utils/validators.ts) — fetched from the
                        // JWT context of the user performing the restore, NOT from the
                        // original activity.
                        userId:       currentUser.id,
                        userName:     currentUser.displayName,
                        userRole:     currentUser.role,
                        ipAddress:    c.req.header('CF-Connecting-IP'),
                        userAgent:    c.req.header('User-Agent'),

                        action:       <RESTORE_CONSTANT_FOR_RESOURCE>,
                        resourceType: activity.resourceType,
                        resourceId:   activity.resourceId,
                        details: {
                          restoredActivityId: activity.id,
                          force,
                          reversible: false,                 // RESTORE itself is irreversible in v1
                          irreversibleReason: "restore_action_v1_not_reversible"
                        }
                      })

     [_, logResult] = await db.batch([mutationStmt, restoreLogStmt])
     → if batch throws: BOTH statements rolled back; compensate by clearing the slot:
         await db.prepare("UPDATE activities SET details = json_set(details, '$.restoredByActivityId', NULL) WHERE id = ?")
                 .bind(activity.id).run()
       → return 500 with the underlying error
     → on success: newRestoreLogId = logResult.meta.last_row_id

10. Finalize: update the placeholder slot with the actual RESTORE log id:
     await db.prepare(`
       UPDATE activities
          SET details = json_set(details, '$.restoredByActivityId', ?)
        WHERE id = ?
     `).bind(newRestoreLogId, activity.id).run()

11. WebSocket broadcast (use existing MessageBroadcaster DO):
     event: 'resource.restored'
     payload: { resourceType, resourceId, restoredBy }

12. Return 200 with restored entity
```

The key correctness properties:
- **Mutual exclusion** — step 8's CAS uses `WHERE ... IS NULL` so only one caller can acquire the slot
- **Atomicity** — step 9's `db.batch()` ensures mutation and RESTORE log either both apply or both don't
- **Compensation** — if step 9 fails, step 8's slot is explicitly cleared so retries can proceed
- **No "data restored but unmarked"** — if step 10 fails after step 9 succeeds, the slot still holds `-1` (not `NULL`), so a second restore is still blocked. A periodic janitor can scan for `restoredByActivityId === -1` orphans and reconcile, or the v1 approach is to accept these as benign markers (data IS restored, just orphan markers exist).

### `RestoreRegistry`

`buildMutation` returns the reversal statement; `getCurrentState` is used by conflict detection (Section 2 step 7) so both belong in one interface.

```typescript
interface RestoreHandler {
  /** Produce the D1 statement that reverses the original operation. */
  buildMutation(
    db: D1Database,
    previousState: Record<string, unknown>
  ): D1PreparedStatement;

  /** Read the current persisted state of the resource, for conflict diffing. */
  getCurrentState(
    db: D1Database,
    resourceId: string
  ): Promise<Record<string, unknown> | null>;
}

const RestoreRegistry: Record<string, RestoreHandler> = {
  // Soft-delete reversal (clear deletedAt)
  "customer.delete":     restoreSoftDeleted("customers"),
  "tag.delete":          restoreSoftDeleted("tags"),
  "conversation.delete": restoreSoftDeleted("conversations"),
  "team.delete":         restoreSoftDeleted("teams"),
  "agent.delete":        restoreSoftDeleted("agents"),

  // Soft-delete inversion (create reversed by setting deletedAt = now)
  "customer.create":     softDelete("customers"),
  "tag.create":          softDelete("tags"),
  "conversation.create": softDelete("conversations"),
  "team.create":         softDelete("teams"),
  "agent.create":        softDelete("agents"),

  // Field restoration
  "customer.update":     restoreFields("customers"),
  "tag.update":          restoreFields("tags"),
  "conversation.update": restoreFields("conversations"),
  "team.update":         restoreFields("teams"),
  "agent.update":        restoreFields("agents"),

  // Relationship reversal
  "customer.tag-assign":   removeTagFromCustomer,
  "customer.tag-unassign": addTagToCustomer,
  "conversation.assign":   restoreAssignedAgent,    // sets back to previousState.assignedAgentId
  "conversation.unassign": restoreAssignedAgent,
  "conversation.status":   restoreField("conversations", "status"),
};
```

`restoreSoftDeleted`, `softDelete`, `restoreFields`, `restoreField` are factory helpers in `src/modules/activities/services/restore-helpers.ts`. Each factory returns an object satisfying `RestoreHandler` — both `buildMutation` and `getCurrentState` implementations.

Section 2 step 7 (conflict detection) calls `handler.getCurrentState(db, activity.resourceId)`. Section 2 step 9 calls `handler.buildMutation(db, activity.details.previousState)`. Sharing one interface means the registry only needs one entry per operation.

### Conflict Payload (HTTP 409)

```json
{
  "success": false,
  "error": "Conflict detected",
  "code": "RESTORE_CONFLICT",
  "data": {
    "midChanges": [
      {
        "field": "name",
        "valueAtOriginalAction": "王小明",
        "valueNow": "王大明",
        "valueAfterRestore": "王小明"
      }
    ]
  }
}
```

`midChanges[]` only includes the three values the backend can always derive: `valueAtOriginalAction` (from `activity.details.newState`), `valueNow` (from current resource), `valueAfterRestore` (from `activity.details.previousState`).

**Not included in v1:** `modifiedBy` and `modifiedAt`. These would require scanning all subsequent activity logs touching the same resource and field, which is approximate (skipped fields, gaps in coverage) and expensive (extra query per conflicting field). The conflict modal in v1 reads "此資料在原操作之後曾被修改" without naming the modifier. A future iteration can derive attribution by querying activity logs for the resource between `activity.createdAt` and now.

Frontend uses this payload to render the diff modal.

---

## Section 3: Backend — Permission, Time, and Conflict Edge Cases

| Edge case | Handling |
|-----------|----------|
| Activity has no `previousState` (legacy log) | `reversible: false` → 422 |
| `resourceId` is null | 422 |
| Resource currently soft-deleted, action was `update` | Refuse — would resurrect deleted record; require explicit `restore-delete` chain |
| Resource currently soft-deleted, action was `delete` | Restore (this is the normal undelete path) |
| Resource was hard-deleted (e.g., cascade) | 422 — cannot restore |
| `force=true` but resource doesn't exist at all | 422 — cannot create from snapshot if FK parents are gone |
| User originally an admin but now an agent | Original-actor check is on ID, not current role — still allowed |
| User originally an admin but now deleted | Still restorable (by another admin only — original-actor check fails on deleted user) |
| Cross-team conflict (Team Lead permission upgrade in future) | Out of scope for v1 |
| Repeated restore attempts (sequential) | Blocked by `restoredByActivityId` idempotency check; user receives 409 with link to the existing RESTORE entry |
| Repeated restore attempts (concurrent) | Conditional-update CAS: `UPDATE activities SET ... WHERE id = ? AND json_extract(details, '$.restoredByActivityId') IS NULL`. Endpoint asserts exactly one row changed; loser receives 409 |
| Restoration itself being restored | **Not supported in v1.** RESTORE activities are logged with `reversible: false` to avoid recursive state-machine complexity. To re-apply the original operation, perform it manually |
| Mutation fails inside the D1 batch | `db.batch()` rolls back the entire batch including the log insert ([Cloudflare D1 docs](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)). No partial state is possible. Caller receives the error and returns it to the user |

---

## Section 4: Frontend — UI Components

### `ActivityCard.vue` (new file or extend existing)

Receives an `activity` prop, computes:
- `canRestore`: `activity.details.reversible && withinTimeWindow && hasPermission`
- `isExpired`: `!withinTimeWindow && activity.details.reversible`
- `isIrreversible`: `!activity.details.reversible`

Displays:
- Default chrome (icon, actor, action, timestamp, target name)
- Right-aligned status zone:
  - `canRestore` → `[↶ 還原]` capsule button + countdown `ⓘ 23h 28m 可用`
  - `isExpired` → `ⓘ 已過期` muted text, no button
  - `isIrreversible` → `ⓘ 不可還原` muted text, with tooltip explaining why

### `RestoreConfirmModal.vue` (new file)

Triggered on `[還原]` click. Two states:

**State A — no conflict (simple confirmation):**
```
╭─ 確認還原 ────────────────────────╮
│  Alice 將還原以下操作：           │
│  「刪除標籤 VIP 客戶」(14:32)     │
│                                   │
│  此操作將：恢復標籤「VIP 客戶」   │
│                                   │
│  [取消]              [確認還原]   │
╰───────────────────────────────────╯
```

**State B — conflict detected (3-column diff):**
```
╭─ 還原前警告 ────────────────────────────────╮
│  ⚠ 此資料在原操作之後曾被修改               │
│                                             │
│  ┌──────────┬──────────────────────────┐   │
│  │ 欄位     │ 三方對照                 │   │
│  ├──────────┼──────────────────────────┤   │
│  │ name     │ 原操作時：王小明         │   │
│  │          │ 目前    ：王大明         │   │
│  │          │ 還原後  ：王小明         │   │
│  ├──────────┼──────────────────────────┤   │
│  │ tags     │ 原操作時：[VIP]          │   │
│  │          │ 目前    ：[VIP, 新會員]  │   │
│  │          │ 還原後  ：[VIP]          │   │
│  └──────────┴──────────────────────────┘   │
│                                             │
│  強制還原會覆蓋上述目前值。                 │
│                                             │
│  [取消]                    [強制還原]       │
╰─────────────────────────────────────────────╯
```

Note: v1 does not show *who* modified the field — that requires scanning subsequent activity logs and is deferred (see Section 2 conflict payload). The warning is field-level only.

All styling per **Apple-Native Soft Minimalism** (Section 15 of `docs/UIUX-Design-System.md`): `rounded-2xl` modal, capsule buttons, no hard borders, `#FF3B30` for warning text, `#1C1C1E` primary text.

### `ActivityTimeline.vue` — Modifications

Existing timeline component receives one new event:

```vue
<ActivityCard
  v-for="activity in activities"
  :activity="activity"
  @restore-requested="openRestoreModal"
/>
```

### `useRestoreActivity()` Composable (new)

```typescript
function useRestoreActivity() {
  const isRestoring = ref(false);
  const conflictData = ref<ConflictPayload | null>(null);

  async function attemptRestore(activityId: number, force = false) {
    // 1. Optimistic UI: mark activity as restoring
    // 2. Call POST /api/activities/:id/restore
    // 3. On 409 → populate conflictData, caller opens conflict modal
    // 4. On 200 → toast success, refresh timeline, broadcast via WS already updated UI
    // 5. On error → toast failure, revert optimistic state
  }

  return { isRestoring, conflictData, attemptRestore };
}
```

Optimistic UI is mandatory per project feedback memory `feedback_optimistic_ui.md`.

---

## Section 5: Frontend — Permission and Time Window in UI

All checks read from the per-record `restorePolicy` written by `ActivityCapture` — never hard-coded 24h, never assume admin-only.

| Check | Where computed | Source |
|-------|---------------|--------|
| `isOriginalActor` | `ActivityCard.vue` computed | `authStore.currentAgent.id === activity.userId` |
| `isAdmin` | `ActivityCard.vue` computed | `authStore.currentAgent.role === ROLES.ADMIN` |
| `requiresAdmin` | `ActivityCard.vue` computed | `activity.details?.restorePolicy?.requiresAdmin === true` |
| `withinTimeWindow` | `ActivityCard.vue` computed, refreshed every 60s | `Date.now() < new Date(activity.details.restorePolicy.expiresAt).getTime()` |
| `canRestore` | `ActivityCard.vue` computed | `activity.details?.reversible && !activity.details?.restoredByActivityId && withinTimeWindow && ((isOriginalActor && !requiresAdmin) || isAdmin)` |

The countdown updates client-side. When `withinTimeWindow` flips to false, the button auto-disables without a server round-trip.

Backend still re-validates all of these on `/restore` — frontend disable is UX, not security. A missing `restorePolicy` (legacy records) is treated as not-reversible.

---

## Section 6: Testing Strategy

### Unit tests (Vitest, root `tests/`)

- `ActivityCapture.buildReversibleLog` produces a `D1PreparedStatement` whose generated JSON matches the schema in Section 1
- `RestoreRegistry` entries each restore correctly given valid `previousState`
- `restore.ts` returns 403 / 410 / 422 / 409 / 200 for matching scenarios
- Conflict detection diff helper produces correct `midChanges[]`
- CAS step 8 mock: simulate `meta.changes === 0` → endpoint returns 409 without invoking handler

### Integration tests (`tests/integration/handlers/`)

- End-to-end: create tag → delete tag → restore tag → tag reappears with original fields
- Cross-user: Alice deletes, Bob (non-admin) attempts restore → 403
- Mid-modification: Alice deletes, Bob modifies (impossible — already deleted), so use update scenario: Alice updates name, Bob updates name, Alice restores without force → 409 with diff
- Time-window: backdate `createdAt` to 25h ago → 410
- Restore-the-restore refused (v1): Alice deletes → Alice restores → Alice attempts to restore the RESTORE entry → 422 because `details.reversible` is `false`
- Concurrent restore: two simultaneous POST /restore on the same activity → exactly one returns 200, the other returns 409 (CAS verification)
- D1 batch atomicity: simulate mutation failure inside the batch → assert log INSERT also rolled back (no orphan log entry)

### Frontend tests (Vitest + Vue Test Utils, `frontend/`)

- `ActivityCard.vue` shows button only when `canRestore`
- `ActivityCard.vue` shows `ⓘ 已過期` when expired
- `ActivityCard.vue` shows `ⓘ 不可還原` when irreversible
- `RestoreConfirmModal.vue` simple state renders with no diff section
- `RestoreConfirmModal.vue` conflict state renders 3-column diff
- `useRestoreActivity` composable handles 200 / 409 / error paths

### E2E tests (Playwright, future — out of scope for v1 implementation)

Listed in roadmap; not blocking initial merge.

---

## Section 7: Phased Delivery

```
Phase 1 — Infrastructure (2-3 days, independently shippable)
─────────────────────────────────────────────────────────────
  ├─ Add new action constants to ACTIVITY_ACTIONS (Section 2.1)
  ├─ ActivityCapture.buildReversibleLog / buildIrreversibleLog (batch-builder API)
  ├─ RestoreRegistry framework + helpers (restoreSoftDeleted, etc.)
  ├─ POST /api/activities/:id/restore handler with CAS + batch flow
  ├─ Permission + time window checks + conflict detection diff helper
  └─ Unit tests for all of the above

Phase 2a — High-risk handlers (4-5 days)
─────────────────────────────────────────────────────────────
  ├─ tag_delete, tag_update
  ├─ customer_delete
  ├─ team_member_remove
  ├─ delayed_message_cancel
  └─ Each handler: migrate to db.batch([mutationStmt, logStmt]), write integration test
  (settings_update intentionally excluded — see Section 8 / Out of Scope)

Phase 2b — Medium-risk handlers (4-5 days)
─────────────────────────────────────────────────────────────
  ├─ All remaining customer / tag / conversation / team / agent CRUD
  └─ Integration test per handler

Phase 3 — Frontend (2-3 days)
─────────────────────────────────────────────────────────────
  ├─ ActivityCard.vue restore button + status indicators
  ├─ RestoreConfirmModal.vue (simple state)
  ├─ RestoreConfirmModal.vue (conflict diff state)
  ├─ useRestoreActivity composable with optimistic UI
  └─ Component tests

Phase 4 — Launch (1-2 days)
─────────────────────────────────────────────────────────────
  ├─ Feature flag wiring (ENABLE_ACTIVITY_RESTORE)
  ├─ Manual QA on production with flag off → small admin group → all
  ├─ Update docs/modules/activities.md
  └─ Monitor activity log volume growth (snapshots add 1-5KB per record)
```

### Migration path for existing activity logs

Existing activity log entries have no `previousState` or `restoreHandler`. They will simply render with no restore button (no `reversible: true` flag). No backfill needed. Only newly captured operations after rollout become reversible.

This is acceptable because:
- The 24-hour window means within one day of deployment, all currently-eligible operations would be new ones anyway
- Backfilling pre-states for historical operations is impossible — that data wasn't captured

### Feature flag

Wrap the `[還原]` button visibility behind a runtime config flag `ENABLE_ACTIVITY_RESTORE`. Default `false` until QA signs off. Backend endpoint always available (returns 422 if `reversible !== true`, which old records are).

**Config shape changes required:**

1. `frontend/src/config/runtime.ts` — add to the runtime config interface and reader:
   ```typescript
   interface RuntimeConfig {
     // ... existing keys
     enableActivityRestore: boolean;
   }
   function isActivityRestoreEnabled(): boolean { ... }
   ```
2. `frontend/.env.development` and `frontend/.env.production` — add:
   ```
   VITE_ENABLE_ACTIVITY_RESTORE=false
   ```
3. `frontend/src/vite-env.d.ts` — extend `ImportMetaEnv` with the new key
4. `ActivityCard.vue` — call `isActivityRestoreEnabled()` and `&&` into `canRestore`

Backend has no flag — endpoint exists permanently but is harmless because no records have `reversible: true` until Phase 2a handlers are deployed.

### Documentation update

After implementation, update `docs/modules/activities.md` with the new restore section.

---

## Section 8: Out of Scope (v1)

- Message send "undo" — sent to external LINE/FB API, irreversible
- Bulk restore (select multiple activities → restore all)
- Restore for system-level actions including `settings_update`, `system_backup`, `integration_create`, etc. (heterogeneous keys, some have credentials, needs separate per-key safety design)
- Team Lead permission tier (only original-actor + Admin in v1)
- Restoring across hard-deleted FK parents (e.g., restore a customer whose team was hard-deleted)
- Restore in mobile/embedded views (web only)
- Email/notification on restore action (audit log entry is sufficient for v1)
- **Restoring a RESTORE action** — RESTORE entries are logged as `reversible: false` in v1. To re-apply the original operation after restoring it, perform the operation manually. Re-enabling "undo the undo" doubles the state-machine surface area and is deferred

---

## Open Questions

None — all design decisions resolved during brainstorm. Ready for implementation planning.
