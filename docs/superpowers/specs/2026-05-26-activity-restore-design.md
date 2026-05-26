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
| **Log reliability** | **Snapshot + log written BEFORE mutation, not fire-and-forget after** | **Current `tag delete` etc. log after mutation. If log write fails, snapshot is lost and operation becomes permanently irrecoverable. This is the critical correctness requirement of v1.** |
| Idempotency | Track `restoredByActivityId` to block double-restore | Repeated restore of the same activity would corrupt state |
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
- `restoredByActivityId` — set to the `id` of the new `RESTORE` activity once this record is restored. Restoration endpoint rejects if non-null (idempotency).

For irreversible actions (LINE/FB message send, login, logout):
```json
{
  "reversible": false,
  "irreversibleReason": "message_sent_to_external_platform"
}
```

### `ActivityCapture` Helper Service

A new service `src/modules/activities/services/ActivityCapture.ts` wraps `logActivity` for write operations:

```typescript
interface ReversibleLogRequest extends CreateActivityRequest {
  restoreHandler: string;        // e.g., "tag.delete"
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  expiresInMs?: number;          // optional, defaults to 24h
  requiresAdmin?: boolean;       // optional, defaults to false
}

class ActivityCapture {
  /**
   * Captures pre-state snapshot AND writes log entry BEFORE
   * the caller performs the mutation. Returns the activity id so the caller
   * can record `restoredByActivityId` later or roll back the log on mutation failure.
   *
   * Must be called in this order:
   *   1. preState = await readCurrentState()
   *   2. logId = await activityCapture.logReversible({ previousState: preState, ... })
   *   3. await performMutation()
   *   4. (on mutation failure) await activityCapture.markFailed(logId)
   */
  async logReversible(req: ReversibleLogRequest): Promise<number | null>;
  async logIrreversible(req: CreateActivityRequest & {reason: string}): Promise<number | null>;

  /** Soft-marks a log entry as failed when its associated mutation rolled back. */
  async markFailed(activityId: number, error: string): Promise<void>;
}
```

### Reliability Requirement (Critical)

Current `tag delete`, `customer delete`, etc. perform the mutation first and then call `logActivity()` fire-and-forget. **This is incompatible with restoration:** if the log write fails (D1 transient error, validation bug, quota), the operation succeeds but no snapshot exists, leaving the record unrecoverable forever.

For all reversible operations, the new contract is:

```
read snapshot  →  log first (with snapshot)  →  mutate  →  on mutation error: mark log failed
```

This is enforced via the `ActivityCapture` API. The existing fire-and-forget pattern remains valid for irreversible / informational actions only (login, view, etc.).

### Write Handlers That Migrate (Phased Priority)

Per user audit, high-risk operations migrate first. Each phase is independently shippable:

**Phase 2a — high-risk (week 1):**

| Module | File | Action |
|--------|------|--------|
| tag | `tags/handlers/*.ts` | `tag_delete`, `tag_update` |
| customer | `customer/handlers/customers-main.ts` | `customer_delete` |
| team | `teams/handlers/team-main.ts` | `team_member_remove` |
| delayed-message | `delayed-message/handlers/*.ts` | `delayed_message_cancel` |
| system | `system/handlers/system-settings.ts` | `settings_update` |

**Phase 2b — medium-risk (week 2):**

| Module | File | Action |
|--------|------|--------|
| customer | `customer/handlers/*.ts` | `customer_create`, `customer_update`, `tag_assign`, `tag_unassign` |
| tag | `tags/handlers/*.ts` | `tag_create` |
| conversation | `conversations/handlers/*.ts` | `assign`, `unassign`, `status_change`, `delete` |
| team | `teams/handlers/team-main.ts` | `team_create`, `team_update`, `team_delete` |
| agent | `auth/handlers/*.ts` | `agent_create`, `agent_update`, `agent_delete` |

### Write Handlers That Migrate

| Module | File | Actions |
|--------|------|---------|
| customer | `customer-tags.ts`, `customers-main.ts` | create, update, delete, tag-assign, tag-unassign |
| tag | `tags/handlers/*.ts` | create, update, delete |
| conversation | `conversations/handlers/*.ts` | create, update, delete, status-change, assign, unassign |
| team | `teams/handlers/team-main.ts` | create, update, delete |
| agent | `auth/handlers/*.ts` | create, update, delete |

---

## Section 2: Backend — Restoration Endpoint

### Route

```
POST /api/activities/:id/restore
Body: { force?: boolean }   // force=true bypasses conflict warning
```

Registered in `src/modules/activities/handlers/restore.ts`, wired into existing activities route group in `src/index.ts`.

### Execution Flow

```
1. Auth check (jwtAuth middleware — already global)
2. Load activity record by id
3. Reversibility check:
     activity.details.reversible === true
     → otherwise 422 Unprocessable
4. Idempotency check:
     activity.details.restoredByActivityId === null
     → otherwise 409 Already Restored (with link to the restoration activity)
5. Permission check:
     (userId === activity.userId || userRole === 'admin')
     AND (!restorePolicy.requiresAdmin || userRole === 'admin')
     → otherwise 403
6. Time window check:
     now < activity.details.restorePolicy.expiresAt
     → otherwise 410 Gone (expired)
7. Conflict detection:
     a) Look up current state of activity.resourceType / activity.resourceId
     b) Diff currentState vs activity.details.newState
     c) If !equal AND !force → return 409 Conflict with diff payload
8. Dispatch (transactional):
     handler = RestoreRegistry[activity.details.restoreHandler]
     → handler(db, activity.details.previousState)
9. Log RESTORE activity:
     {
       action: "RESTORE",
       resourceType: activity.resourceType,
       resourceId: activity.resourceId,
       details: { restoredActivityId: activity.id, force }
     }
10. Mark original activity:
     UPDATE activities SET details = json_set(details, '$.restoredByActivityId', <new id>)
     WHERE id = activity.id
11. WebSocket broadcast (use existing MessageBroadcaster DO):
     event: 'resource.restored'
     payload: { resourceType, resourceId, restoredBy }
12. Return 200 with restored entity
```

Steps 8-10 should run inside a single D1 batch where possible to maintain atomicity. If step 9 or 10 fail after step 8, the system enters an inconsistent state (data restored but not marked); the recovery is manual admin intervention — log the inconsistency with a known error code so it can be alerted on.

### `RestoreRegistry`

```typescript
type RestoreFn = (db: D1Database, previousState: Record<string, unknown>) => Promise<unknown>;

const RestoreRegistry: Record<string, RestoreFn> = {
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

`restoreSoftDeleted`, `softDelete`, `restoreFields`, `restoreField` are factory helpers in `src/modules/activities/services/restore-helpers.ts`.

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
        "valueAfterRestore": "王小明",
        "modifiedBy": "Bob",
        "modifiedAt": "2026-05-26T11:30:00.000Z"
      }
    ]
  }
}
```

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
| Repeated restore attempts | Blocked by `restoredByActivityId` idempotency check; user receives 409 with link to the existing RESTORE entry |
| Restoration itself can be restored | Yes — the `RESTORE` activity is itself logged via `logReversible`. This means "undoing the undo" effectively re-applies the original operation. Tracked recursively, bounded by 24h window |
| `logReversible` succeeds but mutation fails | `markFailed(logId)` is called; the log entry remains for forensics but `reversible` flips to `false` |

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
│  ⚠ 此資料在原操作之後已被修改               │
│                                             │
│  ┌──────────┬───────────┬────────────────┐ │
│  │ 欄位     │ 修改人    │ 三方對照       │ │
│  ├──────────┼───────────┼────────────────┤ │
│  │ name     │ Bob 11:30 │ 王小明         │ │
│  │          │           │ → 王大明 (現)  │ │
│  │          │           │ → 王小明 (還原)│ │
│  ├──────────┼───────────┼────────────────┤ │
│  │ tags     │ Bob 11:35 │ [VIP]          │ │
│  │          │           │ → [VIP,新會員] │ │
│  │          │           │ → [VIP]        │ │
│  └──────────┴───────────┴────────────────┘ │
│                                             │
│  強制還原會覆蓋上述變更。                   │
│                                             │
│  [取消]                    [強制還原]       │
╰─────────────────────────────────────────────╯
```

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

| Check | Where computed | Source |
|-------|---------------|--------|
| `isOriginalActor` | `ActivityCard.vue` computed | `authStore.currentAgent.id === activity.userId` |
| `isAdmin` | `ActivityCard.vue` computed | `authStore.currentAgent.role === ROLES.ADMIN` |
| `withinTimeWindow` | `ActivityCard.vue` computed, refreshed every 60s | `Date.now() - new Date(activity.createdAt).getTime() < 24h` |
| `canRestore` | `ActivityCard.vue` computed | `(isOriginalActor || isAdmin) && withinTimeWindow && activity.details?.reversible` |

The countdown updates client-side. When `withinTimeWindow` flips to false, the button auto-disables without a server round-trip.

Backend still re-validates all three on `/restore` — frontend disable is UX, not security.

---

## Section 6: Testing Strategy

### Unit tests (Vitest, root `tests/`)

- `ActivityCapture.logReversible` writes correct JSON shape
- `RestoreRegistry` entries each restore correctly given valid `previousState`
- `restore.ts` returns 403 / 410 / 422 / 409 / 200 for matching scenarios
- Conflict detection diff helper produces correct `midChanges[]`

### Integration tests (`tests/integration/handlers/`)

- End-to-end: create tag → delete tag → restore tag → tag reappears with original fields
- Cross-user: Alice deletes, Bob (non-admin) attempts restore → 403
- Mid-modification: Alice deletes, Bob modifies (impossible — already deleted), so use update scenario: Alice updates name, Bob updates name, Alice restores without force → 409 with diff
- Time-window: backdate `createdAt` to 25h ago → 410
- Restore the restore: Alice deletes → Alice restores → Alice "restores the restoration" (soft-delete) → works

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
  ├─ ActivityCapture service + markFailed
  ├─ RestoreRegistry framework + helpers (restoreSoftDeleted, etc.)
  ├─ POST /api/activities/:id/restore handler
  ├─ Permission + time window + idempotency middleware
  ├─ Conflict detection diff helper
  └─ Unit tests for all of the above

Phase 2a — High-risk handlers (4-5 days)
─────────────────────────────────────────────────────────────
  ├─ tag_delete, tag_update
  ├─ customer_delete
  ├─ team_member_remove
  ├─ delayed_message_cancel
  ├─ settings_update
  └─ Each handler: migrate to logReversible, write integration test

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

Wrap the `[還原]` button visibility behind a runtime config flag `ENABLE_ACTIVITY_RESTORE` (read via `frontend/src/config/runtime.ts`). Default `false` until QA signs off. Backend endpoint always available (returns 422 if `reversible !== true`, which old records are).

### Documentation update

After implementation, update `docs/modules/activities.md` with the new restore section.

---

## Section 8: Out of Scope (v1)

- Message send "undo" — sent to external LINE/FB API, irreversible
- Bulk restore (select multiple activities → restore all)
- Restore for system-level actions (settings changes, backups, etc.)
- Team Lead permission tier (only original-actor + Admin in v1)
- Restoring across hard-deleted FK parents (e.g., restore a customer whose team was hard-deleted)
- Restore in mobile/embedded views (web only)
- Email/notification on restore action (audit log entry is sufficient for v1)

---

## Open Questions

None — all design decisions resolved during brainstorm. Ready for implementation planning.
