# Conversation Filters Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add customer name search, last message content filter, update time range filter to the conversation list, and rename "團隊指派" label to "負責人".

**Architecture:** Extend existing filter infrastructure (ConversationFilters type → useConversationFilters composable → ConversationFilters.vue component → API layer → Backend handler). Customer name and update time filters go to backend API; last message content filter is client-side on already-loaded `lastMessageContent`.

**Tech Stack:** Vue 3 Composition API, TypeScript strict, Hono backend, Drizzle ORM (D1), Tailwind CSS

---

### Task 1: Extend ConversationFilters type

**Files:**
- Modify: `frontend/src/types/index.ts:76-83`

**Step 1: Add new filter fields to ConversationFilters interface**

```typescript
export interface ConversationFilters {
  status?: 'active' | 'assigned' | 'pending' | '' | undefined;
  teamId?: number | undefined;
  platform?: Platform | '' | undefined;
  tagIds?: number[];
  search?: string;
  customerName?: string;       // NEW: customer name search (backend)
  lastMessageSearch?: string;  // NEW: last message content filter (frontend)
  updatedAfter?: string;       // NEW: ISO date string (backend)
  updatedBefore?: string;      // NEW: ISO date string (backend)
}
```

**Step 2: Verify type-check passes**

Run: `cd frontend && bunx vue-tsc --noEmit`
Expected: PASS (new optional fields are backward-compatible)

---

### Task 2: Update useConversationFilters composable

**Files:**
- Modify: `frontend/src/composables/conversation/useConversationFilters.ts:51-57` (DEFAULT_FILTERS)
- Modify: `frontend/src/composables/conversation/useConversationFilters.ts:71-78` (hasActiveFilters)
- Modify: `frontend/src/composables/conversation/useConversationFilters.ts:171-182` (getApiFilters)

**Step 1: Update DEFAULT_FILTERS**

```typescript
const DEFAULT_FILTERS: ConversationFilters = {
  status: '',
  platform: '',
  teamId: undefined,
  tagIds: [],
  search: '',
  customerName: '',
  lastMessageSearch: '',
  updatedAfter: '',
  updatedBefore: ''
}
```

**Step 2: Update hasActiveFilters computed**

Add checks for the 3 new fields:

```typescript
const hasActiveFilters = computed<boolean>(() => {
  return (
    filters.value.status !== '' ||
    filters.value.platform !== '' ||
    filters.value.teamId !== undefined ||
    (filters.value.tagIds !== undefined && filters.value.tagIds.length > 0) ||
    (filters.value.search !== undefined && filters.value.search.trim() !== '') ||
    (filters.value.customerName !== undefined && filters.value.customerName.trim() !== '') ||
    (filters.value.lastMessageSearch !== undefined && filters.value.lastMessageSearch.trim() !== '') ||
    (filters.value.updatedAfter !== undefined && filters.value.updatedAfter !== '') ||
    (filters.value.updatedBefore !== undefined && filters.value.updatedBefore !== '')
  )
})
```

**Step 3: Update getApiFilters to exclude client-side-only filter**

`lastMessageSearch` is client-side only, so it should NOT be sent to the API.

```typescript
function getApiFilters(): Record<string, unknown> {
  const apiFilters: Record<string, unknown> = { ...filters.value }

  // Remove empty string values
  Object.keys(apiFilters).forEach(key => {
    if (apiFilters[key] === '' || apiFilters[key] === undefined) {
      delete apiFilters[key]
    }
  })

  // lastMessageSearch is client-side only, never send to API
  delete apiFilters.lastMessageSearch

  return apiFilters
}
```

**Step 4: Verify type-check passes**

Run: `cd frontend && bunx vue-tsc --noEmit`
Expected: PASS

---

### Task 3: Update ConversationListParams and API client

**Files:**
- Modify: `frontend/src/api/conversations.ts:163-172` (ConversationListParams)
- Modify: `frontend/src/api/conversations.ts:213-222` (list method query params)

**Step 1: Extend ConversationListParams**

```typescript
interface ConversationListParams {
  page?: number;
  pageSize?: number;
  status?: 'active' | 'assigned' | 'pending';
  platform?: Platform;
  teamId?: number;
  search?: string;
  tagIds?: number[];
  customerName?: string;    // NEW
  updatedAfter?: string;    // NEW
  updatedBefore?: string;   // NEW
}
```

**Step 2: Pass new params in list() method**

In `conversationApi.list`, add after tagIds line:

```typescript
if (params.customerName) {queryParams.append('customerName', params.customerName);}
if (params.updatedAfter) {queryParams.append('updatedAfter', params.updatedAfter);}
if (params.updatedBefore) {queryParams.append('updatedBefore', params.updatedBefore);}
```

**Step 3: Verify type-check passes**

Run: `cd frontend && bunx vue-tsc --noEmit`
Expected: PASS

---

### Task 4: Update store fetchConversations and cacheStrategy to pass new filters

**Files:**
- Modify: `frontend/src/stores/conversations.ts:408-413` (cleanFilters in fetchConversations)
- Modify: `frontend/src/stores/conversations\cacheStrategy.ts:113-116` (cleanFilters in loadWithCache)

**Step 1: Update fetchConversations cleanFilters**

```typescript
const cleanFilters: Record<string, unknown> = {}
if (filters.value.status) { cleanFilters.status = filters.value.status }
if (filters.value.platform) { cleanFilters.platform = filters.value.platform }
if (filters.value.teamId) { cleanFilters.teamId = filters.value.teamId }
if (filters.value.search) { cleanFilters.search = filters.value.search }
if (filters.value.tagIds && filters.value.tagIds.length > 0) { cleanFilters.tagIds = filters.value.tagIds }
if (filters.value.customerName) { cleanFilters.customerName = filters.value.customerName }
if (filters.value.updatedAfter) { cleanFilters.updatedAfter = filters.value.updatedAfter }
if (filters.value.updatedBefore) { cleanFilters.updatedBefore = filters.value.updatedBefore }
```

**Step 2: Update loadWithCache cleanFilters (same pattern)**

```typescript
const cleanFilters: Record<string, unknown> = {}
if (cacheFilters.status) { cleanFilters.status = cacheFilters.status }
if (cacheFilters.platform) { cleanFilters.platform = cacheFilters.platform }
if (cacheFilters.teamId) { cleanFilters.teamId = cacheFilters.teamId }
if (cacheFilters.customerName) { cleanFilters.customerName = cacheFilters.customerName }
if (cacheFilters.updatedAfter) { cleanFilters.updatedAfter = cacheFilters.updatedAfter }
if (cacheFilters.updatedBefore) { cleanFilters.updatedBefore = cacheFilters.updatedBefore }
```

**Step 3: Verify type-check passes**

Run: `cd frontend && bunx vue-tsc --noEmit`
Expected: PASS

---

### Task 5: Backend — Add customerName and updatedAfter/updatedBefore query support

**Files:**
- Modify: `src/modules/conversations/handlers/conversation-queries.ts:139-205`

**Step 1: Parse new query parameters**

After line 148 (`log.debug('Conversation Handler filter params'...)`), add:

```typescript
const customerNameQuery = c.req.query('customerName')?.trim() || '';
const updatedAfter = c.req.query('updatedAfter')?.trim() || '';
const updatedBefore = c.req.query('updatedBefore')?.trim() || '';
```

**Step 2: Add WHERE conditions to the main query**

Replace the simple `inArray` where clause (line 204) with dynamic conditions:

```typescript
// Build dynamic WHERE conditions
const whereConditions = [inArray(conversations.id, filteredConversationIds)];

// Customer name filter: JOIN with customers and filter by displayName LIKE
if (customerNameQuery) {
  whereConditions.push(
    sql`${customers.displayName} LIKE ${'%' + customerNameQuery + '%'}`
  );
}

// Updated time range filters
if (updatedAfter) {
  whereConditions.push(
    sql`${conversations.updatedAt} >= ${updatedAfter}`
  );
}
if (updatedBefore) {
  whereConditions.push(
    sql`${conversations.updatedAt} <= ${updatedBefore}`
  );
}

const conversationResults = await drizzleDb
  .select()
  .from(conversations)
  .leftJoin(customers, eq(conversations.customerId, customers.id))
  .leftJoin(teams, eq(conversations.assignedTeamId, teams.id))
  .where(and(...whereConditions))
  .orderBy(desc(conversations.updatedAt));
```

Note: `like` import is needed. Add to imports at line 7:

```typescript
import { eq, inArray, desc, and, sql, like } from 'drizzle-orm';
```

(Actually we use `sql` template literal for the LIKE, so `like` import is not strictly needed. Keep using `sql` for consistency.)

**Step 3: Verify type-check passes**

Run: `bun run build`
Expected: PASS

---

### Task 6: Add client-side lastMessageSearch filtering in the controller

**Files:**
- Modify: `frontend/src/composables/conversation/useConversationListController.ts:105-113`

**Step 1: Add lastMessageSearch filter to the computed conversations**

Replace the `conversations` computed:

```typescript
const conversations = computed(() => {
  let storeData = conversationsStore.conversations

  // Client-side filter: lastMessageSearch
  const lastMsgSearch = filters.filters.value.lastMessageSearch?.trim().toLowerCase()
  if (lastMsgSearch && storeData && storeData.length > 0) {
    storeData = storeData.filter((c: Conversation) => {
      const content = c.lastMessage?.content?.toLowerCase() || ''
      return content.includes(lastMsgSearch)
    })
  }

  // Apply client-side sorting
  if (storeData && storeData.length > 0) {
    return sort.applySortToConversations(storeData)
  }

  return storeData || []
})
```

**Step 2: Verify type-check passes**

Run: `cd frontend && bunx vue-tsc --noEmit`
Expected: PASS

---

### Task 7: Redesign ConversationFilters.vue — Two-Row Layout

**Files:**
- Modify: `frontend/src/components/conversation-list/ConversationFilters.vue`

**Step 1: Update props interface**

```typescript
export interface ConversationFiltersProps {
  filters: ConversationFilters
  availableTags?: Tag[]
  availableTeams?: { id: number; name: string }[]
  totalConversations?: number
  unreadCount?: number
}
```

**Step 2: Add new emits**

No new emits needed — existing `update:filter` handles all filter keys.

**Step 3: Rewrite template — two-row layout with all 7 filters**

Full template (replace entire `<template>` block):

```html
<template>
  <div class="conversation-filters">
    <!-- Row 1: Primary filters -->
    <div class="filter-row">
      <div class="filter-group flex-1">
        <!-- Customer Name Search -->
        <div class="filter-item filter-search">
          <label class="filter-label">客戶搜尋</label>
          <div class="search-input-wrapper">
            <input
              :value="filters.customerName || ''"
              type="text"
              class="filter-input"
              placeholder="輸入客戶名稱..."
              @input="onFilterChange('customerName', ($event.target as HTMLInputElement).value)"
            >
          </div>
        </div>

        <!-- Platform Filter -->
        <div class="filter-item">
          <label class="filter-label">平台篩選</label>
          <select
            :value="filters.platform"
            class="form-select"
            @change="onFilterChange('platform', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">所有平台</option>
            <option value="line">LINE</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>

        <!-- Status Filter -->
        <div class="filter-item">
          <label class="filter-label">狀態篩選</label>
          <select
            :value="filters.status"
            class="form-select"
            @change="onFilterChange('status', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">所有狀態</option>
            <option value="active">進行中</option>
            <option value="assigned">已指派</option>
            <option value="pending">待處理</option>
          </select>
        </div>

        <!-- Team Filter (renamed to 負責人) -->
        <div class="filter-item">
          <label class="filter-label">負責人</label>
          <select
            :value="filters.teamId || ''"
            class="form-select"
            @change="onFilterChange('teamId', ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : undefined)"
          >
            <option value="">全部</option>
            <option value="0">未指派</option>
          </select>
        </div>

        <!-- Tag Filter -->
        <div class="filter-item relative">
          <label class="filter-label">標籤篩選</label>
          <div class="relative">
            <button
              class="tag-filter-btn"
              :class="{ 'has-selection': selectedTagIds.length > 0 }"
              @click="showTagDropdown = !showTagDropdown"
            >
              <span v-if="selectedTagIds.length === 0">選擇標籤</span>
              <span v-else>已選 {{ selectedTagIds.length }} 個</span>
              <svg
                class="w-4 h-4 ml-auto transition-transform duration-200"
                :class="{ 'rotate-180': showTagDropdown }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            <div
              v-if="showTagDropdown"
              class="tag-filter-dropdown"
            >
              <div
                v-if="availableTags.length === 0"
                class="p-4 text-center text-gray-500 text-sm"
              >
                暫無可用標籤
              </div>
              <div
                v-for="tag in availableTags"
                v-else
                :key="tag.id"
                class="flex items-center gap-3 py-3 px-4 cursor-pointer transition-colors hover:bg-gray-50"
                :class="{ 'bg-primary-50': selectedTagIds.includes(tag.id) }"
                @click="toggleTag(tag.id)"
              >
                <div
                  class="w-3 h-3 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: tag.color }"
                />
                <span class="flex-1 text-sm text-gray-800">{{ tag.name }}</span>
                <svg
                  v-if="selectedTagIds.includes(tag.id)"
                  class="w-4 h-4 text-primary-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div
                v-if="selectedTagIds.length > 0"
                class="py-3 px-4 text-center text-red-600 text-sm cursor-pointer border-t border-gray-200 hover:bg-red-50 transition-colors"
                @click="clearTags"
              >
                清除篩選
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 2: Advanced filters -->
    <div class="filter-row mt-3">
      <div class="filter-group flex-1">
        <!-- Last Message Search -->
        <div class="filter-item filter-search">
          <label class="filter-label">最後訊息</label>
          <div class="search-input-wrapper">
            <input
              :value="filters.lastMessageSearch || ''"
              type="text"
              class="filter-input"
              placeholder="搜尋最後訊息內容..."
              @input="onFilterChange('lastMessageSearch', ($event.target as HTMLInputElement).value)"
            >
          </div>
        </div>

        <!-- Update Time Range -->
        <div class="filter-item">
          <label class="filter-label">更新時間</label>
          <div class="flex items-center gap-2">
            <button
              v-for="preset in timePresets"
              :key="preset.label"
              class="time-preset-btn"
              :class="{ active: activeTimePreset === preset.label }"
              @click="applyTimePreset(preset)"
            >
              {{ preset.label }}
            </button>
            <button
              class="time-preset-btn"
              :class="{ active: activeTimePreset === 'custom' }"
              @click="showCustomDateRange = !showCustomDateRange"
            >
              自訂
            </button>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="flex gap-6 items-center lg:justify-center sm:flex-col sm:gap-3">
        <div class="flex flex-col items-center text-center">
          <span class="text-2xl font-bold text-primary-600 leading-none">{{ totalConversations }}</span>
          <span class="text-xs text-gray-600 font-medium mt-1">總對話</span>
        </div>
        <div class="flex flex-col items-center text-center">
          <span class="text-2xl font-bold text-primary-600 leading-none">{{ unreadCount }}</span>
          <span class="text-xs text-gray-600 font-medium mt-1">未讀</span>
        </div>
      </div>
    </div>

    <!-- Custom Date Range Picker (collapsible) -->
    <div
      v-if="showCustomDateRange"
      class="filter-row mt-3"
    >
      <div class="filter-group">
        <div class="filter-item">
          <label class="filter-label">開始日期</label>
          <input
            :value="filters.updatedAfter || ''"
            type="date"
            class="form-select"
            @change="onDateChange('updatedAfter', ($event.target as HTMLInputElement).value)"
          >
        </div>
        <div class="filter-item">
          <label class="filter-label">結束日期</label>
          <input
            :value="customEndDate"
            type="date"
            class="form-select"
            @change="onDateChange('updatedBefore', ($event.target as HTMLInputElement).value)"
          >
        </div>
        <button
          class="text-sm text-red-500 hover:text-red-700 self-end pb-2"
          @click="clearDateRange"
        >
          清除日期
        </button>
      </div>
    </div>

    <!-- Active Filters Summary + Clear All -->
    <div
      v-if="hasActiveFilters"
      class="mt-3 flex items-center gap-2"
    >
      <span class="text-xs text-gray-500">{{ activeFilterCount }} 個篩選條件</span>
      <button
        class="text-xs text-red-500 hover:text-red-700 hover:underline"
        @click="clearAll"
      >
        清除所有篩選
      </button>
    </div>
  </div>
</template>
```

**Step 4: Rewrite script section**

```typescript
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ConversationFilters } from '@/types'

export interface Tag {
  id: number
  name: string
  color: string
}

export interface ConversationFiltersProps {
  filters: ConversationFilters
  availableTags?: Tag[]
  totalConversations?: number
  unreadCount?: number
}

const props = withDefaults(defineProps<ConversationFiltersProps>(), {
  totalConversations: 0,
  unreadCount: 0,
  availableTags: () => []
})

const emit = defineEmits<{
  'update:filter': [key: keyof ConversationFilters, value: string | number | undefined]
  'update:tag-filter': [tagIds: number[]]
  'toggle:tag': [tagId: number]
  'clear:tags': []
  'clear:all': []
}>()

// State
const showTagDropdown = ref(false)
const showCustomDateRange = ref(false)
const activeTimePreset = ref<string | null>(null)

// Time presets
const timePresets = [
  { label: '今天', daysAgo: 0 },
  { label: '近7天', daysAgo: 7 },
  { label: '近30天', daysAgo: 30 }
]

// Computed
const selectedTagIds = computed(() => props.filters.tagIds || [])

const customEndDate = computed(() => {
  // Strip time portion for date input if updatedBefore has ISO time
  const val = props.filters.updatedBefore || ''
  return val ? val.substring(0, 10) : ''
})

const hasActiveFilters = computed(() => {
  return (
    (props.filters.status !== '' && props.filters.status !== undefined) ||
    (props.filters.platform !== '' && props.filters.platform !== undefined) ||
    props.filters.teamId !== undefined ||
    (props.filters.tagIds !== undefined && props.filters.tagIds.length > 0) ||
    (props.filters.customerName !== undefined && props.filters.customerName.trim() !== '') ||
    (props.filters.lastMessageSearch !== undefined && props.filters.lastMessageSearch.trim() !== '') ||
    (props.filters.updatedAfter !== undefined && props.filters.updatedAfter !== '') ||
    (props.filters.updatedBefore !== undefined && props.filters.updatedBefore !== '')
  )
})

const activeFilterCount = computed(() => {
  let count = 0
  if (props.filters.status) count++
  if (props.filters.platform) count++
  if (props.filters.teamId !== undefined) count++
  if (props.filters.tagIds && props.filters.tagIds.length > 0) count++
  if (props.filters.customerName?.trim()) count++
  if (props.filters.lastMessageSearch?.trim()) count++
  if (props.filters.updatedAfter || props.filters.updatedBefore) count++
  return count
})

function onFilterChange(key: keyof ConversationFilters, value: string | number | undefined) {
  emit('update:filter', key, value || undefined)
}

function applyTimePreset(preset: { label: string; daysAgo: number }) {
  activeTimePreset.value = preset.label
  showCustomDateRange.value = false

  const now = new Date()
  if (preset.daysAgo === 0) {
    // Today: start of today
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    emit('update:filter', 'updatedAfter', startOfToday.toISOString())
  } else {
    const daysAgo = new Date(now.getTime() - preset.daysAgo * 24 * 60 * 60 * 1000)
    emit('update:filter', 'updatedAfter', daysAgo.toISOString())
  }
  emit('update:filter', 'updatedBefore', undefined)
}

function onDateChange(key: 'updatedAfter' | 'updatedBefore', value: string) {
  activeTimePreset.value = 'custom'
  if (!value) {
    emit('update:filter', key, undefined)
    return
  }
  if (key === 'updatedAfter') {
    emit('update:filter', key, new Date(value + 'T00:00:00').toISOString())
  } else {
    emit('update:filter', key, new Date(value + 'T23:59:59').toISOString())
  }
}

function clearDateRange() {
  activeTimePreset.value = null
  showCustomDateRange.value = false
  emit('update:filter', 'updatedAfter', undefined)
  emit('update:filter', 'updatedBefore', undefined)
}

function toggleTag(tagId: number) {
  emit('toggle:tag', tagId)
}

function clearTags() {
  emit('clear:tags')
  showTagDropdown.value = false
}

function clearAll() {
  activeTimePreset.value = null
  showCustomDateRange.value = false
  emit('clear:all')
}
</script>
```

**Step 5: Add new styles**

```css
<style scoped>
.conversation-filters {
  @apply px-6 py-4 bg-white;
}

.filter-row {
  @apply flex items-end gap-6 lg:flex-col lg:items-stretch lg:gap-4;
}

.filter-group {
  @apply flex gap-4 md:flex-col md:gap-3 flex-wrap items-end;
}

.filter-item {
  @apply flex flex-col gap-1 md:w-full;
}

.filter-label {
  @apply text-xs font-medium text-gray-700 uppercase tracking-wider;
}

.filter-search {
  @apply min-w-[160px];
}

.filter-input {
  @apply py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-800;
  @apply transition-all outline-none;
}

.filter-input:focus {
  @apply border-primary-600 ring-2 ring-primary-100;
}

.filter-input::placeholder {
  @apply text-gray-400;
}

/* Time preset buttons */
.time-preset-btn {
  @apply px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200;
  @apply bg-white text-gray-600 cursor-pointer transition-all;
}

.time-preset-btn:hover {
  @apply border-primary-400 text-primary-600;
}

.time-preset-btn.active {
  @apply bg-primary-50 border-primary-600 text-primary-600;
}

/* Tag Filter Button */
.tag-filter-btn {
  @apply flex items-center gap-2 py-2 px-3 bg-white border border-gray-200;
  @apply rounded-lg text-sm text-gray-600 cursor-pointer transition-all min-w-[120px];
}

.tag-filter-btn:hover {
  @apply border-primary-600 text-primary-600;
}

.tag-filter-btn.has-selection {
  @apply bg-primary-50 border-primary-600 text-primary-600;
}

/* Tag Filter Dropdown */
.tag-filter-dropdown {
  @apply absolute z-50 min-w-[200px] max-h-[300px] overflow-y-auto;
  @apply bg-white border border-gray-200 rounded-xl shadow-xl;
  top: calc(100% + 0.5rem);
  left: 0;
  animation: dropdown-appear 0.2s ease-out;
}

@keyframes dropdown-appear {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
```

**Step 6: Verify type-check passes**

Run: `cd frontend && bunx vue-tsc --noEmit`
Expected: PASS

---

### Task 8: Wire up new clear:all emit in ConversationList.vue

**Files:**
- Modify: `frontend/src/views/ConversationList.vue:44-54`

**Step 1: Add clear:all handler to ConversationFilters usage**

```html
<ConversationFilters
  :filters="controller.filters.filters.value"
  :available-tags="availableTags"
  :total-conversations="controller.totalConversations.value"
  :unread-count="controller.unreadCount.value"
  @update:filter="handleFilterUpdate"
  @toggle:tag="controller.filters.toggleTagFilter"
  @clear:tags="controller.filters.clearTagFilter"
  @clear:all="controller.filters.clearAllFilters"
/>
```

**Step 2: Add debounce for customerName input in ConversationList.vue**

Since `customerName` triggers API calls, it needs debounce. The existing search bar already uses debounce. The simplest approach: in the controller's watch on `filters.filters.value`, debounce is handled implicitly because the watch deep triggers `loadConversations()` which is already called.

However, we should move the existing search bar logic into the filter component to avoid duplication. The current `ConversationList.vue` has a separate search bar at line 17-41 that sets `filters.search`. Since we now have `customerName` in the filter component, we can keep the existing search bar for general search and the new `customerName` field in filters for customer-specific search.

No additional code needed — the existing watch in the controller (line 343-349) already debounces via `deep: true` watch on all filter changes.

**Note:** For text input filters (`customerName`, `lastMessageSearch`), we should add debounce inside the ConversationFilters component. Update the component script:

Add debounce for text inputs inside ConversationFilters.vue:

```typescript
import { ref, computed, watch } from 'vue'

// Debounce timers
let customerNameTimer: ReturnType<typeof setTimeout> | null = null
let lastMessageTimer: ReturnType<typeof setTimeout> | null = null

function onTextFilterChange(key: 'customerName' | 'lastMessageSearch', value: string) {
  const timer = key === 'customerName' ? customerNameTimer : lastMessageTimer
  if (timer) clearTimeout(timer)

  const newTimer = setTimeout(() => {
    emit('update:filter', key, value || undefined)
  }, 300)

  if (key === 'customerName') customerNameTimer = newTimer
  else lastMessageTimer = newTimer
}
```

Then update the template inputs to use `onTextFilterChange` instead of `onFilterChange`:

```html
@input="onTextFilterChange('customerName', ($event.target as HTMLInputElement).value)"
```

```html
@input="onTextFilterChange('lastMessageSearch', ($event.target as HTMLInputElement).value)"
```

**Step 3: Verify type-check passes**

Run: `cd frontend && bunx vue-tsc --noEmit`
Expected: PASS

---

### Task 9: Backend type-check and manual testing

**Step 1: Run backend type check**

Run: `bun run build`
Expected: PASS

**Step 2: Run frontend type check**

Run: `cd frontend && bunx vue-tsc --noEmit`
Expected: PASS

**Step 3: Run frontend tests**

Run: `cd frontend && bun run test`
Expected: All existing tests pass (new filters are optional, backward-compatible)

---

### Task 10: Commit

**Step 1: Stage and commit**

```bash
git add frontend/src/types/index.ts \
        frontend/src/composables/conversation/useConversationFilters.ts \
        frontend/src/api/conversations.ts \
        frontend/src/stores/conversations.ts \
        frontend/src/stores/conversations/cacheStrategy.ts \
        frontend/src/composables/conversation/useConversationListController.ts \
        frontend/src/components/conversation-list/ConversationFilters.vue \
        frontend/src/views/ConversationList.vue \
        src/modules/conversations/handlers/conversation-queries.ts

git commit -m "feat(conversations): add customer name, last message, and date range filters

- Add customerName search filter (backend SQL LIKE on customers.displayName)
- Add lastMessageSearch filter (client-side on loaded lastMessageContent)
- Add updatedAfter/updatedBefore date range filter with presets (today/7d/30d/custom)
- Rename team assignment label from '團隊指派' to '負責人'
- Add 'clear all filters' button with active filter count badge
- Two-row filter layout: primary filters row 1, advanced filters row 2"
```
