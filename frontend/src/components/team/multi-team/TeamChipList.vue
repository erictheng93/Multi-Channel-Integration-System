<template>
  <div class="team-chips-container">
    <TransitionGroup name="chip">
      <div
        v-for="team in teams"
        :key="team.teamId"
        class="team-chip"
        :class="{
          'is-pending-add': isPendingAdd(team.teamId),
          'is-pending-remove': isPendingRemove(team.teamId)
        }"
      >
        <span class="chip-icon">{{ getChipIcon(team) }}</span>
        <span class="chip-name">{{ team.teamName || `團隊 #${team.teamId}` }}</span>
        <button
          type="button"
          class="chip-remove"
          :class="{ 'is-cancel': isPendingRemove(team.teamId) }"
          :disabled="loading"
          :title="isPendingRemove(team.teamId) ? '取消移除' : `從「${team.teamName}」移除`"
          @click="$emit('remove', team)"
        >
          <svg
            v-if="!isPendingRemove(team.teamId)"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          <svg
            v-else
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </TransitionGroup>

    <!-- Empty State -->
    <div
      v-if="teams.length === 0"
      class="empty-state"
    >
      <div class="empty-state-icon">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle
            cx="9"
            cy="7"
            r="4"
          />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <span class="empty-state-text">尚未分配團隊</span>
      <span class="empty-state-hint">點擊下方按鈕新增</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * TeamChipList Component
 *
 * Displays team memberships as interactive chips with animations.
 * Supports visual indicators for pending changes in deferred mode.
 *
 * Features:
 * - TransitionGroup animations for smooth chip add/remove
 * - Remove button (×) for each team
 * - Pending change indicators for add/remove operations
 * - Empty state display
 */

import type { AgentTeamMembership } from '@/types'
import type { PendingTeamChange } from '@/composables/team-management/useMemberEditForm'

interface Props {
  /** List of teams the member belongs to */
  teams: AgentTeamMembership[]

  /** Loading state during operations */
  loading?: boolean

  /** Pending changes for visual indicators (deferred mode) */
  pendingChanges?: PendingTeamChange[]
}

interface Emits {
  /** Emitted when remove button is clicked */
  (_e: 'remove', _team: AgentTeamMembership): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  pendingChanges: () => []
})

defineEmits<Emits>()

/**
 * Check if a team has a pending add change
 */
const isPendingAdd = (teamId: number): boolean => {
  return props.pendingChanges.some(c => c.type === 'add' && c.teamId === teamId)
}

/**
 * Check if a team has a pending remove change
 */
const isPendingRemove = (teamId: number): boolean => {
  return props.pendingChanges.some(c => c.type === 'remove' && c.teamId === teamId)
}

/**
 * Get the appropriate icon for a team chip
 */
const getChipIcon = (team: AgentTeamMembership): string => {
  if (isPendingRemove(team.teamId)) {
    return '🗑️'
  }
  if (isPendingAdd(team.teamId)) {
    return '➕'
  }
  return '👥'
}
</script>

<style scoped>
.team-chips-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 40px;
  margin: 16px 0;
}

/* Team Chip Styles */
.team-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(135deg, #f8fafc, #e2e8f0);
  border: 1px solid #cbd5e1;
  border-radius: 20px;
  font-size: 0.9375rem;
  font-weight: 500;
  color: #475569;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
}

.team-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  border-color: #94a3b8;
}

/* Pending Add Style */
.team-chip.is-pending-add {
  background: linear-gradient(135deg, #dcfce7, #bbf7d0);
  border-color: #22c55e;
  border-style: dashed;
  color: #166534;
}

.team-chip.is-pending-add:hover {
  background: linear-gradient(135deg, #bbf7d0, #86efac);
  border-color: #16a34a;
}

/* Pending Remove Style */
.team-chip.is-pending-remove {
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  border-color: #ef4444;
  border-style: dashed;
  color: #991b1b;
  opacity: 0.8;
  text-decoration: line-through;
}

.team-chip.is-pending-remove:hover {
  opacity: 1;
  background: linear-gradient(135deg, #fecaca, #fca5a5);
  border-color: #dc2626;
}

.chip-icon {
  font-size: 1.125rem;
  line-height: 1;
  flex-shrink: 0;
}

.chip-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

/* Chip Action Buttons */
.chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(100, 116, 139, 0.2);
  border-radius: 50%;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  backdrop-filter: blur(4px);
}

.chip-remove:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #ef4444;
  color: #dc2626;
  transform: scale(1.1);
}

/* Cancel style - when clicking cancels a pending remove */
.chip-remove.is-cancel {
  background: rgba(220, 252, 231, 0.8);
  border-color: #22c55e;
  color: #16a34a;
}

.chip-remove.is-cancel:hover:not(:disabled) {
  background: #dcfce7;
  border-color: #16a34a;
  color: #15803d;
  transform: scale(1.1);
}

.chip-remove:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 32px;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  border: 2px dashed #e2e8f0;
  border-radius: 16px;
  width: 100%;
}

.empty-state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
  border-radius: 50%;
  color: #64748b;
  margin-bottom: 4px;
}

.empty-state-text {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #475569;
}

.empty-state-hint {
  font-size: 0.8125rem;
  color: #94a3b8;
}

/* Transition Animations */
.chip-enter-active,
.chip-leave-active {
  transition: all 0.3s ease;
}

.chip-enter-from {
  opacity: 0;
  transform: scale(0.8) translateY(-10px);
}

.chip-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(10px);
}

.chip-move {
  transition: transform 0.3s ease;
}

/* Responsive */
@media (max-width: 640px) {
  .team-chip {
    font-size: 0.875rem;
    padding: 8px 12px;
  }

  .chip-name {
    max-width: 120px;
  }

  .chip-icon {
    font-size: 1rem;
  }
}
</style>
