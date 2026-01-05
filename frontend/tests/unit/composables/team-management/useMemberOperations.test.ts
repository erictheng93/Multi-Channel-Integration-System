/**
 * Unit Tests for useMemberOperations Composable
 *
 * @module tests/unit/composables/team-management/useMemberOperations.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMemberOperations } from '@/composables/team-management/useMemberOperations'
import type { TeamMember } from '@/types'
import { ROLES } from '@/constants/roles'

// Mock dependencies
const mockTeamStore = {
  addMember: vi.fn(),
  resetPasswordWithPolicy: vi.fn(),
  updateMemberRole: vi.fn(),
  updateMemberStatus: vi.fn(),
  removeMember: vi.fn()
}

const mockToast = {
  showSuccess: vi.fn(),
  showError: vi.fn()
}

vi.mock('@/stores/team', () => ({
  useTeamStore: vi.fn(() => mockTeamStore)
}))

vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(() => mockToast)
}))

describe('useMemberOperations', () => {
  let operations: ReturnType<typeof useMemberOperations>

  // Mock member data
  const mockMember: TeamMember = {
    id: 'member-1',
    loginId: 'test@example.com',
    name: 'Test Member',
    email: 'test@example.com',
    role: ROLES.AGENT,
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    operations = useMemberOperations()
  })

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      expect(operations.addMemberModal.value).toBe(false)
      expect(operations.addMemberLoading.value).toBe(false)
      expect(operations.showAddPassword.value).toBe(false)
      expect(operations.passwordResetModal.value).toBe(false)
      expect(operations.passwordResetLoading.value).toBe(false)
      expect(operations.passwordResetMember.value).toBeNull()
    })

    it('should initialize add member form with default values', () => {
      expect(operations.addMemberForm.loginId).toBe('')
      expect(operations.addMemberForm.name).toBe('')
      expect(operations.addMemberForm.email).toBe('')
      expect(operations.addMemberForm.password).toBe('')
      expect(operations.addMemberForm.role).toBe(ROLES.AGENT)
      expect(operations.addMemberForm.group).toBe('')
      expect(operations.addMemberForm.isActive).toBe(true)
    })

    it('should initialize password reset form with default values', () => {
      expect(operations.passwordResetForm.newPassword).toBe('')
      expect(operations.passwordResetForm.confirmPassword).toBe('')
    })

    it('should expose all required operations', () => {
      expect(typeof operations.openAddMemberModal).toBe('function')
      expect(typeof operations.closeAddMemberModal).toBe('function')
      expect(typeof operations.toggleAddPasswordVisibility).toBe('function')
      expect(typeof operations.submitAddMember).toBe('function')
      expect(typeof operations.openPasswordResetModal).toBe('function')
      expect(typeof operations.closePasswordResetModal).toBe('function')
      expect(typeof operations.submitPasswordReset).toBe('function')
      expect(typeof operations.updateMemberRole).toBe('function')
      expect(typeof operations.toggleMemberStatus).toBe('function')
      expect(typeof operations.removeMember).toBe('function')
    })
  })

  // ============================================================================
  // Add Member Modal Tests
  // ============================================================================

  describe('Add Member Modal', () => {
    it('should open add member modal', () => {
      operations.openAddMemberModal()

      expect(operations.addMemberModal.value).toBe(true)
    })

    it('should close add member modal', () => {
      operations.addMemberModal.value = true
      operations.showAddPassword.value = true
      operations.addMemberForm.name = 'Test'

      operations.closeAddMemberModal()

      expect(operations.addMemberModal.value).toBe(false)
      expect(operations.showAddPassword.value).toBe(false)
      expect(operations.addMemberForm.name).toBe('')
    })

    it('should toggle password visibility', () => {
      expect(operations.showAddPassword.value).toBe(false)

      operations.toggleAddPasswordVisibility()
      expect(operations.showAddPassword.value).toBe(true)

      operations.toggleAddPasswordVisibility()
      expect(operations.showAddPassword.value).toBe(false)
    })

    it('should reset form when closing modal', () => {
      operations.addMemberForm.loginId = 'test'
      operations.addMemberForm.name = 'Test Name'
      operations.addMemberForm.email = 'test@example.com'
      operations.addMemberForm.password = 'password123'

      operations.closeAddMemberModal()

      expect(operations.addMemberForm.loginId).toBe('')
      expect(operations.addMemberForm.name).toBe('')
      expect(operations.addMemberForm.email).toBe('')
      expect(operations.addMemberForm.password).toBe('')
    })
  })

  // ============================================================================
  // Submit Add Member Tests
  // ============================================================================

  describe('Submit Add Member', () => {
    beforeEach(() => {
      operations.addMemberForm.name = 'New Member'
      operations.addMemberForm.email = 'newmember@example.com'
      operations.addMemberForm.password = 'password123'
      operations.addMemberForm.role = ROLES.AGENT
    })

    it('should submit add member successfully', async () => {
      mockTeamStore.addMember.mockResolvedValue(undefined)

      await operations.submitAddMember()

      expect(mockTeamStore.addMember).toHaveBeenCalledWith({
        loginId: 'newmember@example.com', // Uses email as loginId
        name: 'New Member',
        email: 'newmember@example.com',
        password: 'password123',
        role: ROLES.AGENT,
        group: '',
        isActive: true
      })
      expect(mockToast.showSuccess).toHaveBeenCalledWith(
        '新增成員成功',
        '已成功新增系統人員'
      )
      expect(operations.addMemberModal.value).toBe(false)
    })

    it('should handle add member errors', async () => {
      const error = new Error('Add member failed')
      mockTeamStore.addMember.mockRejectedValue(error)

      await operations.submitAddMember()

      expect(mockToast.showError).toHaveBeenCalledWith(
        '新增成員失敗',
        'Add member failed'
      )
      // Note: Current implementation closes modal on error
      // TODO: Consider keeping modal open for better UX
      expect(operations.addMemberLoading.value).toBe(false)
    })

    it('should set loading state during submit', async () => {
      mockTeamStore.addMember.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 100))
      )

      const promise = operations.submitAddMember()

      expect(operations.addMemberLoading.value).toBe(true)

      await promise

      expect(operations.addMemberLoading.value).toBe(false)
    })

    it('should use email as loginId', async () => {
      mockTeamStore.addMember.mockResolvedValue(undefined)
      operations.addMemberForm.email = 'test@example.com'
      operations.addMemberForm.loginId = 'old-login-id'

      await operations.submitAddMember()

      expect(mockTeamStore.addMember).toHaveBeenCalledWith(
        expect.objectContaining({
          loginId: 'test@example.com'
        })
      )
    })
  })

  // ============================================================================
  // Password Reset Modal Tests
  // ============================================================================

  describe('Password Reset Modal', () => {
    it('should open password reset modal', () => {
      operations.openPasswordResetModal(mockMember)

      expect(operations.passwordResetModal.value).toBe(true)
      expect(operations.passwordResetMember.value).toEqual(mockMember)
    })

    it('should close password reset modal', () => {
      operations.passwordResetModal.value = true
      operations.passwordResetMember.value = mockMember
      operations.passwordResetForm.newPassword = 'test'

      operations.closePasswordResetModal()

      expect(operations.passwordResetModal.value).toBe(false)
      expect(operations.passwordResetMember.value).toBeNull()
      expect(operations.passwordResetForm.newPassword).toBe('')
    })

    it('should reset form when opening modal', () => {
      operations.passwordResetForm.newPassword = 'old-password'
      operations.passwordResetForm.confirmPassword = 'old-password'

      operations.openPasswordResetModal(mockMember)

      expect(operations.passwordResetForm.newPassword).toBe('')
      expect(operations.passwordResetForm.confirmPassword).toBe('')
    })
  })

  // ============================================================================
  // Password Validation Tests
  // ============================================================================

  describe('Password Validation', () => {
    it('should detect password mismatch', () => {
      operations.passwordResetForm.newPassword = 'password123'
      operations.passwordResetForm.confirmPassword = 'different'

      expect(operations.passwordMismatch.value).toBe(true)
    })

    it('should not show mismatch when passwords match', () => {
      operations.passwordResetForm.newPassword = 'password123'
      operations.passwordResetForm.confirmPassword = 'password123'

      expect(operations.passwordMismatch.value).toBe(false)
    })

    it('should not show mismatch when passwords are empty', () => {
      operations.passwordResetForm.newPassword = ''
      operations.passwordResetForm.confirmPassword = ''

      expect(operations.passwordMismatch.value).toBe(false)
    })

    it('should validate form is invalid when password too short', () => {
      operations.passwordResetForm.newPassword = '12345' // Less than 6 chars
      operations.passwordResetForm.confirmPassword = '12345'

      expect(operations.isPasswordFormValid.value).toBe(false)
    })

    it('should validate form is invalid when passwords mismatch', () => {
      operations.passwordResetForm.newPassword = 'password123'
      operations.passwordResetForm.confirmPassword = 'different'

      expect(operations.isPasswordFormValid.value).toBe(false)
    })

    it('should validate form is valid when conditions met', () => {
      operations.passwordResetForm.newPassword = 'password123'
      operations.passwordResetForm.confirmPassword = 'password123'

      expect(operations.isPasswordFormValid.value).toBe(true)
    })
  })

  // ============================================================================
  // Submit Password Reset Tests
  // ============================================================================

  describe('Submit Password Reset', () => {
    beforeEach(() => {
      operations.passwordResetMember.value = mockMember
      operations.passwordResetForm.newPassword = 'newpassword123'
      operations.passwordResetForm.confirmPassword = 'newpassword123'
    })

    it('should submit password reset successfully', async () => {
      mockTeamStore.resetPasswordWithPolicy.mockResolvedValue(undefined)

      await operations.submitPasswordReset()

      expect(mockTeamStore.resetPasswordWithPolicy).toHaveBeenCalledWith(
        'member-1',
        {
          newPassword: 'newpassword123',
          policy: 'changeable'
        }
      )
      expect(mockToast.showSuccess).toHaveBeenCalledWith(
        '密碼設定成功',
        expect.stringContaining('Test Member'),
        expect.objectContaining({ duration: 5000 })
      )
      expect(operations.passwordResetModal.value).toBe(false)
    })

    it('should not submit when form is invalid', async () => {
      operations.passwordResetForm.newPassword = '123' // Too short

      await operations.submitPasswordReset()

      expect(mockTeamStore.resetPasswordWithPolicy).not.toHaveBeenCalled()
    })

    it('should not submit when no member selected', async () => {
      operations.passwordResetMember.value = null

      await operations.submitPasswordReset()

      expect(mockTeamStore.resetPasswordWithPolicy).not.toHaveBeenCalled()
    })

    it('should handle password reset errors', async () => {
      mockTeamStore.resetPasswordWithPolicy.mockRejectedValue(new Error('Reset failed'))

      await operations.submitPasswordReset()

      expect(mockToast.showError).toHaveBeenCalledWith(
        '設定密碼失敗',
        '請檢查網路連線或稍後重試'
      )
      // Note: Current implementation closes modal on error
      // TODO: Consider keeping modal open for better UX
      expect(operations.passwordResetLoading.value).toBe(false)
    })

    it('should set loading state during submit', async () => {
      mockTeamStore.resetPasswordWithPolicy.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 100))
      )

      const promise = operations.submitPasswordReset()

      expect(operations.passwordResetLoading.value).toBe(true)

      await promise

      expect(operations.passwordResetLoading.value).toBe(false)
    })
  })

  // ============================================================================
  // Update Member Role Tests
  // ============================================================================

  describe('Update Member Role', () => {
    it('should update member role successfully', async () => {
      mockTeamStore.updateMemberRole.mockResolvedValue(undefined)

      await operations.updateMemberRole('member-1', ROLES.ADMIN)

      expect(mockTeamStore.updateMemberRole).toHaveBeenCalledWith('member-1', ROLES.ADMIN)
      expect(mockToast.showSuccess).toHaveBeenCalledWith(
        '更新角色成功',
        '已成功更新成員角色'
      )
    })

    it('should handle update role errors', async () => {
      mockTeamStore.updateMemberRole.mockRejectedValue(new Error('Update failed'))

      await operations.updateMemberRole('member-1', ROLES.ADMIN)

      expect(mockToast.showError).toHaveBeenCalledWith(
        '更新角色失敗',
        '請稍後重試'
      )
    })
  })

  // ============================================================================
  // Toggle Member Status Tests
  // ============================================================================

  describe('Toggle Member Status', () => {
    it('should toggle active member to inactive', async () => {
      mockTeamStore.updateMemberStatus.mockResolvedValue(undefined)
      const activeMember = { ...mockMember, status: 'active' as const }

      await operations.toggleMemberStatus(activeMember)

      expect(mockTeamStore.updateMemberStatus).toHaveBeenCalledWith('member-1', 'inactive')
      expect(mockToast.showSuccess).toHaveBeenCalledWith(
        '狀態更新成功',
        '已停用成員'
      )
    })

    it('should toggle inactive member to active', async () => {
      mockTeamStore.updateMemberStatus.mockResolvedValue(undefined)
      const inactiveMember = { ...mockMember, status: 'inactive' as const }

      await operations.toggleMemberStatus(inactiveMember)

      expect(mockTeamStore.updateMemberStatus).toHaveBeenCalledWith('member-1', 'active')
      expect(mockToast.showSuccess).toHaveBeenCalledWith(
        '狀態更新成功',
        '已啟用成員'
      )
    })

    it('should handle toggle status errors', async () => {
      mockTeamStore.updateMemberStatus.mockRejectedValue(new Error('Update failed'))

      await operations.toggleMemberStatus(mockMember)

      expect(mockToast.showError).toHaveBeenCalledWith(
        '更新狀態失敗',
        '請稍後重試'
      )
    })
  })

  // ============================================================================
  // Remove Member Tests
  // ============================================================================

  describe('Remove Member', () => {
    it('should remove member successfully', async () => {
      mockTeamStore.removeMember.mockResolvedValue(undefined)

      await operations.removeMember(mockMember)

      expect(mockTeamStore.removeMember).toHaveBeenCalledWith('member-1')
      expect(mockToast.showSuccess).toHaveBeenCalledWith(
        '移除成員成功',
        expect.stringContaining('Test Member')
      )
    })

    it('should use loginId when name is not available', async () => {
      mockTeamStore.removeMember.mockResolvedValue(undefined)
      const memberWithoutName = { ...mockMember, name: '' }

      await operations.removeMember(memberWithoutName)

      expect(mockToast.showSuccess).toHaveBeenCalledWith(
        '移除成員成功',
        expect.stringContaining('test@example.com')
      )
    })

    it('should handle remove member errors', async () => {
      const error = new Error('Remove failed')
      mockTeamStore.removeMember.mockRejectedValue(error)

      await operations.removeMember(mockMember)

      expect(mockToast.showError).toHaveBeenCalledWith(
        '移除成員失敗',
        'Remove failed'
      )
    })

    it('should handle non-Error exceptions', async () => {
      mockTeamStore.removeMember.mockRejectedValue('String error')

      await operations.removeMember(mockMember)

      expect(mockToast.showError).toHaveBeenCalledWith(
        '移除成員失敗',
        '移除成員失敗，請稍後重試'
      )
    })
  })
})
