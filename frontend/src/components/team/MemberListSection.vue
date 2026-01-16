<template>
  <div class="content-section">
    <!-- Header -->
    <div class="content-header">
      <h2 class="content-title">
        <UsersIcon />
        人員管理 Staff Management ({{ members.length }})
      </h2>
      <div class="header-actions">
        <!-- Sort Mode Toggle -->
        <SortModeToggle
          :mode="sortMode"
          :disabled="loading"
          @change="(mode) => emit('sort-mode-change', mode)"
        />
        <!-- Sort Dropdown (only visible in auto mode) -->
        <SortDropdown
          v-if="sortMode === 'auto'"
          :options="sortOptions"
          :current-field="sortState.field"
          :current-label="currentSortLabel"
          :sort-order="sortState.order"
          @select="(field) => emit('sort-change', field)"
          @toggle-order="emit('sort-toggle')"
        />
        <PrimaryActionButton
          text="新增成員"
          :icon="PlusIcon"
          :loading="loading"
          @click="emit('add-member')"
        />
      </div>
    </div>

    <!-- Custom Sort Hint -->
    <div
      v-if="sortMode === 'custom'"
      class="sort-hint"
    >
      <DragHintIcon class="hint-icon" />
      <span>拖動 <span class="drag-handle-hint">⋮⋮</span> 把手來自訂排序順序</span>
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

      <!-- Members List - Draggable in custom mode -->
      <VueDraggable
        v-else-if="sortMode === 'custom'"
        v-model="localMembers"
        class="members-list"
        handle=".drag-handle"
        :animation="200"
        ghost-class="drag-ghost"
        chosen-class="drag-chosen"
        drag-class="drag-active"
        @end="onDragEnd"
      >
        <div
          v-for="member in localMembers"
          :key="member.id"
          class="draggable-item"
        >
          <div class="drag-handle">
            <DragHandleIcon />
          </div>
          <TeamMemberCard
            :member="member"
            :all-teams="allTeams"
            :current-user-id="currentUserId"
            :loading="loading"
            class="member-card-draggable"
            @update-role="(memberId: string, role: string) => emit('update-role', memberId, role)"
            @toggle-status="(m) => emit('toggle-status', m)"
            @reset-password="(m) => emit('reset-password', m)"
            @remove-member="(m) => emit('remove-member', m)"
          />
        </div>
      </VueDraggable>

      <!-- Members List - Static in auto mode -->
      <div
        v-else
        class="members-list"
      >
        <TeamMemberCard
          v-for="member in members"
          :key="member.id"
          :member="member"
          :all-teams="allTeams"
          :current-user-id="currentUserId"
          :loading="loading"
          @update-role="(memberId: string, role: string) => emit('update-role', memberId, role)"
          @toggle-status="(m) => emit('toggle-status', m)"
          @reset-password="(m) => emit('reset-password', m)"
          @remove-member="(m) => emit('remove-member', m)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { TeamMember, Team } from '@/types'
import type { SortOption, SortState, SortMode } from '@/composables/useListSorting'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TeamMemberCard from '@/components/team/TeamMemberCard.vue'
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue'
import SortDropdown from '@/components/ui/SortDropdown.vue'
import SortModeToggle from '@/components/ui/SortModeToggle.vue'
import UsersIcon from '@/components/icons/UsersIcon.vue'
import PlusIcon from '@/components/icons/PlusIcon.vue'

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
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Local copy for drag operations
const localMembers = ref<TeamMember[]>([...props.members])

// Sync local members with props when members change
watch(
  () => props.members,
  (newMembers) => {
    localMembers.value = [...newMembers]
  },
  { deep: true }
)

// Handle drag end
function onDragEnd() {
  const newOrder = localMembers.value.map(m => m.id)
  emit('custom-order-change', newOrder)
}

// Icons
const DragHandleIcon = {
  template: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>`
}

const DragHintIcon = {
  template: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
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
}

.sort-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  border-radius: 8px;
  font-size: 0.875rem;
  color: #4338ca;
}

.hint-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.drag-handle-hint {
  display: inline-flex;
  padding: 0.125rem 0.375rem;
  background: white;
  border-radius: 4px;
  font-weight: 600;
  color: #6366f1;
}

.content-body {
  min-height: 200px;
}

.members-list {
  display: grid;
  gap: 1rem;
}

/* Draggable item wrapper */
.draggable-item {
  display: flex;
  align-items: stretch;
  gap: 0;
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  min-width: 32px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-right: none;
  border-radius: 8px 0 0 8px;
  color: #94a3b8;
  cursor: grab;
  transition: all 0.2s;
}

.drag-handle:hover {
  background: #f1f5f9;
  color: #6366f1;
}

.drag-handle:active {
  cursor: grabbing;
}

.member-card-draggable {
  flex: 1;
  border-radius: 0 8px 8px 0 !important;
}

/* Drag states */
.drag-ghost {
  opacity: 0.4;
  background: #c7d2fe;
}

.drag-chosen {
  box-shadow: 0 8px 25px rgba(99, 102, 241, 0.25);
}

.drag-active {
  transform: rotate(2deg);
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

  .sort-hint {
    font-size: 0.8125rem;
  }
}
</style>
