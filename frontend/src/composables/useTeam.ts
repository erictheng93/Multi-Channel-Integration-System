// 現代化團隊管理 Composable
import { computed } from 'vue'
import { useTeamStore } from '@/stores/team'
import { useAsyncData } from './useAsyncData'
import { useError } from './useError'
import type { TeamMember, InviteRequest, Invitation } from '@/types'

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

  // 異步數據 - 邀請列表
  const {
    data: invitations,
    pending: invitationsLoading,
    execute: fetchInvitations,
    refresh: refreshInvitations
  } = useAsyncData(
    'team-invitations',
    () => teamStore.loadInvitations(),
    {
      immediate: true,
      transform: () => teamStore.invitations
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

  const pendingInvitations = computed(() => 
    invitations.value?.filter((i: Invitation) => i.status === 'pending') || []
  )

  const expiredInvitations = computed(() => 
    invitations.value?.filter((i: Invitation) => i.status === 'expired') || []
  )

  const usedInvitations = computed(() => 
    invitations.value?.filter((i: Invitation) => i.status === 'accepted') || []
  )

  const loading = computed(() => membersLoading.value || invitationsLoading.value)

  // 方法
  const inviteMember = async (inviteData: InviteRequest) => {
    clearError()
    try {
      await teamStore.inviteMember(inviteData)
      await refreshInvitations()
      return true
    } catch (err) {
      handleError(err)
      return false
    }
  }

  const updateMemberStatus = async (memberId: string, isActive: boolean) => {
    clearError()
    try {
      const status = isActive ? 'active' : 'inactive'
      await teamStore.updateMemberStatus(memberId, status)
      await refreshMembers()
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
      await refreshMembers()
      return true
    } catch (err) {
      handleError(err)
      return false
    }
  }

  const revokeInvitation = async (invitationId: string) => {
    clearError()
    try {
      await teamStore.cancelInvitation(invitationId)
      await refreshInvitations()
      return true
    } catch (err) {
      handleError(err)
      return false
    }
  }

  const resendInvitation = async (invitationId: string) => {
    clearError()
    try {
      await teamStore.resendInvitation(invitationId)
      await refreshInvitations()
      return true
    } catch (err) {
      handleError(err)
      return false
    }
  }

  const getMemberById = (id: string) => {
    return members.value?.find((m: TeamMember) => m.id === id) || null
  }

  const getInvitationById = (id: string) => {
    return invitations.value?.find((i: Invitation) => i.id === id) || null
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
    invitations,
    activeMembers,
    inactiveMembers,
    adminMembers,
    agentMembers,
    pendingInvitations,
    expiredInvitations,
    usedInvitations,
    loading,
    error,

    // 方法
    fetchMembers,
    refreshMembers,
    fetchInvitations,
    refreshInvitations,
    inviteMember,
    updateMemberStatus,
    deleteMember,
    revokeInvitation,
    resendInvitation,
    getMemberById,
    getInvitationById,
    searchMembers,
    filterMembers,
    getMemberStats,
    clearError
  }
}