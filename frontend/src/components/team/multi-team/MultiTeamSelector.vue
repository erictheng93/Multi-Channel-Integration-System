<template>
  <div class="multi-team-selector">
    <div class="section-header">
      <h4>團隊分配</h4>
      <span
        v-if="teamOperationStatus"
        :class="['status-message', teamOperationStatus.type]"
      >
        {{ teamOperationStatus.message }}
      </span>
    </div>

    <!-- Team Chips List -->
    <TeamChipList
      :teams="memberTeams"
      :loading="teamOperationLoading"
      @remove="handleRemoveTeam"
      @set-primary="handleSetPrimary"
    />

    <!-- Add Team Dropdown -->
    <TeamAddDropdown
      :available-teams="availableTeamsToJoin"
      :loading="teamOperationLoading"
      @add="handleAddTeam"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * MultiTeamSelector Component
 *
 * Extracted from TeamMemberCard.vue
 * Orchestrates multi-team management with TeamChipList and TeamAddDropdown
 *
 * Features:
 * - Integrates useMemberTeams composable
 * - Displays current team memberships
 * - Allows adding/removing teams
 * - Shows operation status messages
 */

import { type Ref } from 'vue'
import TeamChipList from './TeamChipList.vue'
import TeamAddDropdown from './TeamAddDropdown.vue'
import { useMemberTeams } from '@/composables/team-management/useMemberTeams'
import type { Team, AgentTeamMembership } from '@/types'

interface Props {
  /** Member ID */
  memberId: string

  /** All available teams */
  allTeams: Team[]
}

const props = defineProps<Props>()

// Initialize multi-team management composable
const {
  memberTeams,
  availableTeamsToJoin,
  teamOperationLoading,
  teamOperationStatus,
  loadMemberTeams,
  addToTeam,
  removeFromTeam,
  setPrimaryTeam
} = useMemberTeams(props.allTeams as unknown as Ref<Team[]>)

// Load member teams on mount
loadMemberTeams(props.memberId)

/**
 * Handle adding member to a team
 */
const handleAddTeam = async (teamId: number) => {
  await addToTeam(props.memberId, teamId)
}

/**
 * Handle removing member from a team
 */
const handleRemoveTeam = async (team: AgentTeamMembership) => {
  await removeFromTeam(props.memberId, team.teamId)
}

/**
 * Handle setting a team as primary
 */
const handleSetPrimary = async (team: AgentTeamMembership) => {
  await setPrimaryTeam(props.memberId, team.teamId)
}
</script>

<style scoped>
.multi-team-selector {
  margin: 20px 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h4 {
  margin: 0;
  color: #1e293b;
  font-size: 1.125rem;
  font-weight: 600;
}

.status-message {
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.status-message.success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.status-message.error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

/* Responsive */
@media (max-width: 640px) {
  .section-header h4 {
    font-size: 1rem;
  }

  .status-message {
    font-size: 0.8125rem;
    padding: 4px 10px;
  }
}
</style>
