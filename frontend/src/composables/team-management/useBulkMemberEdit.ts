/**
 * Bulk Member Edit Composable
 *
 * Provides form management for editing multiple members simultaneously.
 * Each member has individual editable fields (name, email, role, teams).
 *
 * Features:
 * - Individual form data tracking per member
 * - Team assignment management per member
 * - Dirty detection per member
 * - Validation per member
 * - Batch save with optimistic updates
 *
 * @module composables/team-management/useBulkMemberEdit
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { TeamMember, AgentTeamMembership } from '@/types'
import { teamApi } from '@/api/team'
import { useToast } from '@/composables/useToast'
import { useTeamStore } from '@/stores/team'

/**
 * Individual member edit state
 */
export interface BulkMemberEditState {
  /** Member ID */
  memberId: string

  /** Original member data for reference */
  originalMember: TeamMember

  /** Editable form data */
  formData: {
    displayName: string
    email: string
    role: 'admin' | 'agent'
  }

  /** Original form data for dirty detection */
  originalFormData: {
    displayName: string
    email: string
    role: 'admin' | 'agent'
  }

  /** Current teams (from server) */
  currentTeams: AgentTeamMembership[]

  /** Pending team changes */
  pendingTeamChanges: PendingTeamChange[]

  /** Form validation errors */
  errors: {
    displayName?: string
    email?: string
  }

  /** Whether teams are loaded */
  teamsLoaded: boolean
}

/**
 * Pending team change action
 */
export interface PendingTeamChange {
  type: 'add' | 'remove'
  teamId: number
  teamName?: string
}

/**
 * Return type for useBulkMemberEdit composable
 */
export interface UseBulkMemberEditReturn {
  /** All member edit states */
  memberStates: Ref<Map<string, BulkMemberEditState>>

  /** Loading state */
  isLoading: Ref<boolean>

  /** Whether any member has changes */
  hasAnyChanges: ComputedRef<boolean>

  /** Count of members with changes */
  changedMemberCount: ComputedRef<number>

  /** Whether all forms are valid */
  isAllFormsValid: ComputedRef<boolean>

  /** Initialize with selected members */
  initializeMembers: (_members: TeamMember[]) => void

  /** Update form data for a member */
  updateMemberForm: (_memberId: string, _field: keyof BulkMemberEditState['formData'], _value: string) => void

  /** Add team to member (pending) */
  addTeamToMember: (_memberId: string, _teamId: number, _teamName: string) => void

  /** Remove team from member (pending) */
  removeTeamFromMember: (_memberId: string, _teamId: number) => void

  /** Initialize teams for a member */
  initMemberTeams: (_memberId: string, _teams: AgentTeamMembership[]) => void

  /** Get display teams for a member (current + pending changes) */
  getDisplayTeams: (_memberId: string) => AgentTeamMembership[]

  /** Check if member form is dirty */
  isMemberDirty: (_memberId: string) => boolean

  /** Check if member form is valid */
  isMemberValid: (_memberId: string) => boolean

  /** Save all changes */
  saveAllChanges: (_currentUserId: string) => Promise<{
    success: boolean
    updatedCount: number
    errors: string[]
    undoToken?: string
    undoExpiresAt?: string
  }>

  /** Reset all states */
  reset: () => void
}

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Bulk Member Edit Composable
 *
 * @example
 * ```ts
 * const {
 * memberStates,
 * initializeMembers,
 * updateMemberForm,
 * saveAllChanges
 * } = useBulkMemberEdit()
 *
 * // Initialize with selected members
 * initializeMembers(selectedMembers)
 *
 * // Update a member's name
 * updateMemberForm(memberId, 'displayName', 'New Name')
 *
 * // Save all changes
 * const result = await saveAllChanges(currentUserId)
 * ```
 */
export function useBulkMemberEdit(): UseBulkMemberEditReturn {
  const { showSuccess, showError } = useToast()
  const teamStore = useTeamStore()

  // ==================== State ====================

  const memberStates = ref<Map<string, BulkMemberEditState>>(new Map())
  const isLoading = ref(false)

  // ==================== Computed ====================

  /**
   * Check if any member has changes
   */
  const hasAnyChanges = computed(() => {
    for (const [memberId] of memberStates.value) {
      if (isMemberDirty(memberId)) {
        return true
      }
    }
    return false
  })

  /**
   * Count of members with changes
   */
  const changedMemberCount = computed(() => {
    let count = 0
    for (const [memberId] of memberStates.value) {
      if (isMemberDirty(memberId)) {
        count++
      }
    }
    return count
  })

  /**
   * Check if all forms are valid
   */
  const isAllFormsValid = computed(() => {
    for (const [memberId] of memberStates.value) {
      if (!isMemberValid(memberId)) {
        return false
      }
    }
    return true
  })

  // ==================== Methods ====================

  /**
   * Initialize with selected members
   */
  function initializeMembers(members: TeamMember[]) {
    memberStates.value.clear()

    for (const member of members) {
      const formData = {
        displayName: member.name || member.loginId || '',
        email: member.email || '',
        role: member.role as 'admin' | 'agent'
      }

      memberStates.value.set(member.id, {
        memberId: member.id,
        originalMember: member,
        formData: { ...formData },
        originalFormData: { ...formData },
        currentTeams: [],
        pendingTeamChanges: [],
        errors: {},
        teamsLoaded: false
      })
    }
  }

  /**
   * Update form data for a member
   */
  function updateMemberForm(
    memberId: string,
    field: keyof BulkMemberEditState['formData'],
    value: string
  ) {
    const state = memberStates.value.get(memberId)
    if (!state) {
      return
    }

    if (field === 'role') {
      state.formData.role = value as 'admin' | 'agent'
    } else {
      state.formData[field] = value
    }

    // Validate the field
    validateMemberField(memberId, field)
  }

  /**
   * Validate a single field for a member
   */
  function validateMemberField(
    memberId: string,
    field: keyof BulkMemberEditState['formData']
  ) {
    const state = memberStates.value.get(memberId)
    if (!state) {
      return
    }

    if (field === 'displayName') {
      if (!state.formData.displayName.trim()) {
        state.errors.displayName = '請輸入姓名'
      } else if (state.formData.displayName.length > 100) {
        state.errors.displayName = '姓名不能超過 100 個字元'
      } else {
        delete state.errors.displayName
      }
    }

    if (field === 'email') {
      if (!state.formData.email.trim()) {
        state.errors.email = '請輸入電子郵件'
      } else if (!EMAIL_REGEX.test(state.formData.email)) {
        state.errors.email = '請輸入有效的電子郵件格式'
      } else {
        delete state.errors.email
      }
    }
  }

  /**
   * Add team to member (pending)
   */
  function addTeamToMember(memberId: string, teamId: number, teamName: string) {
    const state = memberStates.value.get(memberId)
    if (!state) {
      return
    }

    // Check if there's already a remove pending for this team - cancel it
    const existingRemoveIndex = state.pendingTeamChanges.findIndex(
      c => c.type === 'remove' && c.teamId === teamId
    )
    if (existingRemoveIndex !== -1) {
      state.pendingTeamChanges.splice(existingRemoveIndex, 1)
      return
    }

    // Check if team is already in current teams
    if (state.currentTeams.some(t => t.teamId === teamId)) {
      return
    }

    // Check if already pending add
    if (state.pendingTeamChanges.some(c => c.type === 'add' && c.teamId === teamId)) {
      return
    }

    state.pendingTeamChanges.push({
      type: 'add',
      teamId,
      teamName
    })
  }

  /**
   * Remove team from member (pending)
   */
  function removeTeamFromMember(memberId: string, teamId: number) {
    const state = memberStates.value.get(memberId)
    if (!state) {
      return
    }

    // Check if there's a pending add for this team - cancel it
    const existingAddIndex = state.pendingTeamChanges.findIndex(
      c => c.type === 'add' && c.teamId === teamId
    )
    if (existingAddIndex !== -1) {
      state.pendingTeamChanges.splice(existingAddIndex, 1)
      return
    }

    // Check if team is in current teams
    if (!state.currentTeams.some(t => t.teamId === teamId)) {
      return
    }

    // Check if already pending remove
    if (state.pendingTeamChanges.some(c => c.type === 'remove' && c.teamId === teamId)) {
      return
    }

    state.pendingTeamChanges.push({
      type: 'remove',
      teamId
    })
  }

  /**
   * Initialize teams for a member
   */
  function initMemberTeams(memberId: string, teams: AgentTeamMembership[]) {
    const state = memberStates.value.get(memberId)
    if (!state) {
      return
    }

    state.currentTeams = [...teams]
    state.pendingTeamChanges = []
    state.teamsLoaded = true
  }

  /**
   * Get display teams for a member (current + pending changes)
   */
  function getDisplayTeams(memberId: string): AgentTeamMembership[] {
    const state = memberStates.value.get(memberId)
    if (!state) {
      return []
    }

    let teams = [...state.currentTeams]

    for (const change of state.pendingTeamChanges) {
      if (change.type === 'add') {
        // Add team if not already present
        if (!teams.some(t => t.teamId === change.teamId)) {
          teams.push({
            teamId: change.teamId,
            teamName: change.teamName,
            roleInTeam: 'member',
            isPrimary: teams.length === 0
          })
        }
      } else if (change.type === 'remove') {
        // Remove team
        teams = teams.filter(t => t.teamId !== change.teamId)
      }
    }

    return teams
  }

  /**
   * Check if member form is dirty (has changes)
   */
  function isMemberDirty(memberId: string): boolean {
    const state = memberStates.value.get(memberId)
    if (!state) {
      return false
    }

    const profileDirty =
      state.formData.displayName !== state.originalFormData.displayName ||
      state.formData.email !== state.originalFormData.email ||
      state.formData.role !== state.originalFormData.role

    const teamsDirty = state.pendingTeamChanges.length > 0

    return profileDirty || teamsDirty
  }

  /**
   * Check if member form is valid
   */
  function isMemberValid(memberId: string): boolean {
    const state = memberStates.value.get(memberId)
    if (!state) {
      return false
    }

    // Display name validation
    if (!state.formData.displayName.trim()) {
      return false
    }
    if (state.formData.displayName.length > 100) {
      return false
    }

    // Email validation
    if (!state.formData.email.trim()) {
      return false
    }
    if (!EMAIL_REGEX.test(state.formData.email)) {
      return false
    }

    // Role validation
    if (!['admin', 'agent'].includes(state.formData.role)) {
      return false
    }

    return true
  }

  /**
   * Save all changes using batch API
   * 優化: 使用單一批量 API 請求取代多次個別請求
   */
  async function saveAllChanges(
    currentUserId: string
  ): Promise<{
    success: boolean
    updatedCount: number
    errors: string[]
    undoToken?: string
    undoExpiresAt?: string
  }> {
    const errors: string[] = []
    isLoading.value = true

    try {
      // Collect all members that need updating and build batch request
      const batchMembers: Array<{
        memberId: string
        profile?: {
          displayName?: string
          email?: string
          role?: 'admin' | 'agent'
        }
        teamChanges?: {
          add?: number[]
          remove?: number[]
        }
      }> = []

      for (const [memberId, state] of memberStates.value) {
        // Skip current user
        if (memberId === currentUserId) {
          continue
        }

        // Skip members without changes
        if (!isMemberDirty(memberId)) {
          continue
        }

        // Skip invalid forms
        if (!isMemberValid(memberId)) {
          errors.push(`${state.originalMember.name || state.originalMember.loginId}: 表單資料無效`)
          continue
        }

        // Build member edit data
        const memberEdit: typeof batchMembers[0] = { memberId }

        // Check profile changes
        const profileDirty =
          state.formData.displayName !== state.originalFormData.displayName ||
          state.formData.email !== state.originalFormData.email ||
          state.formData.role !== state.originalFormData.role

        if (profileDirty) {
          memberEdit.profile = {}
          if (state.formData.displayName !== state.originalFormData.displayName) {
            memberEdit.profile.displayName = state.formData.displayName.trim()
          }
          if (state.formData.email !== state.originalFormData.email) {
            memberEdit.profile.email = state.formData.email.trim()
          }
          if (state.formData.role !== state.originalFormData.role) {
            memberEdit.profile.role = state.formData.role
          }
        }

        // Check team changes
        if (state.pendingTeamChanges.length > 0) {
          const addChanges = state.pendingTeamChanges.filter(c => c.type === 'add')
          const removeChanges = state.pendingTeamChanges.filter(c => c.type === 'remove')

          memberEdit.teamChanges = {}
          if (addChanges.length > 0) {
            memberEdit.teamChanges.add = addChanges.map(c => c.teamId)
          }
          if (removeChanges.length > 0) {
            memberEdit.teamChanges.remove = removeChanges.map(c => c.teamId)
          }
        }

        batchMembers.push(memberEdit)
      }

      if (batchMembers.length === 0) {
        showError('無變更', '沒有需要儲存的變更')
        return { success: false, updatedCount: 0, errors, undoToken: undefined, undoExpiresAt: undefined }
      }

      // Single batch API call
      const response = await teamApi.batchEditMembers(batchMembers)

      if (!response.success) {
        showError('批量編輯失敗', response.error || '未知錯誤')
        return { success: false, updatedCount: 0, errors: [response.error || '未知錯誤'], undoToken: undefined, undoExpiresAt: undefined }
      }

      const data = response.data
      if (!data) {
        showError('批量編輯失敗', '回應資料異常')
        return { success: false, updatedCount: 0, errors: ['回應資料異常'], undoToken: undefined, undoExpiresAt: undefined }
      }
      const updatedCount = data.successCount

      // Collect errors from failed results
      for (const result of data.results) {
        if (!result.success && result.error) {
          const state = memberStates.value.get(result.memberId)
          const memberName = state?.originalMember.name || state?.originalMember.loginId || result.memberId
          errors.push(`${memberName}: ${result.error}`)
        }
      }

      // Update local store for successful updates
      for (const result of data.results) {
        if (result.success) {
          const state = memberStates.value.get(result.memberId)
          if (state) {
            // Update profile in store
            if (result.profileUpdated) {
              teamStore.updateMemberLocal(result.memberId, {
                displayName: state.formData.displayName.trim(),
                email: state.formData.email.trim(),
                role: state.formData.role
              })
            }

            // Update teams in store
            if (result.teamsAdded.length > 0 || result.teamsRemoved.length > 0) {
              const displayTeams = getDisplayTeams(result.memberId)
              teamStore.updateMemberLocal(result.memberId, {
                teams: displayTeams.map(t => ({
                  teamId: t.teamId,
                  teamName: t.teamName,
                  roleInTeam: t.roleInTeam,
                  isPrimary: t.isPrimary,
                  joinedAt: t.joinedAt
                }))
              })
            }
          }
        }
      }

      if (updatedCount > 0) {
        showSuccess('批量編輯成功', `已成功更新 ${updatedCount} 位成員`)
      }

      if (errors.length > 0) {
        showError('部分更新失敗', errors.join('\n'))
      }

      return {
        success: errors.length === 0,
        updatedCount,
        errors,
        undoToken: data.undoToken,
        undoExpiresAt: data.undoExpiresAt
      }
    } catch (error) {
      console.error('Batch edit error:', error)
      const errorMsg = error instanceof Error ? error.message : '批量編輯失敗'
      showError('批量編輯失敗', errorMsg)
      return {
        success: false,
        updatedCount: 0,
        errors: [errorMsg],
        undoToken: undefined,
        undoExpiresAt: undefined
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Reset all states
   */
  function reset() {
    memberStates.value.clear()
    isLoading.value = false
  }

  // ==================== Return ====================

  return {
    memberStates,
    isLoading,
    hasAnyChanges,
    changedMemberCount,
    isAllFormsValid,
    initializeMembers,
    updateMemberForm,
    addTeamToMember,
    removeTeamFromMember,
    initMemberTeams,
    getDisplayTeams,
    isMemberDirty,
    isMemberValid,
    saveAllChanges,
    reset
  }
}
