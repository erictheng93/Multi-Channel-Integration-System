import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { teamApi } from '@/api/team'
import type { TeamMember } from '@/types'
import { getWebSocketManager, type TeamMemberEventData, type TeamUpdateEventData } from '@/services/websocketManager'

// 團隊類型定義
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
  // 狀態
  const members = ref<TeamMember[]>([])
  const teams = ref<Team[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ✅ Loading counter to prevent race conditions when multiple operations run in parallel
  let loadingCounter = 0

  // ==================== Selection State (批量操作) ====================
  const selectedMemberIds = ref<Set<string>>(new Set())
  const isSelectionMode = ref(false)

  // 計算已選擇的數量
  const selectedCount = computed(() => selectedMemberIds.value.size)

  // 統計數據
  const stats = computed(() => ({
    totalMembers: members.value.length,
    teamCount: teams.value.filter(t => t.isActive).length,
    adminCount: members.value.filter(m => m.role === 'admin').length
  }))

  // 動作
  const loadMembers = async () => {
    try {
      // ✅ Increment counter and set loading state
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
      // ✅ Decrement counter and only set loading=false when all operations complete
      loadingCounter--
      if (loadingCounter === 0) {
        loading.value = false
      }
    }
  }

  const loadTeams = async () => {
    try {
      // ✅ Increment counter and set loading state
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
      // ✅ Decrement counter and only set loading=false when all operations complete
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

  // ==================== Selection Operations (批量操作) ====================

  /**
   * 進入/退出選擇模式
   */
  const toggleSelectionMode = () => {
    isSelectionMode.value = !isSelectionMode.value
    if (!isSelectionMode.value) {
      // 退出選擇模式時清空選擇
      selectedMemberIds.value.clear()
    }
  }

  /**
   * 切換單個成員的選擇狀態
   */
  const toggleMemberSelection = (memberId: string) => {
    if (selectedMemberIds.value.has(memberId)) {
      selectedMemberIds.value.delete(memberId)
    } else {
      selectedMemberIds.value.add(memberId)
    }
    // 觸發響應式更新
    selectedMemberIds.value = new Set(selectedMemberIds.value)
  }

  /**
   * 選擇所有成員
   * @param excludeIds 要排除的成員 ID（如當前用戶）
   */
  const selectAllMembers = (excludeIds: string[] = []) => {
    const allIds = members.value
      .filter(m => !excludeIds.includes(m.id))
      .map(m => m.id)
    selectedMemberIds.value = new Set(allIds)
  }

  /**
   * 取消所有選擇
   */
  const deselectAllMembers = () => {
    selectedMemberIds.value.clear()
    selectedMemberIds.value = new Set()
  }

  /**
   * 批量刪除成員（樂觀更新）
   * @param memberIds 要刪除的成員 ID 列表
   * @param reason 刪除原因（可選）
   * @returns 包含 undoToken 的響應
   */
  const bulkDeleteMembers = async (memberIds: string[], reason?: string) => {
    // ① 保存原始列表（用於失敗恢復）
    const originalMembers = [...members.value]

    // ② 樂觀更新：立即從列表中移除
    members.value = members.value.filter(m => !memberIds.includes(m.id))
    error.value = null

    // ③ 退出選擇模式
    deselectAllMembers()
    isSelectionMode.value = false

    try {
      // ④ 調用 API
      const response = await teamApi.bulkDeleteMembers(memberIds, reason)

      if (!response.success || !response.data) {
        // ⑤ API 失敗，恢復原列表
        members.value = originalMembers
        error.value = response.error || '批量刪除失敗'
        throw new Error(response.error || '批量刪除失敗')
      }

      // ⑥ 返回結果（包含 undoToken）
      return response.data
    } catch (err: unknown) {
      // ⑤ 發生錯誤，恢復原列表
      members.value = originalMembers
      error.value = (err as Error)?.message || '批量刪除失敗'
      console.error('批量刪除失敗:', err)
      throw err
    }
  }

  /**
   * 恢復已刪除的成員
   * @param options 恢復選項（undoToken 或 memberIds）
   */
  const restoreMembers = async (options: { undoToken?: string; memberIds?: string[] }) => {
    error.value = null

    try {
      const response = await teamApi.restoreMembers(options)

      if (!response.success || !response.data) {
        error.value = response.error || '恢復成員失敗'
        throw new Error(response.error || '恢復成員失敗')
      }

      // 重新載入成員列表以獲取最新狀態
      await loadMembers()

      return response.data
    } catch (err: unknown) {
      error.value = (err as Error)?.message || '恢復成員失敗'
      console.error('恢復成員失敗:', err)
      throw err
    }
  }

  /**
   * 批量更新成員（樂觀更新）
   * @param memberIds 要更新的成員 ID 列表
   * @param updates 要更新的欄位 (role, isActive)
   * @param reason 更新原因（可選）
   * @returns 批量更新結果
   */
  const bulkUpdateMembers = async (
    memberIds: string[],
    updates: { role?: 'admin' | 'agent'; isActive?: boolean },
    reason?: string
  ) => {
    // ① 保存原始資料（用於失敗恢復）
    const originalMembers = members.value.map(m => {
      if (memberIds.includes(m.id)) {
        return { ...m }
      }
      return m
    })

    // ② 樂觀更新：立即更新 UI
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

    // ③ 退出選擇模式
    deselectAllMembers()
    isSelectionMode.value = false

    try {
      // ④ 調用 API
      const response = await teamApi.bulkUpdateMembers(memberIds, updates, reason)

      if (!response.success || !response.data) {
        // ⑤ API 失敗，恢復原列表
        members.value = originalMembers
        error.value = response.error || '批量更新失敗'
        throw new Error(response.error || '批量更新失敗')
      }

      // ⑥ 返回結果
      return response.data
    } catch (err: unknown) {
      // ⑤ 發生錯誤，恢復原列表
      members.value = originalMembers
      error.value = (err as Error)?.message || '批量更新失敗'
      console.error('批量更新失敗:', err)
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

  const clearError = () => {
    error.value = null
  }

  // 重置狀態
  const $reset = () => {
    members.value = []
    teams.value = []
    loading.value = false
    error.value = null
  }

  // 🆕 WebSocket event handlers for real-time memberCount updates
  const handleTeamMemberAdded = (data: TeamMemberEventData) => {
    console.log('👥 [TeamStore] Member added event received:', data)

    // Find and update the team's memberCount
    const team = teams.value.find(t => t.id === data.teamId)
    if (team) {
      team.memberCount = data.memberCount
      console.log(`✅ [TeamStore] Updated memberCount for team ${data.teamName}: ${data.memberCount}`)
    } else {
      // Team not in store, might need to reload
      console.log(`ℹ️ [TeamStore] Team ${data.teamId} not found in store, consider reloading`)
    }
  }

  const handleTeamMemberRemoved = (data: TeamMemberEventData) => {
    console.log('👥 [TeamStore] Member removed event received:', data)

    // Find and update the team's memberCount
    const team = teams.value.find(t => t.id === data.teamId)
    if (team) {
      team.memberCount = data.memberCount
      console.log(`✅ [TeamStore] Updated memberCount for team ${data.teamName}: ${data.memberCount}`)
    } else {
      console.log(`ℹ️ [TeamStore] Team ${data.teamId} not found in store`)
    }
  }

  const handleTeamUpdated = (data: TeamUpdateEventData) => {
    console.log('🔄 [TeamStore] Team updated event received:', data)

    // Find and update the team
    const team = teams.value.find(t => t.id === data.teamId)
    if (team) {
      if (data.changes.name !== undefined) {team.name = data.changes.name}
      if (data.changes.description !== undefined) {team.description = data.changes.description}
      if (data.changes.isActive !== undefined) {team.isActive = data.changes.isActive}
      if (data.changes.memberCount !== undefined) {team.memberCount = data.changes.memberCount}
      console.log(`✅ [TeamStore] Updated team ${data.teamId}:`, data.changes)
    } else {
      console.log(`ℹ️ [TeamStore] Team ${data.teamId} not found in store`)
    }
  }

  // 🆕 Setup WebSocket event listeners
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
      console.log('✅ [TeamStore] WebSocket listeners setup complete')
    } catch (err) {
      console.warn('⚠️ [TeamStore] Failed to setup WebSocket listeners:', err)
    }
  }

  // Auto-setup listeners when store is used
  setupWebSocketListeners()

  /**
   * 🆕 直接更新本地成員資料（不發送 API 請求）
   * 用於 API 成功後的本地同步，避免全量重新載入
   *
   * @param memberId - 成員 ID
   * @param data - 要更新的欄位
   * @returns 是否成功找到並更新成員
   */
  const updateMemberLocal = (memberId: string, data: {
    name?: string
    displayName?: string
    email?: string
    role?: 'admin' | 'agent'
    status?: 'active' | 'inactive'
    teams?: Array<{ teamId: number; teamName?: string; roleInTeam: 'member' | 'lead' | 'supervisor'; isPrimary: boolean; joinedAt?: string }>
  }): boolean => {
    const member = members.value.find(m => m.id === memberId)
    if (!member) {
      console.warn(`[TeamStore] updateMemberLocal: Member ${memberId} not found`)
      return false
    }

    // 更新欄位
    if (data.name !== undefined) {member.name = data.name}
    if (data.displayName !== undefined) {member.name = data.displayName}
    if (data.email !== undefined) {member.email = data.email}
    if (data.role !== undefined) {member.role = data.role}
    if (data.status !== undefined) {member.status = data.status}
    if (data.teams !== undefined) {member.teams = data.teams}

    // 更新 updatedAt
    member.updatedAt = new Date().toISOString()

    console.log(`✅ [TeamStore] updateMemberLocal: Member ${memberId} updated locally`, data)
    return true
  }

  /**
   * 🆕 直接更新本地團隊資料（不發送 API 請求）
   * 用於 API 成功後的本地同步，避免全量重新載入
   *
   * @param teamId - 團隊 ID
   * @param data - 要更新的欄位
   * @returns 是否成功找到並更新團隊
   */
  const updateTeamLocal = (teamId: number, data: {
    name?: string
    description?: string
    isActive?: boolean
    memberCount?: number
  }): boolean => {
    const team = teams.value.find(t => t.id === teamId)
    if (!team) {
      console.warn(`[TeamStore] updateTeamLocal: Team ${teamId} not found`)
      return false
    }

    // 更新欄位
    if (data.name !== undefined) {team.name = data.name}
    if (data.description !== undefined) {team.description = data.description}
    if (data.isActive !== undefined) {team.isActive = data.isActive}
    if (data.memberCount !== undefined) {team.memberCount = data.memberCount}

    // 更新 updatedAt
    team.updatedAt = new Date().toISOString()

    console.log(`✅ [TeamStore] updateTeamLocal: Team ${teamId} updated locally`, data)
    return true
  }

  return {
    // 狀態
    members,
    teams,
    loading,
    error,
    stats,

    // 🆕 Selection State (批量操作)
    selectedMemberIds,
    isSelectionMode,
    selectedCount,

    // 動作
    loadMembers,
    loadTeams,
    loadAll,
    addMember,
    updateMemberRole,
    updateMemberStatus,
    updateMember,
    removeMember,
    resetPassword,
    resetPasswordWithPolicy,
    clearError,
    $reset,

    // 🆕 Selection Operations (批量操作)
    toggleSelectionMode,
    toggleMemberSelection,
    selectAllMembers,
    deselectAllMembers,
    bulkDeleteMembers,
    bulkUpdateMembers,
    restoreMembers,

    // 🆕 WebSocket setup (exposed for manual re-setup if needed)
    setupWebSocketListeners,
    // 🆕 直接更新本地資料（用於最小化刷新）
    updateMemberLocal,
    updateTeamLocal
  }
})