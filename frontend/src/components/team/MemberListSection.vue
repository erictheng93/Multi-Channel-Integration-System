<template>
  <article
    ref="sectionRef"
    class="ui-card member-section"
  >
    <!-- Header -->
    <div class="ui-card-head">
      <div>
        <h2 class="ui-card-title">
          人員管理
        </h2>
        <div class="ui-card-sub">
          共 {{ members.length }} 位成員，{{ sortCaption }}
        </div>
      </div>
      <div class="ui-card-end legend">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        ><circle
          cx="12"
          cy="12"
          r="9"
        /><path d="M12 8v5M12 16.5h.01" /></svg>團隊角色：成員 → 組長 → 主管
      </div>
    </div>

    <!-- Tools -->
    <div
      v-if="!loading && members.length > 0"
      class="tools"
    >
      <div class="search-bar">
        <SearchIcon class="search-icon" />
        <input
          v-model="searchQuery"
          class="search-input"
          type="text"
          placeholder="搜尋成員 (姓名、信箱、帳號)..."
          aria-label="搜尋成員"
          @keydown.escape="clearSearch"
        >
        <button
          v-if="searchQuery"
          class="search-clear"
          aria-label="清除搜尋"
          @click="clearSearch"
        />
        <span
          v-if="isSearching"
          class="search-stats"
        >
          找到 {{ filteredMembers.length }} / {{ members.length }}
        </span>
      </div>

      <div
        v-if="teamFilterOptions.length > 0"
        class="ui-seg team-seg"
        role="group"
        aria-label="依團隊篩選"
      >
        <button
          type="button"
          :aria-pressed="teamFilter === null"
          @click="setTeamFilter(null)"
        >
          全部 <span class="ui-seg-n">{{ members.length }}</span>
        </button>
        <button
          v-for="opt in teamFilterOptions"
          :key="opt.id"
          type="button"
          :aria-pressed="teamFilter === opt.id"
          @click="setTeamFilter(opt.id)"
        >
          {{ opt.name }} <span class="ui-seg-n">{{ opt.count }}</span>
        </button>
      </div>

      <div class="tools-end">
        <SortDropdown
          v-if="!isSelectionMode"
          :options="sortOptions"
          :current-field="sortState.field"
          :current-label="isCustomMode ? '自訂順序' : currentSortLabel"
          :sort-order="sortState.order"
          :is-custom-mode="isCustomMode"
          @select="handleSortSelect"
          @toggle-order="emit('sort-toggle')"
          @reset-to-auto="handleResetToAuto"
        />
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :aria-pressed="isSelectionMode"
          @click="emit('toggle-selection-mode')"
        >
          <CheckSquareIcon v-if="isSelectionMode" />
          <SquareIcon v-else />
          {{ isSelectionMode ? '取消選擇' : '批量選擇' }}
        </button>
      </div>
    </div>

    <!-- Bulk bar (selection mode) -->
    <div
      v-if="isSelectionMode"
      class="bulkbar"
    >
      <b>已選擇 {{ selectedCount ?? 0 }} 位成員</b>
      <span class="muted">無法選取自己的帳號</span>
      <div class="btns">
        <template v-if="pagination.totalPages.value > 1">
          <button
            class="btn btn-secondary btn-sm"
            @click="handleSelectPage"
          >
            全選本頁
          </button>
          <button
            class="btn btn-secondary btn-sm"
            @click="emit('select-all')"
          >
            全選全部
          </button>
        </template>
        <button
          v-else
          class="btn btn-secondary btn-sm"
          @click="emit('select-all')"
        >
          全選
        </button>
        <button
          class="btn btn-secondary btn-sm"
          :disabled="(selectedCount ?? 0) === 0"
          @click="emit('bulk-edit')"
        >
          <EditIcon />
          批量編輯
        </button>
        <button
          class="btn btn-danger btn-sm"
          :disabled="(selectedCount ?? 0) === 0"
          @click="emit('bulk-delete')"
        >
          <TrashIcon />
          移除選取
        </button>
      </div>
    </div>

    <!-- Content Body -->
    <div class="content-body">
      <!-- Loading State -->
      <HamsterLoader
        v-if="loading"
        message="載入成員中..."
      />

      <!-- Empty State -->
      <EmptyState
        v-else-if="members.length === 0"
        title="尚無系統人員"
        description="新增第一位成員到您的團隊"
      >
        <template #icon>
          <UsersIcon />
        </template>
        <template #actions>
          <button
            class="btn btn-primary"
            @click="emit('add-member')"
          >
            新增成員
          </button>
        </template>
      </EmptyState>

      <!-- Members List - Always Draggable -->
      <template v-else>
        <!-- Drag hint for multi-page custom sort -->
        <div
          v-if="isCustomMode && pagination.totalPages.value > 1 && !isSearching"
          class="drag-hint"
        >
          拖曳排序僅在本頁內生效
        </div>

        <!-- Search active hint -->
        <div
          v-if="(isSearching || teamFilter !== null) && isCustomMode"
          class="drag-hint"
        >
          搜尋或篩選時無法拖曳排序
        </div>

        <div
          v-if="filteredMembers.length === 0"
          class="no-match"
        >
          沒有符合條件的成員
        </div>

        <template v-else>
          <div
            class="mhead"
            aria-hidden="true"
          >
            <span v-if="isSelectionMode" />
            <span>成員</span>
            <span>系統角色</span>
            <span>團隊與角色</span>
            <span>狀態</span>
            <span>最後登入</span>
            <span />
          </div>

          <VueDraggable
            v-model="localMembers"
            class="members-list"
            role="list"
            :animation="200"
            handle=".drag-handle"
            ghost-class="drag-ghost"
            chosen-class="drag-chosen"
            drag-class="drag-active"
            :disabled="isReorderDisabled"
            @start="onDragStart"
            @end="onDragEnd"
          >
            <TeamMemberCard
              v-for="member in localMembers"
              :key="member.id"
              :member="member"
              :all-teams="allTeams"
              :current-user-id="currentUserId"
              :loading="loading"
              :is-selection-mode="isSelectionMode"
              :is-selected="selectedMemberIds?.has(member.id) ?? false"
              :presence="presenceOf(member.id)"
              class="draggable-card"
              @update-role="(memberId: string, role: string) => emit('update-role', memberId, role)"
              @toggle-status="(m) => emit('toggle-status', m)"
              @reset-password="(m) => emit('reset-password', m)"
              @remove-member="(m) => emit('remove-member', m)"
              @toggle-selection="(memberId: string) => emit('toggle-member-selection', memberId)"
            />
          </VueDraggable>
        </template>

        <!-- Pagination Controls -->
        <div
          v-if="paginationInfo.totalPages <= 1 && filteredMembers.length > 0"
          class="mfoot"
        >
          顯示 1 – {{ filteredMembers.length }}，共 {{ filteredMembers.length }} 位
        </div>
        <PaginationControls
          v-show="paginationInfo.totalPages > 1"
          :pagination="paginationInfo"
          :visible-pages="pagination.pageRange.value"
          @change-page="handlePageChange"
        />
      </template>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { TeamMember, Team } from '@/types'
import type { SortOption, SortState, SortMode } from '@/composables/useListSorting'
import { usePagination } from '@/composables/usePagination'
import { useDebounce } from '@/composables/useDebounce'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import TeamMemberCard from '@/components/team/TeamMemberCard.vue'
import SortDropdown from '@/components/ui/SortDropdown.vue'
import UsersIcon from '@/components/icons/UsersIcon.vue'
import CheckSquareIcon from '@/components/icons/CheckSquareIcon.vue'
import SquareIcon from '@/components/icons/SquareIcon.vue'
import TrashIcon from '@/components/icons/TrashIcon.vue'
import EditIcon from '@/components/icons/EditIcon.vue'
import { SearchIcon } from '@/components/icons'

interface Props {
  members: TeamMember[]
  allTeams: Team[]
  loading: boolean
  currentUserId?: string
  // Sorting props
  sortOptions: SortOption[]
  sortState: SortState
  currentSortLabel: string
  // Sort mode props
  sortMode: SortMode
  // Selection mode props
  isSelectionMode?: boolean
  selectedMemberIds?: Set<string>
  selectedCount?: number
  // Presence (GET /team/presence). Omit or false = unknown, no dot is drawn.
  onlineIds?: Set<string>
  presenceAvailable?: boolean
}

interface Emits {
  (_e: 'add-member'): void
  (_e: 'update-role', _memberId: string, _role: string): void
  (_e: 'toggle-status', _member: TeamMember): void
  (_e: 'reset-password', _member: TeamMember): void
  (_e: 'remove-member', _member: TeamMember): void
  (_e: 'sort-change', _field: string): void
  (_e: 'sort-toggle'): void
  (_e: 'sort-mode-change', _mode: SortMode): void
  (_e: 'custom-order-change', _ids: string[]): void
  // Selection mode emits
  (_e: 'toggle-selection-mode'): void
  (_e: 'toggle-member-selection', _memberId: string): void
  (_e: 'select-all'): void
  (_e: 'select-page', _memberIds: string[]): void
  (_e: 'bulk-edit'): void
  (_e: 'bulk-delete'): void
}

const props = withDefaults(defineProps<Props>(), {
  currentUserId: undefined,
  isSelectionMode: false,
  selectedMemberIds: undefined,
  selectedCount: 0,
  onlineIds: undefined,
  presenceAvailable: false
})
const emit = defineEmits<Emits>()

// Template ref for scroll-into-view on page change
const sectionRef = ref<HTMLElement | null>(null)

// Search
const searchQuery = ref('')
const debouncedSearch = useDebounce(searchQuery, 300)
const isSearching = computed(() => debouncedSearch.value.trim().length > 0)

// Team filter (null = all)
const teamFilter = ref<number | null>(null)

function memberInTeam(m: TeamMember, teamId: number): boolean {
  return m.primaryTeamId === teamId || (m.teams ?? []).some(t => t.teamId === teamId)
}

const teamFilterOptions = computed(() =>
  props.allTeams.map(t => ({
    id: t.id,
    name: t.name,
    count: props.members.filter(m => memberInTeam(m, t.id)).length
  }))
)

function setTeamFilter(id: number | null) {
  teamFilter.value = id
  pagination.setPage(1)
}

const teamScopedMembers = computed(() =>
  teamFilter.value === null ? props.members : props.members.filter(m => memberInTeam(m, teamFilter.value as number))
)

const filteredMembers = computed(() => {
  const query = debouncedSearch.value.trim().toLowerCase()
  if (!query) {return teamScopedMembers.value}
  return teamScopedMembers.value.filter(m =>
    (m.name?.toLowerCase().includes(query)) ||
    (m.email?.toLowerCase().includes(query)) ||
    (m.loginId?.toLowerCase().includes(query)) ||
    (m.primaryTeamName?.toLowerCase().includes(query))
  )
})

function clearSearch() {
  searchQuery.value = ''
}

// Pagination
const PAGE_SIZE = 10
const pagination = usePagination({ limit: PAGE_SIZE, total: filteredMembers.value.length })

// Computed
const isCustomMode = computed(() => props.sortMode === 'custom')

// Reordering a filtered view would rewrite the full order from a partial list
const isReorderDisabled = computed(() => isSearching.value || teamFilter.value !== null)

const sortCaption = computed(() =>
  isCustomMode.value ? '依自訂順序排列' : `依${props.currentSortLabel}排序`
)

function presenceOf(memberId: string): 'online' | 'offline' | undefined {
  if (!props.presenceAvailable || !props.onlineIds) {return undefined}
  return props.onlineIds.has(memberId) ? 'online' : 'offline'
}

// Paginated members from full sorted list
const paginatedMembers = computed(() => {
  return pagination.paginateData(filteredMembers.value)
})

// Pagination info for PaginationControls component
const paginationInfo = computed(() => ({
  page: pagination.currentPage.value,
  pageSize: pagination.pageSize.value,
  total: pagination.total.value,
  totalPages: pagination.totalPages.value,
  hasNext: pagination.hasNext.value,
  hasPrev: pagination.hasPrev.value,
}))

// Local copy for drag operations — synced from paginated view
const localMembers = ref<TeamMember[]>([...paginatedMembers.value])

// Sync total when filtered members change
watch(
  () => filteredMembers.value.length,
  (newLength) => {
    pagination.setTotal(newLength)
  }
)

// Reset to page 1 when search query changes
watch(debouncedSearch, () => {
  pagination.setPage(1)
})

// Sync local members with paginated view when members or page changes
watch(
  paginatedMembers,
  (newMembers) => {
    localMembers.value = [...newMembers]
  },
  { deep: true }
)

// Handle drag start - no action needed
function onDragStart() {
  // Optional: Add visual feedback
}

// Handle drag end - reconstruct full order with page slice replaced
function onDragEnd() {
  // Ignore drag in search mode (filtered order is meaningless for reorder)
  if (isReorderDisabled.value) {return}

  // Switch to custom mode if not already
  if (props.sortMode !== 'custom') {
    emit('sort-mode-change', 'custom')
  }

  // Reconstruct full order: replace current page's slice with dragged order
  const fullOrder = [...props.members]
  const startIdx = pagination.startIndex.value
  const pageLength = localMembers.value.length

  // Replace the current page slice in the full array
  fullOrder.splice(startIdx, pageLength, ...localMembers.value)

  const newOrder = fullOrder.map(m => m.id)
  emit('custom-order-change', newOrder)
}

// Handle sort field selection - reset to page 1
function handleSortSelect(field: string) {
  // If in custom mode, switch back to auto first
  if (props.sortMode === 'custom') {
    emit('sort-mode-change', 'auto')
  }
  emit('sort-change', field)
  pagination.setPage(1)
}

// Reset to auto sort - reset to page 1
function handleResetToAuto() {
  emit('sort-mode-change', 'auto')
  pagination.setPage(1)
}

// Handle page change: update page and scroll section into view
function handlePageChange(page: number) {
  pagination.setPage(page)
  nextTick(() => {
    sectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

// Select all members on current page
function handleSelectPage() {
  const pageIds = paginatedMembers.value.map(m => m.id)
  emit('select-page', pageIds)
}
</script>

<style scoped>
.member-section {
  --member-cols: minmax(210px, 1.5fr) 96px minmax(180px, 1.3fr) 90px 110px 40px;
  padding-bottom: 6px;
}
.member-section:has(.selection-mode) {
  --member-cols: 24px minmax(210px, 1.5fr) 96px minmax(180px, 1.3fr) 90px 110px 40px;
}

.legend {
  font-size: 13px;
  color: var(--ui-muted);
}
.legend svg {
  width: 13px;
  height: 13px;
  color: var(--ui-faint);
}

/* Tools row */
.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 0 22px 14px;
}
.tools-end {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.search-bar {
  position: relative;
  display: flex;
  flex: 1 1 240px;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 340px;
  height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  background: var(--ui-fill);
  color: var(--ui-muted);
}
.search-icon {
  width: 16px;
  height: 16px;
  flex: none;
}
.search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  background: transparent;
  font-size: 13.5px;
  color: var(--ui-ink);
  outline: none;
}
.search-input::placeholder {
  color: var(--ui-muted);
}
.search-clear {
  position: relative;
  width: 18px;
  height: 18px;
  flex: none;
  border: 0;
  border-radius: 50%;
  background: var(--ui-fill-strong);
  cursor: pointer;
}
.search-clear::before,
.search-clear::after {
  content: '';
  position: absolute;
  top: 8px;
  left: 4px;
  width: 10px;
  height: 1.5px;
  background: var(--ui-ink-2);
  transform: rotate(45deg);
}
.search-clear::after {
  transform: rotate(-45deg);
}
.search-stats {
  flex: none;
  font-size: 13px;
  white-space: nowrap;
}

.team-seg {
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}

/* Bulk bar */
.bulkbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 0 22px 12px;
  padding: 10px 14px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-accent-soft);
  font-size: 13px;
  color: var(--ui-ink);
}
.bulkbar .muted {
  color: var(--ui-muted);
}
.bulkbar .btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
}

/* Table */
.content-body {
  min-width: 0;
}
.mhead {
  display: grid;
  grid-template-columns: var(--member-cols);
  column-gap: 16px;
  align-items: center;
  height: 36px;
  padding: 0 22px;
  box-shadow:
    inset 0 -0.5px 0 var(--ui-sep),
    inset 0 0.5px 0 var(--ui-sep);
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}
.members-list {
  display: block;
}
.no-match {
  padding: 36px 22px;
  font-size: 13.5px;
  color: var(--ui-muted);
  text-align: center;
}
.drag-hint {
  padding: 8px 22px;
  font-size: 13px;
  color: var(--ui-muted);
}
.drag-ghost {
  opacity: 0.4;
}
.drag-chosen {
  background: var(--ui-surface-2);
}
.drag-active {
  box-shadow: var(--ui-shadow-raised);
}

.mfoot {
  position: relative;
  padding: 12px 22px 14px;
  font-size: 13px;
  color: var(--ui-muted);
}
.mfoot::before {
  content: '';
  position: absolute;
  top: 0;
  right: 22px;
  left: 22px;
  height: 0.5px;
  background: var(--ui-sep);
}

@media (max-width: 1280px) {
  .mhead {
    display: none;
  }
}
@media (max-width: 768px) {
  .tools {
    padding-right: 16px;
    padding-left: 16px;
  }
  .search-bar {
    flex-basis: 100%;
    max-width: none;
  }
  .tools-end {
    width: 100%;
    margin-left: 0;
  }
  .bulkbar {
    margin-right: 16px;
    margin-left: 16px;
  }
  .mfoot {
    padding-right: 16px;
    padding-left: 16px;
  }
  .mfoot::before {
    left: 16px;
  }
  .drag-hint {
    padding-right: 16px;
    padding-left: 16px;
  }
}
</style>
