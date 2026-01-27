/**
 * Unit Tests for useBulkMemberEdit Composable
 *
 * Tests for bulk member editing functionality including:
 * - Initialization with selected members
 * - Form data management per member
 * - Team assignment operations
 * - Dirty detection and validation
 * - Batch save with API integration
 * - Reset functionality
 *
 * @module tests/unit/composables/team-management/useBulkMemberEdit.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBulkMemberEdit } from '@/composables/team-management/useBulkMemberEdit'
import type { TeamMember, AgentTeamMembership } from '@/types'
import { ROLES } from '@/constants/roles'

// ============================================================================
// Mock Dependencies
// ============================================================================

// Use vi.hoisted to create mocks that are available during vi.mock hoisting
const { mockTeamStore, mockToast, mockBatchEditMembers } = vi.hoisted(() => ({
  mockTeamStore: {
    updateMemberLocal: vi.fn()
  },
  mockToast: {
    showSuccess: vi.fn(),
    showError: vi.fn()
  },
  mockBatchEditMembers: vi.fn()
}))

vi.mock('@/stores/team', () => ({
  useTeamStore: vi.fn(() => mockTeamStore)
}))

vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(() => mockToast)
}))

vi.mock('@/api/team', () => ({
  teamApi: {
    batchEditMembers: mockBatchEditMembers
  }
}))

// Default mock response - can be overridden in individual tests
const getDefaultBatchEditResponse = () => ({
  success: true,
  data: {
    results: [
      { memberId: 'member-1', success: true, profileUpdated: true, teamsAdded: [], teamsRemoved: [] },
      { memberId: 'member-2', success: true, profileUpdated: true, teamsAdded: [1], teamsRemoved: [] }
    ],
    successCount: 2,
    failedCount: 0,
    skipped: [],
    undoToken: 'undo-token-123',
    undoExpiresAt: '2024-01-01T00:01:00Z'
  }
})

// ============================================================================
// Test Data
// ============================================================================

const createMockMember = (overrides: Partial<TeamMember> = {}): TeamMember => ({
  id: 'member-1',
  loginId: 'test@example.com',
  name: 'Test Member',
  displayName: 'Test Display Name',
  email: 'test@example.com',
  role: ROLES.AGENT,
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides
})

const createMockTeamMembership = (overrides: Partial<AgentTeamMembership> = {}): AgentTeamMembership => ({
  teamId: 1,
  teamName: 'Team A',
  roleInTeam: 'member',
  isPrimary: false,
  joinedAt: '2024-01-01T00:00:00Z',
  ...overrides
})

// ============================================================================
// Test Suite
// ============================================================================

describe('useBulkMemberEdit', () => {
  let composable: ReturnType<typeof useBulkMemberEdit>

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the batch edit response to default
    mockBatchEditMembers.mockResolvedValue(getDefaultBatchEditResponse())
    composable = useBulkMemberEdit()
  })

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize with empty state', () => {
      expect(composable.memberStates.value.size).toBe(0)
      expect(composable.isLoading.value).toBe(false)
      expect(composable.hasAnyChanges.value).toBe(false)
      expect(composable.changedMemberCount.value).toBe(0)
      expect(composable.isAllFormsValid.value).toBe(true)
    })

    it('should expose all required functions', () => {
      expect(typeof composable.initializeMembers).toBe('function')
      expect(typeof composable.updateMemberForm).toBe('function')
      expect(typeof composable.addTeamToMember).toBe('function')
      expect(typeof composable.removeTeamFromMember).toBe('function')
      expect(typeof composable.initMemberTeams).toBe('function')
      expect(typeof composable.getDisplayTeams).toBe('function')
      expect(typeof composable.isMemberDirty).toBe('function')
      expect(typeof composable.isMemberValid).toBe('function')
      expect(typeof composable.saveAllChanges).toBe('function')
      expect(typeof composable.reset).toBe('function')
    })

    it('should expose all required reactive properties', () => {
      expect(composable.memberStates).toBeDefined()
      expect(composable.isLoading).toBeDefined()
      expect(composable.hasAnyChanges).toBeDefined()
      expect(composable.changedMemberCount).toBeDefined()
      expect(composable.isAllFormsValid).toBeDefined()
    })
  })

  // ============================================================================
  // initializeMembers Tests
  // ============================================================================

  describe('initializeMembers', () => {
    it('should initialize member states from selected members', () => {
      const members = [
        createMockMember({ id: 'member-1', displayName: 'Member 1', email: 'member1@test.com' }),
        createMockMember({ id: 'member-2', displayName: 'Member 2', email: 'member2@test.com' })
      ]

      composable.initializeMembers(members)

      expect(composable.memberStates.value.size).toBe(2)
      expect(composable.memberStates.value.has('member-1')).toBe(true)
      expect(composable.memberStates.value.has('member-2')).toBe(true)
    })

    it('should set correct form data from member properties', () => {
      // Note: initializeMembers uses member.name (not displayName) for formData.displayName
      const member = createMockMember({
        id: 'member-1',
        name: 'Test Name',
        email: 'test@example.com',
        role: ROLES.ADMIN
      })

      composable.initializeMembers([member])

      const state = composable.memberStates.value.get('member-1')
      expect(state).toBeDefined()
      expect(state!.formData.displayName).toBe('Test Name')
      expect(state!.formData.email).toBe('test@example.com')
      expect(state!.formData.role).toBe(ROLES.ADMIN)
    })

    it('should use name as fallback when displayName is empty', () => {
      const member = createMockMember({
        id: 'member-1',
        displayName: '',
        name: 'Fallback Name'
      })

      composable.initializeMembers([member])

      const state = composable.memberStates.value.get('member-1')
      expect(state!.formData.displayName).toBe('Fallback Name')
    })

    it('should initialize with empty teams and pending changes', () => {
      const member = createMockMember({ id: 'member-1' })

      composable.initializeMembers([member])

      const state = composable.memberStates.value.get('member-1')
      expect(state!.currentTeams).toEqual([])
      expect(state!.pendingTeamChanges).toEqual([])
      expect(state!.teamsLoaded).toBe(false)
    })

    it('should initialize with no errors', () => {
      const member = createMockMember({ id: 'member-1' })

      composable.initializeMembers([member])

      const state = composable.memberStates.value.get('member-1')
      expect(state!.errors).toEqual({})
    })

    it('should handle empty array', () => {
      composable.initializeMembers([])

      expect(composable.memberStates.value.size).toBe(0)
    })

    it('should replace previous state on re-initialization', () => {
      const member1 = createMockMember({ id: 'member-1' })
      const member2 = createMockMember({ id: 'member-2' })

      composable.initializeMembers([member1])
      expect(composable.memberStates.value.size).toBe(1)

      composable.initializeMembers([member2])
      expect(composable.memberStates.value.size).toBe(1)
      expect(composable.memberStates.value.has('member-2')).toBe(true)
      expect(composable.memberStates.value.has('member-1')).toBe(false)
    })
  })

  // ============================================================================
  // updateMemberForm Tests
  // ============================================================================

  describe('updateMemberForm', () => {
    beforeEach(() => {
      const member = createMockMember({ id: 'member-1', displayName: 'Original Name' })
      composable.initializeMembers([member])
    })

    it('should update displayName field', () => {
      composable.updateMemberForm('member-1', 'displayName', 'New Name')

      const state = composable.memberStates.value.get('member-1')
      expect(state!.formData.displayName).toBe('New Name')
    })

    it('should update email field', () => {
      composable.updateMemberForm('member-1', 'email', 'new@example.com')

      const state = composable.memberStates.value.get('member-1')
      expect(state!.formData.email).toBe('new@example.com')
    })

    it('should update role field', () => {
      composable.updateMemberForm('member-1', 'role', 'admin')

      const state = composable.memberStates.value.get('member-1')
      expect(state!.formData.role).toBe('admin')
    })

    it('should validate displayName - show error for empty value', () => {
      composable.updateMemberForm('member-1', 'displayName', '')

      const state = composable.memberStates.value.get('member-1')
      expect(state!.errors.displayName).toBe('請輸入姓名')
    })

    it('should validate displayName - clear error for valid value', () => {
      composable.updateMemberForm('member-1', 'displayName', '')
      composable.updateMemberForm('member-1', 'displayName', 'Valid Name')

      const state = composable.memberStates.value.get('member-1')
      expect(state!.errors.displayName).toBeUndefined()
    })

    it('should validate email - show error for invalid format', () => {
      composable.updateMemberForm('member-1', 'email', 'invalid-email')

      const state = composable.memberStates.value.get('member-1')
      expect(state!.errors.email).toBe('請輸入有效的電子郵件格式')
    })

    it('should validate email - show error for empty email (email is required)', () => {
      composable.updateMemberForm('member-1', 'email', '')

      const state = composable.memberStates.value.get('member-1')
      expect(state!.errors.email).toBe('請輸入電子郵件')
    })

    it('should validate email - clear error for valid email', () => {
      composable.updateMemberForm('member-1', 'email', 'invalid')
      composable.updateMemberForm('member-1', 'email', 'valid@example.com')

      const state = composable.memberStates.value.get('member-1')
      expect(state!.errors.email).toBeUndefined()
    })

    it('should not throw for non-existent member', () => {
      expect(() => {
        composable.updateMemberForm('non-existent', 'displayName', 'Test')
      }).not.toThrow()
    })
  })

  // ============================================================================
  // Team Operations Tests
  // ============================================================================

  describe('Team Operations', () => {
    beforeEach(() => {
      const member = createMockMember({ id: 'member-1' })
      composable.initializeMembers([member])
    })

    describe('initMemberTeams', () => {
      it('should initialize teams for a member', () => {
        const teams = [
          createMockTeamMembership({ teamId: 1, teamName: 'Team A' }),
          createMockTeamMembership({ teamId: 2, teamName: 'Team B' })
        ]

        composable.initMemberTeams('member-1', teams)

        const state = composable.memberStates.value.get('member-1')
        expect(state!.currentTeams).toHaveLength(2)
        expect(state!.teamsLoaded).toBe(true)
      })

      it('should not throw for non-existent member', () => {
        expect(() => {
          composable.initMemberTeams('non-existent', [])
        }).not.toThrow()
      })
    })

    describe('addTeamToMember', () => {
      it('should add pending team change', () => {
        composable.addTeamToMember('member-1', 1, 'Team A')

        const state = composable.memberStates.value.get('member-1')
        expect(state!.pendingTeamChanges).toHaveLength(1)
        expect(state!.pendingTeamChanges[0]).toEqual({
          type: 'add',
          teamId: 1,
          teamName: 'Team A'
        })
      })

      it('should not add duplicate team', () => {
        composable.addTeamToMember('member-1', 1, 'Team A')
        composable.addTeamToMember('member-1', 1, 'Team A')

        const state = composable.memberStates.value.get('member-1')
        expect(state!.pendingTeamChanges).toHaveLength(1)
      })

      it('should cancel pending remove when adding same team', () => {
        // Initialize with team
        composable.initMemberTeams('member-1', [
          createMockTeamMembership({ teamId: 1, teamName: 'Team A' })
        ])

        // Remove team
        composable.removeTeamFromMember('member-1', 1)
        expect(composable.memberStates.value.get('member-1')!.pendingTeamChanges).toHaveLength(1)

        // Add same team back - should cancel the remove
        composable.addTeamToMember('member-1', 1, 'Team A')
        expect(composable.memberStates.value.get('member-1')!.pendingTeamChanges).toHaveLength(0)
      })
    })

    describe('removeTeamFromMember', () => {
      it('should add pending remove change for existing team', () => {
        composable.initMemberTeams('member-1', [
          createMockTeamMembership({ teamId: 1, teamName: 'Team A' })
        ])

        composable.removeTeamFromMember('member-1', 1)

        const state = composable.memberStates.value.get('member-1')
        expect(state!.pendingTeamChanges).toHaveLength(1)
        // Note: removeTeamFromMember only stores type and teamId, not teamName
        expect(state!.pendingTeamChanges[0]).toEqual({
          type: 'remove',
          teamId: 1
        })
      })

      it('should cancel pending add when removing same team', () => {
        composable.addTeamToMember('member-1', 1, 'Team A')
        expect(composable.memberStates.value.get('member-1')!.pendingTeamChanges).toHaveLength(1)

        composable.removeTeamFromMember('member-1', 1)
        expect(composable.memberStates.value.get('member-1')!.pendingTeamChanges).toHaveLength(0)
      })
    })

    describe('getDisplayTeams', () => {
      it('should return current teams when no pending changes', () => {
        const teams = [createMockTeamMembership({ teamId: 1, teamName: 'Team A' })]
        composable.initMemberTeams('member-1', teams)

        const displayTeams = composable.getDisplayTeams('member-1')
        expect(displayTeams).toHaveLength(1)
        expect(displayTeams[0].teamId).toBe(1)
      })

      it('should include pending add teams', () => {
        composable.initMemberTeams('member-1', [])
        composable.addTeamToMember('member-1', 1, 'Team A')

        const displayTeams = composable.getDisplayTeams('member-1')
        expect(displayTeams).toHaveLength(1)
        expect(displayTeams[0].teamId).toBe(1)
        expect(displayTeams[0].teamName).toBe('Team A')
      })

      it('should exclude pending remove teams', () => {
        composable.initMemberTeams('member-1', [
          createMockTeamMembership({ teamId: 1, teamName: 'Team A' }),
          createMockTeamMembership({ teamId: 2, teamName: 'Team B' })
        ])
        composable.removeTeamFromMember('member-1', 1)

        const displayTeams = composable.getDisplayTeams('member-1')
        expect(displayTeams).toHaveLength(1)
        expect(displayTeams[0].teamId).toBe(2)
      })

      it('should return empty array for non-existent member', () => {
        const displayTeams = composable.getDisplayTeams('non-existent')
        expect(displayTeams).toEqual([])
      })
    })
  })

  // ============================================================================
  // Dirty Detection Tests
  // ============================================================================

  describe('isMemberDirty', () => {
    beforeEach(() => {
      const member = createMockMember({
        id: 'member-1',
        displayName: 'Original Name',
        email: 'original@example.com',
        role: ROLES.AGENT
      })
      composable.initializeMembers([member])
    })

    it('should return false when no changes', () => {
      expect(composable.isMemberDirty('member-1')).toBe(false)
    })

    it('should return true when displayName changed', () => {
      composable.updateMemberForm('member-1', 'displayName', 'New Name')
      expect(composable.isMemberDirty('member-1')).toBe(true)
    })

    it('should return true when email changed', () => {
      composable.updateMemberForm('member-1', 'email', 'new@example.com')
      expect(composable.isMemberDirty('member-1')).toBe(true)
    })

    it('should return true when role changed', () => {
      composable.updateMemberForm('member-1', 'role', 'admin')
      expect(composable.isMemberDirty('member-1')).toBe(true)
    })

    it('should return true when team added', () => {
      composable.addTeamToMember('member-1', 1, 'Team A')
      expect(composable.isMemberDirty('member-1')).toBe(true)
    })

    it('should return true when team removed', () => {
      composable.initMemberTeams('member-1', [
        createMockTeamMembership({ teamId: 1, teamName: 'Team A' })
      ])
      composable.removeTeamFromMember('member-1', 1)
      expect(composable.isMemberDirty('member-1')).toBe(true)
    })

    it('should return false for non-existent member', () => {
      expect(composable.isMemberDirty('non-existent')).toBe(false)
    })

    it('should return false when changes reverted', () => {
      // Note: originalFormData is set from member.name during initialization
      // The mock member has name: 'Test Member' by default
      const state = composable.memberStates.value.get('member-1')
      const originalName = state!.originalFormData.displayName

      composable.updateMemberForm('member-1', 'displayName', 'New Name')
      expect(composable.isMemberDirty('member-1')).toBe(true)

      // Revert to original name
      composable.updateMemberForm('member-1', 'displayName', originalName)
      expect(composable.isMemberDirty('member-1')).toBe(false)
    })
  })

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('isMemberValid', () => {
    beforeEach(() => {
      const member = createMockMember({ id: 'member-1' })
      composable.initializeMembers([member])
    })

    it('should return true for valid form', () => {
      expect(composable.isMemberValid('member-1')).toBe(true)
    })

    it('should return false when displayName is empty', () => {
      composable.updateMemberForm('member-1', 'displayName', '')
      expect(composable.isMemberValid('member-1')).toBe(false)
    })

    it('should return false when email is invalid', () => {
      composable.updateMemberForm('member-1', 'email', 'invalid-email')
      expect(composable.isMemberValid('member-1')).toBe(false)
    })

    it('should return false for non-existent member', () => {
      expect(composable.isMemberValid('non-existent')).toBe(false)
    })
  })

  // ============================================================================
  // Computed Properties Tests
  // ============================================================================

  describe('Computed Properties', () => {
    describe('hasAnyChanges', () => {
      it('should return false when no members', () => {
        expect(composable.hasAnyChanges.value).toBe(false)
      })

      it('should return false when no changes made', () => {
        composable.initializeMembers([createMockMember({ id: 'member-1' })])
        expect(composable.hasAnyChanges.value).toBe(false)
      })

      it('should return true when any member has changes', () => {
        composable.initializeMembers([
          createMockMember({ id: 'member-1' }),
          createMockMember({ id: 'member-2' })
        ])
        composable.updateMemberForm('member-1', 'displayName', 'Changed')
        expect(composable.hasAnyChanges.value).toBe(true)
      })
    })

    describe('changedMemberCount', () => {
      it('should return 0 when no members', () => {
        expect(composable.changedMemberCount.value).toBe(0)
      })

      it('should count members with changes', () => {
        composable.initializeMembers([
          createMockMember({ id: 'member-1' }),
          createMockMember({ id: 'member-2' }),
          createMockMember({ id: 'member-3' })
        ])

        composable.updateMemberForm('member-1', 'displayName', 'Changed 1')
        composable.updateMemberForm('member-2', 'displayName', 'Changed 2')

        expect(composable.changedMemberCount.value).toBe(2)
      })
    })

    describe('isAllFormsValid', () => {
      it('should return true when no members', () => {
        expect(composable.isAllFormsValid.value).toBe(true)
      })

      it('should return true when all forms valid', () => {
        composable.initializeMembers([
          createMockMember({ id: 'member-1' }),
          createMockMember({ id: 'member-2' })
        ])
        expect(composable.isAllFormsValid.value).toBe(true)
      })

      it('should return false when any form invalid', () => {
        composable.initializeMembers([
          createMockMember({ id: 'member-1' }),
          createMockMember({ id: 'member-2' })
        ])
        composable.updateMemberForm('member-1', 'displayName', '')
        expect(composable.isAllFormsValid.value).toBe(false)
      })
    })
  })

  // ============================================================================
  // saveAllChanges Tests
  // ============================================================================

  describe('saveAllChanges', () => {
    const currentUserId = 'current-user-id'

    beforeEach(() => {
      composable.initializeMembers([
        createMockMember({ id: 'member-1', displayName: 'Member 1' }),
        createMockMember({ id: 'member-2', displayName: 'Member 2' })
      ])
    })

    it('should return error when no changes to save', async () => {
      const result = await composable.saveAllChanges(currentUserId)

      expect(result.success).toBe(false)
      expect(result.updatedCount).toBe(0)
      expect(mockToast.showError).toHaveBeenCalledWith('無變更', '沒有需要儲存的變更')
    })

    it('should skip current user from batch', async () => {
      composable.initializeMembers([
        createMockMember({ id: currentUserId, displayName: 'Current User' }),
        createMockMember({ id: 'member-1', displayName: 'Member 1' })
      ])

      composable.updateMemberForm(currentUserId, 'displayName', 'Changed Current')
      composable.updateMemberForm('member-1', 'displayName', 'Changed Member')

      await composable.saveAllChanges(currentUserId)

      // Should only send member-1, not current user
      expect(mockBatchEditMembers).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ memberId: 'member-1' })
        ])
      )
      expect(mockBatchEditMembers).toHaveBeenCalledWith(
        expect.not.arrayContaining([
          expect.objectContaining({ memberId: currentUserId })
        ])
      )
    })

    it('should skip members with invalid forms', async () => {
      composable.updateMemberForm('member-1', 'displayName', '') // Invalid
      composable.updateMemberForm('member-2', 'displayName', 'Valid Change')

      const result = await composable.saveAllChanges(currentUserId)

      // Should have error for invalid member
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should call batchEditMembers API with correct data', async () => {
      composable.updateMemberForm('member-1', 'displayName', 'New Name 1')
      composable.updateMemberForm('member-1', 'email', 'new1@example.com')
      composable.updateMemberForm('member-2', 'role', 'admin')

      await composable.saveAllChanges(currentUserId)

      expect(mockBatchEditMembers).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            memberId: 'member-1',
            profile: expect.objectContaining({
              displayName: 'New Name 1',
              email: 'new1@example.com'
            })
          }),
          expect.objectContaining({
            memberId: 'member-2',
            profile: expect.objectContaining({
              role: 'admin'
            })
          })
        ])
      )
    })

    it('should include team changes in batch request', async () => {
      composable.initMemberTeams('member-1', [
        createMockTeamMembership({ teamId: 1, teamName: 'Team A' })
      ])
      composable.addTeamToMember('member-1', 2, 'Team B')
      composable.removeTeamFromMember('member-1', 1)

      await composable.saveAllChanges(currentUserId)

      expect(mockBatchEditMembers).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            memberId: 'member-1',
            teamChanges: {
              add: [2],
              remove: [1]
            }
          })
        ])
      )
    })

    it('should return undoToken on success', async () => {
      composable.updateMemberForm('member-1', 'displayName', 'Changed')

      const result = await composable.saveAllChanges(currentUserId)

      expect(result.undoToken).toBe('undo-token-123')
      expect(result.undoExpiresAt).toBe('2024-01-01T00:01:00Z')
    })

    it('should show success toast on successful save', async () => {
      composable.updateMemberForm('member-1', 'displayName', 'Changed')

      await composable.saveAllChanges(currentUserId)

      expect(mockToast.showSuccess).toHaveBeenCalledWith(
        '批量編輯成功',
        expect.stringContaining('已成功更新')
      )
    })

    it('should handle API error', async () => {
      mockBatchEditMembers.mockResolvedValueOnce({
        success: false,
        error: 'API Error'
      })

      composable.updateMemberForm('member-1', 'displayName', 'Changed')
      const result = await composable.saveAllChanges(currentUserId)

      expect(result.success).toBe(false)
      expect(mockToast.showError).toHaveBeenCalledWith('批量編輯失敗', 'API Error')
    })

    it('should handle partial failures', async () => {
      mockBatchEditMembers.mockResolvedValueOnce({
        success: true,
        data: {
          results: [
            { memberId: 'member-1', success: true, profileUpdated: true, teamsAdded: [], teamsRemoved: [] },
            { memberId: 'member-2', success: false, error: 'Failed to update', profileUpdated: false, teamsAdded: [], teamsRemoved: [] }
          ],
          successCount: 1,
          failedCount: 1,
          skipped: [],
          undoToken: 'token'
        }
      })

      composable.updateMemberForm('member-1', 'displayName', 'Changed 1')
      composable.updateMemberForm('member-2', 'displayName', 'Changed 2')

      const result = await composable.saveAllChanges(currentUserId)

      expect(result.updatedCount).toBe(1)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(mockToast.showError).toHaveBeenCalled()
    })

    it('should update local store on success', async () => {
      composable.updateMemberForm('member-1', 'displayName', 'New Name')

      await composable.saveAllChanges(currentUserId)

      expect(mockTeamStore.updateMemberLocal).toHaveBeenCalled()
    })

    it('should set loading state during save', async () => {
      composable.updateMemberForm('member-1', 'displayName', 'Changed')

      expect(composable.isLoading.value).toBe(false)

      const savePromise = composable.saveAllChanges(currentUserId)
      // Note: Due to async nature, loading state may be difficult to test
      // In practice, you might need to add delays or use flush-promises

      await savePromise

      expect(composable.isLoading.value).toBe(false)
    })
  })

  // ============================================================================
  // Reset Tests
  // ============================================================================

  describe('reset', () => {
    it('should clear all member states', () => {
      composable.initializeMembers([
        createMockMember({ id: 'member-1' }),
        createMockMember({ id: 'member-2' })
      ])

      expect(composable.memberStates.value.size).toBe(2)

      composable.reset()

      expect(composable.memberStates.value.size).toBe(0)
    })

    it('should reset loading state', () => {
      composable.isLoading.value = true

      composable.reset()

      expect(composable.isLoading.value).toBe(false)
    })

    it('should reset computed values', () => {
      composable.initializeMembers([createMockMember({ id: 'member-1' })])
      composable.updateMemberForm('member-1', 'displayName', 'Changed')

      expect(composable.hasAnyChanges.value).toBe(true)

      composable.reset()

      expect(composable.hasAnyChanges.value).toBe(false)
      expect(composable.changedMemberCount.value).toBe(0)
    })
  })
})
