<template>
  <div class="multi-team-selector">
    <div class="section-header">
      <h4>團隊分配</h4>
      <span
        v-if="!deferredMode && teamOperationStatus"
        :class="['status-message', teamOperationStatus.type]"
      >
        {{ teamOperationStatus.message }}
      </span>
      <span
        v-else-if="deferredMode && hasPendingChanges && !hideStatusMessage"
        class="status-message pending"
      >
        有未儲存的變更
      </span>
    </div>

    <!-- Team Chips List -->
    <TeamChipList
      :teams="effectiveTeams"
      :loading="effectiveLoading"
      :pending-changes="deferredMode ? pendingChanges : []"
      @remove="handleRemoveTeam"
    />

    <!-- Add Team Dropdown -->
    <TeamAddDropdown
      :available-teams="effectiveAvailableTeams"
      :loading="effectiveLoading"
      @add="handleAddTeam"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * MultiTeamSelector Component
 *
 * Orchestrates multi-team management with TeamChipList and TeamAddDropdown.
 * Supports two modes:
 * - Immediate mode: API calls are made immediately (default)
 * - Deferred mode: Changes are staged and emitted for parent to save
 *
 * Features:
 * - Integrates useMemberTeams composable (immediate mode)
 * - Accepts external state management (deferred mode)
 * - Displays current team memberships
 * - Allows adding/removing teams
 * - Shows operation status messages
 */

import { computed, toRef, watch } from 'vue'
import TeamChipList from './TeamChipList.vue'
import TeamAddDropdown from './TeamAddDropdown.vue'
import { useMemberTeams } from '@/composables/team-management/useMemberTeams'
import type { Team, AgentTeamMembership } from '@/types'
import type { PendingTeamChange } from '@/composables/team-management/useMemberEditForm'

interface Props {
  /** Member ID */
  memberId: string

  /** All available teams */
  allTeams: Team[]

  /**
   * Enable deferred mode - changes are staged instead of saved immediately
   * When true, the component emits events instead of making API calls
   */
  deferredMode?: boolean

  /**
   * (Deferred mode) Teams to display
   * Should be the computed displayTeams from parent
   */
  teams?: AgentTeamMembership[]

  /**
   * (Deferred mode) Pending changes for visual indicators
   */
  pendingChanges?: PendingTeamChange[]

  /**
   * (Deferred mode) Loading state
   */
  loading?: boolean

  /**
   * Hide the status message (useful when parent shows it in header)
   */
  hideStatusMessage?: boolean
}

interface Emits {
  /** (Deferred mode) Emitted when user wants to add a team */
  (_e: 'add-team', _teamId: number, _teamName: string): void

  /** (Deferred mode) Emitted when user wants to remove a team */
  (_e: 'remove-team', _teamId: number): void

  /** Emitted when teams are loaded (for parent to initialize) */
  (_e: 'teams-loaded', _teams: AgentTeamMembership[]): void
}

const props = withDefaults(defineProps<Props>(), {
  deferredMode: false,
  teams: () => [],
  pendingChanges: () => [],
  loading: false,
  hideStatusMessage: false
})

const emit = defineEmits<Emits>()

// Convert props.allTeams to a proper Ref for the composable
const allTeamsRef = toRef(props, 'allTeams')

// Initialize multi-team management composable (for immediate mode)
const {
  memberTeams,
  availableTeamsToJoin,
  teamOperationLoading,
  teamOperationStatus,
  loadMemberTeams,
  addToTeam,
  removeFromTeam
} = useMemberTeams(allTeamsRef)

/**
 * Effective teams to display
 * In deferred mode: use props.teams from parent
 * In immediate mode: use memberTeams from composable
 */
const effectiveTeams = computed(() => {
  if (props.deferredMode) {
    return props.teams
  }
  return memberTeams.value
})

/**
 * Effective available teams for dropdown
 * In deferred mode: compute from allTeams - teams
 * In immediate mode: use availableTeamsToJoin from composable
 */
const effectiveAvailableTeams = computed(() => {
  if (props.deferredMode) {
    const teamIds = props.teams.map(t => t.teamId)
    return props.allTeams.filter(team => !teamIds.includes(team.id))
  }
  return availableTeamsToJoin.value
})

/**
 * Effective loading state
 */
const effectiveLoading = computed(() => {
  if (props.deferredMode) {
    return props.loading
  }
  return teamOperationLoading.value
})

/**
 * Check if there are pending changes (deferred mode only)
 */
const hasPendingChanges = computed(() => {
  return props.pendingChanges.length > 0
})

/**
 * Load member teams on mount (immediate mode only)
 */
const initializeTeams = async () => {
  if (!props.deferredMode) {
    await loadMemberTeams(props.memberId)
  } else {
    // In deferred mode, load teams and emit for parent to initialize
    await loadMemberTeams(props.memberId)
    emit('teams-loaded', memberTeams.value)
  }
}

// Initialize on mount
initializeTeams()

// Watch for memberId changes (in case modal is reused)
watch(
  () => props.memberId,
  () => {
    initializeTeams()
  }
)

/**
 * Handle adding member to a team
 */
const handleAddTeam = async (teamId: number) => {
  if (props.deferredMode) {
    // Deferred mode: emit event for parent to handle
    const team = props.allTeams.find(t => t.id === teamId)
    emit('add-team', teamId, team?.name || `團隊 #${teamId}`)
  } else {
    // Immediate mode: call API directly
    await addToTeam(props.memberId, teamId)
  }
}

/**
 * Handle removing member from a team
 */
const handleRemoveTeam = async (team: AgentTeamMembership) => {
  if (props.deferredMode) {
    // Deferred mode: emit event for parent to handle (no confirmation needed)
    emit('remove-team', team.teamId)
  } else {
    // Immediate mode: call API directly (with confirmation)
    await removeFromTeam(props.memberId, team.teamId)
  }
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

.status-message.pending {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
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
