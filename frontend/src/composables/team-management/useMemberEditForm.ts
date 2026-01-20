/**
 * Member Edit Form Composable
 *
 * Provides form management, validation, and API integration for editing team members.
 *
 * Features:
 * - Form data management with dirty detection
 * - Input validation (required fields, email format)
 * - System Admin protection (cannot reset password for System Administration)
 * - Role change confirmation dialog
 * - Password reset with policy
 * - Toast notifications for success/error states
 *
 * @module composables/team-management/useMemberEditForm
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import type { TeamMember } from '@/types'
import { teamApi } from '@/api/team'
import { useToast } from '@/composables/useToast'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

/**
 * Form data for editing member profile
 */
export interface MemberEditFormData {
  /** Member display name (姓名) */
  displayName: string
  /** Member email (Email) */
  email: string
  /** Member role (角色) */
  role: 'admin' | 'agent'
  /** Member group/department (部門/群組) */
  group: string
}

/**
 * Form data for password reset (named distinctly to avoid export conflicts)
 */
export interface MemberEditPasswordFormData {
  /** New password */
  newPassword: string
  /** Confirm password */
  confirmPassword: string
}

/**
 * Validation errors for member edit form
 */
export interface MemberEditFormErrors {
  displayName?: string
  email?: string
  role?: string
  group?: string
}

/**
 * Validation errors for password reset form (named distinctly to avoid export conflicts)
 */
export interface MemberEditPasswordErrors {
  newPassword?: string
  confirmPassword?: string
}

/**
 * Return type for useMemberEditForm composable
 */
export interface UseMemberEditFormReturn {
  // Form data
  formData: Ref<MemberEditFormData>
  passwordForm: Ref<MemberEditPasswordFormData>

  // Validation
  formErrors: Ref<MemberEditFormErrors>
  passwordErrors: Ref<MemberEditPasswordErrors>
  isFormValid: ComputedRef<boolean>
  isPasswordFormValid: ComputedRef<boolean>

  // State
  isDirty: ComputedRef<boolean>
  isSaving: Ref<boolean>
  isResettingPassword: Ref<boolean>
  showPasswordSection: Ref<boolean>

  // System Admin protection
  isSystemAdmin: ComputedRef<boolean>
  canResetPassword: ComputedRef<boolean>

  // Methods
  initForm: (_member: TeamMember) => void
  validateForm: () => boolean
  validatePasswordForm: () => boolean
  saveChanges: () => Promise<boolean>
  resetPassword: () => Promise<boolean>
  resetForm: () => void
  togglePasswordSection: () => void
}

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Member Edit Form Composable
 *
 * @param member - Reactive reference to the member being edited
 * @param onSaveSuccess - Callback when save is successful
 * @returns Form management utilities and state
 *
 * @example
 * ```ts
 * const {
 *   formData,
 *   isDirty,
 *   isFormValid,
 *   saveChanges,
 *   isSystemAdmin,
 *   canResetPassword
 * } = useMemberEditForm(memberRef, () => emit('save'))
 * ```
 */
export function useMemberEditForm(
  member: Ref<TeamMember | null>,
  onSaveSuccess?: () => void
): UseMemberEditFormReturn {
  const { showSuccess, showError } = useToast()
  const { showWarning } = useConfirmDialog()

  // ==================== Form Data ====================

  const formData = ref<MemberEditFormData>({
    displayName: '',
    email: '',
    role: 'agent',
    group: ''
  })

  const passwordForm = ref<MemberEditPasswordFormData>({
    newPassword: '',
    confirmPassword: ''
  })

  // Original data for dirty detection
  const originalData = ref<MemberEditFormData>({
    displayName: '',
    email: '',
    role: 'agent',
    group: ''
  })

  // ==================== Validation Errors ====================

  const formErrors = ref<MemberEditFormErrors>({})
  const passwordErrors = ref<MemberEditPasswordErrors>({})

  // ==================== UI State ====================

  const isSaving = ref(false)
  const isResettingPassword = ref(false)
  const showPasswordSection = ref(false)

  // ==================== Computed Properties ====================

  /**
   * Check if the member is the System Administration account
   */
  const isSystemAdmin = computed(() => {
    if (!member.value) return false
    return (
      member.value.loginId === 'System Administration' ||
      member.value.email === 'admin@dacit.net'
    )
  })

  /**
   * Check if password can be reset (not System Admin)
   */
  const canResetPassword = computed(() => !isSystemAdmin.value)

  /**
   * Check if form has unsaved changes
   */
  const isDirty = computed(() => {
    return (
      formData.value.displayName !== originalData.value.displayName ||
      formData.value.email !== originalData.value.email ||
      formData.value.role !== originalData.value.role ||
      formData.value.group !== originalData.value.group
    )
  })

  /**
   * Check if the profile form is valid
   */
  const isFormValid = computed(() => {
    // Display name is required and 1-100 chars
    if (!formData.value.displayName.trim()) return false
    if (formData.value.displayName.length > 100) return false

    // Email is required and must be valid format
    if (!formData.value.email.trim()) return false
    if (!EMAIL_REGEX.test(formData.value.email)) return false

    // Role must be valid
    if (!['admin', 'agent'].includes(formData.value.role)) return false

    // Group is optional but max 100 chars if provided
    if (formData.value.group.length > 100) return false

    return true
  })

  /**
   * Check if password form is valid
   */
  const isPasswordFormValid = computed(() => {
    // Password must be at least 6 characters
    if (passwordForm.value.newPassword.length < 6) return false

    // Passwords must match
    if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) return false

    return true
  })

  // ==================== Methods ====================

  /**
   * Initialize form with member data
   */
  const initForm = (memberData: TeamMember) => {
    const data: MemberEditFormData = {
      displayName: memberData.name || memberData.loginId || '',
      email: memberData.email || '',
      role: memberData.role,
      group: memberData.group || ''
    }

    formData.value = { ...data }
    originalData.value = { ...data }

    // Reset password form
    passwordForm.value = {
      newPassword: '',
      confirmPassword: ''
    }

    // Reset errors
    formErrors.value = {}
    passwordErrors.value = {}

    // Close password section
    showPasswordSection.value = false
  }

  /**
   * Validate profile form and set errors
   */
  const validateForm = (): boolean => {
    const errors: MemberEditFormErrors = {}

    // Display name validation
    if (!formData.value.displayName.trim()) {
      errors.displayName = '請輸入姓名'
    } else if (formData.value.displayName.length > 100) {
      errors.displayName = '姓名不能超過 100 個字元'
    }

    // Email validation
    if (!formData.value.email.trim()) {
      errors.email = '請輸入電子郵件'
    } else if (!EMAIL_REGEX.test(formData.value.email)) {
      errors.email = '請輸入有效的電子郵件格式'
    }

    // Role validation
    if (!formData.value.role || !['admin', 'agent'].includes(formData.value.role)) {
      errors.role = '請選擇角色'
    }

    // Group validation (optional)
    if (formData.value.group.length > 100) {
      errors.group = '部門/群組不能超過 100 個字元'
    }

    formErrors.value = errors
    return Object.keys(errors).length === 0
  }

  /**
   * Validate password form and set errors
   */
  const validatePasswordForm = (): boolean => {
    const errors: MemberEditPasswordErrors = {}

    // Password validation
    if (!passwordForm.value.newPassword) {
      errors.newPassword = '請輸入新密碼'
    } else if (passwordForm.value.newPassword.length < 6) {
      errors.newPassword = '密碼至少需要 6 個字元'
    }

    // Confirm password validation
    if (!passwordForm.value.confirmPassword) {
      errors.confirmPassword = '請確認密碼'
    } else if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
      errors.confirmPassword = '密碼不一致'
    }

    passwordErrors.value = errors
    return Object.keys(errors).length === 0
  }

  /**
   * Save changes to member profile
   */
  const saveChanges = async (): Promise<boolean> => {
    if (!member.value) return false

    // Validate form first
    if (!validateForm()) {
      return false
    }

    // Check for role change and show confirmation
    if (formData.value.role !== originalData.value.role) {
      const roleChangingTo = formData.value.role === 'admin' ? '管理員' : '客服人員'
      const roleChangingFrom = originalData.value.role === 'admin' ? '管理員' : '客服人員'

      let message: string
      if (formData.value.role === 'admin') {
        message = '將此成員升級為管理員將授予完整系統管理權限。\n\n確定要繼續嗎？'
      } else {
        message = `將此成員從${roleChangingFrom}降級為${roleChangingTo}將移除管理權限。\n\n確定要繼續嗎？`
      }

      const confirmed = await showWarning('確認角色變更', message, {
        confirmText: '確認變更',
        cancelText: '取消'
      })

      if (!confirmed) {
        return false
      }
    }

    isSaving.value = true

    try {
      const response = await teamApi.updateMember(member.value.id, {
        displayName: formData.value.displayName.trim(),
        email: formData.value.email.trim(),
        role: formData.value.role,
        group: formData.value.group.trim() || undefined
      } as Partial<TeamMember>)

      if (response.success) {
        showSuccess('儲存成功', '成員資料已更新')

        // Update original data to reflect saved state
        originalData.value = { ...formData.value }

        // Notify parent of successful save
        onSaveSuccess?.()

        return true
      } else {
        showError('儲存失敗', response.error || '無法更新成員資料')
        return false
      }
    } catch (error) {
      console.error('Save member failed:', error)
      showError('儲存失敗', '發生錯誤，請稍後再試')
      return false
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Reset member password
   */
  const resetPassword = async (): Promise<boolean> => {
    if (!member.value || !canResetPassword.value) return false

    // Validate password form first
    if (!validatePasswordForm()) {
      return false
    }

    isResettingPassword.value = true

    try {
      const response = await teamApi.resetPasswordWithPolicy(member.value.id, {
        newPassword: passwordForm.value.newPassword,
        policy: 'changeable'
      })

      if (response.success) {
        showSuccess('密碼重設成功', '新密碼已設定')

        // Clear password form
        passwordForm.value = {
          newPassword: '',
          confirmPassword: ''
        }
        passwordErrors.value = {}

        // Close password section
        showPasswordSection.value = false

        return true
      } else {
        showError('密碼重設失敗', response.error || '無法重設密碼')
        return false
      }
    } catch (error) {
      console.error('Reset password failed:', error)
      showError('密碼重設失敗', '發生錯誤，請稍後再試')
      return false
    } finally {
      isResettingPassword.value = false
    }
  }

  /**
   * Reset form to original values
   */
  const resetForm = () => {
    formData.value = { ...originalData.value }
    passwordForm.value = {
      newPassword: '',
      confirmPassword: ''
    }
    formErrors.value = {}
    passwordErrors.value = {}
    showPasswordSection.value = false
  }

  /**
   * Toggle password section visibility
   */
  const togglePasswordSection = () => {
    showPasswordSection.value = !showPasswordSection.value
    if (!showPasswordSection.value) {
      // Clear password form when closing
      passwordForm.value = {
        newPassword: '',
        confirmPassword: ''
      }
      passwordErrors.value = {}
    }
  }

  // ==================== Watchers ====================

  /**
   * Watch for member changes and reinitialize form
   */
  watch(
    () => member.value,
    newMember => {
      if (newMember) {
        initForm(newMember)
      }
    },
    { immediate: true }
  )

  // ==================== Return ====================

  return {
    // Form data
    formData,
    passwordForm,

    // Validation
    formErrors,
    passwordErrors,
    isFormValid,
    isPasswordFormValid,

    // State
    isDirty,
    isSaving,
    isResettingPassword,
    showPasswordSection,

    // System Admin protection
    isSystemAdmin,
    canResetPassword,

    // Methods
    initForm,
    validateForm,
    validatePasswordForm,
    saveChanges,
    resetPassword,
    resetForm,
    togglePasswordSection
  }
}
