<template>
  <div class="add-team-section">
    <select
      v-model="selectedTeam"
      class="team-add-select"
      :disabled="availableTeams.length === 0 || loading"
      @change="handleTeamSelection"
    >
      <option
        :value="null"
        disabled
      >
        {{ availableTeams.length === 0 ? '已加入所有可用群組' : '+ 選擇群組加入...' }}
      </option>
      <option
        v-for="team in availableTeams"
        :key="team.id"
        :value="team.id"
      >
        {{ team.name }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
/**
 * TeamAddDropdown Component
 *
 * Extracted from TeamMemberCard.vue (lines 210-229)
 * Dropdown for adding member to available teams
 *
 * Features:
 * - Displays list of available teams
 * - Auto-resets after selection
 * - Disabled when no teams available or during operations
 */

import { ref, type Ref } from 'vue'
import type { Team } from '@/types'

interface Props {
  /** Teams available for the member to join */
  availableTeams: Team[]

  /** Loading state during operations */
  loading?: boolean
}

interface Emits {
  /** Emitted when a team is selected */
  (_e: 'add', _teamId: number): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const selectedTeam = ref<number | null>(null) as Ref<number | null>

/**
 * Handle team selection and reset dropdown
 */
const handleTeamSelection = () => {
  if (selectedTeam.value) {
    emit('add', selectedTeam.value)
    // Reset dropdown after selection
    selectedTeam.value = null
  }
}
</script>

<style scoped>
.add-team-section {
  margin-top: 12px;
}

.team-add-select {
  width: 100%;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f8fafc, #ffffff);
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
}

.team-add-select:hover:not(:disabled) {
  background: linear-gradient(135deg, #e2e8f0, #f1f5f9);
  border-color: #94a3b8;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.team-add-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  background: white;
}

.team-add-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f1f5f9;
}

.team-add-select option {
  padding: 10px;
  background: white;
  color: #475569;
}

.team-add-select option:disabled {
  color: #94a3b8;
  font-style: italic;
}

/* Responsive */
@media (max-width: 640px) {
  .team-add-select {
    font-size: 0.9375rem;
    padding: 10px 14px;
  }
}
</style>
