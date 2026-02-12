/**
 * useMemberTeams Composable
 *
 * Extracted from TeamMemberCard.vue
 * Manages multi-team assignment and operations for team members
 *
 * Features:
 * - Multi-team state management with optimistic updates
 * - Add/remove/set primary team operations
 * - API integration with teamApi
 * - Confirmation dialogs for destructive operations
 * - Toast notifications for user feedback
 * - Auto-clearing status messages (3 seconds)
 * - Rollback on API failures
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { teamApi } from '@/api/team'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'
import type { AgentTeamMembership, Team } from '@/types'

interface TeamOperationStatus {
  type: 'success' | 'error'
  message: string
}

export interface UseMemberTeamsReturn {
  /** List of teams the member belongs to */
  memberTeams: Ref<AgentTeamMembership[]>

  /** Teams available for the member to join */
  availableTeamsToJoin: ComputedRef<Team[]>

  /** Loading state during team operations */
  teamOperationLoading: Ref<boolean>

  /** Status message from last operation (auto-clears after 3s) */
  teamOperationStatus: Ref<TeamOperationStatus | null>

  /** Load member's current team memberships */
  loadMemberTeams: (_memberId: string) => Promise<void>

  /** Add member to a team */
  addToTeam: (_memberId: string, _teamId: number) => Promise<boolean>

  /** Remove member from a team (with confirmation) */
  removeFromTeam: (_memberId: string, _teamId: number) => Promise<boolean>

  /** Set a team as the member's primary team */
  setPrimaryTeam: (_memberId: string, _teamId: number) => Promise<boolean>
}

export function useMemberTeams(allTeams: Ref<Team[]>): UseMemberTeamsReturn {
  const { showWarning } = useConfirmDialog()
  const { showSuccess, showError } = useToast()

  const memberTeams = ref<AgentTeamMembership[]>([]) as Ref<AgentTeamMembership[]>
  const teamOperationLoading = ref<boolean>(false) as Ref<boolean>
  const teamOperationStatus = ref<TeamOperationStatus | null>(null) as Ref<TeamOperationStatus | null>

  // Auto-clear status after 3 seconds
  let statusClearTimeout: ReturnType<typeof setTimeout> | null = null

  const setStatus = (status: TeamOperationStatus) => {
    teamOperationStatus.value = status

    // Clear previous timeout
    if (statusClearTimeout) {
      clearTimeout(statusClearTimeout)
    }

    // Auto-clear after 3 seconds
    statusClearTimeout = setTimeout(() => {
      teamOperationStatus.value = null
    }, 3000)
  }

  /**
   * Computed list of teams available for the member to join
   * Excludes teams the member is already part of
   */
  const availableTeamsToJoin: ComputedRef<Team[]> = computed(() => {
    // Guard: 確保 allTeams.value 存在，避免 undefined.filter() 錯誤
    if (!allTeams.value) {return []}
    const memberTeamIds = memberTeams.value.map(t => t.teamId)
    return allTeams.value.filter(team => !memberTeamIds.includes(team.id))
  })

  /**
   * Load member's current team memberships from API
   */
  const loadMemberTeams = async (memberId: string): Promise<void> => {
    try {
      const response = await teamApi.getAgentTeams(memberId)
      if (response.success && response.data) {
        memberTeams.value = response.data
      } else {
        console.error('載入成員團隊失敗:', response.error)
        memberTeams.value = []
      }
    } catch (error) {
      console.error('載入成員團隊失敗:', error)
      memberTeams.value = []
    }
  }

  /**
   * Add member to a team with optimistic UI update
   * Returns true if successful, false otherwise
   */
  const addToTeam = async (memberId: string, teamId: number): Promise<boolean> => {
    // Guard: 確保 allTeams.value 存在
    if (!allTeams.value) {
      showError('團隊資料尚未載入')
      return false
    }

    // Find the team to add
    const teamToAdd = allTeams.value.find(t => t.id === teamId)
    if (!teamToAdd) {
      showError('找不到指定的團隊')
      return false
    }

    // Optimistic update: add team to local state
    const newTeamMembership: AgentTeamMembership = {
      teamId,
      teamName: teamToAdd.name,
      roleInTeam: 'member',
      isPrimary: memberTeams.value.length === 0 // First team becomes primary
    }

    const previousTeams = [...memberTeams.value]
    memberTeams.value = [...memberTeams.value, newTeamMembership]

    try {
      teamOperationLoading.value = true

      const response = await teamApi.joinTeam(memberId, teamId, {
        roleInTeam: 'member',
        isPrimary: newTeamMembership.isPrimary
      })

      if (response.success) {
        showSuccess(`成功加入團隊: ${teamToAdd.name}`)
        setStatus({ type: 'success', message: `已加入 ${teamToAdd.name}` })
        return true
      } else {
        // Rollback on API failure
        memberTeams.value = previousTeams
        showError(response.error || '加入團隊失敗')
        setStatus({ type: 'error', message: '加入團隊失敗' })
        return false
      }
    } catch (error) {
      // Rollback on error
      memberTeams.value = previousTeams
      console.error('加入團隊失敗:', error)
      showError('加入團隊時發生錯誤')
      setStatus({ type: 'error', message: '操作失敗' })
      return false
    } finally {
      teamOperationLoading.value = false
    }
  }

  /**
   * Remove member from a team with confirmation dialog
   * Returns true if successful, false otherwise
   */
  const removeFromTeam = async (memberId: string, teamId: number): Promise<boolean> => {
    // Find the team to remove
    const teamToRemove = memberTeams.value.find(t => t.teamId === teamId)
    if (!teamToRemove) {
      showError('找不到指定的團隊')
      return false
    }

    // Show confirmation dialog
    const confirmed = await showWarning(
      '確認移除團隊？',
      `確定要將此成員從「${teamToRemove.teamName || `團隊 #${teamId}`}」移除嗎？`
    )

    if (!confirmed) {
      return false
    }

    // Optimistic update: remove team from local state
    const previousTeams = [...memberTeams.value]
    memberTeams.value = memberTeams.value.filter(t => t.teamId !== teamId)

    // If removing primary team, set first remaining team as primary
    if (teamToRemove.isPrimary && memberTeams.value.length > 0 && memberTeams.value[0]) {
      const firstTeam = memberTeams.value[0]
      memberTeams.value[0] = {
        teamId: firstTeam.teamId,
        teamName: firstTeam.teamName,
        roleInTeam: firstTeam.roleInTeam,
        isPrimary: true,
        joinedAt: firstTeam.joinedAt
      }
    }

    try {
      teamOperationLoading.value = true

      const response = await teamApi.leaveTeam(memberId, teamId)

      if (response.success) {
        showSuccess(`已從團隊移除: ${teamToRemove.teamName || `團隊 #${teamId}`}`)
        setStatus({ type: 'success', message: `已移除 ${teamToRemove.teamName || '團隊'}` })

        // If primary team was removed and there are remaining teams, update primary on backend
        const firstRemainingTeam = memberTeams.value[0]
        if (teamToRemove.isPrimary && memberTeams.value.length > 0 && firstRemainingTeam) {
          await teamApi.setPrimaryTeam(memberId, firstRemainingTeam.teamId)
        }

        return true
      } else {
        // Rollback on API failure
        memberTeams.value = previousTeams
        showError(response.error || '移除團隊失敗')
        setStatus({ type: 'error', message: '移除失敗' })
        return false
      }
    } catch (error) {
      // Rollback on error
      memberTeams.value = previousTeams
      console.error('移除團隊失敗:', error)
      showError('移除團隊時發生錯誤')
      setStatus({ type: 'error', message: '操作失敗' })
      return false
    } finally {
      teamOperationLoading.value = false
    }
  }

  /**
   * Set a team as the member's primary team
   * Returns true if successful, false otherwise
   */
  const setPrimaryTeam = async (memberId: string, teamId: number): Promise<boolean> => {
    // Find the team to set as primary
    const teamToSetPrimary = memberTeams.value.find(t => t.teamId === teamId)
    if (!teamToSetPrimary) {
      showError('找不到指定的團隊')
      return false
    }

    // Already primary
    if (teamToSetPrimary.isPrimary) {
      return true
    }

    // Optimistic update: update primary status
    const previousTeams = [...memberTeams.value]
    memberTeams.value = memberTeams.value.map(t => ({
      ...t,
      isPrimary: t.teamId === teamId
    }))

    try {
      teamOperationLoading.value = true

      const response = await teamApi.setPrimaryTeam(memberId, teamId)

      if (response.success) {
        showSuccess(`已設定主要團隊: ${teamToSetPrimary.teamName || `團隊 #${teamId}`}`)
        setStatus({ type: 'success', message: `主要團隊: ${teamToSetPrimary.teamName || '已設定'}` })
        return true
      } else {
        // Rollback on API failure
        memberTeams.value = previousTeams
        showError(response.error || '設定主要團隊失敗')
        setStatus({ type: 'error', message: '設定失敗' })
        return false
      }
    } catch (error) {
      // Rollback on error
      memberTeams.value = previousTeams
      console.error('設定主要團隊失敗:', error)
      showError('設定主要團隊時發生錯誤')
      setStatus({ type: 'error', message: '操作失敗' })
      return false
    } finally {
      teamOperationLoading.value = false
    }
  }

  return {
    memberTeams,
    availableTeamsToJoin,
    teamOperationLoading,
    teamOperationStatus,
    loadMemberTeams,
    addToTeam,
    removeFromTeam,
    setPrimaryTeam
  }
}
