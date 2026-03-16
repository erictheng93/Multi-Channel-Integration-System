<template>
  <div class="content-section">
    <!-- Header -->
    <div class="content-header">
      <h2 class="content-title">
        <TeamsIcon />
        團隊設置 Team Settings ({{ teams.length }})
      </h2>
      <div class="header-actions">
        <!-- Sort Dropdown -->
        <SortDropdown
          :options="sortOptions"
          :current-field="sortState.field"
          :current-label="isCustomMode ? '自訂順序' : currentSortLabel"
          :sort-order="sortState.order"
          :is-custom-mode="isCustomMode"
          @select="handleSortSelect"
          @toggle-order="emit('sort-toggle')"
          @reset-to-auto="handleResetToAuto"
        />
        <PrimaryActionButton
          text="新增團隊"
          :icon="PlusIcon"
          :loading="loading"
          @click="emit('add-team')"
        />
      </div>
    </div>

    <!-- Search Bar -->
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
        @keydown.escape="clearSearch"
      >
      <button
        v-if="searchQuery"
        class="search-clear"
        @click="clearSearch"
      />
      <span
        v-if="isSearching"
        class="search-stats"
      >
        找到 {{ filteredTeams.length }} / {{ teams.length }}
      </span>
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
          class="teams-list"
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
            class="draggable-card"
            @toggle-status="(t) => emit('toggle-status', t)"
            @remove-team="(t) => emit('remove-team', t)"
            @member-updated="emit('member-updated')"
            @team-updated="emit('team-updated')"
          />
        </VueDraggable>

        <!-- Pagination Controls -->
        <PaginationControls
          :pagination="paginationInfo"
          :visible-pages="pagination.pageRange.value"
          @change-page="pagination.setPage"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { Team } from '@/composables/team-management'
import type { SortOption, SortState, SortMode } from '@/composables/useListSorting'
import { usePagination } from '@/composables/usePagination'
import { useDebounce } from '@/composables/useDebounce'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PaginationControls from '@/components/ui/PaginationControls.vue'
import TeamCard from '@/components/team/TeamCard.vue'
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue'
import SortDropdown from '@/components/ui/SortDropdown.vue'
import TeamsIcon from '@/components/icons/TeamsIcon.vue'
import PlusIcon from '@/components/icons/PlusIcon.vue'
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

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

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
</script>

<style scoped>
.content-section {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.content-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0;
}

.content-title svg {
  width: 24px;
  height: 24px;
  color: #10b981;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

/* Search Bar */
.search-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: border-color 0.2s;
}

.search-bar:focus-within {
  border-color: #10b981;
  background: white;
}

.search-icon {
  width: 18px;
  height: 18px;
  color: #9ca3af;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.875rem;
  color: #1f2937;
  outline: none;
}

.search-input::placeholder {
  color: #9ca3af;
}

.search-clear {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0.25rem;
  line-height: 1;
  border-radius: 4px;
  transition: all 0.15s;
}

.search-clear:hover {
  color: #4b5563;
  background: #e5e7eb;
}

.search-stats {
  font-size: 0.75rem;
  color: #10b981;
  font-weight: 600;
  white-space: nowrap;
  padding: 0.25rem 0.5rem;
  background: #ecfdf5;
  border-radius: 4px;
}

.content-body {
  min-height: 200px;
}

.teams-list {
  display: grid;
  gap: 1rem;
}

/* Drag hint */
.drag-hint {
  padding: 0.5rem 1rem;
  margin-bottom: 0.75rem;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.8rem;
  border-radius: 6px;
  text-align: center;
}

/* Draggable card styles */
.draggable-card {
  cursor: grab;
  transition: all 0.2s ease;
}

.draggable-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.draggable-card:active {
  cursor: grabbing;
}

/* Drag states */
.drag-ghost {
  opacity: 0.4;
  background: #d1fae5;
  border-radius: 12px;
}

.drag-chosen {
  box-shadow: 0 8px 25px rgba(16, 185, 129, 0.25);
  transform: scale(1.02);
}

.drag-active {
  transform: rotate(1deg) scale(1.02);
  box-shadow: 0 12px 35px rgba(16, 185, 129, 0.3);
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

@media (max-width: 768px) {
  .content-section {
    padding: 1.5rem;
  }

  .content-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: flex-end;
  }

  .content-title {
    font-size: 1.25rem;
  }
}
</style>
