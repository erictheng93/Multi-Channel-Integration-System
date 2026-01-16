<template>
  <div class="content-section">
    <!-- Header -->
    <div class="content-header">
      <h2 class="content-title">
        <TeamsIcon />
        團隊設置 Team Settings ({{ teams.length }})
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
          text="新增團隊"
          :icon="PlusIcon"
          :loading="loading"
          @click="emit('add-team')"
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

      <!-- Teams List - Draggable in custom mode -->
      <VueDraggable
        v-else-if="sortMode === 'custom'"
        v-model="localTeams"
        class="teams-list"
        handle=".drag-handle"
        :animation="200"
        ghost-class="drag-ghost"
        chosen-class="drag-chosen"
        drag-class="drag-active"
        @end="onDragEnd"
      >
        <div
          v-for="team in localTeams"
          :key="team.id"
          class="draggable-item"
        >
          <div class="drag-handle">
            <DragHandleIcon />
          </div>
          <TeamCard
            :team="team"
            :loading="loading"
            class="team-card-draggable"
            @toggle-status="(t) => emit('toggle-status', t)"
            @remove-team="(t) => emit('remove-team', t)"
            @member-updated="emit('member-updated')"
            @team-updated="emit('team-updated')"
          />
        </div>
      </VueDraggable>

      <!-- Teams List - Static in auto mode -->
      <div
        v-else
        class="teams-list"
      >
        <TeamCard
          v-for="team in teams"
          :key="team.id"
          :team="team"
          :loading="loading"
          @toggle-status="(t) => emit('toggle-status', t)"
          @remove-team="(t) => emit('remove-team', t)"
          @member-updated="emit('member-updated')"
          @team-updated="emit('team-updated')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { Team } from '@/composables/team-management'
import type { SortOption, SortState, SortMode } from '@/composables/useListSorting'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TeamCard from '@/components/team/TeamCard.vue'
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue'
import SortDropdown from '@/components/ui/SortDropdown.vue'
import SortModeToggle from '@/components/ui/SortModeToggle.vue'
import TeamsIcon from '@/components/icons/TeamsIcon.vue'
import PlusIcon from '@/components/icons/PlusIcon.vue'

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

// Local copy for drag operations
const localTeams = ref<Team[]>([...props.teams])

// Sync local teams with props when teams change
watch(
  () => props.teams,
  (newTeams) => {
    localTeams.value = [...newTeams]
  },
  { deep: true }
)

// Handle drag end
function onDragEnd() {
  const newOrder = localTeams.value.map(t => String(t.id))
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
  color: #10b981;
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
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border-radius: 8px;
  font-size: 0.875rem;
  color: #047857;
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
  color: #10b981;
}

.content-body {
  min-height: 200px;
}

.teams-list {
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
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-right: none;
  border-radius: 8px 0 0 8px;
  color: #86efac;
  cursor: grab;
  transition: all 0.2s;
}

.drag-handle:hover {
  background: #dcfce7;
  color: #10b981;
}

.drag-handle:active {
  cursor: grabbing;
}

.team-card-draggable {
  flex: 1;
  border-radius: 0 8px 8px 0 !important;
}

/* Drag states */
.drag-ghost {
  opacity: 0.4;
  background: #bbf7d0;
}

.drag-chosen {
  box-shadow: 0 8px 25px rgba(16, 185, 129, 0.25);
}

.drag-active {
  transform: rotate(2deg);
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

  .sort-hint {
    font-size: 0.8125rem;
  }
}
</style>
