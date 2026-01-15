/**
 * Team Operations Composable
 *
 * 职责：
 * - 团队 CRUD 操作
 * - 成员分配和管理
 * - 乐观更新逻辑
 * - 表单状态管理
 *
 * @module composables/team-management/useTeamOperations
 */

import { ref, reactive, computed, type Ref } from 'vue'
import { useTeamStore } from '@/stores/team'
import { useQRCodeStore } from '@/stores/qrcode'
import { useToast } from '@/composables/useToast'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { teamApi } from '@/api/team'
import type { TeamMember } from '@/types'

// ==================== Types ====================

export interface Team {
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

export interface AddTeamFormData {
  name: string
  description: string
  selectedMembers: string[]
}

export interface EditTeamFormData {
  id: number
  name: string
  description: string
  isActive: boolean
  membersToAdd: string[]
  membersToRemove: string[]
}

export interface UseTeamOperationsReturn {
  // Add Team Modal
  addTeamModal: Ref<boolean>
  addTeamForm: AddTeamFormData
  addTeamLoading: Ref<boolean>
  availableMembers: Ref<TeamMember[]>
  isAllMembersSelected: Ref<boolean>
  openAddTeamModal: () => void
  closeAddTeamModal: () => void
  toggleMemberSelection: (memberId: string) => void
  toggleSelectAllMembers: () => void
  submitAddTeam: () => Promise<void>

  // Edit Team Modal
  editTeamModal: Ref<boolean>
  editTeamForm: EditTeamFormData
  editTeamLoading: Ref<boolean>
  editTeamCurrentMembers: Ref<TeamMember[]>
  editTeamAvailableMembers: Ref<TeamMember[]>
  isAllAvailableMembersSelected: Ref<boolean>
  openEditTeamModal: (team: Team) => Promise<void>
  closeEditTeamModal: () => void
  toggleAvailableMemberSelection: (memberId: string) => void
  toggleSelectAllAvailableMembers: () => void
  removeMemberFromTeam: (memberId: string) => void
  submitEditTeam: () => Promise<void>

  // Team Operations
  toggleTeamStatus: (team: Team) => Promise<void>
  removeTeam: (team: Team) => Promise<void>
  handleMemberUpdated: () => Promise<void>

  // Utilities
  getInitials: (name: string) => string
  getRoleDisplayName: (role: string) => string
}

// ==================== Composable ====================

/**
 * 团队操作 Composable
 *
 * @example
 * ```typescript
 * const teamOps = useTeamOperations()
 *
 * // 打开新增团队模态框
 * teamOps.openAddTeamModal()
 *
 * // 编辑团队
 * await teamOps.openEditTeamModal(team)
 * ```
 */
export function useTeamOperations(): UseTeamOperationsReturn {
  const teamStore = useTeamStore()
  const qrCodeStore = useQRCodeStore()
  const { showSuccess, showError } = useToast()
  const { showDanger } = useConfirmDialog()

  // ==================== Add Team Modal ====================

  const addTeamModal = ref(false)
  const addTeamLoading = ref(false)

  const addTeamForm = reactive<AddTeamFormData>({
    name: '',
    description: '',
    selectedMembers: []
  })

  /**
   * 可用成员列表（排除管理员，允许客服加入多个团队）
   */
  const availableMembers = computed(() => {
    return teamStore.members.filter(member =>
      member.role !== 'admin' // 只排除管理员
    )
  })

  /**
   * 是否全选所有成员
   */
  const isAllMembersSelected = computed(() => {
    return availableMembers.value.length > 0 &&
      addTeamForm.selectedMembers.length === availableMembers.value.length
  })

  /**
   * 打开新增团队模态框
   */
  function openAddTeamModal() {
    addTeamModal.value = true
  }

  /**
   * 关闭新增团队模态框
   */
  function closeAddTeamModal() {
    addTeamModal.value = false
    resetAddTeamForm()
  }

  /**
   * 重置新增团队表单
   */
  function resetAddTeamForm() {
    Object.assign(addTeamForm, {
      name: '',
      description: '',
      selectedMembers: []
    })
  }

  /**
   * 切换单个成员选择状态
   */
  function toggleMemberSelection(memberId: string) {
    const index = addTeamForm.selectedMembers.indexOf(memberId)
    if (index > -1) {
      addTeamForm.selectedMembers.splice(index, 1)
    } else {
      addTeamForm.selectedMembers.push(memberId)
    }
  }

  /**
   * 切换全选状态
   */
  function toggleSelectAllMembers() {
    if (isAllMembersSelected.value) {
      addTeamForm.selectedMembers = []
    } else {
      addTeamForm.selectedMembers = availableMembers.value.map(m => m.id)
    }
  }

  /**
   * 提交新增团队（乐观更新）
   */
  async function submitAddTeam() {
    // ① 立即关闭模态框和显示成功提示（乐观更新）
    const teamName = addTeamForm.name
    const memberCount = addTeamForm.selectedMembers.length
    const selectedMemberIds = [...addTeamForm.selectedMembers]

    // 立即重置表单并关闭模态框
    resetAddTeamForm()
    closeAddTeamModal()
    showSuccess('新增團隊成功', `正在建立團隊並加入 ${memberCount} 位成員...`)

    // ② 背景执行实际操作
    try {
      // 建立团队
      const response = await teamApi.createTeam({
        name: teamName,
        description: addTeamForm.description
      })

      if (response.success && response.data) {
        const newTeamId = response.data.id

        // ③ 乐观更新：直接将新团队添加到列表
        teamStore.teams = [...teamStore.teams, response.data]

        // 🆕 团队创建时已预生成 QR 码，触发 Store 预载
        if (response.data.qrCode) {
          await qrCodeStore.loadQRCode(newTeamId, true)
          console.log(`🚀 QR 碼已存入 Store: team ${newTeamId}`)
        }

        // ④ 如果有选择成员，将他们加入团队
        if (selectedMemberIds.length > 0) {
          await Promise.all(
            selectedMemberIds.map(async (memberId) => {
              try {
                await teamStore.updateMember(memberId, { teamId: newTeamId })
                // ⑤ 乐观更新：直接更新成员的 teamId
                const member = teamStore.members.find(m => m.id === memberId)
                if (member) {
                  member.teamId = newTeamId
                }
              } catch (memberError) {
                console.error(`新增成員 ${memberId} 到團隊失敗:`, memberError)
              }
            })
          )
        }

        console.log('✅ 團隊創建完成，已優化更新本地數據')
      } else {
        showError('新增團隊失敗', '團隊創建失敗，請重試')
      }
    } catch (error) {
      console.error('新增團隊失敗:', error)
      showError('新增團隊失敗', error instanceof Error ? error.message : '請稍後重試')
    }
  }

  // ==================== Edit Team Modal ====================

  const editTeamModal = ref(false)
  const editTeamLoading = ref(false)
  const editTeamCurrentMembers = ref<TeamMember[]>([])

  const editTeamForm = reactive<EditTeamFormData>({
    id: 0,
    name: '',
    description: '',
    isActive: true,
    membersToAdd: [],
    membersToRemove: []
  })

  /**
   * 编辑团队时：可新增的成员列表（多团队支援）
   */
  const editTeamAvailableMembers = computed(() => {
    const currentMemberIds = editTeamCurrentMembers.value.map(m => m.id)
    return teamStore.members.filter(member =>
      member.role !== 'admin' && // 排除管理员
      !currentMemberIds.includes(member.id) // 不在当前团队成员中
    )
  })

  /**
   * 是否全选所有可用成员
   */
  const isAllAvailableMembersSelected = computed(() => {
    return editTeamAvailableMembers.value.length > 0 &&
      editTeamForm.membersToAdd.length === editTeamAvailableMembers.value.length
  })

  /**
   * 打开编辑团队模态框
   */
  async function openEditTeamModal(team: Team) {
    // 重置表单数据
    Object.assign(editTeamForm, {
      id: team.id,
      name: team.name,
      description: team.description || '',
      isActive: team.isActive,
      membersToAdd: [],
      membersToRemove: []
    })

    // 载入当前团队成员
    try {
      const response = await teamApi.getTeamMembersByTeam(team.id)
      if (response.success && response.data) {
        editTeamCurrentMembers.value = response.data
      } else {
        editTeamCurrentMembers.value = []
      }
    } catch (error) {
      console.error('載入團隊成員失敗:', error)
      editTeamCurrentMembers.value = []
    }

    editTeamModal.value = true
  }

  /**
   * 关闭编辑团队模态框
   */
  function closeEditTeamModal() {
    editTeamModal.value = false
    resetEditTeamForm()
    editTeamCurrentMembers.value = []
  }

  /**
   * 重置编辑团队表单
   */
  function resetEditTeamForm() {
    Object.assign(editTeamForm, {
      id: 0,
      name: '',
      description: '',
      isActive: true,
      membersToAdd: [],
      membersToRemove: []
    })
  }

  /**
   * 切换可用成员选择状态
   */
  function toggleAvailableMemberSelection(memberId: string) {
    const index = editTeamForm.membersToAdd.indexOf(memberId)
    if (index > -1) {
      editTeamForm.membersToAdd.splice(index, 1)
    } else {
      editTeamForm.membersToAdd.push(memberId)
    }
  }

  /**
   * 切换全选可用成员
   */
  function toggleSelectAllAvailableMembers() {
    if (isAllAvailableMembersSelected.value) {
      editTeamForm.membersToAdd = []
    } else {
      editTeamForm.membersToAdd = editTeamAvailableMembers.value.map(m => m.id)
    }
  }

  /**
   * 从团队移除成员
   */
  function removeMemberFromTeam(memberId: string) {
    const memberIndex = editTeamCurrentMembers.value.findIndex(m => m.id === memberId)
    if (memberIndex === -1) {
      return
    }

    // 乐观更新：立即从当前成员列表移除
    editTeamCurrentMembers.value.splice(memberIndex, 1)

    // 记录到待移除列表
    if (!editTeamForm.membersToRemove.includes(memberId)) {
      editTeamForm.membersToRemove.push(memberId)
    }

    // 如果该成员在待新增列表中，移除它
    const addIndex = editTeamForm.membersToAdd.indexOf(memberId)
    if (addIndex > -1) {
      editTeamForm.membersToAdd.splice(addIndex, 1)
    }
  }

  /**
   * 提交编辑团队（乐观更新）
   */
  async function submitEditTeam() {
    editTeamLoading.value = true

    const teamIndex = teamStore.teams.findIndex(t => t.id === editTeamForm.id)
    if (teamIndex === -1) {
      console.error('Team not found:', editTeamForm.id)
      editTeamLoading.value = false
      return
    }

    const team = teamStore.teams[teamIndex]
    if (!team) {
      console.error('Team object is undefined:', editTeamForm.id)
      editTeamLoading.value = false
      return
    }

    // 保存原始数据（用于失败恢复）
    const originalName = team.name
    const originalDescription = team.description
    const originalIsActive = team.isActive
    const originalMemberCount = team.memberCount || 0

    const { id, membersToAdd, membersToRemove, ...updateData } = editTeamForm
    const memberCountChange = membersToAdd.length - membersToRemove.length
    const newMemberCount = originalMemberCount + memberCountChange

    // 乐观更新：立即更新 UI
    team.name = updateData.name
    team.description = updateData.description
    team.isActive = updateData.isActive
    team.memberCount = newMemberCount

    // 立即关闭模态框和显示成功消息
    const totalChanges = membersToAdd.length + membersToRemove.length
    const changeMessage = totalChanges > 0
      ? `正在更新團隊資訊並處理 ${totalChanges} 位成員變更...`
      : '已成功更新團隊資訊'

    closeEditTeamModal()
    editTeamLoading.value = false
    showSuccess('更新團隊成功', changeMessage)

    try {
      // 背景调用 API - 更新团队基本资讯
      const response = await teamApi.updateTeam(id, {
        name: updateData.name,
        description: updateData.description,
        isActive: updateData.isActive
      })

      if (!response.success) {
        // API 返回失败，恢复原数据
        team.name = originalName
        team.description = originalDescription
        team.isActive = originalIsActive
        team.memberCount = originalMemberCount
        showError('更新團隊失敗', response.error || '請稍後重試')
        return
      }

      // 处理成员变更
      const memberUpdatePromises: Promise<TeamMember | { success: false; memberId: string }>[] = []

      // 移除成员
      membersToRemove.forEach(memberId => {
        memberUpdatePromises.push(
          teamStore.updateMember(memberId, { teamId: undefined })
            .catch(error => {
              console.error(`移除成員 ${memberId} 失敗:`, error)
              return { success: false, memberId }
            })
        )
      })

      // 新增成员
      membersToAdd.forEach(memberId => {
        memberUpdatePromises.push(
          teamStore.updateMember(memberId, { teamId: id })
            .catch(error => {
              console.error(`新增成員 ${memberId} 到團隊失敗:`, error)
              return { success: false, memberId }
            })
        )
      })

      if (memberUpdatePromises.length > 0) {
        await Promise.all(memberUpdatePromises)
        console.log('✅ 團隊成員更新完成')
      }
    } catch (error) {
      console.error('更新團隊失敗:', error)
      // 发生错误，恢复原数据
      team.name = originalName
      team.description = originalDescription
      team.isActive = originalIsActive
      team.memberCount = originalMemberCount
      showError('更新團隊失敗', error instanceof Error ? error.message : '請稍後重試')
    }
  }

  // ==================== Team Operations ====================

  /**
   * 切换团队状态（乐观更新）
   */
  async function toggleTeamStatus(team: Team) {
    const teamIndex = teamStore.teams.findIndex(t => t.id === team.id)
    if (teamIndex === -1) {
      console.warn('Team not found:', team.id)
      return
    }

    const teamObj = teamStore.teams[teamIndex]
    if (!teamObj) {
      console.error('Team object is undefined:', team.id)
      return
    }

    // 保存原始状态
    const originalStatus = teamObj.isActive
    const newStatus = !originalStatus

    // 乐观更新
    teamObj.isActive = newStatus

    try {
      const response = await teamApi.updateTeam(team.id, { isActive: newStatus })
      if (response.success) {
        showSuccess('團隊狀態更新成功', `已${newStatus ? '啟用' : '停用'}團隊`)
      } else {
        // 恢复原状态
        teamObj.isActive = originalStatus
        showError('更新團隊狀態失敗', response.error || '請稍後重試')
      }
    } catch (error) {
      console.error('更新團隊狀態失敗:', error)
      // 恢复原状态
      teamObj.isActive = originalStatus
      showError('更新團隊狀態失敗', '請稍後重試')
    }
  }

  /**
   * 移除团队（带确认弹窗）
   */
  async function removeTeam(team: Team) {
    // 顯示確認彈窗
    const confirmed = await showDanger(
      '確認刪除團隊',
      `您確定要刪除團隊「${team.name}」嗎？\n\n此操作將會：\n• 永久刪除此團隊\n• 團隊中的成員將變為未分配狀態\n\n⚠️ 此操作無法復原`,
      {
        confirmText: '確認刪除',
        cancelText: '取消'
      }
    )

    if (!confirmed) {
      return
    }

    try {
      await teamApi.deleteTeam(team.id)
      // 从列表中移除
      const index = teamStore.teams.findIndex(t => t.id === team.id)
      if (index > -1) {
        teamStore.teams.splice(index, 1)
      }
      showSuccess('移除團隊成功', `已成功移除團隊 ${team.name}`)
    } catch (error) {
      console.error('移除團隊失敗:', error)
      showError('移除團隊失敗', '請稍後重試')
    }
  }

  /**
   * 处理成员更新事件
   */
  async function handleMemberUpdated() {
    console.log('🔄 團隊成員已更新，重新載入團隊數據...')
    try {
      await teamStore.loadTeams()
      console.log('✅ 團隊數據重新載入完成')
    } catch (error) {
      console.error('❌ 重新載入團隊數據失敗:', error)
    }
  }

  // ==================== Utilities ====================

  /**
   * 获取姓名首字母
   */
  function getInitials(name: string): string {
    if (!name) {
      return '?'
    }
    const names = name.split(' ').filter(n => n.trim())
    if (names.length === 0) {
      return '?'
    }
    if (names.length === 1) {
      const firstName = names[0]
      return firstName ? firstName.charAt(0).toUpperCase() : '?'
    }
    const firstName = names[0]
    const lastName = names[names.length - 1]
    return firstName && lastName
      ? (firstName.charAt(0) + lastName.charAt(0)).toUpperCase()
      : '?'
  }

  /**
   * 获取角色显示名称
   */
  function getRoleDisplayName(role: string): string {
    const roleMap: Record<string, string> = {
      admin: '管理員',
      agent: '客服'
    }
    return roleMap[role] || role
  }

  // ==================== Return ====================

  return {
    // Add Team Modal
    addTeamModal,
    addTeamForm,
    addTeamLoading,
    availableMembers,
    isAllMembersSelected,
    openAddTeamModal,
    closeAddTeamModal,
    toggleMemberSelection,
    toggleSelectAllMembers,
    submitAddTeam,

    // Edit Team Modal
    editTeamModal,
    editTeamForm,
    editTeamLoading,
    editTeamCurrentMembers,
    editTeamAvailableMembers,
    isAllAvailableMembersSelected,
    openEditTeamModal,
    closeEditTeamModal,
    toggleAvailableMemberSelection,
    toggleSelectAllAvailableMembers,
    removeMemberFromTeam,
    submitEditTeam,

    // Team Operations
    toggleTeamStatus,
    removeTeam,
    handleMemberUpdated,

    // Utilities
    getInitials,
    getRoleDisplayName
  }
}
