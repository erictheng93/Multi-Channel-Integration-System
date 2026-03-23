<template>
  <div
    ref="sectionRef"
    class="content-section"
  >
    <!-- Header -->
    <div class="content-header">
      <h2 class="content-title">
        <UsersIcon />
        人員管理 Staff Management ({{ members.length }})
      </h2>
      <div class="header-actions">
        <!-- Bulk Selection Mode Toggle -->
        <button
          class="btn btn-outline"
          :class="{ 'btn-outline-active': isSelectionMode }"
          @click="emit('toggle-selection-mode')"
        >
          <CheckSquareIcon v-if="isSelectionMode" />
          <SquareIcon v-else />
          {{ isSelectionMode ? '取消選擇' : '批量選擇' }}
        </button>

        <!-- Bulk Actions (shown when in selection mode) -->
        <template v-if="isSelectionMode && (selectedCount ?? 0) > 0">
          <span class="selection-count">
            已選擇 {{ selectedCount ?? 0 }} 位
          </span>
          <button
            class="btn btn-primary"
            @click="emit('bulk-edit')"
          >
            <EditIcon />
            批量編輯
          </button>
          <button
            class="btn btn-danger"
            @click="emit('bulk-delete')"
          >
            <TrashIcon />
            移除選取
          </button>
        </template>

        <!-- Select All (shown when in selection mode) -->
        <template v-if="isSelectionMode">
          <!-- Multi-page: show page/all options -->
          <template v-if="pagination.totalPages.value > 1">
            <button
              class="btn btn-outline"
              @click="handleSelectPage"
            >
              全選本頁
            </button>
            <button
              class="btn btn-outline"
              @click="emit('select-all')"
            >
              全選全部
            </button>
          </template>
          <!-- Single page: show original single button -->
          <button
            v-else
            class="btn btn-outline"
            @click="emit('select-all')"
          >
            全選
          </button>
        </template>

        <!-- Sort Dropdown (hidden in selection mode) -->
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
        <PrimaryActionButton
          v-if="!isSelectionMode"
          class="add-member-btn"
          text="新增成員"
          :icon="PlusIcon"
          :loading="loading"
          @click="emit('add-member')"
        />
      </div>
    </div>

    <!-- Search Bar -->
    <div
      v-if="!loading && members.length > 0"
      class="search-bar"
    >
      <SearchIcon class="search-icon" />
      <input
        v-model="searchQuery"
        class="search-input"
        type="text"
        placeholder="搜尋成員 (姓名、信箱、帳號)..."
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
        找到 {{ filteredMembers.length }} / {{ members.length }}
      </span>
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
          v-if="isSearching && isCustomMode"
          class="drag-hint"
        >
          搜尋模式下無法拖曳排序
        </div>

        <VueDraggable
          v-model="localMembers"
          class="members-list"
          :animation="200"
          handle=".drag-handle"
          ghost-class="drag-ghost"
          chosen-class="drag-chosen"
          drag-class="drag-active"
          :disabled="isSearching"
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
            class="draggable-card"
            @update-role="(memberId: string, role: string) => emit('update-role', memberId, role)"
            @toggle-status="(m) => emit('toggle-status', m)"
            @reset-password="(m) => emit('reset-password', m)"
            @remove-member="(m) => emit('remove-member', m)"
            @toggle-selection="(memberId: string) => emit('toggle-member-selection', memberId)"
          />
        </VueDraggable>

        <!-- Pagination Controls -->
        <PaginationControls
          :pagination="paginationInfo"
          :visible-pages="pagination.pageRange.value"
          @change-page="handlePageChange"
        />
      </template>
    </div>
  </div>
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
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue'
import SortDropdown from '@/components/ui/SortDropdown.vue'
import UsersIcon from '@/components/icons/UsersIcon.vue'
import PlusIcon from '@/components/icons/PlusIcon.vue'
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

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Template ref for scroll-into-view on page change
const sectionRef = ref<HTMLElement | null>(null)

// Search
const searchQuery = ref('')
const debouncedSearch = useDebounce(searchQuery, 300)
const isSearching = computed(() => debouncedSearch.value.trim().length > 0)

const filteredMembers = computed(() => {
  const query = debouncedSearch.value.trim().toLowerCase()
  if (!query) {return props.members}
  return props.members.filter(m =>
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
  if (isSearching.value) {return}

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
  color: #6366f1;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
  flex: 1;
}

/* Push add member button to the right */
.add-member-btn {
  margin-left: auto;
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
  border-color: #6366f1;
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
  color: #6366f1;
  font-weight: 600;
  white-space: nowrap;
  padding: 0.25rem 0.5rem;
  background: #eef2ff;
  border-radius: 4px;
}

.content-body {
  min-height: 200px;
}

.members-list {
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
  transition: all 0.2s ease;
}

.draggable-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Drag states */
.drag-ghost {
  opacity: 0.4;
  background: #e0e7ff;
  border-radius: 12px;
}

.drag-chosen {
  box-shadow: 0 8px 25px rgba(99, 102, 241, 0.25);
  transform: scale(1.02);
}

.drag-active {
  transform: rotate(1deg) scale(1.02);
  box-shadow: 0 12px 35px rgba(99, 102, 241, 0.3);
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
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

/* Outline Button */
.btn-outline {
  background: white;
  color: #4b5563;
  border: 1px solid #d1d5db;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-outline:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.btn-outline-active {
  background: #eef2ff;
  color: #4f46e5;
  border-color: #6366f1;
}

.btn-outline-active:hover {
  background: #e0e7ff;
}

/* Danger Button */
.btn-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-danger:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

/* Selection Count Badge */
.selection-count {
  padding: 0.5rem 1rem;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
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
