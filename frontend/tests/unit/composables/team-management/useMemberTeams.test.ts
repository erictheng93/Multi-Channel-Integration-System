/**
 * Unit Tests for useMemberTeams Composable
 *
 * Tests multi-team assignment operations with:
 * - Optimistic UI updates
 * - API failure rollback
 * - Confirmation dialogs
 * - Toast notifications
 * - Auto-clearing status messages
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useMemberTeams } from '@/composables/team-management/useMemberTeams'
import type { AgentTeamMembership, Team } from '@/types'

// Mock dependencies - Create mocks inside factory functions
vi.mock('@/api/team', () => {
  return {
    teamApi: {
      getAgentTeams: vi.fn(),
      joinTeam: vi.fn(),
      leaveTeam: vi.fn(),
      setPrimaryTeam: vi.fn()
    }
  }
})

vi.mock('@/composables/useConfirmDialog', () => {
  return {
    useConfirmDialog: vi.fn(() => ({
      showWarning: vi.fn().mockResolvedValue(true)
    }))
  }
})

vi.mock('@/composables/useToast', () => {
  return {
    useToast: vi.fn(() => ({
      showSuccess: vi.fn(),
      showError: vi.fn()
    }))
  }
})

import { teamApi } from '@/api/team'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'

describe('useMemberTeams', () => {
  // Create mock function references for assertions
  let mockShowWarning: ReturnType<typeof vi.fn>
  let mockShowSuccess: ReturnType<typeof vi.fn>
  let mockShowError: ReturnType<typeof vi.fn>
  // Mock data
  const mockAllTeams = ref<Team[]>([
    {
      id: 1,
      name: 'Team Alpha',
      description: 'First team',
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      memberCount: 5
    },
    {
      id: 2,
      name: 'Team Beta',
      description: 'Second team',
      isActive: true,
      createdAt: '2024-01-02',
      updatedAt: '2024-01-02',
      memberCount: 3
    },
    {
      id: 3,
      name: 'Team Gamma',
      description: 'Third team',
      isActive: true,
      createdAt: '2024-01-03',
      updatedAt: '2024-01-03',
      memberCount: 7
    }
  ])

  const mockMemberTeams: AgentTeamMembership[] = [
    {
      teamId: 1,
      teamName: 'Team Alpha',
      roleInTeam: 'member',
      isPrimary: true,
      joinedAt: '2024-01-01'
    }
  ]

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Create fresh mock functions for each test
    mockShowWarning = vi.fn().mockResolvedValue(true)
    mockShowSuccess = vi.fn()
    mockShowError = vi.fn()

    // Setup default API responses
    vi.mocked(teamApi.getAgentTeams).mockResolvedValue({
      success: true,
      data: [...mockMemberTeams]
    })

    vi.mocked(teamApi.joinTeam).mockResolvedValue({
      success: true
    })

    vi.mocked(teamApi.leaveTeam).mockResolvedValue({
      success: true
    })

    vi.mocked(teamApi.setPrimaryTeam).mockResolvedValue({
      success: true
    })

    // Setup default composable responses with our mock references
    vi.mocked(useConfirmDialog).mockReturnValue({
      showWarning: mockShowWarning
    } as any)

    vi.mocked(useToast).mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError
    } as any)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('loadMemberTeams', () => {
    it('should load member teams successfully', async () => {
      const { memberTeams, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')

      expect(teamApi.getAgentTeams).toHaveBeenCalledWith('member-123')
      expect(memberTeams.value).toEqual(mockMemberTeams)
    })

    it('should handle API failure when loading teams', async () => {
      vi.mocked(teamApi.getAgentTeams).mockResolvedValue({
        success: false,
        error: 'Failed to load teams'
      })

      const { memberTeams, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')

      expect(memberTeams.value).toEqual([])
    })

    it('should handle network error when loading teams', async () => {
      vi.mocked(teamApi.getAgentTeams).mockRejectedValue(new Error('Network error'))

      const { memberTeams, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')

      expect(memberTeams.value).toEqual([])
    })
  })

  describe('availableTeamsToJoin', () => {
    it('should compute available teams correctly', async () => {
      const { memberTeams: _memberTeams, availableTeamsToJoin, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      await nextTick()

      // Member is in Team Alpha (id: 1), so available teams should be Beta (2) and Gamma (3)
      expect(availableTeamsToJoin.value).toHaveLength(2)
      expect(availableTeamsToJoin.value.map(t => t.id)).toEqual([2, 3])
    })

    it('should show all teams when member has no teams', () => {
      vi.mocked(teamApi.getAgentTeams).mockResolvedValue({
        success: true,
        data: []
      })

      const { availableTeamsToJoin } = useMemberTeams(mockAllTeams)

      expect(availableTeamsToJoin.value).toHaveLength(3)
      expect(availableTeamsToJoin.value.map(t => t.id)).toEqual([1, 2, 3])
    })
  })

  describe('addToTeam', () => {
    it('should add member to team successfully with optimistic update', async () => {
      const { memberTeams, addToTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      const initialLength = memberTeams.value.length

      const result = await addToTeam('member-123', 2) // Add to Team Beta

      expect(result).toBe(true)
      expect(memberTeams.value).toHaveLength(initialLength + 1)
      expect(memberTeams.value.some(t => t.teamId === 2)).toBe(true)
      expect(teamApi.joinTeam).toHaveBeenCalledWith('member-123', 2, {
        roleInTeam: 'member',
        isPrimary: false // Not first team
      })
      expect(mockShowSuccess).toHaveBeenCalledWith('成功加入團隊: Team Beta')
    })

    it('should set first team as primary automatically', async () => {
      vi.mocked(teamApi.getAgentTeams).mockResolvedValue({
        success: true,
        data: [] // No existing teams
      })

      const { addToTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      await addToTeam('member-123', 1)

      expect(teamApi.joinTeam).toHaveBeenCalledWith('member-123', 1, {
        roleInTeam: 'member',
        isPrimary: true // First team becomes primary
      })
    })

    it('should rollback optimistic update on API failure', async () => {
      vi.mocked(teamApi.joinTeam).mockResolvedValue({
        success: false,
        error: 'Join failed'
      })

      const { memberTeams, addToTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      const initialTeams = [...memberTeams.value]

      const result = await addToTeam('member-123', 2)

      expect(result).toBe(false)
      expect(memberTeams.value).toEqual(initialTeams) // Rolled back
      expect(mockShowError).toHaveBeenCalledWith('Join failed')
    })

    it('should rollback optimistic update on network error', async () => {
      vi.mocked(teamApi.joinTeam).mockRejectedValue(new Error('Network error'))

      const { memberTeams, addToTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      const initialTeams = [...memberTeams.value]

      const result = await addToTeam('member-123', 2)

      expect(result).toBe(false)
      expect(memberTeams.value).toEqual(initialTeams) // Rolled back
      expect(mockShowError).toHaveBeenCalledWith('加入團隊時發生錯誤')
    })

    it('should return false if team not found', async () => {
      const { addToTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      const result = await addToTeam('member-123', 999) // Non-existent team

      expect(result).toBe(false)
      expect(mockShowError).toHaveBeenCalledWith('找不到指定的團隊')
      expect(teamApi.joinTeam).not.toHaveBeenCalled()
    })

    it('should set loading state during operation', async () => {
      const { teamOperationLoading, addToTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')

      expect(teamOperationLoading.value).toBe(false)

      const promise = addToTeam('member-123', 2)
      expect(teamOperationLoading.value).toBe(true)

      await promise
      expect(teamOperationLoading.value).toBe(false)
    })

    it('should set status message that auto-clears', async () => {
      vi.useFakeTimers()

      const { teamOperationStatus, addToTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      await addToTeam('member-123', 2)

      expect(teamOperationStatus.value).toEqual({
        type: 'success',
        message: '已加入 Team Beta'
      })

      // Fast-forward 3 seconds
      vi.advanceTimersByTime(3000)
      await nextTick()

      expect(teamOperationStatus.value).toBeNull()
    })
  })

  describe('removeFromTeam', () => {
    it('should remove member from team after confirmation', async () => {
      mockShowWarning.mockResolvedValue(true) // User confirms

      const { memberTeams, removeFromTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      const initialLength = memberTeams.value.length

      const result = await removeFromTeam('member-123', 1)

      expect(result).toBe(true)
      expect(mockShowWarning).toHaveBeenCalledWith(
        '確認移除團隊？',
        expect.stringContaining('Team Alpha')
      )
      expect(memberTeams.value).toHaveLength(initialLength - 1)
      expect(memberTeams.value.some(t => t.teamId === 1)).toBe(false)
      expect(teamApi.leaveTeam).toHaveBeenCalledWith('member-123', 1)
      expect(mockShowSuccess).toHaveBeenCalledWith('已從團隊移除: Team Alpha')
    })

    it('should cancel removal if user declines confirmation', async () => {
      mockShowWarning.mockResolvedValue(false) // User cancels

      const { memberTeams, removeFromTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      const initialTeams = [...memberTeams.value]

      const result = await removeFromTeam('member-123', 1)

      expect(result).toBe(false)
      expect(memberTeams.value).toEqual(initialTeams) // Unchanged
      expect(teamApi.leaveTeam).not.toHaveBeenCalled()
    })

    it('should set first remaining team as primary when removing primary team', async () => {
      // Setup member with 2 teams, first is primary
      vi.mocked(teamApi.getAgentTeams).mockResolvedValue({
        success: true,
        data: [
          {
            teamId: 1,
            teamName: 'Team Alpha',
            roleInTeam: 'member',
            isPrimary: true,
            joinedAt: '2024-01-01'
          },
          {
            teamId: 2,
            teamName: 'Team Beta',
            roleInTeam: 'member',
            isPrimary: false,
            joinedAt: '2024-01-02'
          }
        ]
      })

      mockShowWarning.mockResolvedValue(true)

      const { memberTeams, removeFromTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      await removeFromTeam('member-123', 1) // Remove primary team

      // Team Beta should now be primary
      expect(memberTeams.value[0].isPrimary).toBe(true)
      expect(memberTeams.value[0].teamId).toBe(2)
      expect(teamApi.setPrimaryTeam).toHaveBeenCalledWith('member-123', 2)
    })

    it('should rollback on API failure', async () => {
      mockShowWarning.mockResolvedValue(true)
      vi.mocked(teamApi.leaveTeam).mockResolvedValue({
        success: false,
        error: 'Leave failed'
      })

      const { memberTeams, removeFromTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      const initialTeams = [...memberTeams.value]

      const result = await removeFromTeam('member-123', 1)

      expect(result).toBe(false)
      expect(memberTeams.value).toEqual(initialTeams) // Rolled back
      expect(mockShowError).toHaveBeenCalledWith('Leave failed')
    })

    it('should return false if team not found', async () => {
      const { removeFromTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      const result = await removeFromTeam('member-123', 999)

      expect(result).toBe(false)
      expect(mockShowError).toHaveBeenCalledWith('找不到指定的團隊')
      expect(teamApi.leaveTeam).not.toHaveBeenCalled()
    })
  })

  describe('setPrimaryTeam', () => {
    it('should set team as primary successfully', async () => {
      // Setup member with 2 teams
      vi.mocked(teamApi.getAgentTeams).mockResolvedValue({
        success: true,
        data: [
          {
            teamId: 1,
            teamName: 'Team Alpha',
            roleInTeam: 'member',
            isPrimary: true,
            joinedAt: '2024-01-01'
          },
          {
            teamId: 2,
            teamName: 'Team Beta',
            roleInTeam: 'member',
            isPrimary: false,
            joinedAt: '2024-01-02'
          }
        ]
      })

      const { memberTeams, setPrimaryTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      const result = await setPrimaryTeam('member-123', 2)

      expect(result).toBe(true)
      expect(memberTeams.value.find(t => t.teamId === 2)?.isPrimary).toBe(true)
      expect(memberTeams.value.find(t => t.teamId === 1)?.isPrimary).toBe(false)
      expect(teamApi.setPrimaryTeam).toHaveBeenCalledWith('member-123', 2)
      expect(mockShowSuccess).toHaveBeenCalledWith('已設定主要團隊: Team Beta')
    })

    it('should return true if team is already primary', async () => {
      const { setPrimaryTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      const result = await setPrimaryTeam('member-123', 1) // Already primary

      expect(result).toBe(true)
      expect(teamApi.setPrimaryTeam).not.toHaveBeenCalled()
    })

    it('should rollback on API failure', async () => {
      vi.mocked(teamApi.getAgentTeams).mockResolvedValue({
        success: true,
        data: [
          {
            teamId: 1,
            teamName: 'Team Alpha',
            roleInTeam: 'member',
            isPrimary: true,
            joinedAt: '2024-01-01'
          },
          {
            teamId: 2,
            teamName: 'Team Beta',
            roleInTeam: 'member',
            isPrimary: false,
            joinedAt: '2024-01-02'
          }
        ]
      })

      vi.mocked(teamApi.setPrimaryTeam).mockResolvedValue({
        success: false,
        error: 'Set primary failed'
      })

      const { memberTeams, setPrimaryTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      const initialTeams = [...memberTeams.value]

      const result = await setPrimaryTeam('member-123', 2)

      expect(result).toBe(false)
      expect(memberTeams.value).toEqual(initialTeams) // Rolled back
      expect(mockShowError).toHaveBeenCalledWith('Set primary failed')
    })

    it('should return false if team not found', async () => {
      const { setPrimaryTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')
      const result = await setPrimaryTeam('member-123', 999)

      expect(result).toBe(false)
      expect(mockShowError).toHaveBeenCalledWith('找不到指定的團隊')
      expect(teamApi.setPrimaryTeam).not.toHaveBeenCalled()
    })
  })

  describe('status message auto-clearing', () => {
    it('should clear previous timeout when new status is set', async () => {
      vi.useFakeTimers()

      const { teamOperationStatus, addToTeam, loadMemberTeams } = useMemberTeams(mockAllTeams)

      await loadMemberTeams('member-123')

      // Add first team
      await addToTeam('member-123', 2)
      expect(teamOperationStatus.value?.message).toBe('已加入 Team Beta')

      // Advance 1.5 seconds (not enough to clear)
      vi.advanceTimersByTime(1500)

      // Add second team (should clear previous timeout)
      await addToTeam('member-123', 3)
      expect(teamOperationStatus.value?.message).toBe('已加入 Team Gamma')

      // Advance 1.5 seconds (total 3s from first, but only 1.5s from second)
      vi.advanceTimersByTime(1500)
      await nextTick()

      // Should still have message (second timeout not complete)
      expect(teamOperationStatus.value).not.toBeNull()

      // Advance remaining 1.5 seconds
      vi.advanceTimersByTime(1500)
      await nextTick()

      // Now it should be cleared
      expect(teamOperationStatus.value).toBeNull()
    })
  })
})
