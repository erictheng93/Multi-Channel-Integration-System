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
      <VueDraggable
        v-else
        v-model="localTeams"
        class="teams-list"
        :animation="200"
        ghost-class="drag-ghost"
        chosen-class="drag-chosen"
        drag-class="drag-active"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { Team } from '@/composables/team-management'
import type { SortOption, SortState, SortMode } from '@/composables/useListSorting'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TeamCard from '@/components/team/TeamCard.vue'
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue'
import SortDropdown from '@/components/ui/SortDropdown.vue'
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

// Computed
const isCustomMode = computed(() => props.sortMode === 'custom')

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

// Handle drag start - no action needed
function onDragStart() {
  // Optional: Add visual feedback
}

// Handle drag end - switch to custom mode and save order
function onDragEnd() {
  // Switch to custom mode if not already
  if (props.sortMode !== 'custom') {
    emit('sort-mode-change', 'custom')
  }
  // Save custom order
  const newOrder = localTeams.value.map(t => String(t.id))
  emit('custom-order-change', newOrder)
}

// Handle sort field selection
function handleSortSelect(field: string) {
  // If in custom mode, switch back to auto first
  if (props.sortMode === 'custom') {
    emit('sort-mode-change', 'auto')
  }
  emit('sort-change', field)
}

// Reset to auto sort
function handleResetToAuto() {
  emit('sort-mode-change', 'auto')
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

.content-body {
  min-height: 200px;
}

.teams-list {
  display: grid;
  gap: 1rem;
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
