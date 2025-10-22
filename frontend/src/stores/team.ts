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
    role: 'admin' | 'agent' // Simplified from 3-tier to 2-tier role system
    group?: string
    isActive: boolean
  }) => {
    // ① 清除錯誤狀態
    error.value = null

    try {
      // ② 背景調用 API（不使用 loading.value）
      const response = await teamApi.addMember(request)

      if (response.success && response.data) {
        // ③ API 成功，直接將新成員添加到列表（避免 loadMembers）
        members.value = [...members.value, response.data]
        return response.data
      } else {
        // ④ API 失敗，設置錯誤訊息
        error.value = '新增成員失敗'
        throw new Error('新增成員失敗')
      }
    } catch (err: unknown) {
      // ④ 發生錯誤，設置錯誤訊息
      error.value = (err as Error)?.message || '新增成員失敗'
      console.error('新增成員失敗:', err)
      throw err
    }
  }

  const inviteMember = async (request: {
    email: string
    role: 'admin' | 'agent' // Simplified from 3-tier to 2-tier role system
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

  const updateMemberRole = async (memberId: string, role: 'admin' | 'agent') => { // Simplified from 3-tier to 2-tier
    // ① 查找成員
    const member = members.value.find(m => m.id === memberId)
    if (!member) {
      console.error('Member not found:', memberId)
      error.value = '找不到該成員'
      throw new Error('找不到該成員')
    }

    // ② 保存原始角色（用於失敗恢復）
    const originalRole = member.role

    // ③ 樂觀更新：立即更新 UI
    member.role = role
    error.value = null

    try {
      // ④ 背景調用 API（不使用 loading.value，UI 已更新）
      const response = await teamApi.updateMemberRole(memberId, role)

      if (!response.success) {
        // ⑤ API 失敗，恢復原角色
        member.role = originalRole
        error.value = '更新角色失敗'
        throw new Error('更新角色失敗')
      }
      // 成功：無需操作，UI 已更新
    } catch (err: unknown) {
      // ⑤ 發生錯誤，恢復原角色
      member.role = originalRole
      error.value = (err as Error)?.message || '更新角色失敗'
      console.error('更新角色失敗:', err)
      throw err
    }
  }

  const updateMemberStatus = async (memberId: string, status: 'active' | 'inactive') => {
    // ① 查找成員
    const member = members.value.find(m => m.id === memberId)
    if (!member) {
      console.error('Member not found:', memberId)
      error.value = '找不到該成員'
      throw new Error('找不到該成員')
    }

    // ② 保存原始狀態（用於失敗恢復）
    const originalStatus = member.status

    // ③ 樂觀更新：立即更新 UI
    member.status = status
    error.value = null

    try {
      // ④ 背景調用 API（不使用 loading.value，UI 已更新）
      const response = await teamApi.updateMemberStatus(memberId, status)

      if (response.success) {
        // ⑤ API 成功，發送 WebSocket 通知（只在停用時）
        if (status === 'inactive') {
          window.dispatchEvent(new CustomEvent('user-account-disabled', {
            detail: { memberId, memberName: member.name || member.loginId }
          }))
        }
      } else {
        // ⑥ API 失敗，恢復原狀態
        member.status = originalStatus
        error.value = '更新狀態失敗'
        throw new Error('更新狀態失敗')
      }
    } catch (err: unknown) {
      // ⑥ 發生錯誤，恢復原狀態
      member.status = originalStatus
      error.value = (err as Error)?.message || '更新狀態失敗'
      console.error('更新狀態失敗:', err)
      throw err
    }
  }

  const removeMember = async (memberId: string) => {
    // ① 查找成員
    const member = members.value.find(m => m.id === memberId)
    if (!member) {
      console.error('Member not found:', memberId)
      error.value = '找不到該成員'
      throw new Error('找不到該成員')
    }

    // ② 保存原始列表（用於失敗恢復）
    const originalMembers = [...members.value]

    // ③ 樂觀更新：立即從列表中移除
    members.value = members.value.filter(m => m.id !== memberId)
    error.value = null

    try {
      // ④ 背景調用 API（不使用 loading.value，UI 已更新）
      const response = await teamApi.removeMember(memberId)

      if (!response.success) {
        // ⑤ API 失敗，恢復原列表
        members.value = originalMembers
        error.value = '移除成員失敗'
        throw new Error('移除成員失敗')
      }
      // 成功：無需操作，UI 已更新
    } catch (err: unknown) {
      // ⑤ 發生錯誤，恢復原列表
      members.value = originalMembers
      error.value = (err as Error)?.message || '移除成員失敗'
      console.error('移除成員失敗:', err)
      throw err
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