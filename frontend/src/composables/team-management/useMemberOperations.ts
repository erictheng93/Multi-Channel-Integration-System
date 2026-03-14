/**
 * Member Operations Composable
 *
 * 职责：
 * - 成员 CRUD 操作
 * - 密码重置管理
 * - 角色和状态切换
 * - 表单状态管理
 * -  批量选择和删除操作
 * -  Undo 机制
 *
 * @module composables/team-management/useMemberOperations
 */

import { ref, reactive, computed, type Ref, type ComputedRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useTeamStore } from '@/stores/team'
import { useToast } from '@/composables/useToast'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { ROLES } from '@/constants/roles'
import type { TeamMember } from '@/types'

// ==================== Types ====================

export interface AddMemberFormData {
  loginId: string
  name: string
  email: string
  password: string
  role: typeof ROLES.ADMIN | typeof ROLES.AGENT
  group: string
  isActive: boolean
}

export interface PasswordResetFormData {
  newPassword: string
  confirmPassword: string
}

export interface BulkEditFormData {
  updateRole: boolean
  role: 'admin' | 'agent'
  updateStatus: boolean
  isActive: boolean
}

export interface UseMemberOperationsReturn {
  // Add Member Modal
  addMemberModal: Ref<boolean>
  addMemberForm: AddMemberFormData
  addMemberLoading: Ref<boolean>
  showAddPassword: Ref<boolean>
  openAddMemberModal: () => void
  closeAddMemberModal: () => void
  toggleAddPasswordVisibility: () => void
  submitAddMember: () => Promise<void>

  // Password Reset Modal
  passwordResetModal: Ref<boolean>
  passwordResetForm: PasswordResetFormData
  passwordResetMember: Ref<TeamMember | null>
  passwordResetLoading: Ref<boolean>
  passwordMismatch: ComputedRef<boolean>
  isPasswordFormValid: ComputedRef<boolean>
  openPasswordResetModal: (_member: TeamMember) => void
  closePasswordResetModal: () => void
  submitPasswordReset: () => Promise<void>

  // Member Operations
  updateMemberRole: (_memberId: string, _role: string) => Promise<void>
  toggleMemberStatus: (_member: TeamMember) => Promise<void>
  removeMember: (_member: TeamMember) => Promise<void>

  // Selection Mode (批量操作)
  isSelectionMode: Ref<boolean>
  selectedMemberIds: Ref<Set<string>>
  selectedCount: ComputedRef<number>
  toggleSelectionMode: () => void
  toggleMemberSelection: (_memberId: string) => void
  selectAllMembers: (_currentUserId: string) => void
  deselectAllMembers: () => void

  // Bulk Operations
  bulkDeleteMembers: (_currentUserId: string) => Promise<void>

  // Bulk Edit Modal
  bulkEditModal: Ref<boolean>
  bulkEditForm: BulkEditFormData
  bulkEditLoading: Ref<boolean>
  isBulkEditFormValid: ComputedRef<boolean>
  openBulkEditModal: () => void
  closeBulkEditModal: () => void
  submitBulkEdit: (_currentUserId: string) => Promise<void>
}

// ==================== Composable ====================

/**
 * 成员操作 Composable
 *
 * @example
 * ```typescript
 * const memberOps = useMemberOperations()
 *
 * // 打开新增成员模态框
 * memberOps.openAddMemberModal()
 *
 * // 重置密码
 * memberOps.openPasswordResetModal(member)
 * ```
 */
export function useMemberOperations(): UseMemberOperationsReturn {
  const teamStore = useTeamStore()
  const { showSuccess, showError } = useToast()
  const { showDanger } = useConfirmDialog()

  // ==================== Add Member Modal ====================

  const addMemberModal = ref(false)
  const addMemberLoading = ref(false)
  const showAddPassword = ref(false)

  const addMemberForm = reactive<AddMemberFormData>({
    loginId: '',
    name: '',
    email: '',
    password: '',
    role: ROLES.AGENT,
    group: '',
    isActive: true
  })

  /**
   * 打开新增成员模态框
   */
  function openAddMemberModal() {
    addMemberModal.value = true
  }

  /**
   * 关闭新增成员模态框并重置表单
   */
  function closeAddMemberModal() {
    addMemberModal.value = false
    showAddPassword.value = false
    resetAddMemberForm()
  }

  /**
   * 重置新增成员表单
   */
  function resetAddMemberForm() {
    Object.assign(addMemberForm, {
      loginId: '',
      name: '',
      email: '',
      password: '',
      role: ROLES.AGENT,
      group: '',
      isActive: true
    })
  }

  /**
   * 切换密码显示/隐藏
   */
  function toggleAddPasswordVisibility() {
    showAddPassword.value = !showAddPassword.value
  }

  /**
   * 提交新增成员
   */
  async function submitAddMember() {
    addMemberLoading.value = true
    try {
      // 使用 email 作为 loginId
      const memberData = {
        ...addMemberForm,
        loginId: addMemberForm.email
      }

      await teamStore.addMember(memberData)

      showSuccess('新增成員成功', '已成功新增系統人員')
      closeAddMemberModal()
    } catch (error) {
      console.error('新增成員失敗:', error)
      const errorMessage = error instanceof Error
        ? error.message
        : '新增成員失敗，請稍後重試'
      showError('新增成員失敗', errorMessage)
    } finally {
      addMemberLoading.value = false
    }
  }

  // ==================== Password Reset Modal ====================

  const passwordResetModal = ref(false)
  const passwordResetMember = ref<TeamMember | null>(null)
  const passwordResetLoading = ref(false)

  const passwordResetForm = reactive<PasswordResetFormData>({
    newPassword: '',
    confirmPassword: ''
  })

  /**
   * 密码不匹配检查
   */
  const passwordMismatch = computed(() => {
    return !!(passwordResetForm.newPassword &&
      passwordResetForm.confirmPassword &&
      passwordResetForm.newPassword !== passwordResetForm.confirmPassword)
  })

  /**
   * 密码表单验证
   */
  const isPasswordFormValid = computed(() => {
    return !!(passwordResetForm.newPassword.length >= 6 &&
      passwordResetForm.confirmPassword &&
      !passwordMismatch.value)
  })

  /**
   * 打开密码重置模态框
   */
  function openPasswordResetModal(member: TeamMember) {
    passwordResetMember.value = member
    resetPasswordResetForm()
    passwordResetModal.value = true
  }

  /**
   * 关闭密码重置模态框
   */
  function closePasswordResetModal() {
    passwordResetModal.value = false
    passwordResetMember.value = null
    resetPasswordResetForm()
  }

  /**
   * 重置密码表单
   */
  function resetPasswordResetForm() {
    Object.assign(passwordResetForm, {
      newPassword: '',
      confirmPassword: ''
    })
  }

  /**
   * 提交密码重置
   */
  async function submitPasswordReset() {
    if (!isPasswordFormValid.value || !passwordResetMember.value) {
      return
    }

    passwordResetLoading.value = true
    try {
      await teamStore.resetPasswordWithPolicy(
        passwordResetMember.value.id,
        {
          newPassword: passwordResetForm.newPassword,
          policy: 'changeable' // 默认使用 changeable 政策
        }
      )

      showSuccess(
        '密碼設定成功',
        `成功為 ${passwordResetMember.value.name || passwordResetMember.value.loginId} 設定新密碼`,
        {
          duration: 5000,
          actionText: '確定'
        }
      )

      closePasswordResetModal()
    } catch (error) {
      console.error('設定密碼失敗:', error)
      showError('設定密碼失敗', '請檢查網路連線或稍後重試')
    } finally {
      passwordResetLoading.value = false
    }
  }

  // ==================== Member Operations ====================

  /**
   * 更新成员角色
   */
  async function updateMemberRole(memberId: string, role: string) {
    try {
      await teamStore.updateMemberRole(
        memberId,
        role as typeof ROLES.ADMIN | typeof ROLES.AGENT
      )
      showSuccess('更新角色成功', '已成功更新成員角色')
    } catch (error) {
      console.error('更新角色失敗:', error)
      showError('更新角色失敗', '請稍後重試')
    }
  }

  /**
   * 切换成员状态
   */
  async function toggleMemberStatus(member: TeamMember) {
    const newStatus = member.status === 'active' ? 'inactive' : 'active'
    try {
      await teamStore.updateMemberStatus(member.id, newStatus)
      showSuccess(
        '狀態更新成功',
        `已${newStatus === 'active' ? '啟用' : '停用'}成員`
      )
    } catch (error) {
      console.error('更新狀態失敗:', error)
      showError('更新狀態失敗', '請稍後重試')
    }
  }

  /**
   * 永久移除成员（带确认弹窗，不可撤銷）
   */
  async function removeMember(member: TeamMember) {
    const memberName = member.name || member.loginId

    // 顯示確認彈窗
    const confirmed = await showDanger(
      '確認永久刪除成員',
      `您確定要永久刪除成員「${memberName}」嗎？\n\n此操作將會：\n• 永久刪除該成員帳號\n• 清理所有相關資料\n• 此操作不可撤銷`,
      {
        confirmText: '確認刪除',
        cancelText: '取消'
      }
    )

    if (!confirmed) {
      return
    }

    try {
      await teamStore.removeMember(member.id)

      showSuccess(
        '刪除成員成功',
        `已永久刪除成員 ${memberName}`
      )
    } catch (error) {
      console.error('刪除成員失敗:', error)
      const errorMessage = error instanceof Error
        ? error.message
        : '刪除成員失敗，請稍後重試'
      showError('刪除成員失敗', errorMessage)
    }
  }

  // ==================== Selection Mode (批量操作) ====================

  // 使用 storeToRefs 獲取響應式狀態
  const { isSelectionMode, selectedMemberIds, selectedCount } = storeToRefs(teamStore)

  /**
   * 進入/退出選擇模式
   */
  function toggleSelectionMode() {
    teamStore.toggleSelectionMode()
  }

  /**
   * 切換單個成員的選擇狀態
   */
  function toggleMemberSelection(memberId: string) {
    teamStore.toggleMemberSelection(memberId)
  }

  /**
   * 選擇所有成員（排除當前用戶）
   */
  function selectAllMembers(currentUserId: string) {
    teamStore.selectAllMembers([currentUserId])
  }

  /**
   * 取消所有選擇
   */
  function deselectAllMembers() {
    teamStore.deselectAllMembers()
  }

  // ==================== Bulk Operations ====================

  /**
   * 批量永久刪除成員（帶確認彈窗，不可撤銷）
   */
  async function bulkDeleteMembers(currentUserId: string) {
    const selectedIds = Array.from(selectedMemberIds.value)

    // 過濾掉當前用戶（防止自刪）
    const idsToDelete = selectedIds.filter(id => id !== currentUserId)

    if (idsToDelete.length === 0) {
      showError('無法刪除', '請選擇要移除的成員')
      return
    }

    // 獲取選中成員的名稱
    const selectedMembers = teamStore.members.filter(m => idsToDelete.includes(m.id))
    const memberNames = selectedMembers.map(m => m.name || m.loginId).join('、')

    // 顯示確認彈窗
    const confirmed = await showDanger(
      '確認批量永久刪除成員',
      `您確定要永久刪除以下 ${idsToDelete.length} 位成員嗎？\n\n${memberNames}\n\n此操作不可撤銷。`,
      {
        confirmText: `確認刪除 ${idsToDelete.length} 位成員`,
        cancelText: '取消'
      }
    )

    if (!confirmed) {
      return
    }

    try {
      // 執行批量刪除
      const result = await teamStore.bulkDeleteMembers(idsToDelete)

      showSuccess(
        '成功刪除成員',
        `已永久刪除 ${result.deletedCount} 位成員`
      )
    } catch (error) {
      console.error('批量刪除失敗:', error)
      const errorMessage = error instanceof Error
        ? error.message
        : '批量刪除失敗，請稍後重試'
      showError('批量刪除失敗', errorMessage)
    }
  }

  // ==================== Bulk Edit Modal ====================

  const bulkEditModal = ref(false)
  const bulkEditLoading = ref(false)

  const bulkEditForm = reactive<BulkEditFormData>({
    updateRole: false,
    role: ROLES.AGENT,
    updateStatus: false,
    isActive: true
  })

  /**
   * 表單驗證：至少勾選一個更新選項
   */
  const isBulkEditFormValid = computed(() => {
    return bulkEditForm.updateRole || bulkEditForm.updateStatus
  })

  /**
   * 打開批量編輯模態框
   */
  function openBulkEditModal() {
    resetBulkEditForm()
    bulkEditModal.value = true
  }

  /**
   * 關閉批量編輯模態框
   */
  function closeBulkEditModal() {
    bulkEditModal.value = false
    resetBulkEditForm()
  }

  /**
   * 重置批量編輯表單
   */
  function resetBulkEditForm() {
    Object.assign(bulkEditForm, {
      updateRole: false,
      role: ROLES.AGENT,
      updateStatus: false,
      isActive: true
    })
  }

  /**
   * 提交批量編輯
   */
  async function submitBulkEdit(currentUserId: string) {
    if (!isBulkEditFormValid.value) {
      showError('無效操作', '請至少選擇一個要變更的欄位')
      return
    }

    const selectedIds = Array.from(selectedMemberIds.value)

    // 過濾掉當前用戶（防止自我更新）
    const idsToUpdate = selectedIds.filter(id => id !== currentUserId)

    if (idsToUpdate.length === 0) {
      showError('無法更新', '請選擇要編輯的成員（不能選擇自己）')
      return
    }

    // 構建更新資料
    const updates: { role?: 'admin' | 'agent'; isActive?: boolean } = {}
    if (bulkEditForm.updateRole) {
      updates.role = bulkEditForm.role
    }
    if (bulkEditForm.updateStatus) {
      updates.isActive = bulkEditForm.isActive
    }

    // 獲取選中成員的名稱（用於確認彈窗）
    const selectedMembers = teamStore.members.filter(m => idsToUpdate.includes(m.id))
    const memberNames = selectedMembers.map(m => m.name || m.loginId).slice(0, 5).join('、')
    const moreCount = idsToUpdate.length > 5 ? `...等 ${idsToUpdate.length} 位` : ''

    // 構建變更描述
    const changes: string[] = []
    if (updates.role) {
      changes.push(`角色變更為「${updates.role === 'admin' ? '管理員' : '客服人員'}」`)
    }
    if (updates.isActive !== undefined) {
      changes.push(`狀態變更為「${updates.isActive ? '啟用' : '停用'}」`)
    }

    // 顯示確認彈窗
    const confirmed = await showDanger(
      '確認批量編輯',
      `您確定要對以下 ${idsToUpdate.length} 位成員套用變更嗎？\n\n成員：${memberNames}${moreCount}\n\n變更內容：\n${changes.map(c => `• ${c}`).join('\n')}`,
      {
        confirmText: `確認變更 ${idsToUpdate.length} 位成員`,
        cancelText: '取消'
      }
    )

    if (!confirmed) {
      return
    }

    bulkEditLoading.value = true
    try {
      // 執行批量更新
      const result = await teamStore.bulkUpdateMembers(idsToUpdate, updates)

      // 關閉 Modal
      closeBulkEditModal()

      // 顯示成功訊息
      const skippedCount = result.skipped?.length || 0
      let message = `已成功更新 ${result.updatedCount} 位成員`
      if (skippedCount > 0) {
        message += `（${skippedCount} 位被跳過）`
      }

      showSuccess('批量編輯成功', message)

    } catch (error) {
      console.error('批量編輯失敗:', error)
      const errorMessage = error instanceof Error
        ? error.message
        : '批量編輯失敗，請稍後重試'
      showError('批量編輯失敗', errorMessage)
    } finally {
      bulkEditLoading.value = false
    }
  }

  // ==================== Return ====================

  return {
    // Add Member Modal
    addMemberModal,
    addMemberForm,
    addMemberLoading,
    showAddPassword,
    openAddMemberModal,
    closeAddMemberModal,
    toggleAddPasswordVisibility,
    submitAddMember,

    // Password Reset Modal
    passwordResetModal,
    passwordResetForm,
    passwordResetMember,
    passwordResetLoading,
    passwordMismatch,
    isPasswordFormValid,
    openPasswordResetModal,
    closePasswordResetModal,
    submitPasswordReset,

    // Member Operations
    updateMemberRole,
    toggleMemberStatus,
    removeMember,

    // Selection Mode (批量操作)
    isSelectionMode,
    selectedMemberIds,
    selectedCount,
    toggleSelectionMode,
    toggleMemberSelection,
    selectAllMembers,
    deselectAllMembers,

    // Bulk Operations
    bulkDeleteMembers,

    // Bulk Edit Modal
    bulkEditModal,
    bulkEditForm,
    bulkEditLoading,
    isBulkEditFormValid,
    openBulkEditModal,
    closeBulkEditModal,
    submitBulkEdit
  }
}
