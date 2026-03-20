# Activity Log Page Redesign

**Date:** 2026-03-20
**Status:** Approved
**Approach:** Stats Dashboard + Date-Grouped Timeline (Approach A)

## Summary

Complete redesign of the Activity Log page (`frontend/src/views/ActivityLog.vue`) to follow the Apple-Native Soft Minimalism design system. The current page uses generic CSS variables, hard 1px borders, raw dropdown selects, and unformatted JSON details. The redesign introduces stats overview cards, capsule filter pills, color-coded action icons, date-grouped timeline, and formatted detail panels.

## Design System Compliance

All elements follow `docs/UIUX-Design-System.md`:
- Page background: `#F2F2F7` (iOS system gray)
- Cards: white + `rounded-2xl` + `shadow-[0_4px_16px_rgb(0,0,0,0.06)]`
- No hard 1px borders — shadow + background color difference only
- Buttons/tags: capsule shape (`rounded-full`)
- Text: `#1C1C1E` primary, `#8E8E93` secondary (never pure black)
- Animations: 200-350ms, ease-out

## Architecture

### Component Structure

The monolithic `ActivityLog.vue` will be refactored into focused sub-components:

```
ActivityLog.vue (page container)
  +-- ActivityStatsCards.vue        (4 stat overview cards)
  +-- ActivityFilterPills.vue       (capsule filter row)
  +-- ActivityTimeline.vue          (main timeline list)
  |     +-- ActivityTimelineItem.vue  (single activity row)
  |     +-- ActivityDetailPanel.vue   (expandable detail view)
  +-- ActivityPagination.vue        (capsule pagination)
  +-- ActivityEmptyState.vue        (empty/loading/error states)
```

### Data Flow

```
ActivityLog.vue
  |-- calls activitiesApi.getOverview() --> ActivityStatsCards (stats data)
  |-- calls activitiesApi.list(filters) --> ActivityTimeline (activities list)
  |-- manages filter state            --> ActivityFilterPills (two-way binding)
  |-- manages pagination state        --> ActivityPagination (page navigation)
```

## Section 1: Page Header

- Title: `text-3xl font-bold text-[#1C1C1E]` (34px — matches design system page title spec)
- Subtitle: `text-sm text-[#8E8E93]`
- Two action buttons (Export, Refresh): capsule ghost buttons `rounded-full bg-white shadow-[0_2px_8px_rgb(0,0,0,0.04)]`
- "Clear Filters" button removed from header — moved inline with filter pills
- Header sits directly on `#F2F2F7` page background (no card wrapper)

## Section 2: Stats Overview Cards (NEW)

Four cards in a `grid grid-cols-4 gap-4` row. Each card:
- Container: `bg-white rounded-2xl shadow-[0_4px_16px_rgb(0,0,0,0.06)] p-5`
- Hover: `translateY(-2px)` + `shadow-[0_8px_30px_rgb(0,0,0,0.08)]`
- Icon: 40x40 `rounded-xl` with pastel background + matching icon color
- Label: `text-xs font-medium text-[#8E8E93]`
- Value: `text-2xl font-bold text-[#1C1C1E]`
- Period: `text-xs text-[#AEAEB2]`

| Card | Icon BG | Icon Color | Data Source |
|------|---------|------------|-------------|
| Total Activities | `bg-blue-50` | `#007AFF` | `overview.totalActivities` |
| Top Users | `bg-green-50` | `#34C759` | `overview.topUsers.length` (top N most active users) |
| Top Action | `bg-orange-50` | `#FF9500` | Highest from `overview.actionStats` |
| Logins | `bg-[#F2E8FB]` | `#AF52DE` | `overview.actionStats.user_login` |

**API:** `activitiesApi.getOverview(days)` — already exists, currently unused.

**Stats card loading/error handling:**
- While loading: show skeleton placeholders (shimmer animation) in each card
- If `getOverview()` fails (network error, 403): hide the stats row entirely — do not show broken cards
- Note: `getOverview()` is admin-only. For non-admin users, skip the API call and hide the stats row.

## Section 3: Filter Pills

Row of capsule-styled `<select>` elements:
- Inactive: `bg-gray-100 text-gray-600 rounded-full px-4 py-2.5`
- Active (filtered): `bg-[#007AFF] text-white rounded-full px-4 py-2.5`
- Custom chevron SVG via `background-image` (CSS appearance: none)
- "Clear Filters" text link: `text-[#007AFF]` — shown only when any filter is active

Filters (same as current, restyled):
1. User filter — `<select>` with all team members
2. Action type — `<select>` with action categories
3. Resource type — `<select>` with resource categories
4. Date range — `<select>` with today/week/month/custom

Custom date range: slides open below filters in a `bg-white rounded-2xl shadow-[0_4px_16px_rgb(0,0,0,0.06)] p-4` card with `rounded-xl bg-[#F2F2F7]` date inputs.

## Section 4: Activity Timeline

Container: `bg-white rounded-2xl shadow-[0_4px_16px_rgb(0,0,0,0.06)] overflow-hidden`

### Date Group Headers
- Background: `bg-[#F2F2F7]`
- Text: `text-xs font-semibold text-[#8E8E93] uppercase tracking-wider`
- Labels: "Today", "Yesterday", or formatted date ("March 18")
- Sticky positioning within scroll

### Activity Items
- Layout: `flex items-start gap-4 px-5 py-4`
- Hover: `bg-[#F9F9FB]` with 200ms transition
- Separator: `border-gray-100` with left indent at 68px (past icon)

**Icon color-coding:**

| Action Category | Icon BG | Icon Color | Icon |
|----------------|---------|------------|------|
| user_login/logout | `bg-blue-50` | `#007AFF` | **New: LoginIcon** (must add to icons/index.ts) |
| message_send/recall | `bg-green-50` | `#34C759` | ChatIcon (existing) |
| conversation_assign | `bg-orange-50` | `#FF9500` | UsersIcon (existing) |
| conversation_transfer | `bg-orange-50` | `#FF9500` | ForwardIcon (existing) |
| conversation_close/reopen | `bg-red-50` | `#FF3B30` | XIcon / RefreshIcon (existing) |
| settings_update | `bg-[#F2E8FB]` | `#AF52DE` | CogIcon (existing) |
| team_* | `bg-[#E6F7FA]` | `#30B0C7` | UserPlusIcon (existing) |
| user_create/update/delete | `bg-red-50` | `#FF3B30` | UserIcon (existing) |

Icon container: `w-10 h-10 rounded-xl flex items-center justify-center`

**Item content:**
- User name: `text-sm font-semibold text-[#1C1C1E]`
- Role badge: `px-2 py-0.5 rounded-full text-[11px] font-medium` with pastel bg matching role
- Timestamp: `text-xs text-[#8E8E93] ml-auto`
- Description: `text-sm text-gray-600`
- "Show Details" link: `text-xs text-[#007AFF] font-medium`

### Detail Panel (Expanded)

Replaces raw `JSON.stringify()` with formatted key-value display:
- Container: `bg-[#F2F2F7] rounded-xl p-4`
- Animation: Use Vue `<Transition>` with JS hooks — on `enter`, read `el.scrollHeight` and set `max-height` dynamically; on `leave`, animate back to 0. Duration 300ms ease-out. This avoids the hardcoded `max-height` problem with CSS-only transitions on dynamic content.
- Keys: `text-xs text-[#8E8E93]` with fixed width
- Values: `text-xs text-[#1C1C1E] font-mono`
- Settings changes: old value in `text-red-500 line-through`, new value in `text-green-500 font-medium`

**Detail formatting logic:** Parse `activity.details` object and render as key-value rows. Special handling for:
- Settings changes: show old/new value comparison
- Login events: show IP, user agent, browser
- Conversation events: show conversation ID, customer info
- Fallback: generic key-value pairs for unknown detail structures

## Section 5: Pagination

- Container: `bg-[#F2F2F7] px-5 py-3.5` at bottom of timeline card
- Info text: `text-sm text-[#8E8E93]` — "Page 1 of 5 (156 records)"
- Buttons: capsule `rounded-full bg-white shadow-[0_2px_8px_rgb(0,0,0,0.04)]`
- Disabled state: `opacity-50 cursor-not-allowed`

## Section 6: Empty / Loading / Error States

All states render inside a `bg-white rounded-2xl shadow-[0_4px_16px_rgb(0,0,0,0.06)] p-12 text-center` card.

- **Loading:** iOS-style spinner in `#007AFF` + "Loading activities..." text
- **Empty:** ClockIcon (48px, `text-[#AEAEB2]`) + title + subtitle
- **Error:** Red-tinted card `bg-red-50 text-[#FF3B30]` with error message

## Date Grouping Logic

New utility function `groupActivitiesByDate(activities)`:
1. Compare activity date to today → locale-aware label (zh-TW: "...", en: "Today")
2. Compare to yesterday → locale-aware label
3. Otherwise → `date.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })` — e.g., "3/18"

Use the same locale detection as the existing `formatTime()` function in the current component.

## Files to Create/Modify

| Action | Path |
|--------|------|
| Rewrite | `frontend/src/views/ActivityLog.vue` |
| Create | `frontend/src/components/activity/ActivityStatsCards.vue` |
| Create | `frontend/src/components/activity/ActivityFilterPills.vue` |
| Create | `frontend/src/components/activity/ActivityTimeline.vue` |
| Create | `frontend/src/components/activity/ActivityTimelineItem.vue` |
| Create | `frontend/src/components/activity/ActivityDetailPanel.vue` |
| Create | `frontend/src/components/activity/ActivityPagination.vue` |
| Create | `frontend/src/components/activity/ActivityEmptyState.vue` |
| Modify | `frontend/src/components/icons/index.ts` (add LoginIcon — login arrow SVG) |

## Existing API — No Backend Changes

All data requirements are met by existing APIs:
- `activitiesApi.list(filters)` — paginated activity list
- `activitiesApi.getOverview(days)` — stats for overview cards
- `activitiesApi.export(filters)` — CSV export

## Responsive Behavior

- `< 1024px`: Stats grid → `grid-cols-2`, filter pills wrap to 2 rows
- `< 768px`: Stats grid → `grid-cols-2`, activity item layout stacks (icon above content), pagination stacks vertically
- `< 640px`: Stats grid → `grid-cols-1`, simplified activity layout, header stacks vertically

## Accessibility

- All filter `<select>` elements retain native behavior (keyboard, screen reader)
- Role badges use `aria-label` for screen readers
- Detail expand uses `aria-expanded` attribute
- Color-coded icons supplemented with text descriptions (not color-only)
