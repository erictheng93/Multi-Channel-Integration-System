<template>
  <div class="team-chips-container">
    <TransitionGroup name="chip">
      <div
        v-for="team in teams"
        :key="team.teamId"
        class="team-chip"
        :class="{
          'is-primary': team.isPrimary,
          'is-pending-add': isPendingAdd(team.teamId),
          'is-pending-remove': isPendingRemove(team.teamId)
        }"
      >
        <span class="chip-icon">{{ getChipIcon(team) }}</span>
        <span class="chip-name">{{ team.teamName || `團隊 #${team.teamId}` }}</span>
        <span
          v-if="isPendingAdd(team.teamId)"
          class="chip-status"
          title="待新增"
        >
          +
        </span>
        <span
          v-if="isPendingRemove(team.teamId)"
          class="chip-status remove"
          title="待移除"
        >
          −
        </span>
        <button
          type="button"
          class="chip-remove"
          :disabled="loading"
          :title="isPendingRemove(team.teamId) ? '取消移除' : `從「${team.teamName}」移除`"
          @click="$emit('remove', team)"
        >
          ×
        </button>
        <button
          v-if="!team.isPrimary && teams.length > 1 && !isPendingRemove(team.teamId)"
          type="button"
          class="chip-star"
          :disabled="loading"
          title="設為主要團隊"
          @click="$emit('set-primary', team)"
        >
          ☆
        </button>
      </div>
    </TransitionGroup>

    <!-- Empty State -->
    <div
      v-if="teams.length === 0"
      class="no-teams-message"
    >
      <span class="empty-icon">📭</span>
      <span>尚未加入任何群組</span>
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
 * - Primary team indicator (⭐)
 * - Remove button (×) for each team
 * - Set as primary button (☆) for non-primary teams
 * - Pending change indicators (+ for add, − for remove)
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

  /** Emitted when set-as-primary button is clicked */
  (_e: 'set-primary', _team: AgentTeamMembership): void
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
  if (team.isPrimary) {
    return '⭐'
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

.team-chip.is-primary {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  border-color: #fbbf24;
  color: #92400e;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(251, 191, 36, 0.3);
}

.team-chip.is-primary:hover {
  background: linear-gradient(135deg, #fde68a, #fcd34d);
  border-color: #f59e0b;
  box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
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

.chip-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: #22c55e;
  border-radius: 50%;
  color: white;
  font-size: 0.875rem;
  font-weight: 700;
  flex-shrink: 0;
}

.chip-status.remove {
  background: #ef4444;
}

/* Chip Action Buttons */
.chip-remove,
.chip-star {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(100, 116, 139, 0.2);
  border-radius: 50%;
  font-size: 0.875rem;
  font-weight: 700;
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

/* Special style for pending remove - clicking cancels */
.is-pending-remove .chip-remove:hover:not(:disabled) {
  background: #dcfce7;
  border-color: #22c55e;
  color: #16a34a;
}

.chip-star {
  font-size: 1rem;
  line-height: 1;
}

.chip-star:hover:not(:disabled) {
  background: #fef3c7;
  border-color: #fbbf24;
  color: #f59e0b;
  transform: scale(1.1);
}

.chip-remove:disabled,
.chip-star:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Empty State */
.no-teams-message {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  color: #94a3b8;
  font-size: 0.9375rem;
  font-style: italic;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
}

.empty-icon {
  font-size: 1.5rem;
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
