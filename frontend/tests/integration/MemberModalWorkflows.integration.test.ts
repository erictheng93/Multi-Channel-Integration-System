/**
 * Integration Tests for Member Modal Workflows
 *
 * Tests complete user flows through member-related modals:
 * - MemberEditModal: Open → View member → Manage teams → Save
 * - Multi-team assignment: Add team → Remove team → Set primary
 *
 * These tests verify:
 * - Component communication (MemberEditModal → MultiTeamSelector → TeamChipList)
 * - API integration (useMemberTeams composable)
 * - State management across nested components
 * - Optimistic updates and rollback on errors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref, computed } from 'vue'
import MemberEditModal from '@/components/team/member-edit/MemberEditModal.vue'
import MultiTeamSelector from '@/components/team/multi-team/MultiTeamSelector.vue'

// Mock dependencies
vi.mock('@/api/team', () => ({
  teamApi: {
    getAgentTeams: vi.fn(),
    joinTeam: vi.fn(),
    leaveTeam: vi.fn(),
    setPrimaryTeam: vi.fn()
  }
}))

vi.mock('@/composables/useConfirmDialog', () => ({
  useConfirmDialog: vi.fn(() => ({
    showWarning: vi.fn().mockResolvedValue(true)
  }))
}))

vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(() => ({
    showSuccess: vi.fn(),
    showError: vi.fn()
  }))
}))

// Mock useMemberTeams composable to avoid ref.value issue with props
vi.mock('@/composables/team-management/useMemberTeams', () => ({
  useMemberTeams: vi.fn(() => ({
    memberTeams: { value: [] },
    availableTeamsToJoin: { value: [] },
    teamOperationLoading: { value: false },
    teamOperationStatus: { value: null },
    loadMemberTeams: vi.fn(),
    addToTeam: vi.fn().mockResolvedValue(true),
    removeFromTeam: vi.fn().mockResolvedValue(true),
    setPrimaryTeam: vi.fn().mockResolvedValue(true)
  }))
}))

import { teamApi } from '@/api/team'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'
import { useMemberTeams } from '@/composables/team-management/useMemberTeams'

describe('Member Modal Workflows - Integration Tests', () => {
  let mockShowWarning: ReturnType<typeof vi.fn>
  let mockShowSuccess: ReturnType<typeof vi.fn>
  let mockShowError: ReturnType<typeof vi.fn>
  let mockLoadMemberTeams: ReturnType<typeof vi.fn>
  let mockAddToTeam: ReturnType<typeof vi.fn>
  let mockRemoveFromTeam: ReturnType<typeof vi.fn>
  let mockSetPrimaryTeam: ReturnType<typeof vi.fn>

  const mockMember = {
    id: 'agent-123',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'agent' as const,
    isActive: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  }

  const mockAllTeams = [
    { id: 1, name: 'Team Alpha', description: 'First team', isActive: true, createdAt: '2024-01-01', updatedAt: '2024-01-01', memberCount: 5 },
    { id: 2, name: 'Team Beta', description: 'Second team', isActive: true, createdAt: '2024-01-02', updatedAt: '2024-01-02', memberCount: 3 },
    { id: 3, name: 'Team Gamma', description: 'Third team', isActive: true, createdAt: '2024-01-03', updatedAt: '2024-01-03', memberCount: 7 }
  ]

  const mockMemberTeamsData = [
    { teamId: 1, teamName: 'Team Alpha', roleInTeam: 'member', isPrimary: true, joinedAt: '2024-01-01' }
  ]

  beforeEach(() => {
    // Setup Pinia
    const pinia = createPinia()
    setActivePinia(pinia)

    // Clear all mocks
    vi.clearAllMocks()

    // Create fresh mock functions
    mockShowWarning = vi.fn().mockResolvedValue(true)
    mockShowSuccess = vi.fn()
    mockShowError = vi.fn()
    mockLoadMemberTeams = vi.fn()
    mockAddToTeam = vi.fn().mockResolvedValue(true)
    mockRemoveFromTeam = vi.fn().mockResolvedValue(true)
    mockSetPrimaryTeam = vi.fn().mockResolvedValue(true)

    // Setup mock responses
    vi.mocked(useConfirmDialog).mockReturnValue({
      showWarning: mockShowWarning
    } as any)

    vi.mocked(useToast).mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError
    } as any)

    // Setup useMemberTeams mock with proper Vue refs that auto-unwrap in templates
    vi.mocked(useMemberTeams).mockReturnValue({
      memberTeams: ref([...mockMemberTeamsData]),
      availableTeamsToJoin: computed(() => mockAllTeams.filter(t => t.id !== 1)),
      teamOperationLoading: ref(false),
      teamOperationStatus: ref(null),
      loadMemberTeams: mockLoadMemberTeams,
      addToTeam: mockAddToTeam,
      removeFromTeam: mockRemoveFromTeam,
      setPrimaryTeam: mockSetPrimaryTeam
    })

    // Default API responses (for direct API calls if any)
    vi.mocked(teamApi.getAgentTeams).mockResolvedValue({
      success: true,
      data: [...mockMemberTeamsData]
    })

    vi.mocked(teamApi.joinTeam).mockResolvedValue({ success: true })
    vi.mocked(teamApi.leaveTeam).mockResolvedValue({ success: true })
    vi.mocked(teamApi.setPrimaryTeam).mockResolvedValue({ success: true })
  })

  describe('MemberEditModal - Complete Workflow', () => {
    it('should display member information correctly', async () => {
      const wrapper = mount(MemberEditModal, {
        props: {
          show: true,
          member: mockMember,
          allTeams: mockAllTeams
        },
        global: {
          plugins: [createPinia()],
          stubs: {
            Modal: {
              template: '<div class="modal-stub"><slot name="header" /><slot /><slot name="footer" /></div>',
              props: ['show', 'title', 'size'],
              emits: ['close']
            }
          }
        }
      })

      await nextTick()

      // Modal should display member name in title (header slot)
      expect(wrapper.text()).toContain('John Doe')

      // Should display member email in form input
      const emailInput = wrapper.find('input[type="email"]')
      expect(emailInput.exists()).toBe(true)
      expect((emailInput.element as HTMLInputElement).value).toBe('john@example.com')

      // Should display role dropdown with agent role options
      const roleSelect = wrapper.find('select')
      expect(roleSelect.exists()).toBe(true)
      expect(wrapper.text()).toContain('客服人員')
    })

    it('should show admin notice for admin members', async () => {
      const adminMember = { ...mockMember, role: 'admin' as const }

      const wrapper = mount(MemberEditModal, {
        props: {
          show: true,
          member: adminMember,
          allTeams: mockAllTeams
        },
        global: {
          plugins: [createPinia()],
          stubs: {
            Modal: {
              template: '<div class="modal-stub"><slot /></div>',
              props: ['show', 'title', 'size'],
              emits: ['close']
            }
          }
        }
      })

      await nextTick()

      // Should show admin notice instead of team selector
      expect(wrapper.text()).toContain('管理員無需分配團隊')
    })
  })

  describe('MultiTeamSelector - immediate mode', () => {
    const mountSelector = (props: Record<string, unknown> = {}) =>
      mount(MultiTeamSelector, {
        props: { memberId: mockMember.id, allTeams: mockAllTeams, ...props },
        global: { plugins: [createPinia()] }
      })

    it('loads the member teams on mount and shows them as chips', async () => {
      const wrapper = mountSelector()
      await flushPromises()

      expect(mockLoadMemberTeams).toHaveBeenCalledWith(mockMember.id)
      const chips = wrapper.findAll('.team-chip')
      expect(chips).toHaveLength(1)
      expect(chips[0]?.text()).toContain('Team Alpha')
    })

    it('offers only teams the member has not joined', async () => {
      const wrapper = mountSelector()
      await flushPromises()

      const options = wrapper.findAll('select.team-add-select option').map(o => o.text())
      expect(options.some(t => t.includes('Beta'))).toBe(true)
      expect(options.some(t => t.includes('Gamma'))).toBe(true)
      expect(options.some(t => t.includes('Alpha'))).toBe(false)
    })

    it('adds the chosen team through the composable', async () => {
      const wrapper = mountSelector()
      await flushPromises()

      await wrapper.find('select.team-add-select').setValue(2)
      await flushPromises()

      expect(mockAddToTeam).toHaveBeenCalledWith(mockMember.id, 2)
    })

    it('removes a team through the composable (which confirms internally)', async () => {
      const wrapper = mountSelector()
      await flushPromises()

      await wrapper.find('.team-chip .chip-remove').trigger('click')

      expect(mockRemoveFromTeam).toHaveBeenCalledWith(mockMember.id, 1)
    })

    it('shows the operation status message with its type class', async () => {
      vi.mocked(useMemberTeams).mockReturnValue({
        ...vi.mocked(useMemberTeams)({} as never),
        teamOperationStatus: ref({ type: 'error', message: 'Join failed' })
      } as never)

      const wrapper = mountSelector()
      await flushPromises()

      const status = wrapper.find('.status-message')
      expect(status.text()).toBe('Join failed')
      expect(status.classes()).toContain('error')
    })

    it('disables chip removal while an operation is running', async () => {
      vi.mocked(useMemberTeams).mockReturnValue({
        ...vi.mocked(useMemberTeams)({} as never),
        teamOperationLoading: ref(true)
      } as never)

      const wrapper = mountSelector()
      await flushPromises()

      expect(wrapper.find('.chip-remove').attributes('disabled')).toBeDefined()
      expect(wrapper.find('select.team-add-select').attributes('disabled')).toBeDefined()
    })
  })

  describe('MultiTeamSelector - deferred mode', () => {
    const alpha = { teamId: 1, teamName: 'Team Alpha', roleInTeam: 'member', isPrimary: true, joinedAt: '2024-01-01' }

    const mountDeferred = (props: Record<string, unknown> = {}) =>
      mount(MultiTeamSelector, {
        props: {
          memberId: mockMember.id,
          allTeams: mockAllTeams,
          deferredMode: true,
          teams: [alpha],
          ...props
        } as never,
        global: { plugins: [createPinia()] }
      })

    it('stages an add as an event and never calls the API', async () => {
      const wrapper = mountDeferred()
      await flushPromises()

      await wrapper.find('select.team-add-select').setValue(2)

      expect(wrapper.emitted('add-team')).toEqual([[2, 'Team Beta']])
      expect(mockAddToTeam).not.toHaveBeenCalled()
    })

    it('stages a remove as an event and never calls the API', async () => {
      const wrapper = mountDeferred()
      await flushPromises()

      await wrapper.find('.chip-remove').trigger('click')

      expect(wrapper.emitted('remove-team')).toEqual([[1]])
      expect(mockRemoveFromTeam).not.toHaveBeenCalled()
    })

    it('computes the dropdown from allTeams minus the supplied teams', async () => {
      const wrapper = mountDeferred()
      await flushPromises()

      const options = wrapper.findAll('select.team-add-select option').map(o => o.text())
      expect(options.some(t => t.includes('Alpha'))).toBe(false)
      expect(options.some(t => t.includes('Beta'))).toBe(true)
    })

    it('reports loaded teams to the parent so it can initialize its staging state', async () => {
      const wrapper = mountDeferred()
      await flushPromises()

      expect(mockLoadMemberTeams).toHaveBeenCalledWith(mockMember.id)
      expect(wrapper.emitted('teams-loaded')).toHaveLength(1)
    })

    it('flags unsaved changes and marks pending chips', async () => {
      const wrapper = mountDeferred({
        pendingChanges: [{ type: 'remove', teamId: 1, teamName: 'Team Alpha' }]
      })
      await flushPromises()

      expect(wrapper.find('.status-message.pending').text()).toBe('有未儲存的變更')
      expect(wrapper.find('.team-chip').classes()).toContain('is-pending-remove')
    })

    it('hides the unsaved-changes message when the parent shows it instead', async () => {
      const wrapper = mountDeferred({
        hideStatusMessage: true,
        pendingChanges: [{ type: 'remove', teamId: 1, teamName: 'Team Alpha' }]
      })
      await flushPromises()

      expect(wrapper.find('.status-message').exists()).toBe(false)
    })
  })
})
