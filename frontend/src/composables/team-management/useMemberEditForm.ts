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
 * - Team assignment changes (deferred save mode)
 * - Toast notifications for success/error states
 *
 * @module composables/team-management/useMemberEditForm
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import type { TeamMember, AgentTeamMembership, Team } from '@/types'
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
}

/**
 * Validation errors for password reset form (named distinctly to avoid export conflicts)
 */
export interface MemberEditPasswordErrors {
  newPassword?: string
  confirmPassword?: string
}

/**
 * Pending team change action
 */
export interface PendingTeamChange {
  type: 'add' | 'remove' | 'set-primary'
  teamId: number
  teamName?: string
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

  // Team changes (deferred mode)
  pendingTeamChanges: Ref<PendingTeamChange[]>
  currentTeams: Ref<AgentTeamMembership[]>
  displayTeams: ComputedRef<AgentTeamMembership[]>
  hasTeamChanges: ComputedRef<boolean>
  addTeamToPending: (teamId: number, teamName: string) => void
  removeTeamFromPending: (teamId: number) => void
  setPrimaryTeamPending: (teamId: number) => void
  initTeams: (teams: AgentTeamMembership[]) => void

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
 * @param allTeams - Reactive reference to all available teams
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
 *   canResetPassword,
 *   pendingTeamChanges,
 *   addTeamToPending,
 *   removeTeamFromPending
 * } = useMemberEditForm(memberRef, allTeamsRef, () => emit('save'))
 * ```
 */
export function useMemberEditForm(
  member: Ref<TeamMember | null>,
  _allTeams?: Ref<Team[]>, // Reserved for future use
  onSaveSuccess?: () => void
): UseMemberEditFormReturn {
  const { showSuccess, showError } = useToast()
  const { showWarning } = useConfirmDialog()

  // ==================== Form Data ====================

  const formData = ref<MemberEditFormData>({
    displayName: '',
    email: '',
    role: 'agent'
  })

  const passwordForm = ref<MemberEditPasswordFormData>({
    newPassword: '',
    confirmPassword: ''
  })

  // Original data for dirty detection
  const originalData = ref<MemberEditFormData>({
    displayName: '',
    email: '',
    role: 'agent'
  })

  // ==================== Team Changes (Deferred Mode) ====================

  /** Current teams from the server (original state) */
  const currentTeams = ref<AgentTeamMembership[]>([])

  /** Pending team changes to be applied on save */
  const pendingTeamChanges = ref<PendingTeamChange[]>([])

  /**
   * Computed display teams - applies pending changes to current teams
   */
  const displayTeams = computed<AgentTeamMembership[]>(() => {
    let teams = [...currentTeams.value]

    for (const change of pendingTeamChanges.value) {
      if (change.type === 'add') {
        // Add team if not already present
        if (!teams.some(t => t.teamId === change.teamId)) {
          teams.push({
            teamId: change.teamId,
            teamName: change.teamName,
            roleInTeam: 'member',
            isPrimary: teams.length === 0 // First team becomes primary
          })
        }
      } else if (change.type === 'remove') {
        // Remove team
        teams = teams.filter(t => t.teamId !== change.teamId)
      } else if (change.type === 'set-primary') {
        // Update primary status
        teams = teams.map(t => ({
          ...t,
          isPrimary: t.teamId === change.teamId
        }))
      }
    }

    return teams
  })

  /**
   * Check if there are pending team changes
   */
  const hasTeamChanges = computed(() => pendingTeamChanges.value.length > 0)

  /**
   * Initialize teams from loaded data
   */
  const initTeams = (teams: AgentTeamMembership[]) => {
    currentTeams.value = [...teams]
    pendingTeamChanges.value = []
  }

  /**
   * Add a team to pending changes
   */
  const addTeamToPending = (teamId: number, teamName: string) => {
    // Check if there's already a remove pending for this team - cancel it instead
    const existingRemoveIndex = pendingTeamChanges.value.findIndex(
      c => c.type === 'remove' && c.teamId === teamId
    )
    if (existingRemoveIndex !== -1) {
      pendingTeamChanges.value.splice(existingRemoveIndex, 1)
      return
    }

    // Check if team is already in current teams
    if (currentTeams.value.some(t => t.teamId === teamId)) {
      return
    }

    // Check if already pending add
    if (pendingTeamChanges.value.some(c => c.type === 'add' && c.teamId === teamId)) {
      return
    }

    pendingTeamChanges.value.push({
      type: 'add',
      teamId,
      teamName
    })
  }

  /**
   * Remove a team from pending changes
   */
  const removeTeamFromPending = (teamId: number) => {
    // Check if there's a pending add for this team - cancel it instead
    const existingAddIndex = pendingTeamChanges.value.findIndex(
      c => c.type === 'add' && c.teamId === teamId
    )
    if (existingAddIndex !== -1) {
      pendingTeamChanges.value.splice(existingAddIndex, 1)
      return
    }

    // Check if team is in current teams
    if (!currentTeams.value.some(t => t.teamId === teamId)) {
      return
    }

    // Check if already pending remove
    if (pendingTeamChanges.value.some(c => c.type === 'remove' && c.teamId === teamId)) {
      return
    }

    pendingTeamChanges.value.push({
      type: 'remove',
      teamId
    })
  }

  /**
   * Set a team as primary (pending)
   */
  const setPrimaryTeamPending = (teamId: number) => {
    // Remove any existing set-primary changes
    pendingTeamChanges.value = pendingTeamChanges.value.filter(c => c.type !== 'set-primary')

    // Check if team is already primary in current state
    const currentPrimary = currentTeams.value.find(t => t.isPrimary)
    if (currentPrimary?.teamId === teamId) {
      return
    }

    pendingTeamChanges.value.push({
      type: 'set-primary',
      teamId
    })
  }

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
   * Check if form has unsaved changes (profile or team changes)
   */
  const isDirty = computed(() => {
    const profileDirty =
      formData.value.displayName !== originalData.value.displayName ||
      formData.value.email !== originalData.value.email ||
      formData.value.role !== originalData.value.role

    return profileDirty || hasTeamChanges.value
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
      role: memberData.role
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

    // Reset team changes
    pendingTeamChanges.value = []
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
   * Apply pending team changes via API
   */
  const applyTeamChanges = async (memberId: string): Promise<{ success: boolean; errors: string[] }> => {
    const errors: string[] = []

    // Process changes in order
    for (const change of pendingTeamChanges.value) {
      try {
        if (change.type === 'add') {
          const response = await teamApi.joinTeam(memberId, change.teamId, {
            roleInTeam: 'member'
          })
          if (!response.success) {
            errors.push(`加入團隊「${change.teamName}」失敗: ${response.error}`)
          }
        } else if (change.type === 'remove') {
          const response = await teamApi.leaveTeam(memberId, change.teamId)
          if (!response.success) {
            errors.push(`離開團隊失敗: ${response.error}`)
          }
        } else if (change.type === 'set-primary') {
          const response = await teamApi.setPrimaryTeam(memberId, change.teamId)
          if (!response.success) {
            errors.push(`設定主要團隊失敗: ${response.error}`)
          }
        }
      } catch (error) {
        console.error('Team change failed:', error)
        errors.push(`團隊操作失敗`)
      }
    }

    return {
      success: errors.length === 0,
      errors
    }
  }

  /**
   * Save changes to member profile and team assignments
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
      let profileSuccess = true
      let teamSuccess = true
      const teamErrors: string[] = []

      // Check if profile has changes
      const profileDirty =
        formData.value.displayName !== originalData.value.displayName ||
        formData.value.email !== originalData.value.email ||
        formData.value.role !== originalData.value.role

      // Save profile changes if dirty
      if (profileDirty) {
        const response = await teamApi.updateMember(member.value.id, {
          displayName: formData.value.displayName.trim(),
          email: formData.value.email.trim(),
          role: formData.value.role
        } as Partial<TeamMember>)

        if (!response.success) {
          showError('儲存失敗', response.error || '無法更新成員資料')
          return false
        }

        // Update original data to reflect saved state
        originalData.value = { ...formData.value }
      }

      // Apply team changes if any
      if (hasTeamChanges.value) {
        const result = await applyTeamChanges(member.value.id)
        teamSuccess = result.success
        teamErrors.push(...result.errors)

        if (teamSuccess) {
          // Update current teams to reflect the new state
          currentTeams.value = [...displayTeams.value]
          pendingTeamChanges.value = []
        }
      }

      // Show result
      if (profileSuccess && teamSuccess) {
        showSuccess('儲存成功', '成員資料已更新')
        onSaveSuccess?.()
        return true
      } else if (teamErrors.length > 0) {
        showError('部分儲存失敗', teamErrors.join('\n'))
        return false
      }

      return true
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
    // Reset pending team changes
    pendingTeamChanges.value = []
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

    // Team changes (deferred mode)
    pendingTeamChanges,
    currentTeams,
    displayTeams,
    hasTeamChanges,
    addTeamToPending,
    removeTeamFromPending,
    setPrimaryTeamPending,
    initTeams,

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
