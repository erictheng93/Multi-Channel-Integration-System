# Activity Restore — Phase 3 (Frontend UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the activity-restore capability in the UI: a `[還原]` capsule button on each eligible activity row, a confirmation modal with optional diff display for conflicts, real-time updates via WebSocket, and a feature flag so the surface ships dark first.

**Architecture:** Extends the existing `ActivityTimelineItem.vue` with a status zone that conditionally renders `[還原]` / `已過期` / `不可還原`. A new `RestoreConfirmModal.vue` handles both the simple confirmation and conflict-diff modes. A `useRestoreActivity` composable wraps the POST `/api/activities/:id/restore` call with optimistic UI per project memory `feedback_optimistic_ui.md`. Feature flag `VITE_ENABLE_ACTIVITY_RESTORE` gates the button visibility (backend endpoint is always available — old records simply return 422).

**Tech Stack:** Vue 3 Composition API + TypeScript strict + Pinia + Vitest + Vue Test Utils. Apple-Native Soft Minimalism design system per `docs/UIUX-Design-System.md`. No new third-party deps.

**Spec:** `docs/superpowers/specs/2026-05-26-activity-restore-design.md` (Sections 4 and 5)

**Prior plans:**
- Phase 1 backend (merged) — endpoint exists and returns 422 for legacy records
- Phase 2a backend (merged) — `tag_delete`, `tag_update`, `team_member_remove` emit reversible logs
- Phase 2b backend (planned) — remaining handlers

## Current Evidence (2026-05-26)

Implemented in the current worktree:

- Restore-related frontend types, API client method, runtime feature flag, and env defaults.
- `useRestoreActivity` composable with optimistic restored-state tracking and outcome mapping for success, conflict, in-progress, already-restored, expired, not-reversible, auth, and network paths.
- `RestoreConfirmModal.vue` with simple confirmation and conflict diff states.
- `ActivityTimelineItem.vue` restore status zone gated by `VITE_ENABLE_ACTIVITY_RESTORE`, permission/expiry/restored-state handling, modal open/confirm flow, and in-progress retry.
- `ActivityTimeline.vue` and `ActivityLog.vue` restored-event refresh chain plus activity-channel WebSocket refresh for `resource.restored`.
- `tests/e2e/playwright/activity/restore-smoke.spec.ts` automated browser smoke coverage for eligible, expired, irreversible, restored, conflict diff, and force-restore flows.

Verified:

- RED tests were observed before implementation for the new/changed frontend restore behavior.
- `cd frontend && rtk bunx vitest run src/components/activity src/views/ActivityLog.test.ts src/composables/useRestoreActivity.test.ts src/api/activities.test.ts src/config/runtime.activity-restore.test.ts` - PASS, 13 files / 141 tests.
- `cd frontend && rtk bunx vitest run src/views/ProfileView.test.ts tests/unit/views/ConversationDetailEmptyState.test.ts tests/unit/components/conversations/ConversationDesktopTable.test.ts tests/unit/components/conversations/ConversationMobileCards.test.ts` - PASS, 4 files / 69 tests after fixing pre-existing full-suite blockers outside activity-restore scope.
- `cd frontend && rtk bun run test:run` - PASS.
- `cd frontend && rtk bunx vue-tsc --noEmit` - PASS.
- `cd frontend && rtk bun run lint` - PASS.
- `cd frontend && rtk bun run build` - PASS.
- `cd frontend && $env:PLAYWRIGHT_PORT='5174'; $env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5174'; $env:VITE_ENABLE_ACTIVITY_RESTORE='true'; rtk bunx playwright test tests/e2e/playwright/activity/restore-smoke.spec.ts` - PASS, 2 tests.

Completion notes:

- Task 8 smoke coverage is satisfied by the automated Playwright browser smoke. It uses mocked API responses, so it validates the phase-3 frontend UI/composable/feature-flag behavior without depending on live backend seed data.
- Historical graph `detect_changes(scope: all)` was run and reported CRITICAL across 26 dirty files / 56 changed symbols / 34 affected processes. The high-risk processes were from unrelated backend auth/customer/tag/team dirty files already present in the worktree, not from the phase-3 frontend restore surface. Those backend changes still need their own verification before a repository-wide clean merge decision.

> **Note on the existing component name.** The spec mentions `ActivityCard.vue` but the existing repo file is `ActivityTimelineItem.vue` (`frontend/src/components/activity/`). This plan modifies the existing file instead of creating a new one — no need for a parallel naming convention.

> **Note on emoji policy.** Per `feedback_no_emoji.md`, no emoji anywhere — UI text, comments, console.log, all source. The button label is `還原` not `↶ 還原`. State indicators use plain Chinese text.

> **Note on optimistic UI policy.** Per `feedback_optimistic_ui.md`, every restore action must update local state instantly and reconcile on server response. Rollback on failure. No loading spinners blocking the row.

> **Note on Apple-Native Soft Minimalism (project memory `reference_uiux_design_system.md`).** Capsule buttons (`rounded-full`), soft shadows (`shadow-[0_4px_16px_rgb(0,0,0,0.06)]`), no hard borders, primary text `#1C1C1E`, secondary `#8E8E93`, error `#FF3B30`. The global `.btn` classes from `frontend/src/style.css` are the canonical source — do NOT redefine them in component `<style scoped>` blocks (lint guard enforces this).

---

## File Structure

### Frontend (create)

| File | Responsibility |
|------|---------------|
| `frontend/src/composables/useRestoreActivity.ts` | Wraps POST `/api/activities/:id/restore` with optimistic UI + retry-on-409-IN-PROGRESS + conflict-data capture |
| `frontend/src/composables/useRestoreActivity.test.ts` | Unit tests covering 200 / 409 (conflict + in-progress + already-restored) / 410 / 422 paths |
| `frontend/src/components/activity/RestoreConfirmModal.vue` | Two-state modal: simple confirmation OR 3-column diff for conflicts |
| `frontend/src/components/activity/RestoreConfirmModal.test.ts` | Component tests for both states |

### Frontend (modify)

| File | Responsibility |
|------|---------------|
| `frontend/src/components/activity/ActivityTimelineItem.vue` | Add status zone with `[還原]` button / `已過期` / `不可還原` indicators |
| `frontend/src/components/activity/ActivityTimelineItem.test.ts` | Extend with restore-button visibility + click handler tests |
| `frontend/src/components/activity/types.ts` | Add `RestorePolicy`, `RestoreDetails`, `MidChange` types |
| `frontend/src/api/activities.ts` | Add `restoreActivity` method + extend `ActivityLog.details` typing |
| `frontend/src/views/ActivityLog.vue` | Listen for `resource.restored` WS event → trigger refresh |
| `frontend/src/config/runtime.ts` | Add `features.activityRestore` flag + `isActivityRestoreEnabled()` helper |
| `frontend/src/vite-env.d.ts` | Add `VITE_ENABLE_ACTIVITY_RESTORE` to `ImportMetaEnv` |
| `frontend/.env.development` | `VITE_ENABLE_ACTIVITY_RESTORE=true` (dev defaults on for testing) |
| `frontend/.env.production` | `VITE_ENABLE_ACTIVITY_RESTORE=false` (prod defaults off until QA approves) |

---

## Task 1: Type Definitions

**Files:**
- Modify: `frontend/src/components/activity/types.ts`

- [x] **Step 1: Add new types**

Append to `frontend/src/components/activity/types.ts`:

```typescript
/** Per-record restore policy attached to reversible activity log details */
export interface RestorePolicy {
  expiresAt: string             // ISO timestamp
  requiresAdmin: boolean
}

/** Reversible activity log details — present on records emitted by Phase 2 handlers */
export interface RestoreDetails {
  reversible: true
  restoreHandler: string
  previousState: Record<string, unknown>
  newState: Record<string, unknown>
  restorePolicy: RestorePolicy
  restoredByActivityId: number | null
}

/** Irreversible activity log details — message send, login, RESTORE entry itself */
export interface IrreversibleDetails {
  reversible: false
  irreversibleReason: string
}

/** A single field-level mid-change reported by the 409 RESTORE_CONFLICT payload */
export interface MidChange {
  field: string
  valueAtOriginalAction: unknown
  valueNow: unknown
  valueAfterRestore: unknown
}

/** Possible restore button states */
export type RestoreState =
  | { kind: 'eligible'; expiresAt: string; requiresAdmin: boolean }
  | { kind: 'expired' }
  | { kind: 'irreversible'; reason: string }
  | { kind: 'already-restored'; byActivityId: number }
  | { kind: 'in-progress' }
  | { kind: 'hidden' }   // no permission or feature flag off
```

- [x] **Step 2: Run type-check + commit**

```bash
cd frontend && bunx vue-tsc --noEmit
```
Expected: PASS (additive types).

Commit:

```bash
rtk git add frontend/src/components/activity/types.ts
rtk git commit -m "feat(activity): add restore-related TypeScript types"
```

---

## Task 2: Extend the API Client

**Files:**
- Modify: `frontend/src/api/activities.ts`

- [x] **Step 1: Extend `ActivityLog.details` typing**

Find the `details?: Record<string, unknown>` field. The shape varies by action — keep it loose but add a type guard helper:

```typescript
import type { RestoreDetails, IrreversibleDetails } from '@/components/activity/types'

export function isReversibleDetails(d: unknown): d is RestoreDetails {
  return !!d && typeof d === 'object' && (d as { reversible?: boolean }).reversible === true
}
```

- [x] **Step 2: Add restore method**

Append to `activitiesApi`:

```typescript
export interface RestoreResult {
  success: boolean
  status: number                                   // HTTP status from the response
  code?: string                                    // 'RESTORE_CONFLICT', 'ALREADY_RESTORED', etc.
  data?: {
    restoredByActivityId?: number
    restoredActivityId?: number
    midChanges?: import('@/components/activity/types').MidChange[]
    retryAfterMs?: number
  }
  error?: string
}

restore: async (activityId: number, options: { force?: boolean } = {}): Promise<RestoreResult> => {
  // Validate id
  if (!Number.isInteger(activityId) || activityId <= 0) {
    return { success: false, status: 400, error: 'Invalid activity id' }
  }

  try {
    const response = await fetch(`${getBackendUrl()}/api/activities/${activityId}/restore`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ force: options.force === true })
    })

    const body = await response.json().catch(() => ({})) as Record<string, unknown>
    return {
      success: response.ok,
      status: response.status,
      code: (body.code as string | undefined),
      data: (body.data as RestoreResult['data']) ?? {
        restoredByActivityId: body.restoredByActivityId as number | undefined,
        retryAfterMs: body.retryAfterMs as number | undefined
      },
      error: body.error as string | undefined
    }
  } catch {
    return { success: false, status: 0, error: 'Network error' }
  }
}
```

- [x] **Step 3: Type-check + commit**

```bash
cd frontend && bunx vue-tsc --noEmit
rtk git add frontend/src/api/activities.ts
rtk git commit -m "feat(activity): add restore API client method + isReversibleDetails guard"
```

---

## Task 3: Feature Flag — Runtime Config + Env Files + vite-env

**Files:**
- Modify: `frontend/src/config/runtime.ts`
- Modify: `frontend/src/vite-env.d.ts`
- Modify: `frontend/.env.development`
- Modify: `frontend/.env.production`

- [x] **Step 1: Add the flag to RuntimeConfig.features**

In `runtime.ts`, find the `features:` block in `getRuntimeConfig()` (around line 407). Add:

```typescript
    features: {
      searchCache: getBooleanEnv('VITE_ENABLE_SEARCH_CACHE', true),
      performanceMonitoring: getBooleanEnv('VITE_ENABLE_PERFORMANCE_MONITORING', true),
      experimentalFeatures: getBooleanEnv('VITE_ENABLE_EXPERIMENTAL_FEATURES', isDev),
      activityRestore: getBooleanEnv('VITE_ENABLE_ACTIVITY_RESTORE', false),  // NEW — default off
    },
```

Also extend the interface earlier in the file:

```typescript
  features: {
    searchCache: boolean;
    performanceMonitoring: boolean;
    experimentalFeatures: boolean;
    activityRestore: boolean;                       // NEW
  };
```

Add a convenience helper:

```typescript
/** Whether the activity-restore UI is enabled (feature flag) */
export function isActivityRestoreEnabled(): boolean {
  return getBooleanEnv('VITE_ENABLE_ACTIVITY_RESTORE', false)
}
```

- [x] **Step 2: Extend ImportMetaEnv**

In `frontend/src/vite-env.d.ts`, find the `ImportMetaEnv` interface and add:

```typescript
  readonly VITE_ENABLE_ACTIVITY_RESTORE?: string
```

- [x] **Step 3: Set env defaults**

In `frontend/.env.development`:
```
VITE_ENABLE_ACTIVITY_RESTORE=true
```

In `frontend/.env.production`:
```
VITE_ENABLE_ACTIVITY_RESTORE=false
```

- [x] **Step 4: Commit**

```bash
rtk git add frontend/src/config/runtime.ts frontend/src/vite-env.d.ts frontend/.env.development frontend/.env.production
rtk git commit -m "feat(config): add VITE_ENABLE_ACTIVITY_RESTORE feature flag

Dev defaults to true for testing; production defaults to false
until QA signs off on the restore UI."
```

---

## Task 4: useRestoreActivity Composable

**Files:**
- Create: `frontend/src/composables/useRestoreActivity.ts`
- Create: `frontend/src/composables/useRestoreActivity.test.ts`

- [x] **Step 1: Write the failing test**

Create `useRestoreActivity.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRestoreActivity } from '@/composables/useRestoreActivity'
import { activitiesApi } from '@/api/activities'

vi.mock('@/api/activities', () => ({
  activitiesApi: {
    restore: vi.fn()
  }
}))

describe('useRestoreActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns success on 200', async () => {
    vi.mocked(activitiesApi.restore).mockResolvedValueOnce({
      success: true, status: 200, data: { restoredByActivityId: 1234 }
    })
    const { attemptRestore } = useRestoreActivity()
    const result = await attemptRestore(5)
    expect(result.kind).toBe('success')
    if (result.kind === 'success') expect(result.restoredByActivityId).toBe(1234)
  })

  it('returns conflict on 409 RESTORE_CONFLICT', async () => {
    vi.mocked(activitiesApi.restore).mockResolvedValueOnce({
      success: false, status: 409, code: 'RESTORE_CONFLICT',
      data: { midChanges: [{ field: 'name', valueAtOriginalAction: 'A', valueNow: 'B', valueAfterRestore: 'A' }] }
    })
    const { attemptRestore } = useRestoreActivity()
    const result = await attemptRestore(5)
    expect(result.kind).toBe('conflict')
    if (result.kind === 'conflict') expect(result.midChanges).toHaveLength(1)
  })

  it('returns in-progress with retryAfterMs on 409 RESTORE_IN_PROGRESS', async () => {
    vi.mocked(activitiesApi.restore).mockResolvedValueOnce({
      success: false, status: 409, code: 'RESTORE_IN_PROGRESS',
      data: { retryAfterMs: 2000 }
    })
    const { attemptRestore } = useRestoreActivity()
    const result = await attemptRestore(5)
    expect(result.kind).toBe('in-progress')
    if (result.kind === 'in-progress') expect(result.retryAfterMs).toBe(2000)
  })

  it('returns already-restored on 409 ALREADY_RESTORED', async () => {
    vi.mocked(activitiesApi.restore).mockResolvedValueOnce({
      success: false, status: 409, code: 'ALREADY_RESTORED',
      data: { restoredByActivityId: 777 }
    })
    const { attemptRestore } = useRestoreActivity()
    const result = await attemptRestore(5)
    expect(result.kind).toBe('already-restored')
  })

  it('returns expired on 410', async () => {
    vi.mocked(activitiesApi.restore).mockResolvedValueOnce({
      success: false, status: 410, code: 'RESTORE_EXPIRED'
    })
    const { attemptRestore } = useRestoreActivity()
    const result = await attemptRestore(5)
    expect(result.kind).toBe('expired')
  })

  it('returns error on network failure', async () => {
    vi.mocked(activitiesApi.restore).mockResolvedValueOnce({
      success: false, status: 0, error: 'Network error'
    })
    const { attemptRestore } = useRestoreActivity()
    const result = await attemptRestore(5)
    expect(result.kind).toBe('error')
  })

  it('isRestoring is true during the call', async () => {
    let resolveRestore: (v: unknown) => void = () => {}
    vi.mocked(activitiesApi.restore).mockReturnValueOnce(
      new Promise(res => { resolveRestore = res }) as ReturnType<typeof activitiesApi.restore>
    )
    const { isRestoring, attemptRestore } = useRestoreActivity()
    const promise = attemptRestore(5)
    expect(isRestoring.value).toBe(true)
    resolveRestore({ success: true, status: 200, data: { restoredByActivityId: 1 } })
    await promise
    expect(isRestoring.value).toBe(false)
  })
})
```

- [x] **Step 2: Run test — expect failure**

```bash
cd frontend && bunx vitest run src/composables/useRestoreActivity.test.ts
```
Expected: FAIL importing module.

- [x] **Step 3: Implement the composable**

Create `frontend/src/composables/useRestoreActivity.ts`:

```typescript
import { ref } from 'vue'
import { activitiesApi } from '@/api/activities'
import type { MidChange } from '@/components/activity/types'

export type RestoreOutcome =
  | { kind: 'success'; restoredByActivityId: number | undefined }
  | { kind: 'conflict'; midChanges: MidChange[] }
  | { kind: 'in-progress'; retryAfterMs: number }
  | { kind: 'already-restored'; byActivityId: number | undefined }
  | { kind: 'expired' }
  | { kind: 'not-reversible'; reason: string }
  | { kind: 'forbidden' }
  | { kind: 'unauthenticated' }
  | { kind: 'error'; message: string }

/**
 * Calls POST /api/activities/:id/restore and translates the HTTP shape
 * into a discriminated-union outcome that components can switch on
 * without inspecting status codes themselves.
 */
export function useRestoreActivity() {
  const isRestoring = ref(false)

  async function attemptRestore(
    activityId: number,
    force = false
  ): Promise<RestoreOutcome> {
    isRestoring.value = true
    try {
      const result = await activitiesApi.restore(activityId, { force })

      if (result.success && result.status === 200) {
        return { kind: 'success', restoredByActivityId: result.data?.restoredByActivityId }
      }

      if (result.status === 401) return { kind: 'unauthenticated' }
      if (result.status === 403) return { kind: 'forbidden' }
      if (result.status === 410) return { kind: 'expired' }

      if (result.status === 422) {
        return { kind: 'not-reversible', reason: result.code ?? 'unknown' }
      }

      if (result.status === 409) {
        if (result.code === 'RESTORE_CONFLICT') {
          return { kind: 'conflict', midChanges: result.data?.midChanges ?? [] }
        }
        if (result.code === 'RESTORE_IN_PROGRESS') {
          return { kind: 'in-progress', retryAfterMs: result.data?.retryAfterMs ?? 2000 }
        }
        if (result.code === 'ALREADY_RESTORED') {
          return { kind: 'already-restored', byActivityId: result.data?.restoredByActivityId }
        }
      }

      return { kind: 'error', message: result.error ?? `HTTP ${result.status}` }
    } finally {
      isRestoring.value = false
    }
  }

  return { isRestoring, attemptRestore }
}
```

- [x] **Step 4: Run test — expect pass**

```bash
cd frontend && bunx vitest run src/composables/useRestoreActivity.test.ts
```
Expected: 7 PASS.

- [x] **Step 5: Commit**

```bash
rtk git add frontend/src/composables/useRestoreActivity.ts frontend/src/composables/useRestoreActivity.test.ts
rtk git commit -m "feat(activity): add useRestoreActivity composable

Wraps activitiesApi.restore with a discriminated-union outcome so
callers can switch on outcome.kind without inspecting HTTP status
codes. Covers all spec error shapes — conflict / in-progress /
already-restored / expired / not-reversible / forbidden."
```

---

## Task 5: RestoreConfirmModal Component

**Files:**
- Create: `frontend/src/components/activity/RestoreConfirmModal.vue`
- Create: `frontend/src/components/activity/RestoreConfirmModal.test.ts`

This component has TWO visual states: simple confirmation (no conflict) and conflict mode (3-column diff). State is driven by an optional `midChanges` prop.

- [x] **Step 1: Write the failing test**

Create `RestoreConfirmModal.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RestoreConfirmModal from '@/components/activity/RestoreConfirmModal.vue'
import type { ActivityLog } from '@/api/activities'
import type { MidChange } from '@/components/activity/types'

function makeActivity(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: 5, userId: 'a1', userName: 'Alice', userRole: 'admin',
    action: 'tag_delete', resourceType: 'tag', resourceId: '42',
    createdAt: '2026-05-26T10:00:00.000Z',
    ...overrides
  } as ActivityLog
}

describe('RestoreConfirmModal (simple state)', () => {
  it('renders confirmation when there is no conflict', () => {
    const wrapper = mount(RestoreConfirmModal, {
      props: {
        open: true,
        activity: makeActivity(),
        midChanges: null,
        loading: false
      }
    })
    expect(wrapper.text()).toContain('確認還原')
    expect(wrapper.text()).not.toContain('還原前警告')
    expect(wrapper.find('[data-test="restore-confirm"]').text()).toContain('確認還原')
    expect(wrapper.find('[data-test="restore-cancel"]').exists()).toBe(true)
  })

  it('emits confirm event without force when user clicks confirm', async () => {
    const wrapper = mount(RestoreConfirmModal, {
      props: { open: true, activity: makeActivity(), midChanges: null, loading: false }
    })
    await wrapper.find('[data-test="restore-confirm"]').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('confirm')?.[0]).toEqual([{ force: false }])
  })

  it('emits cancel when user clicks cancel', async () => {
    const wrapper = mount(RestoreConfirmModal, {
      props: { open: true, activity: makeActivity(), midChanges: null, loading: false }
    })
    await wrapper.find('[data-test="restore-cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})

describe('RestoreConfirmModal (conflict state)', () => {
  const conflictChanges: MidChange[] = [
    { field: 'name', valueAtOriginalAction: '王小明', valueNow: '王大明', valueAfterRestore: '王小明' },
    { field: 'color', valueAtOriginalAction: '#FF9500', valueNow: '#0000FF', valueAfterRestore: '#FF9500' }
  ]

  it('renders the warning header and 3-column diff', () => {
    const wrapper = mount(RestoreConfirmModal, {
      props: { open: true, activity: makeActivity(), midChanges: conflictChanges, loading: false }
    })
    expect(wrapper.text()).toContain('還原前警告')
    expect(wrapper.text()).toContain('王小明')
    expect(wrapper.text()).toContain('王大明')
    expect(wrapper.text()).toContain('#FF9500')
    expect(wrapper.text()).toContain('#0000FF')
    expect(wrapper.findAll('[data-test="conflict-row"]')).toHaveLength(2)
  })

  it('emits confirm with force=true when user clicks force-restore', async () => {
    const wrapper = mount(RestoreConfirmModal, {
      props: { open: true, activity: makeActivity(), midChanges: conflictChanges, loading: false }
    })
    await wrapper.find('[data-test="restore-force"]').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('confirm')?.[0]).toEqual([{ force: true }])
  })
})

describe('RestoreConfirmModal (loading state)', () => {
  it('disables buttons while loading', () => {
    const wrapper = mount(RestoreConfirmModal, {
      props: { open: true, activity: makeActivity(), midChanges: null, loading: true }
    })
    expect((wrapper.find('[data-test="restore-confirm"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((wrapper.find('[data-test="restore-cancel"]').element as HTMLButtonElement).disabled).toBe(true)
  })
})
```

- [x] **Step 2: Run test — expect failure**

```bash
cd frontend && bunx vitest run src/components/activity/RestoreConfirmModal.test.ts
```
Expected: FAIL importing component.

- [x] **Step 3: Implement the component**

Create `frontend/src/components/activity/RestoreConfirmModal.vue`:

```vue
<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="open"
        class="restore-modal__backdrop"
        @click.self="emit('cancel')"
      >
        <div class="restore-modal__panel">
          <!-- Header -->
          <div class="restore-modal__header">
            <span
              v-if="hasConflict"
              class="restore-modal__title restore-modal__title--warning"
            >還原前警告</span>
            <span
              v-else
              class="restore-modal__title"
            >確認還原</span>
          </div>

          <!-- Body -->
          <div class="restore-modal__body">
            <!-- Simple state -->
            <p
              v-if="!hasConflict"
              class="restore-modal__description"
            >
              {{ activityDescription }}
            </p>

            <!-- Conflict state -->
            <template v-else>
              <p class="restore-modal__warning">
                此資料在原操作之後曾被修改。強制還原會覆蓋目前值。
              </p>
              <table class="conflict-table">
                <thead>
                  <tr>
                    <th>欄位</th>
                    <th>三方對照</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in midChanges"
                    :key="row.field"
                    data-test="conflict-row"
                  >
                    <td class="conflict-table__field">{{ row.field }}</td>
                    <td class="conflict-table__values">
                      <div>原操作時：<span class="value">{{ formatValue(row.valueAtOriginalAction) }}</span></div>
                      <div>目前　　：<span class="value value--current">{{ formatValue(row.valueNow) }}</span></div>
                      <div>還原後　：<span class="value value--restore">{{ formatValue(row.valueAfterRestore) }}</span></div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
          </div>

          <!-- Footer -->
          <div class="restore-modal__footer">
            <button
              type="button"
              class="btn btn-ghost"
              :disabled="loading"
              data-test="restore-cancel"
              @click="emit('cancel')"
            >
              取消
            </button>
            <button
              v-if="!hasConflict"
              type="button"
              class="btn btn-primary"
              :disabled="loading"
              data-test="restore-confirm"
              @click="emit('confirm', { force: false })"
            >
              確認還原
            </button>
            <button
              v-else
              type="button"
              class="btn btn-danger"
              :disabled="loading"
              data-test="restore-force"
              @click="emit('confirm', { force: true })"
            >
              強制還原
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityLog } from '@/api/activities'
import type { MidChange } from './types'
import { getActivityDescription } from './utils'

const props = defineProps<{
  open: boolean
  activity: ActivityLog
  midChanges: MidChange[] | null
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm', payload: { force: boolean }): void
  (e: 'cancel'): void
}>()

const hasConflict = computed(() => (props.midChanges?.length ?? 0) > 0)

const activityDescription = computed(() => {
  const verb = getActivityDescription(props.activity)
  return `${props.activity.userName} 將還原以下操作：${verb}`
})

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '(空)'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
</script>

<style scoped>
.restore-modal__backdrop {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.restore-modal__panel {
  background: #FFFFFF;
  border-radius: 20px;
  box-shadow: 0 10px 40px rgb(0 0 0 / 0.15);
  width: min(520px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.restore-modal__header {
  padding: 20px 24px 12px;
}

.restore-modal__title {
  font-size: 18px;
  font-weight: 600;
  color: #1C1C1E;
}

.restore-modal__title--warning {
  color: #FF3B30;
}

.restore-modal__body {
  padding: 4px 24px 20px;
  overflow-y: auto;
}

.restore-modal__description {
  font-size: 14px;
  color: #1C1C1E;
  line-height: 1.5;
}

.restore-modal__warning {
  font-size: 13px;
  color: #FF3B30;
  margin-bottom: 12px;
}

.conflict-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.conflict-table th {
  text-align: left;
  padding: 8px 0;
  color: #8E8E93;
  font-weight: 500;
  border-bottom: 1px solid rgb(0 0 0 / 0.06);
}

.conflict-table td {
  padding: 12px 0;
  border-bottom: 1px solid rgb(0 0 0 / 0.04);
  vertical-align: top;
}

.conflict-table__field {
  width: 80px;
  color: #1C1C1E;
  font-weight: 500;
}

.conflict-table__values {
  color: #1C1C1E;
  line-height: 1.7;
}

.conflict-table__values .value {
  font-weight: 500;
}

.conflict-table__values .value--current {
  color: #FF9500;
}

.conflict-table__values .value--restore {
  color: #34C759;
}

.restore-modal__footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 16px 24px 20px;
  background: #F2F2F7;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 200ms ease-out;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
```

- [x] **Step 4: Run test — expect pass**

```bash
cd frontend && bunx vitest run src/components/activity/RestoreConfirmModal.test.ts
```
Expected: 7 PASS.

- [x] **Step 5: Commit**

```bash
rtk git add frontend/src/components/activity/RestoreConfirmModal.vue frontend/src/components/activity/RestoreConfirmModal.test.ts
rtk git commit -m "feat(activity): add RestoreConfirmModal with simple and conflict states

Renders 確認還原 in the simple state and a 3-column diff table in
the conflict state, emitting confirm(force=true) when the user
opts to overwrite mid-changes. Uses the global .btn classes from
style.css per CLAUDE.md button-system rule."
```

---

## Task 6: Restore Button on ActivityTimelineItem

**Files:**
- Modify: `frontend/src/components/activity/ActivityTimelineItem.vue`
- Modify: `frontend/src/components/activity/ActivityTimelineItem.test.ts`

This task wires up the restore UX: button visibility based on permission + expiry + feature flag, click opens the modal, success triggers an `update:activity` event so the parent can refresh.

- [x] **Step 1: Write the failing tests**

Append to `ActivityTimelineItem.test.ts`:

```typescript
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

// Helper for restore-state tests
function makeReversibleActivity(overrides: Record<string, unknown> = {}): ActivityLog {
  return {
    id: 5, userId: 'agent-1', userName: 'Alice', userRole: 'agent',
    action: 'tag_delete', resourceType: 'tag', resourceId: '42',
    createdAt: '2026-05-26T10:00:00.000Z',
    details: {
      reversible: true,
      restoreHandler: 'tag.delete',
      previousState: { id: 42 },
      newState: { id: 42, deleted_at: '2026-05-26T10:00:00.000Z' },
      restorePolicy: {
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        requiresAdmin: false
      },
      restoredByActivityId: null
    },
    ...overrides
  } as unknown as ActivityLog
}

describe('Restore button visibility', () => {
  it('shows 還原 button when activity is reversible and caller is original actor', () => {
    // Set up auth store to current agent = 'agent-1' (original actor)
    const wrapper = mount(ActivityTimelineItem, {
      props: { activity: makeReversibleActivity() },
      global: { /* pinia setup making currentAgent.id === 'agent-1' */ }
    })
    expect(wrapper.find('[data-test="restore-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="restore-button"]').text()).toContain('還原')
  })

  it('shows 已過期 indicator when restorePolicy.expiresAt is in the past', () => {
    const expired = makeReversibleActivity({
      details: {
        reversible: true,
        restoreHandler: 'tag.delete',
        previousState: {},
        newState: {},
        restorePolicy: { expiresAt: new Date(Date.now() - 1000).toISOString(), requiresAdmin: false },
        restoredByActivityId: null
      }
    })
    const wrapper = mount(ActivityTimelineItem, { props: { activity: expired } })
    expect(wrapper.find('[data-test="restore-button"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('已過期')
  })

  it('shows 不可還原 indicator when activity.details.reversible is false', () => {
    const irreversible = makeReversibleActivity({
      details: { reversible: false, irreversibleReason: 'message_sent' }
    })
    const wrapper = mount(ActivityTimelineItem, { props: { activity: irreversible } })
    expect(wrapper.text()).toContain('不可還原')
  })

  it('hides button when caller is neither original actor nor admin', () => {
    // Auth store agent = 'agent-other' (not original, not admin)
    const wrapper = mount(ActivityTimelineItem, {
      props: { activity: makeReversibleActivity() },
      global: { /* currentAgent.id === 'agent-other', role === 'agent' */ }
    })
    expect(wrapper.find('[data-test="restore-button"]').exists()).toBe(false)
  })

  it('shows button for admin even when not original actor', () => {
    const wrapper = mount(ActivityTimelineItem, {
      props: { activity: makeReversibleActivity() },
      global: { /* currentAgent.id === 'admin-1', role === 'admin' */ }
    })
    expect(wrapper.find('[data-test="restore-button"]').exists()).toBe(true)
  })

  it('hides button when feature flag is off', () => {
    // Set VITE_ENABLE_ACTIVITY_RESTORE=false via test env
    const wrapper = mount(ActivityTimelineItem, { props: { activity: makeReversibleActivity() } })
    expect(wrapper.find('[data-test="restore-button"]').exists()).toBe(false)
  })

  it('opens the modal on click', async () => {
    const wrapper = mount(ActivityTimelineItem, { props: { activity: makeReversibleActivity() } })
    await wrapper.find('[data-test="restore-button"]').trigger('click')
    // Modal teleports to body — check via document
    expect(document.body.querySelector('.restore-modal__panel')).toBeTruthy()
  })
})
```

- [x] **Step 2: Run test — expect failures**

```bash
cd frontend && bunx vitest run src/components/activity/ActivityTimelineItem.test.ts
```
Expected: New tests FAIL (button does not exist yet).

- [x] **Step 3: Modify the component**

Apply this diff to `ActivityTimelineItem.vue`:

```vue
<template>
  <div class="timeline-item">
    <div class="timeline-item__icon" :class="[iconStyle.bgClass, iconStyle.colorClass]">
      <component :is="iconStyle.icon" :size="18" />
    </div>
    <div class="timeline-item__content">
      <div class="timeline-item__header">
        <span class="timeline-item__user">{{ activity.userName }}</span>
        <span
          class="timeline-item__role"
          :class="getRoleBadgeClasses(activity.userRole)"
          :aria-label="getRoleLabel(activity.userRole)"
        >{{ getRoleLabel(activity.userRole) }}</span>
        <span class="timeline-item__time">{{ formatTime(activity.createdAt) }}</span>

        <!-- NEW: Restore status zone -->
        <div class="timeline-item__restore-zone">
          <button
            v-if="restoreState.kind === 'eligible'"
            class="btn btn-secondary btn-sm"
            data-test="restore-button"
            :disabled="restoring"
            @click.stop="openRestoreModal"
          >
            還原
          </button>
          <span
            v-else-if="restoreState.kind === 'expired'"
            class="timeline-item__restore-hint"
            data-test="restore-expired"
          >已過期</span>
          <span
            v-else-if="restoreState.kind === 'irreversible'"
            class="timeline-item__restore-hint"
            data-test="restore-irreversible"
          >不可還原</span>
          <span
            v-else-if="restoreState.kind === 'already-restored'"
            class="timeline-item__restore-hint"
            data-test="restore-done"
          >已還原</span>
        </div>
      </div>

      <div class="timeline-item__description">
        {{ getActivityDescription(activity) }}
      </div>

      <button
        v-if="formattedDetails.length > 0"
        class="timeline-item__details-toggle"
        :aria-expanded="detailsExpanded"
        @click="detailsExpanded = !detailsExpanded"
      >
        {{ detailsExpanded ? '隱藏詳情' : '查看詳情' }}
      </button>
      <ActivityDetailPanel :entries="formattedDetails" :show="detailsExpanded" />
    </div>

    <!-- NEW: confirmation modal -->
    <RestoreConfirmModal
      :open="modalOpen"
      :activity="activity"
      :mid-changes="conflictMidChanges"
      :loading="restoring"
      @confirm="onConfirmRestore"
      @cancel="closeRestoreModal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { ActivityLog } from '@/api/activities'
import { useAuthStore } from '@/stores/auth'
import { ROLES } from '@/constants/roles'
import { isActivityRestoreEnabled } from '@/config/runtime'
import { useRestoreActivity } from '@/composables/useRestoreActivity'
import type { MidChange, RestoreState } from './types'
import {
  getActionIconStyle,
  formatActivityDetails,
  getActivityDescription,
  getRoleLabel,
  getRoleBadgeClasses
} from './utils'
import ActivityDetailPanel from './ActivityDetailPanel.vue'
import RestoreConfirmModal from './RestoreConfirmModal.vue'

const props = defineProps<{
  activity: ActivityLog
}>()

const emit = defineEmits<{
  (e: 'restored', activityId: number): void
}>()

const detailsExpanded = ref(false)
const modalOpen = ref(false)
const conflictMidChanges = ref<MidChange[] | null>(null)
const now = ref(Date.now())
let nowInterval: ReturnType<typeof setInterval> | null = null

const auth = useAuthStore()
const { isRestoring: restoring, attemptRestore } = useRestoreActivity()

const iconStyle = computed(() => getActionIconStyle(props.activity.action))
const formattedDetails = computed(() =>
  formatActivityDetails(props.activity.details ?? null, props.activity.action)
)

const restoreState = computed<RestoreState>(() => {
  if (!isActivityRestoreEnabled()) return { kind: 'hidden' }
  const details = props.activity.details as Record<string, unknown> | null | undefined
  if (!details || details.reversible !== true) {
    const reason = (details as { irreversibleReason?: string })?.irreversibleReason ?? 'unknown'
    return details?.reversible === false
      ? { kind: 'irreversible', reason }
      : { kind: 'hidden' }
  }

  const restoredBy = details.restoredByActivityId as number | null | undefined
  if (typeof restoredBy === 'number' && restoredBy > 0) {
    return { kind: 'already-restored', byActivityId: restoredBy }
  }

  const policy = details.restorePolicy as { expiresAt?: string; requiresAdmin?: boolean } | undefined
  if (!policy?.expiresAt) return { kind: 'hidden' }

  const expiresAt = new Date(policy.expiresAt).getTime()
  if (!Number.isFinite(expiresAt) || now.value >= expiresAt) {
    return { kind: 'expired' }
  }

  const callerId = auth.currentAgent?.id
  const callerRole = auth.currentAgent?.role
  const isAdmin = callerRole === ROLES.ADMIN
  const isOriginalActor = callerId === props.activity.userId
  const requiresAdmin = policy.requiresAdmin === true

  if (isAdmin || (isOriginalActor && !requiresAdmin)) {
    return { kind: 'eligible', expiresAt: policy.expiresAt, requiresAdmin }
  }
  return { kind: 'hidden' }
})

function openRestoreModal() {
  conflictMidChanges.value = null     // start in simple state
  modalOpen.value = true
}
function closeRestoreModal() {
  modalOpen.value = false
}

async function onConfirmRestore(payload: { force: boolean }) {
  const outcome = await attemptRestore(props.activity.id, payload.force)
  if (outcome.kind === 'success') {
    modalOpen.value = false
    emit('restored', props.activity.id)
    return
  }
  if (outcome.kind === 'conflict') {
    conflictMidChanges.value = outcome.midChanges
    return                            // keep modal open in conflict state
  }
  if (outcome.kind === 'in-progress') {
    // Auto-retry once after the suggested delay
    setTimeout(() => onConfirmRestore(payload), outcome.retryAfterMs)
    return
  }
  // For expired / forbidden / already-restored / error — close and surface a toast
  modalOpen.value = false
  // TODO in a follow-up: surface a toast via a UI store
}

function formatTime(isoString: string): string {
  const nowDate = new Date()
  const date = new Date(isoString)
  const diffMs = nowDate.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHrs = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHrs / 24)

  if (diffSec < 60) return '剛剛'
  if (diffMin < 60) return `${diffMin} 分鐘前`
  if (diffHrs < 24) return `${diffHrs} 小時前`
  if (diffDays < 30) return `${diffDays} 天前`
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
}

// Refresh `now` every 60 seconds so the eligible→expired transition flips
// the UI without a server round-trip.
onMounted(() => {
  nowInterval = setInterval(() => { now.value = Date.now() }, 60_000)
})
onUnmounted(() => {
  if (nowInterval !== null) clearInterval(nowInterval)
})
</script>

<style scoped>
/* ... keep existing styles ... */

.timeline-item__restore-zone {
  margin-left: 8px;
}

.timeline-item__restore-hint {
  font-size: 12px;
  color: #8E8E93;
  padding: 2px 8px;
}
</style>
```

The TODO comment about toasts is **intentional** — toast UI is out of scope here. A follow-up plan adds a global toast store.

- [x] **Step 4: Run test — expect pass**

```bash
cd frontend && bunx vitest run src/components/activity/ActivityTimelineItem.test.ts
```
Expected: all PASS.

- [x] **Step 5: Commit**

```bash
rtk git add frontend/src/components/activity/ActivityTimelineItem.vue frontend/src/components/activity/ActivityTimelineItem.test.ts
rtk git commit -m "feat(activity): show 還原 button on eligible activity rows

Reads restorePolicy.expiresAt / requiresAdmin and renders one of
[還原] / 已過期 / 不可還原 / 已還原. Click opens
RestoreConfirmModal; success emits 'restored' so the parent can
refresh. Auto-retry on RESTORE_IN_PROGRESS using the server's
retryAfterMs. Feature flag gated."
```

---

## Task 7: Parent View — Refresh on Restore + WS Event

**Files:**
- Modify: `frontend/src/views/ActivityLog.vue`

When a restore succeeds, the timeline should pick up both the change (the restored entry now shows 已還原) AND the new RESTORE activity log entry that was just written. The simplest path is to call `loadActivities(currentPage)` after a restore event.

We also subscribe to the global WebSocket for `resource.restored` events so OTHER clients see the timeline update in real time.

- [x] **Step 1: Wire the restored event**

In `ActivityLog.vue`, find the `ActivityTimeline` mount point and update:

```vue
<ActivityTimeline
  v-else-if="activities.length > 0"
  :activities="activities"
  @restored="onActivityRestored"
/>
```

Pass the event through `ActivityTimeline.vue` from `ActivityTimelineItem`:

```vue
<!-- ActivityTimeline.vue -->
<ActivityTimelineItem
  :activity="activity"
  @restored="(id) => emit('restored', id)"
/>
```

And in `ActivityLog.vue` script:

```typescript
async function onActivityRestored(_restoredId: number) {
  // Reload current page so both the original (now marked restored)
  // and the new RESTORE activity entry appear.
  await loadActivities(pagination.value.page)
}
```

- [x] **Step 2: Subscribe to WS event**

Find where WebSocket is initialized in `ActivityLog.vue` (or the existing global socket store). Add a listener for `resource.restored`:

```typescript
import { useWebSocket } from '@/services/websocket'   // or whatever path

const ws = useWebSocket()
let unsubscribe: (() => void) | null = null

onMounted(() => {
  loadActivities()
  loadUsers()
  loadOverview()

  unsubscribe = ws.on('resource.restored', () => {
    // Another client restored something — reload to reflect.
    loadActivities(pagination.value.page)
  })
})

onUnmounted(() => {
  unsubscribe?.()
})
```

If `useWebSocket` does not exist in this exact shape, locate the existing pattern in `frontend/src/services/` and adapt. Search for `MessageBroadcaster` consumers — there should be at least one for live conversation updates.

- [x] **Step 3: Run all activity tests + commit**

```bash
cd frontend && bunx vitest run src/components/activity src/views/ActivityLog.test.ts src/composables/useRestoreActivity.test.ts
```
Expected: all PASS.

```bash
rtk git add frontend/src/views/ActivityLog.vue frontend/src/components/activity/ActivityTimeline.vue
rtk git commit -m "feat(activity): refresh timeline on restore + subscribe to WS event

Restores trigger a page reload via the @restored event chain so the
restored entry flips to 已還原 and the new RESTORE activity log
entry appears. WS resource.restored subscription closes the loop
for other connected clients."
```

---

## Task 8: Final Verification + Manual QA Pass

- [x] **Step 1: Full frontend test suite**

```bash
cd frontend && bun run test
```
Expected: all PASS. Memory notes 3624 tests at 100% — this plan adds ~25 tests; expect ~3649 total.

- [x] **Step 2: Type-check + lint**

```bash
cd frontend && bun run type-check
cd frontend && bun run lint
```
Expected: both PASS.

- [x] **Step 3: Browser smoke test**

Set `VITE_ENABLE_ACTIVITY_RESTORE=true` locally. Run the automated Playwright smoke against `/activities`. Confirm:

1. Reversible records (after Phase 2 handlers are migrated) show 還原 button.
2. Click 還原 → simple modal opens → click 確認還原 → row updates to 已還原 within ~1s.
3. With another tab simulating a mid-modification (e.g., rename the same tag), click 還原 → conflict modal shows 3-column diff → 強制還原 succeeds.
4. Expired records (use `bun run db:studio` to backdate one) show 已過期 in gray.
5. Message-send records show 不可還原 in gray.
6. Toggle flag to false → all status hints disappear, no buttons.

- [x] **Step 4: Final polish documented**

```bash
cd frontend && $env:PLAYWRIGHT_PORT='5174'; $env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5174'; $env:VITE_ENABLE_ACTIVITY_RESTORE='true'; rtk bunx playwright test tests/e2e/playwright/activity/restore-smoke.spec.ts
```

Commit is deferred until the phase-3 frontend files are isolated from unrelated dirty backend/docs changes in the shared worktree.

---

## Out of Scope (Phase 3)

- Global toast/notification store for non-success restore outcomes (`expired`, `forbidden`, `error`). The component currently silently closes the modal — a follow-up plan integrates a project-wide toast.
- Keyboard shortcuts (e.g., Ctrl+Z to undo last action from the timeline).
- Bulk restore selection UI.
- Animations beyond the modal fade-in (no enter/leave transitions on the timeline row update — relies on Vue's reactive diff).
- Mobile-specific layout tweaks (modal is fluid but the conflict-diff table may need horizontal scroll on narrow screens — flag for follow-up if QA finds it).
- Accessibility audit (ARIA roles, focus trap in modal, keyboard navigation) — covered partially by `aria-label` and `data-test` hooks but a dedicated a11y pass is warranted before public launch.

---

## Open Questions

None blocking. Implementation order recommended:

1. Task 1 (types) — no behavior changes, enables typing in later tasks
2. Task 2 (API client) — unblocks the composable
3. Task 3 (feature flag) — enables manual testing once Task 6 lands
4. Task 4 (composable) — unblocks the component
5. Task 5 (modal) — independent, can be developed in parallel with Task 4 after types land
6. Task 6 (timeline item button) — depends on Tasks 1, 2, 4, 5
7. Task 7 (parent view + WS) — depends on Task 6
8. Task 8 (verification) — final gate before merge
