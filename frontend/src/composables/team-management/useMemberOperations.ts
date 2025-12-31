/**
 * Member Operations Composable
 *
 * 职责：
 * - 成员 CRUD 操作
 * - 密码重置管理
 * - 角色和状态切换
 * - 表单状态管理
 *
 * @module composables/team-management/useMemberOperations
 */

import { ref, reactive, computed, type Ref, type ComputedRef } from 'vue'
import { useTeamStore } from '@/stores/team'
import { useToast } from '@/composables/useToast'
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
  openPasswordResetModal: (member: TeamMember) => void
  closePasswordResetModal: () => void
  submitPasswordReset: () => Promise<void>

  // Member Operations
  updateMemberRole: (memberId: string, role: string) => Promise<void>
  toggleMemberStatus: (member: TeamMember) => Promise<void>
  removeMember: (member: TeamMember) => Promise<void>
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
   * 移除成员
   */
  async function removeMember(member: TeamMember) {
    try {
      await teamStore.removeMember(member.id)
      showSuccess(
        '移除成員成功',
        `已成功移除成員 ${member.name || member.loginId}`
      )
    } catch (error) {
      console.error('移除成員失敗:', error)
      const errorMessage = error instanceof Error
        ? error.message
        : '移除成員失敗，請稍後重試'
      showError('移除成員失敗', errorMessage)
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
    removeMember
  }
}
