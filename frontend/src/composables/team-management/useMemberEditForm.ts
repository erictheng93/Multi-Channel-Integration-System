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
import { useTeamStore } from '@/stores/team'

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
 * Snapshot for optimistic update rollback
 * Captures the state before changes are applied
 */
export interface MemberEditSnapshot {
  /** Original form data before changes */
  originalData: MemberEditFormData
  /** Current teams before changes */
  currentTeams: AgentTeamMembership[]
  /** Pending changes being applied */
  pendingChanges: PendingTeamChange[]
  /** Member ID for rollback */
  memberId: string
}

/**
 * Password match status for real-time validation feedback
 */
export type PasswordMatchStatus = 'idle' | 'mismatch' | 'match'

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
  passwordMatchStatus: ComputedRef<PasswordMatchStatus>

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

  /**
   * Real-time password match status for immediate user feedback
   * - 'idle': No password entered yet, no feedback needed
   * - 'mismatch': Password entered but doesn't match confirm (show error)
   * - 'match': Passwords match (show success)
   */
  const passwordMatchStatus = computed<PasswordMatchStatus>(() => {
    const newPwd = passwordForm.value.newPassword
    const confirmPwd = passwordForm.value.confirmPassword

    // No password entered yet - don't show any status
    if (newPwd.length === 0) {
      return 'idle'
    }

    // Password entered - check if it matches confirm
    if (newPwd === confirmPwd) {
      return 'match'
    }

    // Passwords don't match
    return 'mismatch'
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

  // ==================== Optimistic Update Helpers ====================

  /**
   * Create a snapshot of current state for potential rollback
   * Used by optimistic update pattern
   */
  const createSnapshot = (): MemberEditSnapshot | null => {
    if (!member.value) return null

    return {
      originalData: { ...originalData.value },
      currentTeams: [...currentTeams.value],
      pendingChanges: [...pendingTeamChanges.value],
      memberId: member.value.id
    }
  }

  /**
   * Rollback to snapshot state after failed background save
   * Restores both local state and store state
   */
  const rollbackToSnapshot = (snapshot: MemberEditSnapshot) => {
    console.warn('🔄 [Optimistic Update] Rolling back to snapshot...')

    // Restore local state
    originalData.value = { ...snapshot.originalData }
    currentTeams.value = [...snapshot.currentTeams]
    pendingTeamChanges.value = [...snapshot.pendingChanges]

    // Restore form data to original
    formData.value = { ...snapshot.originalData }

    // Restore store state
    const teamStore = useTeamStore()
    teamStore.updateMemberLocal(snapshot.memberId, {
      displayName: snapshot.originalData.displayName,
      email: snapshot.originalData.email,
      role: snapshot.originalData.role,
      teams: snapshot.currentTeams.map(t => ({
        teamId: t.teamId,
        teamName: t.teamName,
        roleInTeam: t.roleInTeam,
        isPrimary: t.isPrimary,
        joinedAt: t.joinedAt
      }))
    })

    console.log('✅ [Optimistic Update] Rollback completed')
  }

  /**
   * Execute API calls in background (non-blocking)
   * Uses Promise.all for parallel execution
   *
   * @param snapshot - State snapshot for rollback on failure
   * @param profileDirty - Whether profile needs to be updated
   */
  const executeBackgroundSave = async (
    snapshot: MemberEditSnapshot,
    profileDirty: boolean
  ): Promise<void> => {
    const memberId = snapshot.memberId
    const errors: string[] = []

    console.log('🚀 [Background Save] Starting parallel API calls...', {
      profileDirty,
      teamChanges: snapshot.pendingChanges.length
    })

    try {
      // Collect all API promises for parallel execution
      const apiPromises: Promise<{ type: string; success: boolean; error?: string }>[] = []

      // Profile update promise
      if (profileDirty) {
        apiPromises.push(
          teamApi.updateMember(memberId, {
            displayName: formData.value.displayName.trim(),
            email: formData.value.email.trim(),
            role: formData.value.role
          } as Partial<TeamMember>).then(response => ({
            type: 'profile',
            success: response.success,
            error: response.error
          }))
        )
      }

      // Team change promises (parallel!)
      for (const change of snapshot.pendingChanges) {
        if (change.type === 'add') {
          apiPromises.push(
            teamApi.joinTeam(memberId, change.teamId, { roleInTeam: 'member' })
              .then(response => ({
                type: `add-team-${change.teamId}`,
                success: response.success,
                error: response.success ? undefined : `加入團隊「${change.teamName}」失敗: ${response.error}`
              }))
          )
        } else if (change.type === 'remove') {
          apiPromises.push(
            teamApi.leaveTeam(memberId, change.teamId)
              .then(response => ({
                type: `remove-team-${change.teamId}`,
                success: response.success,
                error: response.success ? undefined : `離開團隊失敗: ${response.error}`
              }))
          )
        } else if (change.type === 'set-primary') {
          apiPromises.push(
            teamApi.setPrimaryTeam(memberId, change.teamId)
              .then(response => ({
                type: `set-primary-${change.teamId}`,
                success: response.success,
                error: response.success ? undefined : `設定主要團隊失敗: ${response.error}`
              }))
          )
        }
      }

      // Execute all API calls in parallel
      const results = await Promise.all(apiPromises)

      // Check for failures
      for (const result of results) {
        if (!result.success && result.error) {
          errors.push(result.error)
        }
      }

      if (errors.length > 0) {
        console.error('❌ [Background Save] Some operations failed:', errors)
        // Rollback and notify user
        rollbackToSnapshot(snapshot)
        showError('部分儲存失敗', errors.join('\n') + '\n\n已恢復原狀態')
      } else {
        console.log('✅ [Background Save] All operations completed successfully')
      }

    } catch (error) {
      console.error('❌ [Background Save] Critical error:', error)
      // Rollback and notify user
      rollbackToSnapshot(snapshot)
      showError('儲存失敗', '背景儲存時發生錯誤，已恢復原狀態')
    }
  }

  /**
   * Save changes to member profile and team assignments
   *
   * 🚀 Optimistic Update Pattern:
   * 1. Validate form (blocking)
   * 2. Role change confirmation if needed (blocking)
   * 3. Create snapshot for rollback
   * 4. Optimistically update Store (instant UI feedback)
   * 5. Show success & trigger callback (user sees instant response)
   * 6. Execute API calls in background (non-blocking, parallel)
   * 7. On failure: rollback & notify user
   */
  const saveChanges = async (): Promise<boolean> => {
    if (!member.value) return false

    // ========== Step 1: Validate form (blocking) ==========
    if (!validateForm()) {
      return false
    }

    // ========== Step 2: Role change confirmation (blocking) ==========
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

    // ========== Step 3: Create snapshot for rollback ==========
    const snapshot = createSnapshot()
    if (!snapshot) {
      console.error('Failed to create snapshot')
      return false
    }

    // Check if profile has changes
    const profileDirty =
      formData.value.displayName !== originalData.value.displayName ||
      formData.value.email !== originalData.value.email ||
      formData.value.role !== originalData.value.role

    // Check if there are any changes to save
    if (!profileDirty && !hasTeamChanges.value) {
      showSuccess('沒有變更', '資料沒有變動')
      return true
    }

    console.log('🚀 [Optimistic Update] Starting save...', {
      profileDirty,
      teamChanges: pendingTeamChanges.value.length
    })

    // ========== Step 4: Optimistically update Store (instant!) ==========
    const teamStore = useTeamStore()

    // Update profile in store
    if (profileDirty) {
      teamStore.updateMemberLocal(member.value.id, {
        displayName: formData.value.displayName.trim(),
        email: formData.value.email.trim(),
        role: formData.value.role
      })
    }

    // Update teams in store
    if (hasTeamChanges.value) {
      teamStore.updateMemberLocal(member.value.id, {
        teams: displayTeams.value.map(t => ({
          teamId: t.teamId,
          teamName: t.teamName,
          roleInTeam: t.roleInTeam,
          isPrimary: t.isPrimary,
          joinedAt: t.joinedAt
        }))
      })
    }

    // Update local state to reflect "saved" state
    originalData.value = { ...formData.value }
    currentTeams.value = [...displayTeams.value]
    pendingTeamChanges.value = []

    // ========== Step 5: Show success & trigger callback (instant!) ==========
    showSuccess('儲存成功', '成員資料已更新')
    onSaveSuccess?.()

    console.log('✅ [Optimistic Update] UI updated, starting background save...')

    // ========== Step 6: Execute API calls in background (non-blocking) ==========
    // Note: We don't await this - it runs in background
    executeBackgroundSave(snapshot, profileDirty)

    return true
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
    passwordMatchStatus,

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
