import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { teamApi } from '@/api/team'
import type { TeamMember } from '@/types'
import { nowISO } from '@/utils/timestamp'
import { getWebSocketManager, type TeamMemberEventData, type TeamUpdateEventData } from '@/services/websocketManager'

interface Team {
  id: number
  name: string
  description?: string
  qrCode?: string
  lineUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  memberCount?: number
}

export const useTeamStore = defineStore('team', () => {
  const members = ref<TeamMember[]>([])
  const teams = ref<Team[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Counter (not boolean) so parallel loadMembers/loadTeams don't prematurely clear loading
  let loadingCounter = 0

  // ==================== Selection State ====================
  const selectedMemberIds = ref<Set<string>>(new Set())
  const isSelectionMode = ref(false)
  const selectedCount = computed(() => selectedMemberIds.value.size)

  const stats = computed(() => ({
    totalMembers: members.value.length,
    teamCount: teams.value.filter(t => t.isActive).length,
    adminCount: members.value.filter(m => m.role === 'admin').length
  }))

  const loadMembers = async () => {
    try {
      loadingCounter++
      loading.value = true
      error.value = null
      const response = await teamApi.getMembers()
      if (response.success && response.data) {
        members.value = response.data
      } else {
        error.value = '載入成員列表失敗'
      }
    } catch (err: unknown) {
      error.value = (err as Error)?.message || '載入成員列表失敗'
      console.error('載入成員失敗:', err)
    } finally {
      loadingCounter--
      if (loadingCounter === 0) {
        loading.value = false
      }
    }
  }

  const loadTeams = async () => {
    try {
      loadingCounter++
      loading.value = true
      error.value = null
      const response = await teamApi.getTeams()
      if (response.success && response.data) {
        teams.value = response.data
      } else {
        error.value = '載入團隊列表失敗'
      }
    } catch (err: unknown) {
      error.value = (err as Error)?.message || '載入團隊列表失敗'
      console.error('載入團隊失敗:', err)
    } finally {
      loadingCounter--
      if (loadingCounter === 0) {
        loading.value = false
      }
    }
  }

  const loadAll = async () => {
    await Promise.all([
      loadMembers(),
      loadTeams()
    ])
  }

  const addMember = async (request: {
    loginId: string
    name?: string
    email?: string
    password: string
    role: 'admin' | 'agent' // Simplified from 3-tier to 2-tier role system
    group?: string
    isActive: boolean
  }) => {
    error.value = null

    try {
      const response = await teamApi.addMember(request)

      if (response.success && response.data) {
        members.value = [...members.value, response.data]
        return response.data
      } else {
        error.value = '新增成員失敗'
        throw new Error('新增成員失敗')
      }
    } catch (err: unknown) {
      error.value = (err as Error)?.message || '新增成員失敗'
      console.error('新增成員失敗:', err)
      throw err
    }
  }

  const updateMemberRole = async (memberId: string, role: 'admin' | 'agent') => {
    const member = members.value.find(m => m.id === memberId)
    if (!member) {
      console.error('Member not found:', memberId)
      error.value = '找不到該成員'
      throw new Error('找不到該成員')
    }

    const originalRole = member.role
    member.role = role
    error.value = null

    try {
      const response = await teamApi.updateMemberRole(memberId, role)

      if (!response.success) {
        member.role = originalRole
        error.value = '更新角色失敗'
        throw new Error('更新角色失敗')
      }
    } catch (err: unknown) {
      member.role = originalRole
      error.value = (err as Error)?.message || '更新角色失敗'
      console.error('更新角色失敗:', err)
      throw err
    }
  }

  const updateMemberStatus = async (memberId: string, status: 'active' | 'inactive') => {
    const member = members.value.find(m => m.id === memberId)
    if (!member) {
      console.error('Member not found:', memberId)
      error.value = '找不到該成員'
      throw new Error('找不到該成員')
    }

    const originalStatus = member.status
    member.status = status
    error.value = null

    try {
      const response = await teamApi.updateMemberStatus(memberId, status)

      if (response.success) {
        // Notify other tabs/windows so they can force-logout the disabled user
        if (status === 'inactive') {
          window.dispatchEvent(new CustomEvent('user-account-disabled', {
            detail: { memberId, memberName: member.name || member.loginId }
          }))
        }
      } else {
        member.status = originalStatus
        error.value = '更新狀態失敗'
        throw new Error('更新狀態失敗')
      }
    } catch (err: unknown) {
      member.status = originalStatus
      error.value = (err as Error)?.message || '更新狀態失敗'
      console.error('更新狀態失敗:', err)
      throw err
    }
  }

  const removeMember = async (memberId: string) => {
    const member = members.value.find(m => m.id === memberId)
    if (!member) {
      console.error('Member not found:', memberId)
      error.value = '找不到該成員'
      throw new Error('找不到該成員')
    }

    const originalMembers = [...members.value]
    members.value = members.value.filter(m => m.id !== memberId)
    error.value = null

    try {
      const response = await teamApi.removeMember(memberId)

      if (!response.success) {
        members.value = originalMembers
        error.value = '移除成員失敗'
        throw new Error('移除成員失敗')
      }
      return response.data
    } catch (err: unknown) {
      members.value = originalMembers
      error.value = (err as Error)?.message || '移除成員失敗'
      console.error('移除成員失敗:', err)
      throw err
    }
  }

  // ==================== Selection Operations ====================

  const toggleSelectionMode = () => {
    isSelectionMode.value = !isSelectionMode.value
    if (!isSelectionMode.value) {
      selectedMemberIds.value.clear()
    }
  }

  const toggleMemberSelection = (memberId: string) => {
    if (selectedMemberIds.value.has(memberId)) {
      selectedMemberIds.value.delete(memberId)
    } else {
      selectedMemberIds.value.add(memberId)
    }
    // Re-assign to trigger Vue reactivity (Set mutations aren't tracked)
    selectedMemberIds.value = new Set(selectedMemberIds.value)
  }

  const selectAllMembers = (excludeIds: string[] = []) => {
    const allIds = members.value
      .filter(m => !excludeIds.includes(m.id))
      .map(m => m.id)
    selectedMemberIds.value = new Set(allIds)
  }

  const deselectAllMembers = () => {
    selectedMemberIds.value.clear()
    selectedMemberIds.value = new Set()
  }

  const bulkDeleteMembers = async (memberIds: string[], reason?: string) => {
    const originalMembers = [...members.value]
    members.value = members.value.filter(m => !memberIds.includes(m.id))
    error.value = null
    deselectAllMembers()
    isSelectionMode.value = false

    try {
      const response = await teamApi.bulkDeleteMembers(memberIds, reason)

      if (!response.success || !response.data) {
        members.value = originalMembers
        error.value = response.error || '批量刪除失敗'
        throw new Error(response.error || '批量刪除失敗')
      }

      return response.data
    } catch (err: unknown) {
      members.value = originalMembers
      error.value = (err as Error)?.message || '批量刪除失敗'
      console.error('批量刪除失敗:', err)
      throw err
    }
  }

  const bulkUpdateMembers = async (
    memberIds: string[],
    updates: { role?: 'admin' | 'agent'; isActive?: boolean },
    reason?: string
  ) => {
    const originalMembers = members.value.map(m =>
      memberIds.includes(m.id) ? { ...m } : m
    )

    members.value = members.value.map(m => {
      if (memberIds.includes(m.id)) {
        const updated = { ...m }
        if (updates.role !== undefined) {updated.role = updates.role}
        if (updates.isActive !== undefined) {
          updated.status = updates.isActive ? 'active' : 'inactive'
        }
        return updated
      }
      return m
    })
    error.value = null
    deselectAllMembers()
    isSelectionMode.value = false

    try {
      const response = await teamApi.bulkUpdateMembers(memberIds, updates, reason)

      if (!response.success || !response.data) {
        members.value = originalMembers
        error.value = response.error || '批量更新失敗'
        throw new Error(response.error || '批量更新失敗')
      }

      return response.data
    } catch (err: unknown) {
      members.value = originalMembers
      error.value = (err as Error)?.message || '批量更新失敗'
      console.error('批量更新失敗:', err)
      throw err
    }
  }

  const resetPasswordWithPolicy = async (memberId: string, data: {
    newPassword: string;
    policy: 'changeable' | 'unchangeable' | 'must_change';
  }) => {
    try {
      loading.value = true
      error.value = null
      const response = await teamApi.resetPasswordWithPolicy(memberId, data)
      if (!response.success) {
        error.value = '設定密碼失敗'
        throw new Error('設定密碼失敗')
      }
    } catch (err: unknown) {
      error.value = (err as Error)?.message || '設定密碼失敗'
      console.error('設定密碼失敗:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateMember = async (memberId: string, data: Partial<TeamMember>) => {
    try {
      loading.value = true
      error.value = null
      const response = await teamApi.updateMember(memberId, data)
      if (response.success && response.data) {
        const memberIndex = members.value.findIndex(m => m.id === memberId)
        if (memberIndex !== -1) {
          members.value[memberIndex] = { ...members.value[memberIndex], ...response.data }
        }
        return response.data
      } else {
        error.value = '更新成員失敗'
        throw new Error('更新成員失敗')
      }
    } catch (err: unknown) {
      error.value = (err as Error)?.message || '更新成員失敗'
      console.error('更新成員失敗:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  const $reset = () => {
    members.value = []
    teams.value = []
    loading.value = false
    error.value = null
  }

  // ==================== WebSocket Handlers ====================

  const handleTeamMemberAdded = (data: TeamMemberEventData) => {
    const team = teams.value.find(t => t.id === data.teamId)
    if (team) { team.memberCount = data.memberCount }
  }

  const handleTeamMemberRemoved = (data: TeamMemberEventData) => {
    const team = teams.value.find(t => t.id === data.teamId)
    if (team) { team.memberCount = data.memberCount }
  }

  const handleTeamUpdated = (data: TeamUpdateEventData) => {
    const team = teams.value.find(t => t.id === data.teamId)
    if (team) {
      if (data.changes.name !== undefined) {team.name = data.changes.name}
      if (data.changes.description !== undefined) {team.description = data.changes.description}
      if (data.changes.isActive !== undefined) {team.isActive = data.changes.isActive}
      if (data.changes.memberCount !== undefined) {team.memberCount = data.changes.memberCount}
    }
  }

  let isWebSocketSetup = false
  const setupWebSocketListeners = () => {
    if (isWebSocketSetup) {return}

    try {
      const manager = getWebSocketManager()

      manager.setEventCallbacks({
        onTeamMemberAdded: handleTeamMemberAdded,
        onTeamMemberRemoved: handleTeamMemberRemoved,
        onTeamUpdated: handleTeamUpdated
      })

      isWebSocketSetup = true
    } catch (err) {
      console.warn('[TeamStore] Failed to setup WebSocket listeners:', err)
    }
  }

  setupWebSocketListeners()

  // ==================== Local-only Updates (skip API, used after API success elsewhere) ====================

  const updateMemberLocal = (memberId: string, data: {
    name?: string
    displayName?: string
    email?: string
    role?: 'admin' | 'agent'
    status?: 'active' | 'inactive'
    teams?: Array<{ teamId: number; teamName?: string; roleInTeam: 'member' | 'lead' | 'supervisor'; isPrimary: boolean; joinedAt?: string }>
  }): boolean => {
    const member = members.value.find(m => m.id === memberId)
    if (!member) { return false }

    if (data.name !== undefined) {member.name = data.name}
    if (data.displayName !== undefined) {member.name = data.displayName}
    if (data.email !== undefined) {member.email = data.email}
    if (data.role !== undefined) {member.role = data.role}
    if (data.status !== undefined) {member.status = data.status}
    if (data.teams !== undefined) {member.teams = data.teams}
    member.updatedAt = nowISO()
    return true
  }

  const updateTeamLocal = (teamId: number, data: {
    name?: string
    description?: string
    isActive?: boolean
    memberCount?: number
  }): boolean => {
    const team = teams.value.find(t => t.id === teamId)
    if (!team) { return false }

    if (data.name !== undefined) {team.name = data.name}
    if (data.description !== undefined) {team.description = data.description}
    if (data.isActive !== undefined) {team.isActive = data.isActive}
    if (data.memberCount !== undefined) {team.memberCount = data.memberCount}
    team.updatedAt = nowISO()
    return true
  }

  return {
    members, teams, loading, error, stats,
    selectedMemberIds, isSelectionMode, selectedCount,

    loadMembers, loadTeams, loadAll,
    addMember, updateMemberRole, updateMemberStatus, updateMember, removeMember,
    resetPasswordWithPolicy,
    clearError, $reset,

    toggleSelectionMode, toggleMemberSelection, selectAllMembers, deselectAllMembers,
    bulkDeleteMembers, bulkUpdateMembers,

    setupWebSocketListeners,
    updateMemberLocal, updateTeamLocal
  }
})
