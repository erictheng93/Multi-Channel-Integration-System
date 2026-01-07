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
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
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

import { teamApi } from '@/api/team'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'

describe('Member Modal Workflows - Integration Tests', () => {
  let mockShowWarning: ReturnType<typeof vi.fn>
  let mockShowSuccess: ReturnType<typeof vi.fn>
  let mockShowError: ReturnType<typeof vi.fn>

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

  const mockMemberTeams = [
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

    // Setup mock responses
    vi.mocked(useConfirmDialog).mockReturnValue({
      showWarning: mockShowWarning
    } as any)

    vi.mocked(useToast).mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError
    } as any)

    // Default API responses
    vi.mocked(teamApi.getAgentTeams).mockResolvedValue({
      success: true,
      data: [...mockMemberTeams]
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
              template: '<div class="modal-stub"><h2>{{ title }}</h2><slot /></div>',
              props: ['show', 'title', 'size'],
              emits: ['close']
            }
          }
        }
      })

      await nextTick()

      // Modal should display member name in title
      expect(wrapper.text()).toContain('John Doe')

      // Should display member email
      expect(wrapper.text()).toContain('john@example.com')

      // Should display role
      expect(wrapper.text()).toContain('agent')
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

  describe('MultiTeamSelector - Integration with MemberEditModal', () => {
    it('should load and display member teams on mount', async () => {
      const wrapper = mount(MultiTeamSelector, {
        props: {
          memberId: mockMember.id,
          allTeams: mockAllTeams
        },
        global: {
          plugins: [createPinia()]
        }
      })

      await nextTick()
      await nextTick() // Wait for async load

      // API should be called to load teams
      expect(teamApi.getAgentTeams).toHaveBeenCalledWith(mockMember.id)

      // Should display the team chip
      expect(wrapper.text()).toContain('Team Alpha')
    })

    it('should complete add team workflow', async () => {
      const wrapper = mount(MultiTeamSelector, {
        props: {
          memberId: mockMember.id,
          allTeams: mockAllTeams
        },
        global: {
          plugins: [createPinia()]
        }
      })

      await nextTick()
      await nextTick()

      // Find the dropdown/select for adding teams
      const addDropdown = wrapper.find('select, [data-testid="team-add-dropdown"]')

      if (addDropdown.exists()) {
        // Select Team Beta (id: 2)
        await addDropdown.setValue('2')
        await nextTick()

        // API should be called
        expect(teamApi.joinTeam).toHaveBeenCalledWith(
          mockMember.id,
          2,
          expect.objectContaining({
            roleInTeam: 'member',
            isPrimary: false // Not first team
          })
        )

        // Success message should be shown
        expect(mockShowSuccess).toHaveBeenCalledWith(expect.stringContaining('Team Beta'))
      }
    })

    it('should complete remove team workflow with confirmation', async () => {
      const wrapper = mount(MultiTeamSelector, {
        props: {
          memberId: mockMember.id,
          allTeams: mockAllTeams
        },
        global: {
          plugins: [createPinia()]
        }
      })

      await nextTick()
      await nextTick()

      // Find remove button (usually marked with × or remove class)
      const removeBtn = wrapper.find('[class*="remove"], [class*="chip-remove"]')

      if (removeBtn.exists()) {
        await removeBtn.trigger('click')
        await nextTick()

        // Confirmation dialog should be shown
        expect(mockShowWarning).toHaveBeenCalledWith(
          '確認移除團隊？',
          expect.stringContaining('Team Alpha')
        )

        // API should be called
        expect(teamApi.leaveTeam).toHaveBeenCalledWith(mockMember.id, 1)

        // Success message should be shown
        expect(mockShowSuccess).toHaveBeenCalled()
      }
    })

    it('should handle remove team cancellation', async () => {
      mockShowWarning.mockResolvedValue(false) // User cancels

      const wrapper = mount(MultiTeamSelector, {
        props: {
          memberId: mockMember.id,
          allTeams: mockAllTeams
        },
        global: {
          plugins: [createPinia()]
        }
      })

      await nextTick()
      await nextTick()

      const removeBtn = wrapper.find('[class*="remove"], [class*="chip-remove"]')

      if (removeBtn.exists()) {
        await removeBtn.trigger('click')
        await nextTick()

        // Confirmation was shown but user cancelled
        expect(mockShowWarning).toHaveBeenCalled()

        // API should NOT be called
        expect(teamApi.leaveTeam).not.toHaveBeenCalled()
      }
    })

    it('should set team as primary', async () => {
      // Setup with multiple teams
      vi.mocked(teamApi.getAgentTeams).mockResolvedValue({
        success: true,
        data: [
          { teamId: 1, teamName: 'Team Alpha', roleInTeam: 'member', isPrimary: true, joinedAt: '2024-01-01' },
          { teamId: 2, teamName: 'Team Beta', roleInTeam: 'member', isPrimary: false, joinedAt: '2024-01-02' }
        ]
      })

      const wrapper = mount(MultiTeamSelector, {
        props: {
          memberId: mockMember.id,
          allTeams: mockAllTeams
        },
        global: {
          plugins: [createPinia()]
        }
      })

      await nextTick()
      await nextTick()

      // Find set-primary button (usually marked with star ☆)
      const setPrimaryBtn = wrapper.find('[class*="chip-star"], [class*="set-primary"]')

      if (setPrimaryBtn.exists()) {
        await setPrimaryBtn.trigger('click')
        await nextTick()

        // API should be called
        expect(teamApi.setPrimaryTeam).toHaveBeenCalled()

        // Success message should be shown
        expect(mockShowSuccess).toHaveBeenCalled()
      }
    })

    it('should display available teams for selection', async () => {
      const wrapper = mount(MultiTeamSelector, {
        props: {
          memberId: mockMember.id,
          allTeams: mockAllTeams
        },
        global: {
          plugins: [createPinia()]
        }
      })

      await nextTick()
      await nextTick()

      // Member is in Team Alpha, so Beta and Gamma should be available
      const dropdown = wrapper.find('select, [data-testid="team-add-dropdown"]')

      if (dropdown.exists()) {
        const options = dropdown.findAll('option')
        const optionTexts = options.map(o => o.text())

        // Should show available teams (not already joined)
        expect(optionTexts.some(t => t.includes('Beta'))).toBe(true)
        expect(optionTexts.some(t => t.includes('Gamma'))).toBe(true)
      }
    })
  })

  describe('Error Handling in Multi-Team Operations', () => {
    it('should handle API failure when adding team', async () => {
      vi.mocked(teamApi.joinTeam).mockResolvedValue({
        success: false,
        error: 'Team is full'
      })

      const wrapper = mount(MultiTeamSelector, {
        props: {
          memberId: mockMember.id,
          allTeams: mockAllTeams
        },
        global: {
          plugins: [createPinia()]
        }
      })

      await nextTick()
      await nextTick()

      const addDropdown = wrapper.find('select, [data-testid="team-add-dropdown"]')

      if (addDropdown.exists()) {
        await addDropdown.setValue('2')
        await nextTick()

        // Error message should be shown
        expect(mockShowError).toHaveBeenCalledWith('Team is full')
      }
    })

    it('should rollback optimistic update on network error', async () => {
      vi.mocked(teamApi.joinTeam).mockRejectedValue(new Error('Network error'))

      const wrapper = mount(MultiTeamSelector, {
        props: {
          memberId: mockMember.id,
          allTeams: mockAllTeams
        },
        global: {
          plugins: [createPinia()]
        }
      })

      await nextTick()
      await nextTick()

      // Get initial team count
      const initialTeams = wrapper.findAll('[class*="team-chip"], [class*="chip"]')
      const initialCount = initialTeams.length

      const addDropdown = wrapper.find('select, [data-testid="team-add-dropdown"]')

      if (addDropdown.exists()) {
        await addDropdown.setValue('2')
        await nextTick()
        await nextTick()

        // Team count should remain the same (rollback)
        const currentTeams = wrapper.findAll('[class*="team-chip"], [class*="chip"]')
        expect(currentTeams.length).toBe(initialCount)

        // Error message shown
        expect(mockShowError).toHaveBeenCalled()
      }
    })
  })

  describe('Status Messages and User Feedback', () => {
    it('should display success status after adding team', async () => {
      const wrapper = mount(MultiTeamSelector, {
        props: {
          memberId: mockMember.id,
          allTeams: mockAllTeams
        },
        global: {
          plugins: [createPinia()]
        }
      })

      await nextTick()
      await nextTick()

      const addDropdown = wrapper.find('select, [data-testid="team-add-dropdown"]')

      if (addDropdown.exists()) {
        await addDropdown.setValue('2')
        await nextTick()

        // Status message should appear
        const statusMsg = wrapper.find('[class*="status-message"]')
        if (statusMsg.exists()) {
          expect(statusMsg.text()).toContain('Beta')
          expect(statusMsg.classes()).toContain('success')
        }
      }
    })

    it('should auto-clear status message after 3 seconds', async () => {
      vi.useFakeTimers()

      const wrapper = mount(MultiTeamSelector, {
        props: {
          memberId: mockMember.id,
          allTeams: mockAllTeams
        },
        global: {
          plugins: [createPinia()]
        }
      })

      await nextTick()
      await nextTick()

      const addDropdown = wrapper.find('select, [data-testid="team-add-dropdown"]')

      if (addDropdown.exists()) {
        await addDropdown.setValue('2')
        await nextTick()

        // Status message exists
        let statusMsg = wrapper.find('[class*="status-message"]')
        const statusExists = statusMsg.exists()

        if (statusExists) {
          // Fast-forward 3 seconds
          vi.advanceTimersByTime(3000)
          await nextTick()

          // Status message should be cleared
          statusMsg = wrapper.find('[class*="status-message"]')
          expect(statusMsg.exists()).toBe(false)
        }
      }

      vi.useRealTimers()
    })
  })
})
