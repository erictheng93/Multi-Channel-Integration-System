# Auto-Reply Frontend Settings Page — Design Spec

**Date:** 2026-03-14
**Status:** Approved

## Summary

Build a standalone frontend page (`/auto-reply`) for managing auto-reply rules, business hours schedules, and viewing execution logs. Backend API already exists at`src/modules/auto-reply/`.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Page structure | Dashboard + Tabs Hybrid | Stats cards for instant visibility, tabs keep sections focused |
| Rule editor | Inline Expand | Cards expand in-place, keeps context visible |
| Access control | All users | Not admin-only; placed in base nav items |
| Nav position | After Customer Tags | Before Reports, in base items section |

## Page Layout

### Stats Bar (top)
4 stat cards: Active Rules count, Today's Replies count, Current Business Hours status, Reply Success Rate.

Stats are computed client-side from existing API data (rules list for active count, logs for today's count + success rate, schedules for business hours status).

### Tab 1: Rules Management
- Toolbar: search input + trigger type filter dropdown + "New Rule" button
- Rule list: vertical stack of`RuleCard` components
- Each card shows: drag handle, active toggle, name, trigger type badge, priority, condition/action count, expand arrow
- Expanded card shows inline editor: name, trigger type select, priority input, conditions (tag-style with add form), actions (cards with add form), save/cancel/delete buttons
- New rule: clicking "New Rule" inserts an expanded empty card at top

### Tab 2: Business Hours
- Timezone selector + Save button at top
- 7-row grid: day name, start time input, end time input, active toggle
- Disabled days show grayed-out inputs
- Save does bulk upsert (replaces all schedules for team)

### Tab 3: Execution Logs
- Toolbar: search input + rule filter + platform filter
- Table columns: time, rule (badge + name), trigger content, response content, platform, reply method
- Pagination at bottom
- Read-only, no edit actions

## Backend API Mapping

| Frontend Action | API Endpoint | Method |
|----------------|-------------|--------|
| List rules |`/api/auto-reply/rules?teamId=X&page=N&pageSize=N` | GET |
| Create rule |`/api/auto-reply/rules?teamId=X` | POST |
| Update rule |`/api/auto-reply/rules/:id` | PUT |
| Delete rule |`/api/auto-reply/rules/:id` | DELETE |
| Get schedules |`/api/auto-reply/schedules?teamId=X` | GET |
| Save schedules |`/api/auto-reply/schedules?teamId=X` | POST |
| List logs |`/api/auto-reply/logs?teamId=X&page=N&ruleId=N&platform=X` | GET |

## File Structure

```
frontend/src/
  views/AutoReply.vue # Main page (AppLayout + stats + tabs)
  api/autoReply.ts # API client
  stores/autoReply.ts # Pinia store
  composables/autoReply/
    useAutoReplyController.ts # Main controller
    useRuleEditor.ts # Rule expand/collapse/edit logic
    useScheduleEditor.ts # Schedule edit logic
  components/auto-reply/
    AutoReplyStats.vue # Stats cards
    RuleList.vue # Rule list container
    RuleCard.vue # Single rule (collapsed/expanded)
    RuleEditor.vue # Expanded editor area
    ConditionEditor.vue # Condition tags + add form
    ActionEditor.vue # Action cards + add form
    ScheduleGrid.vue # Business hours grid
    LogTable.vue # Log table + filters + pagination
  components/icons/AutoReplyIcon.vue # Sidebar icon
  router/index.ts # Add /auto-reply route
  components/ui/SidebarNav.vue # Add nav item
```

## Types (Frontend)

```typescript
// Trigger types
type TriggerType = 'welcome' | 'keyword' | 'off_hours' | 'fallback'
type ConditionType = 'exact' | 'contains' | 'regex' | 'message_type'
type MatchMode = 'any' | 'all'
type ActionType = 'reply_text' | 'reply_image' | 'reply_flex'

// Rule with relations
interface AutoReplyRule {
  id: number
  teamId: number
  name: string
  triggerType: TriggerType
  priority: number
  isActive: boolean
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
  conditions: AutoReplyCondition[]
  actions: AutoReplyAction[]
}

interface AutoReplyCondition {
  id: number
  conditionType: ConditionType
  value: string
  caseSensitive: boolean
  matchMode: MatchMode
}

interface AutoReplyAction {
  id: number
  actionType: ActionType
  content: string // JSON string
  sortOrder: number
}

interface AutoReplySchedule {
  id: number
  teamId: number
  dayOfWeek: number // 0-6
  startTime: string // HH:mm
  endTime: string // HH:mm
  timezone: string
  isActive: boolean
}

interface AutoReplyLog {
  id: number
  rule_id: number | null
  rule_name: string
  conversation_id: string
  customer_id: number
  trigger_content: string
  response_content: string
  matched_condition: string
  platform: 'line' | 'facebook'
  reply_method: 'reply_api' | 'push_api'
  created_at: string
}
```
