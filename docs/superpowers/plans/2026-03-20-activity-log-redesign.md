# Activity Log Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Activity Log page to follow the Apple-Native Soft Minimalism design system with stats overview cards, capsule filter pills, color-coded timeline, and formatted detail panels.

**Architecture:** Decompose monolithic `ActivityLog.vue` (1127 lines) into 8 focused sub-components under `frontend/src/components/activity/`. The page orchestrator (`ActivityLog.vue`) manages state and API calls, passing data down via props. No backend changes needed — all APIs already exist.

**Tech Stack:** Vue 3 Composition API, TypeScript strict, scoped CSS with Tailwind-compatible custom properties, Vitest + Vue Test Utils.

**Spec:** `docs/superpowers/specs/2026-03-20-activity-log-redesign.md`

**Design System:** `docs/UIUX-Design-System.md` (Apple-Native Soft Minimalism)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `frontend/src/components/icons/index.ts` | Add LoginIcon |
| Create | `frontend/src/components/activity/types.ts` | Shared types/interfaces for activity components |
| Create | `frontend/src/components/activity/utils.ts` | Date grouping, icon mapping, detail formatting utilities |
| Create | `frontend/src/components/activity/ActivityDetailPanel.vue` | Expandable detail key-value display |
| Create | `frontend/src/components/activity/ActivityTimelineItem.vue` | Single activity row with color-coded icon |
| Create | `frontend/src/components/activity/ActivityTimeline.vue` | Date-grouped timeline list container |
| Create | `frontend/src/components/activity/ActivityStatsCards.vue` | 4 stat overview cards |
| Create | `frontend/src/components/activity/ActivityFilterPills.vue` | Capsule filter row |
| Create | `frontend/src/components/activity/ActivityPagination.vue` | Capsule-style pagination |
| Create | `frontend/src/components/activity/ActivityEmptyState.vue` | Empty/loading/error states |
| Rewrite | `frontend/src/views/ActivityLog.vue` | Page orchestrator wiring all sub-components |

**Test files** (co-located):
| Path | Covers |
|------|--------|
| `frontend/src/components/activity/utils.test.ts` | Date grouping, icon mapping, detail formatting |
| `frontend/src/components/activity/ActivityDetailPanel.test.ts` | Expand/collapse, key-value rendering |
| `frontend/src/components/activity/ActivityTimelineItem.test.ts` | Icon color mapping, role badge, detail toggle |
| `frontend/src/components/activity/ActivityTimeline.test.ts` | Date grouping headers, list rendering |
| `frontend/src/components/activity/ActivityStatsCards.test.ts` | Stats rendering, loading/error states |
| `frontend/src/components/activity/ActivityFilterPills.test.ts` | Filter state, active styling, clear action |
| `frontend/src/components/activity/ActivityPagination.test.ts` | Page navigation, disabled states |
| `frontend/src/components/activity/ActivityEmptyState.test.ts` | Loading/empty/error variants |

---

## Task 1: Add LoginIcon and shared types

**Files:**
- Modify: `frontend/src/components/icons/index.ts`
- Create: `frontend/src/components/activity/types.ts`

- [ ] **Step 1: Add LoginIcon to icon library**

In `frontend/src/components/icons/index.ts`, add after the existing `HistoryIcon` export (around line 320):

```typescript
export const LoginIcon = defineComponent<IconProps>({
  name: 'LoginIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4' }),
      h('polyline', { points: '10 17 15 12 10 7' }),
      h('line', { x1: '15', y1: '12', x2: '3', y2: '12' })
    ])
  }
})

export const LogoutIcon = defineComponent<IconProps>({
  name: 'LogoutIcon',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    class: { type: String, default: '' }
  },
  setup(props) {
    return () => h('svg', {
      width: String(props.size || 24),
      height: String(props.size || 24),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': String(props.strokeWidth || 2),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: props.class || ''
    }, [
      h('path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }),
      h('polyline', { points: '16 17 21 12 16 7' }),
      h('line', { x1: '21', y1: '12', x2: '9', y2: '12' })
    ])
  }
})
```

- [ ] **Step 2: Create shared types file**

Create `frontend/src/components/activity/types.ts`:

```typescript
import type { ActivityLog } from '@/api/activities'

/** Date-grouped activities for timeline rendering */
export interface ActivityDateGroup {
  label: string
  date: string
  activities: ActivityLog[]
}

/** Icon style mapping for each action category */
export interface ActionIconStyle {
  bgClass: string
  colorClass: string
  icon: ReturnType<typeof import('vue').defineComponent>
}

/** Formatted detail entry for the detail panel */
export interface DetailEntry {
  key: string
  value: string
  type?: 'default' | 'old-value' | 'new-value'
}

/** Stats card data */
export interface StatCardData {
  label: string
  value: string | number
  subtitle: string
  bgClass: string
  colorStyle: string
  icon: ReturnType<typeof import('vue').defineComponent>
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && bunx vue-tsc --noEmit`
Expected: No errors related to new files.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/icons/index.ts frontend/src/components/activity/types.ts
git commit -m "feat(activity): add LoginIcon/LogoutIcon and shared activity types"
```

---

## Task 2: Create utility functions with tests

**Files:**
- Create: `frontend/src/components/activity/utils.ts`
- Create: `frontend/src/components/activity/utils.test.ts`

- [ ] **Step 1: Write failing tests for utilities**

Create `frontend/src/components/activity/utils.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  groupActivitiesByDate,
  getActionIconStyle,
  formatActivityDetails,
  getActivityDescription,
  getRoleLabel,
  getRoleBadgeClasses
} from './utils'
import type { ActivityLog } from '@/api/activities'

function makeActivity(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: 1,
    userId: 'user-1',
    userName: 'Test User',
    userRole: 'admin',
    action: 'user_login',
    resourceType: 'user',
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

describe('groupActivitiesByDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should group today activities under "today" label', () => {
    const activities = [
      makeActivity({ id: 1, createdAt: '2026-03-20T09:00:00Z' }),
      makeActivity({ id: 2, createdAt: '2026-03-20T08:00:00Z' })
    ]
    const groups = groupActivitiesByDate(activities)
    expect(groups).toHaveLength(1)
    expect(groups[0].activities).toHaveLength(2)
  })

  it('should group yesterday activities separately', () => {
    const activities = [
      makeActivity({ id: 1, createdAt: '2026-03-20T09:00:00Z' }),
      makeActivity({ id: 2, createdAt: '2026-03-19T15:00:00Z' })
    ]
    const groups = groupActivitiesByDate(activities)
    expect(groups).toHaveLength(2)
  })

  it('should use formatted date for older activities', () => {
    const activities = [
      makeActivity({ id: 1, createdAt: '2026-03-15T10:00:00Z' })
    ]
    const groups = groupActivitiesByDate(activities)
    expect(groups).toHaveLength(1)
    // Should be a formatted date string, not "today" or "yesterday"
    expect(groups[0].label).not.toBe('')
  })

  it('should return empty array for empty input', () => {
    expect(groupActivitiesByDate([])).toEqual([])
  })
})

describe('getActionIconStyle', () => {
  it('should return blue style for user_login', () => {
    const style = getActionIconStyle('user_login')
    expect(style.bgClass).toContain('blue')
  })

  it('should return green style for message_send', () => {
    const style = getActionIconStyle('message_send')
    expect(style.bgClass).toContain('green')
  })

  it('should return orange style for conversation_assign', () => {
    const style = getActionIconStyle('conversation_assign')
    expect(style.bgClass).toContain('orange')
  })

  it('should return purple style for settings_update', () => {
    const style = getActionIconStyle('settings_update')
    expect(style.bgClass).toContain('F2E8FB')
  })

  it('should return teal style for team actions', () => {
    const style = getActionIconStyle('team_invite')
    expect(style.bgClass).toContain('E6F7FA')
  })

  it('should return a default style for unknown actions', () => {
    const style = getActionIconStyle('unknown_action')
    expect(style.bgClass).toBeTruthy()
  })
})

describe('formatActivityDetails', () => {
  it('should format login details with IP and browser', () => {
    const details = {
      ipAddress: '192.168.1.1',
      userAgent: 'Chrome/122',
      userId: 'user-abc'
    }
    const entries = formatActivityDetails(details, 'user_login')
    expect(entries.length).toBeGreaterThan(0)
    expect(entries.some(e => e.key === 'IP Address')).toBe(true)
  })

  it('should format settings changes with old/new values', () => {
    const details = {
      setting: 'auto-reply',
      oldValue: 'disabled',
      newValue: 'enabled'
    }
    const entries = formatActivityDetails(details, 'settings_update')
    const oldEntry = entries.find(e => e.type === 'old-value')
    const newEntry = entries.find(e => e.type === 'new-value')
    expect(oldEntry).toBeTruthy()
    expect(newEntry).toBeTruthy()
  })

  it('should handle null/undefined details gracefully', () => {
    expect(formatActivityDetails(undefined, 'user_login')).toEqual([])
    expect(formatActivityDetails(null, 'user_login')).toEqual([])
  })

  it('should fall back to generic key-value for unknown structures', () => {
    const details = { foo: 'bar', baz: 123 }
    const entries = formatActivityDetails(details, 'unknown')
    expect(entries).toHaveLength(2)
  })
})

describe('getActivityDescription', () => {
  it('should return Chinese description for known actions', () => {
    const desc = getActivityDescription(makeActivity({ action: 'user_login' }))
    expect(desc).toContain('\u767b\u5165\u7cfb\u7d71')
  })

  it('should include resource info when available', () => {
    const desc = getActivityDescription(makeActivity({
      action: 'message_send',
      resourceType: 'conversation',
      resourceId: 'conv-123'
    }))
    expect(desc).toContain('conv-123')
  })
})

describe('getRoleLabel', () => {
  it('should map admin to Chinese label', () => {
    expect(getRoleLabel('admin')).toBe('\u7ba1\u7406\u54e1')
  })

  it('should return raw role for unknown roles', () => {
    expect(getRoleLabel('unknown')).toBe('unknown')
  })
})

describe('getRoleBadgeClasses', () => {
  it('should return blue classes for admin', () => {
    const classes = getRoleBadgeClasses('admin')
    expect(classes).toContain('blue')
  })

  it('should return green classes for agent', () => {
    const classes = getRoleBadgeClasses('agent')
    expect(classes).toContain('green')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && bunx vitest run src/components/activity/utils.test.ts`
Expected: FAIL — module `./utils` not found.

- [ ] **Step 3: Implement utility functions**

Create `frontend/src/components/activity/utils.ts`:

```typescript
import type { ActivityLog } from '@/api/activities'
import type { ActivityDateGroup, ActionIconStyle, DetailEntry } from './types'
import {
  LoginIcon, LogoutIcon, ChatIcon, UsersIcon, ForwardIcon,
  XIcon, RefreshIcon, CogIcon, UserPlusIcon, UserIcon, FileIcon
} from '@/components/icons'

// ── Date Grouping ──────────────────────────────────────────

export function groupActivitiesByDate(activities: ActivityLog[]): ActivityDateGroup[] {
  if (!activities.length) return []

  const now = new Date()
  const todayStr = toDateKey(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = toDateKey(yesterday)

  const groups = new Map<string, ActivityLog[]>()
  const groupOrder: string[] = []

  for (const activity of activities) {
    const dateKey = toDateKey(new Date(activity.createdAt))
    if (!groups.has(dateKey)) {
      groups.set(dateKey, [])
      groupOrder.push(dateKey)
    }
    groups.get(dateKey)!.push(activity)
  }

  return groupOrder.map(dateKey => ({
    date: dateKey,
    label: dateKey === todayStr
      ? '\u4eca\u5929'
      : dateKey === yesterdayStr
        ? '\u6628\u5929'
        : formatDateLabel(dateKey),
    activities: groups.get(dateKey)!
  }))
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })
}

// ── Icon Mapping ──────────────────────────────────────────

const ACTION_ICON_MAP: Record<string, ActionIconStyle> = {
  user_login: { bgClass: 'bg-blue-50', colorClass: 'text-[#007AFF]', icon: LoginIcon },
  user_logout: { bgClass: 'bg-blue-50', colorClass: 'text-[#007AFF]', icon: LogoutIcon },
  message_send: { bgClass: 'bg-green-50', colorClass: 'text-[#34C759]', icon: ChatIcon },
  message_recall: { bgClass: 'bg-green-50', colorClass: 'text-[#34C759]', icon: ChatIcon },
  conversation_assign: { bgClass: 'bg-orange-50', colorClass: 'text-[#FF9500]', icon: UsersIcon },
  conversation_transfer: { bgClass: 'bg-orange-50', colorClass: 'text-[#FF9500]', icon: ForwardIcon },
  conversation_close: { bgClass: 'bg-red-50', colorClass: 'text-[#FF3B30]', icon: XIcon },
  conversation_reopen: { bgClass: 'bg-red-50', colorClass: 'text-[#FF3B30]', icon: RefreshIcon },
  settings_update: { bgClass: 'bg-[#F2E8FB]', colorClass: 'text-[#AF52DE]', icon: CogIcon },
  team_invite: { bgClass: 'bg-[#E6F7FA]', colorClass: 'text-[#30B0C7]', icon: UserPlusIcon },
  team_member_update: { bgClass: 'bg-[#E6F7FA]', colorClass: 'text-[#30B0C7]', icon: UserPlusIcon },
  team_member_remove: { bgClass: 'bg-[#E6F7FA]', colorClass: 'text-[#30B0C7]', icon: UserPlusIcon },
  user_create: { bgClass: 'bg-red-50', colorClass: 'text-[#FF3B30]', icon: UserIcon },
  user_update: { bgClass: 'bg-red-50', colorClass: 'text-[#FF3B30]', icon: UserIcon },
  user_delete: { bgClass: 'bg-red-50', colorClass: 'text-[#FF3B30]', icon: UserIcon }
}

const DEFAULT_ICON_STYLE: ActionIconStyle = {
  bgClass: 'bg-gray-50',
  colorClass: 'text-gray-400',
  icon: FileIcon
}

export function getActionIconStyle(action: string): ActionIconStyle {
  return ACTION_ICON_MAP[action] || DEFAULT_ICON_STYLE
}

// ── Detail Formatting ──────────────────────────────────────

export function formatActivityDetails(
  details: Record<string, unknown> | null | undefined,
  action: string
): DetailEntry[] {
  if (!details) return []

  if (action === 'settings_update') {
    return formatSettingsDetails(details)
  }
  if (action === 'user_login' || action === 'user_logout') {
    return formatLoginDetails(details)
  }
  // Generic fallback
  return Object.entries(details).map(([key, value]) => ({
    key: humanizeKey(key),
    value: String(value ?? ''),
    type: 'default' as const
  }))
}

function formatSettingsDetails(details: Record<string, unknown>): DetailEntry[] {
  const entries: DetailEntry[] = []
  if (details.setting) {
    entries.push({ key: 'Setting', value: String(details.setting), type: 'default' })
  }
  if ('oldValue' in details) {
    entries.push({ key: 'Old Value', value: String(details.oldValue ?? ''), type: 'old-value' })
  }
  if ('newValue' in details) {
    entries.push({ key: 'New Value', value: String(details.newValue ?? ''), type: 'new-value' })
  }
  // Include any remaining fields
  for (const [key, value] of Object.entries(details)) {
    if (!['setting', 'oldValue', 'newValue'].includes(key)) {
      entries.push({ key: humanizeKey(key), value: String(value ?? ''), type: 'default' })
    }
  }
  return entries
}

function formatLoginDetails(details: Record<string, unknown>): DetailEntry[] {
  const entries: DetailEntry[] = []
  if (details.userId) entries.push({ key: 'User ID', value: String(details.userId), type: 'default' })
  if (details.ipAddress) entries.push({ key: 'IP Address', value: String(details.ipAddress), type: 'default' })
  if (details.userAgent) entries.push({ key: 'Browser', value: String(details.userAgent), type: 'default' })
  // Include remaining
  for (const [key, value] of Object.entries(details)) {
    if (!['userId', 'ipAddress', 'userAgent'].includes(key)) {
      entries.push({ key: humanizeKey(key), value: String(value ?? ''), type: 'default' })
    }
  }
  return entries
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim()
}

// ── Activity Description ──────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  conversation_assign: '\u6307\u6d3e\u4e86\u5c0d\u8a71',
  conversation_transfer: '\u8f49\u79fb\u4e86\u5c0d\u8a71',
  conversation_close: '\u95dc\u9589\u4e86\u5c0d\u8a71',
  conversation_reopen: '\u91cd\u65b0\u958b\u555f\u4e86\u5c0d\u8a71',
  message_send: '\u767c\u9001\u4e86\u8a0a\u606f',
  message_recall: '\u64a4\u56de\u4e86\u8a0a\u606f',
  user_login: '\u767b\u5165\u7cfb\u7d71',
  user_logout: '\u767b\u51fa\u7cfb\u7d71',
  user_create: '\u5275\u5efa\u4e86\u7528\u6236',
  user_update: '\u66f4\u65b0\u4e86\u7528\u6236\u8cc7\u8a0a',
  user_delete: '\u522a\u9664\u4e86\u7528\u6236',
  settings_update: '\u66f4\u65b0\u4e86\u7cfb\u7d71\u8a2d\u5b9a',
  team_invite: '\u9080\u8acb\u4e86\u5718\u968a\u6210\u54e1',
  team_member_update: '\u66f4\u65b0\u4e86\u5718\u968a\u6210\u54e1',
  team_member_remove: '\u79fb\u9664\u4e86\u5718\u968a\u6210\u54e1'
}

export function getActivityDescription(activity: ActivityLog): string {
  const label = ACTION_LABELS[activity.action] || activity.action
  const resourceInfo = activity.resourceId
    ? ` (${activity.resourceType}: ${activity.resourceId})`
    : ''
  return `${label}${resourceInfo}`
}

// ── Role Helpers ──────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin: '\u7ba1\u7406\u54e1',
  team: '\u5718\u968a\u7ba1\u7406\u54e1',
  agent: '\u5ba2\u670d'
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role
}

export function getRoleBadgeClasses(role: string): string {
  switch (role) {
    case 'admin': return 'bg-blue-50 text-[#007AFF]'
    case 'team': return 'bg-orange-50 text-[#FF9500]'
    case 'agent': return 'bg-green-50 text-[#34C759]'
    default: return 'bg-gray-100 text-gray-500'
  }
}
```

Note: The Chinese strings above are written as Unicode escapes to comply with the no-emoji rule and avoid encoding issues. They decode to the same Traditional Chinese text from the original component.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run src/components/activity/utils.test.ts`
Expected: All tests PASS. Adjust test assertions for actual Chinese string values (the test uses placeholder `'...'` — implementer must replace with actual expected strings).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/activity/utils.ts frontend/src/components/activity/utils.test.ts
git commit -m "feat(activity): add utility functions for date grouping, icon mapping, detail formatting"
```

---

## Task 3: Create ActivityDetailPanel component

**Files:**
- Create: `frontend/src/components/activity/ActivityDetailPanel.vue`
- Create: `frontend/src/components/activity/ActivityDetailPanel.test.ts`

- [ ] **Step 1: Write failing test**

Create `frontend/src/components/activity/ActivityDetailPanel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ActivityDetailPanel from './ActivityDetailPanel.vue'
import type { DetailEntry } from './types'

function makeEntries(): DetailEntry[] {
  return [
    { key: 'User ID', value: 'user-abc', type: 'default' },
    { key: 'IP Address', value: '192.168.1.1', type: 'default' }
  ]
}

describe('ActivityDetailPanel', () => {
  it('should render all detail entries', () => {
    const entries = makeEntries()
    const wrapper = mount(ActivityDetailPanel, {
      props: { entries, show: true }
    })
    expect(wrapper.findAll('.detail-entry')).toHaveLength(2)
  })

  it('should display key and value for each entry', () => {
    const wrapper = mount(ActivityDetailPanel, {
      props: { entries: makeEntries(), show: true }
    })
    expect(wrapper.text()).toContain('User ID')
    expect(wrapper.text()).toContain('user-abc')
  })

  it('should apply old-value styling for old values', () => {
    const entries: DetailEntry[] = [
      { key: 'Old Value', value: 'disabled', type: 'old-value' }
    ]
    const wrapper = mount(ActivityDetailPanel, {
      props: { entries, show: true }
    })
    const valueEl = wrapper.find('.detail-value--old')
    expect(valueEl.exists()).toBe(true)
  })

  it('should apply new-value styling for new values', () => {
    const entries: DetailEntry[] = [
      { key: 'New Value', value: 'enabled', type: 'new-value' }
    ]
    const wrapper = mount(ActivityDetailPanel, {
      props: { entries, show: true }
    })
    const valueEl = wrapper.find('.detail-value--new')
    expect(valueEl.exists()).toBe(true)
  })

  it('should not render content when show is false', () => {
    const wrapper = mount(ActivityDetailPanel, {
      props: { entries: makeEntries(), show: false }
    })
    expect(wrapper.findAll('.detail-entry')).toHaveLength(0)
  })

  it('should render empty when entries is empty', () => {
    const wrapper = mount(ActivityDetailPanel, {
      props: { entries: [], show: true }
    })
    expect(wrapper.findAll('.detail-entry')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bunx vitest run src/components/activity/ActivityDetailPanel.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement component**

Create `frontend/src/components/activity/ActivityDetailPanel.vue`:

```vue
<template>
  <Transition
    @enter="onEnter"
    @after-enter="onAfterEnter"
    @leave="onLeave"
  >
    <div
      v-if="show && entries.length > 0"
      class="detail-panel"
    >
      <div class="detail-panel__content">
        <div
          v-for="(entry, index) in entries"
          :key="index"
          class="detail-entry"
        >
          <span class="detail-key">{{ entry.key }}</span>
          <span
            :class="[
              'detail-value',
              entry.type === 'old-value' && 'detail-value--old',
              entry.type === 'new-value' && 'detail-value--new'
            ]"
          >
            {{ entry.value }}
          </span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { DetailEntry } from './types'

defineProps<{
  entries: DetailEntry[]
  show: boolean
}>()

function onEnter(el: Element) {
  const htmlEl = el as HTMLElement
  htmlEl.style.maxHeight = '0'
  htmlEl.style.opacity = '0'
  htmlEl.style.overflow = 'hidden'
  // Force reflow
  void htmlEl.offsetHeight
  htmlEl.style.transition = 'max-height 0.3s ease-out, opacity 0.25s ease-out'
  htmlEl.style.maxHeight = htmlEl.scrollHeight + 'px'
  htmlEl.style.opacity = '1'
}

function onAfterEnter(el: Element) {
  const htmlEl = el as HTMLElement
  htmlEl.style.maxHeight = ''
  htmlEl.style.overflow = ''
  htmlEl.style.transition = ''
}

function onLeave(el: Element) {
  const htmlEl = el as HTMLElement
  htmlEl.style.maxHeight = htmlEl.scrollHeight + 'px'
  htmlEl.style.overflow = 'hidden'
  void htmlEl.offsetHeight
  htmlEl.style.transition = 'max-height 0.3s ease-out, opacity 0.25s ease-out'
  htmlEl.style.maxHeight = '0'
  htmlEl.style.opacity = '0'
}
</script>

<style scoped>
.detail-panel {
  margin-top: 8px;
}

.detail-panel__content {
  background: #F2F2F7;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-entry {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-key {
  font-size: 12px;
  color: #8E8E93;
  width: 96px;
  flex-shrink: 0;
}

.detail-value {
  font-size: 12px;
  color: #1C1C1E;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
}

.detail-value--old {
  color: #FF3B30;
  text-decoration: line-through;
}

.detail-value--new {
  color: #34C759;
  font-weight: 500;
}
</style>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run src/components/activity/ActivityDetailPanel.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/activity/ActivityDetailPanel.vue frontend/src/components/activity/ActivityDetailPanel.test.ts
git commit -m "feat(activity): add ActivityDetailPanel with expand animation and value formatting"
```

---

## Task 4: Create ActivityTimelineItem component

**Files:**
- Create: `frontend/src/components/activity/ActivityTimelineItem.vue`
- Create: `frontend/src/components/activity/ActivityTimelineItem.test.ts`

- [ ] **Step 1: Write failing test**

Create `frontend/src/components/activity/ActivityTimelineItem.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ActivityLog } from '@/api/activities'

// Mock icons
vi.mock('@/components/icons', () => ({
  LoginIcon: { template: '<svg data-testid="login-icon" />' },
  LogoutIcon: { template: '<svg data-testid="logout-icon" />' },
  ChatIcon: { template: '<svg data-testid="chat-icon" />' },
  UsersIcon: { template: '<svg />' },
  ForwardIcon: { template: '<svg />' },
  XIcon: { template: '<svg />' },
  RefreshIcon: { template: '<svg />' },
  CogIcon: { template: '<svg />' },
  UserPlusIcon: { template: '<svg />' },
  UserIcon: { template: '<svg />' },
  FileIcon: { template: '<svg />' }
}))

import ActivityTimelineItem from './ActivityTimelineItem.vue'

function makeActivity(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: 1,
    userId: 'user-1',
    userName: 'Test User',
    userRole: 'admin',
    action: 'user_login',
    resourceType: 'user',
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

describe('ActivityTimelineItem', () => {
  it('should render user name', () => {
    const wrapper = mount(ActivityTimelineItem, {
      props: { activity: makeActivity({ userName: 'Alice' }) }
    })
    expect(wrapper.text()).toContain('Alice')
  })

  it('should render role badge', () => {
    const wrapper = mount(ActivityTimelineItem, {
      props: { activity: makeActivity({ userRole: 'admin' }) }
    })
    expect(wrapper.find('.timeline-item__role').exists()).toBe(true)
  })

  it('should render activity description', () => {
    const wrapper = mount(ActivityTimelineItem, {
      props: { activity: makeActivity({ action: 'user_login' }) }
    })
    // Description should contain the action text
    expect(wrapper.find('.timeline-item__description').exists()).toBe(true)
  })

  it('should show "Show Details" button when activity has details', () => {
    const wrapper = mount(ActivityTimelineItem, {
      props: { activity: makeActivity({ details: { ip: '1.2.3.4' } }) }
    })
    expect(wrapper.find('.timeline-item__details-toggle').exists()).toBe(true)
  })

  it('should not show "Show Details" when no details', () => {
    const wrapper = mount(ActivityTimelineItem, {
      props: { activity: makeActivity({ details: undefined }) }
    })
    expect(wrapper.find('.timeline-item__details-toggle').exists()).toBe(false)
  })

  it('should toggle detail panel on click', async () => {
    const wrapper = mount(ActivityTimelineItem, {
      props: { activity: makeActivity({ details: { ip: '1.2.3.4' } }) }
    })
    const toggle = wrapper.find('.timeline-item__details-toggle')
    await toggle.trigger('click')
    // After click, the panel should appear
    expect(wrapper.find('.detail-panel').exists()).toBe(true)
  })

  it('should apply correct icon background for message actions', () => {
    const wrapper = mount(ActivityTimelineItem, {
      props: { activity: makeActivity({ action: 'message_send' }) }
    })
    const iconContainer = wrapper.find('.timeline-item__icon')
    expect(iconContainer.classes().join(' ')).toContain('green')
  })

  it('should render relative time', () => {
    const wrapper = mount(ActivityTimelineItem, {
      props: { activity: makeActivity() }
    })
    expect(wrapper.find('.timeline-item__time').exists()).toBe(true)
  })

  it('should set aria-expanded on details toggle', async () => {
    const wrapper = mount(ActivityTimelineItem, {
      props: { activity: makeActivity({ details: { ip: '1.2.3.4' } }) }
    })
    const toggle = wrapper.find('.timeline-item__details-toggle')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
  })

  it('should have aria-label on role badge', () => {
    const wrapper = mount(ActivityTimelineItem, {
      props: { activity: makeActivity({ userRole: 'admin' }) }
    })
    const badge = wrapper.find('.timeline-item__role')
    expect(badge.attributes('aria-label')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bunx vitest run src/components/activity/ActivityTimelineItem.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement component**

Create `frontend/src/components/activity/ActivityTimelineItem.vue`. This component renders a single activity row with color-coded icon, user info, description, relative time, and expandable detail panel. Uses `getActionIconStyle`, `getActivityDescription`, `getRoleLabel`, `getRoleBadgeClasses`, and `formatActivityDetails` from `./utils`. Uses `ActivityDetailPanel` for the expandable section. Scoped CSS following iOS design system: no hard borders, 40x40 rounded-xl icon container, capsule role badge, hover state `#F9F9FB`.

Key implementation details:
- Props: `{ activity: ActivityLog }`
- Local state: `detailsExpanded: ref(false)`
- Computed: icon style from `getActionIconStyle(activity.action)`, description from `getActivityDescription(activity)`, role label/classes from role helpers, formatted details from `formatActivityDetails`
- Relative time formatting reused from the existing `formatTime` logic in current `ActivityLog.vue` (lines 554-574)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run src/components/activity/ActivityTimelineItem.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/activity/ActivityTimelineItem.vue frontend/src/components/activity/ActivityTimelineItem.test.ts
git commit -m "feat(activity): add ActivityTimelineItem with color-coded icons and detail toggle"
```

---

## Task 5: Create ActivityTimeline component

**Files:**
- Create: `frontend/src/components/activity/ActivityTimeline.vue`
- Create: `frontend/src/components/activity/ActivityTimeline.test.ts`

- [ ] **Step 1: Write failing test**

Test that the component groups activities by date, renders date headers, and renders `ActivityTimelineItem` for each activity. Tests should verify:
- Date group headers appear (`.timeline__date-header`)
- Correct number of items rendered
- Empty list renders nothing
- Dividers between items within same date group

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bunx vitest run src/components/activity/ActivityTimeline.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement component**

Create `frontend/src/components/activity/ActivityTimeline.vue`. Container is `bg-white rounded-2xl shadow-[0_4px_16px_rgb(0,0,0,0.06)] overflow-hidden`. Uses `groupActivitiesByDate` to create date groups. Each group has a sticky header (`bg-[#F2F2F7] px-5 py-2.5`, `text-xs font-semibold text-[#8E8E93] uppercase tracking-wider`). Renders `ActivityTimelineItem` for each activity. Dividers use `border-gray-100` with `margin-left: 68px` indent.

Props: `{ activities: ActivityLog[] }`

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && bunx vitest run src/components/activity/ActivityTimeline.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/activity/ActivityTimeline.vue frontend/src/components/activity/ActivityTimeline.test.ts
git commit -m "feat(activity): add ActivityTimeline with date-grouped sections"
```

---

## Task 6: Create ActivityStatsCards component

**Files:**
- Create: `frontend/src/components/activity/ActivityStatsCards.vue`
- Create: `frontend/src/components/activity/ActivityStatsCards.test.ts`

- [ ] **Step 1: Write failing test**

Test:
- Renders 4 stat cards when data provided
- Shows skeleton loading state when `loading=true`
- Hides entirely when `overview` is null (non-admin / error)
- Displays correct values from `ActivityOverview` data
- Hover effect class exists on cards

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement component**

Props: `{ overview: ActivityOverview | null, loading: boolean }`

Four cards in `grid grid-cols-4 gap-4`. Each card: `bg-white rounded-2xl shadow-[0_4px_16px_rgb(0,0,0,0.06)] p-5` with hover `translateY(-2px)` + elevated shadow. When `loading=true`, show shimmer skeleton placeholders. When `overview` is null, render nothing (the parent hides the section).

Card data derived from props:
1. Total Activities → `overview.totalActivities`
2. Top Users → `overview.topUsers.length`
3. Top Action → find max entry in `overview.actionStats`
4. Logins → `overview.actionStats.user_login || 0`

Icons per card (note: stat card icons use their OWN colors, independent of the timeline icon map in `utils.ts`):
1. Total Activities: FileIcon, bg `bg-blue-50`, color `#007AFF`
2. Top Users: UsersIcon, bg `bg-green-50`, color `#34C759`
3. Top Action: BarChartIcon, bg `bg-orange-50`, color `#FF9500`
4. Logins: LoginIcon, bg `bg-[#F2E8FB]`, color `#AF52DE` (purple — overrides LoginIcon's default blue)

The card component hardcodes each card's icon color directly — it does NOT use `getActionIconStyle()` from utils.

Responsive: `lg:grid-cols-4 md:grid-cols-2 grid-cols-1`

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/activity/ActivityStatsCards.vue frontend/src/components/activity/ActivityStatsCards.test.ts
git commit -m "feat(activity): add ActivityStatsCards with skeleton loading and responsive grid"
```

---

## Task 7: Create ActivityFilterPills component

**Files:**
- Create: `frontend/src/components/activity/ActivityFilterPills.vue`
- Create: `frontend/src/components/activity/ActivityFilterPills.test.ts`

- [ ] **Step 1: Write failing test**

Test:
- Renders 4 filter selects
- Emits `update:filters` when a select changes
- Applies active class when filter value is non-default
- Shows "Clear Filters" link only when at least one filter is active
- Emits `clear` when clear link clicked
- Shows custom date range inputs when date range is "custom"

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement component**

Props:
```typescript
{
  filters: { userId: string, action: string, resourceType: string }
  dateRange: string
  customDateRange: { start: string, end: string }
  users: Array<{ id: string, name: string, role: string }>
}
```

Emits: `update:filters`, `update:dateRange`, `update:customDateRange`, `clear`, `apply`

Capsule-styled `<select>` elements with `appearance: none`, custom chevron SVG via CSS `background-image`. Active state: `bg-[#007AFF] text-white`. Inactive: `bg-gray-100 text-gray-600`. All `rounded-full px-4 py-2.5`.

Custom date range section: appears with `v-if="dateRange === 'custom'"` in a `bg-white rounded-2xl shadow p-4` card below the pills.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/activity/ActivityFilterPills.vue frontend/src/components/activity/ActivityFilterPills.test.ts
git commit -m "feat(activity): add ActivityFilterPills with capsule selects and active state"
```

---

## Task 8: Create ActivityPagination and ActivityEmptyState

**Files:**
- Create: `frontend/src/components/activity/ActivityPagination.vue`
- Create: `frontend/src/components/activity/ActivityPagination.test.ts`
- Create: `frontend/src/components/activity/ActivityEmptyState.vue`
- Create: `frontend/src/components/activity/ActivityEmptyState.test.ts`

- [ ] **Step 1: Write tests for both components**

**ActivityPagination tests:**
- Renders page info text
- Prev button disabled on page 1
- Next button disabled on last page
- Emits `page-change` with correct page number on click

**ActivityEmptyState tests:**
- Renders loading spinner when `variant="loading"`
- Renders empty icon + message when `variant="empty"`
- Renders error message when `variant="error"`

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement both components**

**ActivityPagination.vue:**
Props: `{ currentPage: number, totalPages: number, totalRecords: number, loading: boolean }`
Emits: `page-change`
Container: `bg-[#F2F2F7] px-5 py-3.5`. Capsule buttons `rounded-full bg-white shadow-[0_2px_8px_rgb(0,0,0,0.04)]`. Disabled: `opacity-50 cursor-not-allowed`.

**ActivityEmptyState.vue:**
Props: `{ variant: 'loading' | 'empty' | 'error', message?: string }`
Container: `bg-white rounded-2xl shadow-[0_4px_16px_rgb(0,0,0,0.06)] p-12 text-center`.
Loading: spinner + text. Empty: ClockIcon 48px + title + subtitle. Error: red-tinted.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/activity/ActivityPagination.vue frontend/src/components/activity/ActivityPagination.test.ts frontend/src/components/activity/ActivityEmptyState.vue frontend/src/components/activity/ActivityEmptyState.test.ts
git commit -m "feat(activity): add ActivityPagination and ActivityEmptyState components"
```

---

## Task 9: Rewrite ActivityLog.vue page orchestrator

**Files:**
- Rewrite: `frontend/src/views/ActivityLog.vue`

- [ ] **Step 1: Rewrite the page component**

The new `ActivityLog.vue` becomes a thin orchestrator (~200 lines instead of 1127):

**Template structure:**
```
AppLayout
  div.activity-log (max-w-[1200px] mx-auto px-6 py-8)
    Header (title + subtitle + Export/Refresh buttons)
    ActivityStatsCards (v-if="isAdmin", :overview, :loading)
    ActivityFilterPills (:filters, :dateRange, :customDateRange, :users, @update, @clear, @apply)
    ActivityEmptyState (v-if="loading", variant="loading")
    ActivityTimeline (v-else-if="activities.length > 0", :activities)
    ActivityEmptyState (v-else, variant="empty")
    ActivityPagination (v-if="activities.length > 0", :currentPage, :totalPages, :totalRecords, @page-change)
    Error toast (v-if="error")
```

**Script setup:** Reuse existing logic from current `ActivityLog.vue` (lines 274-654) — the filter state, pagination, date helpers. Required changes:
1. Remove inline icon placeholders (lines 287-291) — icons now in sub-components
2. Remove `getActivityIcon`, `getActivityDescription`, `getRoleLabel`, `formatTime` — moved to utils
3. Remove `toggleDetails`, `expandedDetails` — now in `ActivityTimelineItem`
4. **Fix URL violation:** Replace the hardcoded `import.meta.env` URL in `exportActivities()` (line 596) with `activitiesApi.export(filters)` which already uses `getBackendUrl()`. The current code violates the project rule "never hardcode URLs."
5. **Add stats overview call:** Add new state `const overview = ref<ActivityOverview | null>(null)` and `const overviewLoading = ref(false)`. In `onMounted` and `refreshData`, call `activitiesApi.getOverview(getDaysFromDateRange())` wrapped in try/catch — on error, set `overview.value = null` (stats cards will hide). Only call if `isAdmin.value` is true.
6. Import and wire all sub-components
7. Import `activitiesApi` from `@/api/activities` (replace the raw `apiClient.get` calls)

**Style:** Minimal scoped CSS — just the page container spacing. Sub-components handle their own styles.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && bunx vue-tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Verify ESLint passes**

Run: `cd frontend && bunx eslint src/views/ActivityLog.vue`
Expected: No lint errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/ActivityLog.vue
git commit -m "feat(activity): rewrite ActivityLog page with sub-components and design system compliance"
```

---

## Task 10: Integration verification and cleanup

- [ ] **Step 1: Run ALL activity component tests**

Run: `cd frontend && bunx vitest run src/components/activity/`
Expected: All tests PASS.

- [ ] **Step 2: Run full frontend test suite**

Run: `cd frontend && bun run test`
Expected: No regressions. If existing tests reference old `ActivityLog.vue` structure, update them.

- [ ] **Step 3: Run full type check**

Run: `cd frontend && bun run type-check`
Expected: No type errors.

- [ ] **Step 4: Run ESLint**

Run: `cd frontend && bun run lint`
Expected: No lint errors.

- [ ] **Step 5: Visual verification**

Run: `cd frontend && bun run dev`
Open `http://localhost:5173/activities` in browser. Verify:
- [ ] Stats cards load and display overview data (admin only)
- [ ] Filter pills render as capsules, active filter shows blue
- [ ] Timeline groups activities by date with sticky headers
- [ ] Each action type has correct color-coded icon
- [ ] "Show Details" expands with smooth animation
- [ ] Settings details show old/new value formatting
- [ ] Pagination works (prev/next)
- [ ] Export CSV works
- [ ] Refresh reloads data
- [ ] Empty state shows correctly when no results
- [ ] Page background is `#F2F2F7`, cards are white with soft shadows
- [ ] No hard 1px borders anywhere
- [ ] Responsive: resize to tablet/mobile widths

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore(activity): final integration fixes and cleanup"
```
