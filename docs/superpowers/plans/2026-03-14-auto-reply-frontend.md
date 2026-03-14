# Auto-Reply Frontend Settings Page — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone`/auto-reply` page with Dashboard+Tabs layout, inline-expand rule editor, business hours grid, and log table.

**Architecture:** Single route`/auto-reply` with`AutoReply.vue` as main view containing stats cards + 3 tab panels. Uses existing patterns: Pinia store, apiClient, composable controllers, custom components.

**Tech Stack:** Vue 3 Composition API, Pinia, TypeScript strict, Tailwind CSS + CSS variables, Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
|`frontend/src/api/autoReply.ts` | API client — rules CRUD, schedules bulk upsert, logs list |
|`frontend/src/stores/autoReply.ts` | Pinia store — rules[], schedules[], logs[], loading/error state |
|`frontend/src/composables/autoReply/useAutoReplyController.ts` | Main controller — orchestrates sub-composables, init/cleanup |
|`frontend/src/composables/autoReply/useRuleEditor.ts` | Rule expand/collapse, form state, save/delete actions |
|`frontend/src/composables/autoReply/useScheduleEditor.ts` | Schedule grid state, save action |
|`frontend/src/views/AutoReply.vue` | Main page — AppLayout + stats + tabs |
|`frontend/src/components/auto-reply/AutoReplyStats.vue` | 4 stat cards |
|`frontend/src/components/auto-reply/RuleList.vue` | Rule list container + toolbar + new rule |
|`frontend/src/components/auto-reply/RuleCard.vue` | Single rule card (collapsed/expanded) |
|`frontend/src/components/auto-reply/RuleEditor.vue` | Expanded inline editor |
|`frontend/src/components/auto-reply/ConditionEditor.vue` | Condition tags + add form |
|`frontend/src/components/auto-reply/ActionEditor.vue` | Action cards + add form |
|`frontend/src/components/auto-reply/ScheduleGrid.vue` | 7-day business hours grid |
|`frontend/src/components/auto-reply/LogTable.vue` | Log table + filters + pagination |
|`frontend/src/components/icons/AutoReplyIcon.vue` | Sidebar nav icon |
|`frontend/src/router/index.ts` | Add`/auto-reply` route (line ~181) |
|`frontend/src/components/ui/SidebarNav.vue` | Add nav item to baseNavigationItems (line ~93) |

---

## Chunk 1: Foundation (API + Store + Types)

### Task 1: API Client

**Files:**
- Create:`frontend/src/api/autoReply.ts`

### Task 2: Pinia Store

**Files:**
- Create:`frontend/src/stores/autoReply.ts`

### Task 3: Icon + Route + Sidebar

**Files:**
- Create:`frontend/src/components/icons/AutoReplyIcon.vue`
- Modify:`frontend/src/router/index.ts:181` (add route after CustomerTags)
- Modify:`frontend/src/components/ui/SidebarNav.vue:90-93` (add nav item)

---

## Chunk 2: Composables

### Task 4: useRuleEditor composable

**Files:**
- Create:`frontend/src/composables/autoReply/useRuleEditor.ts`

### Task 5: useScheduleEditor composable

**Files:**
- Create:`frontend/src/composables/autoReply/useScheduleEditor.ts`

### Task 6: useAutoReplyController composable

**Files:**
- Create:`frontend/src/composables/autoReply/useAutoReplyController.ts`

---

## Chunk 3: Components

### Task 7: AutoReplyStats, ConditionEditor, ActionEditor

**Files:**
- Create:`frontend/src/components/auto-reply/AutoReplyStats.vue`
- Create:`frontend/src/components/auto-reply/ConditionEditor.vue`
- Create:`frontend/src/components/auto-reply/ActionEditor.vue`

### Task 8: RuleEditor, RuleCard, RuleList

**Files:**
- Create:`frontend/src/components/auto-reply/RuleEditor.vue`
- Create:`frontend/src/components/auto-reply/RuleCard.vue`
- Create:`frontend/src/components/auto-reply/RuleList.vue`

### Task 9: ScheduleGrid, LogTable

**Files:**
- Create:`frontend/src/components/auto-reply/ScheduleGrid.vue`
- Create:`frontend/src/components/auto-reply/LogTable.vue`

### Task 10: Main View

**Files:**
- Create:`frontend/src/views/AutoReply.vue`
