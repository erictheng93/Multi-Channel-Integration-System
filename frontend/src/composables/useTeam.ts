// 現代化團隊管理 Composable
import { computed } from 'vue'
import { useTeamStore } from '@/stores/team'
import { useAsyncData } from './useAsyncData'
import { useError } from './useError'
import type { TeamMember } from '@/types'

export function useTeam() {
  const teamStore = useTeamStore()
  const { error, handleError, clearError } = useError()

  // 異步數據 - 團隊成員
  const {
    data: members,
    pending: membersLoading,
    execute: fetchMembers,
    refresh: refreshMembers
  } = useAsyncData(
    'team-members',
    () => teamStore.loadMembers(),
    {
      immediate: true,
      transform: () => teamStore.members
    }
  )

  // 計算屬性
  const activeMembers = computed(() =>
    members.value?.filter((m: TeamMember) => m.status === 'active') || []
  )

  const inactiveMembers = computed(() =>
    members.value?.filter((m: TeamMember) => m.status === 'inactive') || []
  )

  const adminMembers = computed(() =>
    members.value?.filter((m: TeamMember) => m.role === 'admin') || []
  )

  const agentMembers = computed(() =>
    members.value?.filter((m: TeamMember) => m.role === 'agent') || []
  )

  const loading = computed(() => membersLoading.value)

  // 方法
  const updateMemberStatus = async (memberId: string, isActive: boolean) => {
    clearError()
    try {
      const status = isActive ? 'active' : 'inactive'
      await teamStore.updateMemberStatus(memberId, status)
      // Store already applies optimistic update — no full reload needed
      return true
    } catch (err) {
      handleError(err)
      return false
    }
  }

  const deleteMember = async (memberId: string) => {
    clearError()
    try {
      await teamStore.removeMember(memberId)
      // Store already removes member optimistically — no full reload needed
      return true
    } catch (err) {
      handleError(err)
      return false
    }
  }

  const getMemberById = (id: string) => {
    return members.value?.find((m: TeamMember) => m.id === id) || null
  }

  const searchMembers = (query: string) => {
    if (!members.value || !query.trim()) {return members.value || []}

    const searchLower = query.toLowerCase()
    return members.value.filter((member: TeamMember) =>
      (member.name || member.loginId).toLowerCase().includes(searchLower) ||
      (member.email || '').toLowerCase().includes(searchLower) ||
      member.loginId.toLowerCase().includes(searchLower)
    )
  }

  const filterMembers = (filters: {
    role?: 'admin' | 'agent'
    isActive?: boolean
    search?: string
  }) => {
    if (!members.value) {return []}

    return members.value.filter((member: TeamMember) => {
      if (filters.role && member.role !== filters.role) {return false}
      if (filters.isActive !== undefined && (member.status === 'active') !== filters.isActive) {return false}
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const name = (member.name || member.loginId).toLowerCase()
        const email = (member.email || '').toLowerCase()
        const loginId = member.loginId.toLowerCase()
        if (!name.includes(searchLower) && !email.includes(searchLower) && !loginId.includes(searchLower)) {
          return false
        }
      }
      return true
    })
  }

  const getMemberStats = () => {
    if (!members.value) {return {
      total: 0,
      active: 0,
      inactive: 0,
      admins: 0,
      agents: 0
    }}

    return {
      total: members.value.length,
      active: activeMembers.value.length,
      inactive: inactiveMembers.value.length,
      admins: adminMembers.value.length,
      agents: agentMembers.value.length
    }
  }

  return {
    // 數據
    members,
    activeMembers,
    inactiveMembers,
    adminMembers,
    agentMembers,
    loading,
    error,

    // 方法
    fetchMembers,
    refreshMembers,
    updateMemberStatus,
    deleteMember,
    getMemberById,
    searchMembers,
    filterMembers,
    getMemberStats,
    clearError
  }
}
