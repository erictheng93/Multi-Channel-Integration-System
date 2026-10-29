<template>
  <section
    ref="sectionRef"
    class="team-section"
  >
    <!-- Header -->
    <div class="section-head">
      <div>
        <h2 class="ui-card-title">
          團隊設置
        </h2>
        <div class="ui-card-sub">
          共 {{ teams.length }} 個團隊，成員只會看到所屬團隊的對話與共享池
        </div>
      </div>
      <div class="section-end">
        <div
          v-if="!loading && teams.length > 0"
          class="search-bar"
        >
          <SearchIcon class="search-icon" />
          <input
            v-model="searchQuery"
            class="search-input"
            type="text"
            placeholder="搜尋團隊 (名稱、描述)..."
            aria-label="搜尋團隊"
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
            找到 {{ filteredTeams.length }} / {{ teams.length }}
          </span>
        </div>
        <SortDropdown
          v-if="teams.length > 0"
          :options="sortOptions"
          :current-field="sortState.field"
          :current-label="isCustomMode ? '自訂順序' : currentSortLabel"
          :sort-order="sortState.order"
          :is-custom-mode="isCustomMode"
          @select="handleSortSelect"
          @toggle-order="emit('sort-toggle')"
          @reset-to-auto="handleResetToAuto"
        />
      </div>
    </div>

    <!-- Content Body -->
    <div class="content-body">
      <!-- Loading State -->
      <HamsterLoader
        v-if="loading"
        message="載入團隊中..."
      />

      <!-- Empty State -->
      <EmptyState
        v-else-if="teams.length === 0"
        title="尚無團隊"
        description="建立第一個團隊來管理客服人員"
      >
        <template #icon>
          <TeamsIcon />
        </template>
        <template #actions>
          <button
            class="btn btn-primary"
            @click="emit('add-team')"
          >
            新增團隊
          </button>
        </template>
      </EmptyState>

      <!-- Teams List - Always Draggable -->
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
          v-if="isSearching && isCustomMode"
          class="drag-hint"
        >
          搜尋模式下無法拖曳排序
        </div>

        <VueDraggable
          v-model="localTeams"
          class="ui-grid ui-cols-2 teams-list"
          :animation="200"
          ghost-class="drag-ghost"
          chosen-class="drag-chosen"
          drag-class="drag-active"
          :disabled="isSearching"
          @start="onDragStart"
          @end="onDragEnd"
        >
          <TeamCard
            v-for="team in localTeams"
            :key="team.id"
            :team="team"
            :loading="loading"
            :preview-members="previewMembersFor(team.id)"
            class="draggable-card"
            @toggle-status="(t) => emit('toggle-status', t)"
            @remove-team="(t) => emit('remove-team', t)"
            @member-updated="emit('member-updated')"
            @team-updated="emit('team-updated')"
          />
        </VueDraggable>

        <!-- Pagination Controls -->
        <PaginationControls
          v-show="paginationInfo.totalPages > 1"
          :pagination="paginationInfo"
          :visible-pages="pagination.pageRange.value"
          @change-page="handlePageChange"
        />
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { Team } from '@/composables/team-management'
import type { TeamMember } from '@/types'
import type { SortOption, SortState, SortMode } from '@/composables/useListSorting'
import { usePagination } from '@/composables/usePagination'
import { useDebounce } from '@/composables/useDebounce'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import TeamCard from '@/components/team/TeamCard.vue'
import SortDropdown from '@/components/ui/SortDropdown.vue'
import TeamsIcon from '@/components/icons/TeamsIcon.vue'
import { SearchIcon } from '@/components/icons'

interface Props {
  teams: Team[]
  loading: boolean
  // Sorting props
  sortOptions: SortOption[]
  sortState: SortState
  currentSortLabel: string
  // Sort mode props
  sortMode: SortMode
  /** All members, used to draw each team's avatar stack. */
  members?: TeamMember[]
}

interface Emits {
  (_e: 'add-team'): void
  (_e: 'toggle-status', _team: Team): void
  (_e: 'remove-team', _team: Team): void
  (_e: 'member-updated'): void
  (_e: 'team-updated'): void
  (_e: 'sort-change', _field: string): void
  (_e: 'sort-toggle'): void
  (_e: 'sort-mode-change', _mode: SortMode): void
  (_e: 'custom-order-change', _ids: string[]): void
}

const props = withDefaults(defineProps<Props>(), { members: () => [] })

const emit = defineEmits<Emits>()

const PREVIEW_COUNT = 4

function previewMembersFor(teamId: number): TeamMember[] {
  return props.members
    .filter(m => m.primaryTeamId === teamId || (m.teams ?? []).some(t => t.teamId === teamId))
    .slice(0, PREVIEW_COUNT)
}

// Template ref for scroll-into-view on page change
const sectionRef = ref<HTMLElement | null>(null)

// Search
const searchQuery = ref('')
const debouncedSearch = useDebounce(searchQuery, 300)
const isSearching = computed(() => debouncedSearch.value.trim().length > 0)

const filteredTeams = computed(() => {
  const query = debouncedSearch.value.trim().toLowerCase()
  if (!query) {return props.teams}
  return props.teams.filter(t =>
    t.name.toLowerCase().includes(query) ||
    (t.description?.toLowerCase().includes(query))
  )
})

function clearSearch() {
  searchQuery.value = ''
}

// Pagination
const PAGE_SIZE = 10
const pagination = usePagination({ limit: PAGE_SIZE, total: filteredTeams.value.length })

// Computed
const isCustomMode = computed(() => props.sortMode === 'custom')

// Paginated teams from full sorted list
const paginatedTeams = computed(() => {
  return pagination.paginateData(filteredTeams.value)
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
const localTeams = ref<Team[]>([...paginatedTeams.value])

// Sync total when filtered teams change
watch(
  () => filteredTeams.value.length,
  (newLength) => {
    pagination.setTotal(newLength)
  }
)

// Reset to page 1 when search query changes
watch(debouncedSearch, () => {
  pagination.setPage(1)
})

// Sync local teams with paginated view when teams or page changes
watch(
  paginatedTeams,
  (newTeams) => {
    localTeams.value = [...newTeams]
  },
  { deep: true }
)

// Handle drag start - no action needed
function onDragStart() {
  // Optional: Add visual feedback
}

// Handle drag end - reconstruct full order with page slice replaced
function onDragEnd() {
  // Ignore drag in search mode
  if (isSearching.value) {return}

  // Switch to custom mode if not already
  if (props.sortMode !== 'custom') {
    emit('sort-mode-change', 'custom')
  }

  // Reconstruct full order: replace current page's slice with dragged order
  const fullOrder = [...props.teams]
  const startIdx = pagination.startIndex.value
  const pageLength = localTeams.value.length

  // Replace the current page slice in the full array
  fullOrder.splice(startIdx, pageLength, ...localTeams.value)

  const newOrder = fullOrder.map(t => String(t.id))
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
</script>

<style scoped>
.team-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 4px 4px 0;
}
.section-head > :first-child {
  min-width: 0;
  flex: 1;
}
.section-head .ui-card-sub {
  margin-top: 2px;
  font-size: var(--ui-t-foot);
  color: var(--ui-muted);
}
.section-end {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 260px;
  max-width: 100%;
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
  font-size: 11.5px;
  white-space: nowrap;
}

.content-body {
  min-width: 0;
}
.drag-hint {
  padding: 4px 4px 8px;
  font-size: 12px;
  color: var(--ui-muted);
}
.drag-ghost {
  opacity: 0.4;
}
.drag-chosen {
  cursor: grabbing;
}
.drag-active {
  box-shadow: var(--ui-shadow-raised);
}

@media (max-width: 768px) {
  .section-end {
    width: 100%;
  }
  .search-bar {
    flex: 1 1 100%;
    width: auto;
  }
}
</style>
