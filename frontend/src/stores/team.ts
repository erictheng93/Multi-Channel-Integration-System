import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { teamApi } from '@/api/team'
import type { TeamMember, Invitation } from '@/types'

export const useTeamStore = defineStore('team', () => {
  // 狀態
  const members = ref<TeamMember[]>([])
  const invitations = ref<Invitation[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 統計數據
  const stats = computed(() => ({
    totalMembers: members.value.length,
    activeMembers: members.value.filter(m => m.status === 'active').length,
    adminCount: members.value.filter(m => m.role === 'admin').length
  }))

  // 動作
  const loadMembers = async () => {
    try {
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
      loading.value = false
    }
  }

  const loadInvitations = async () => {
    try {
      loading.value = true
      error.value = null
      const response = await teamApi.getInvitations()
      if (response.success && response.data) {
        invitations.value = response.data
      } else {
        error.value = '載入邀請列表失敗'
      }
    } catch (err: unknown) {
      error.value = (err as Error)?.message || '載入邀請列表失敗'
      console.error('載入邀請失敗:', err)
    } finally {
      loading.value = false
    }
  }

  const loadAll = async () => {
    await Promise.all([
      loadMembers(),
      loadInvitations()
    ])
  }

  const addMember = async (request: {
    loginId: string
    name?: string
    email?: string
    password: string
    role: 'admin' | 'agent'
    group?: string
    isActive: boolean
  }) => {
    try {
      loading.value = true
      error.value = null
      const response = await teamApi.addMember(request)
      if (response.success && response.data) {
        await loadMembers() // 重新載入成員列表
        return response.data
      } else {
        error.value = '新增成員失敗'
        throw new Error('新增成員失敗')
      }
    } catch (err: unknown) {
      error.value = (err as Error)?.message || '新增成員失敗'
      console.error('新增成員失敗:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const inviteMember = async (request: {
    email: string
    role: 'admin' | 'agent'
    message?: string
    useQR?: boolean
  }) => {
    try {
      loading.value = true
      error.value = null
      const response = await teamApi.inviteMember(request)
      if (response.success && response.data) {
        await loadInvitations() // 重新載入邀請列表
        return response.data
      } else {
        error.value = '發送邀請失敗'
        throw new Error('發送邀請失敗')
      }
    } catch (err: unknown) {
      error.value = (err as Error)?.message || '發送邀請失敗'
      console.error('發送邀請失敗:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateMemberRole = async (memberId: string, role: 'admin' | 'agent') => {
    try {
      loading.value = true
      error.value = null
      const response = await teamApi.updateMemberRole(memberId, role)
      if (response.success) {
        // 更新本地狀態
        const member = members.value.find(m => m.id === memberId)
        if (member) {
          member.role = role
        }
      } else {
        error.value = '更新角色失敗'
        throw new Error('更新角色失敗')
      }
    } catch (err: unknown) {
      error.value = (err as Error)?.message || '更新角色失敗'
      console.error('更新角色失敗:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateMemberStatus = async (memberId: string, status: 'active' | 'inactive') => {
    try {
      loading.value = true
      error.value = null
      const response = await teamApi.updateMemberStatus(memberId, status)
      if (response.success) {
        // 更新本地狀態
        const member = members.value.find(m => m.id === memberId)
        if (member) {
          member.status = status
          
          // 如果是停用操作，發送 WebSocket 通知給該用戶
          if (status === 'inactive') {
            // 通知系統該用戶已被停權
            window.dispatchEvent(new CustomEvent('user-account-disabled', {
              detail: { memberId, memberName: member.name || member.loginId }
            }))
          }
        }
      } else {
        error.value = '更新狀態失敗'
        throw new Error('更新狀態失敗')
      }
    } catch (err: unknown) {
      error.value = (err as Error)?.message || '更新狀態失敗'
      console.error('更新狀態失敗:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const removeMember = async (memberId: string) => {
    try {
      loading.value = true
      error.value = null
      const response = await teamApi.removeMember(memberId)
      if (response.success) {
        // 從本地狀態中移除
        members.value = members.value.filter(m => m.id !== memberId)
      } else {
        error.value = '移除成員失敗'
        throw new Error('移除成員失敗')
      }
    } catch (err: unknown) {
      error.value = (err as Error)?.message || '移除成員失敗'
      console.error('移除成員失敗:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const resetPassword = async (memberId: string) => {
    try {
      loading.value = true
      error.value = null
      const response = await teamApi.resetPassword(memberId)
      if (!response.success) {
        error.value = '重設密碼失敗'
        throw new Error('重設密碼失敗')
      }
    } catch (err: unknown) {
      error.value = (err as Error)?.message || '重設密碼失敗'
      console.error('重設密碼失敗:', err)
      throw err
    } finally {
      loading.value = false
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
        // 更新本地狀態
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

  const resendInvitation = async (invitationId: string) => {
    try {
      loading.value = true
      error.value = null
      const response = await teamApi.resendInvitation(invitationId)
      if (!response.success) {
        error.value = '重新發送邀請失敗'
        throw new Error('重新發送邀請失敗')
      }
    } catch (err: unknown) {
      error.value = (err as Error)?.message || '重新發送邀請失敗'
      console.error('重新發送邀請失敗:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const cancelInvitation = async (invitationId: string) => {
    try {
      loading.value = true
      error.value = null
      const response = await teamApi.cancelInvitation(invitationId)
      if (response.success) {
        // 從本地狀態中移除
        invitations.value = invitations.value.filter(i => i.id !== invitationId)
      } else {
        error.value = '取消邀請失敗'
        throw new Error('取消邀請失敗')
      }
    } catch (err: unknown) {
      error.value = (err as Error)?.message || '取消邀請失敗'
      console.error('取消邀請失敗:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  // 重置狀態
  const $reset = () => {
    members.value = []
    invitations.value = []
    loading.value = false
    error.value = null
  }

  return {
    // 狀態
    members,
    invitations,
    loading,
    error,
    stats,
    
    // 動作
    loadMembers,
    loadInvitations,
    loadAll,
    addMember,
    inviteMember,
    updateMemberRole,
    updateMemberStatus,
    updateMember,
    removeMember,
    resetPassword,
    resetPasswordWithPolicy,
    resendInvitation,
    cancelInvitation,
    clearError,
    $reset
  }
})