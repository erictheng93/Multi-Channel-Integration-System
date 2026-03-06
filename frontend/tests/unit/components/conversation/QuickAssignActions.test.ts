/**
 * QuickAssignActions.vue Unit Tests
 *
 * Coverage:
 * - Props and initial rendering
 * - Permission-based visibility (canAssignToMe, canAssignToOthers)
 * - Team assignment flow (assign to me, assign to member)
 * - Loading / disabled states
 * - Error handling (no teamId, API failure)
 * - Emitted events (assigned, error)
 * - Edge cases (already assigned to same team, no team members, member without team)
 * - Assign menu open/close and click outside
 * - Helper functions (getInitials, getRoleDisplayName)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { ref } from 'vue'
import QuickAssignActions from '@/components/conversation/QuickAssignActions.vue'
import type { Conversation, TeamMember } from '@/types'

// --- Mocks ---

const mockCurrentAgent = ref<Record<string, unknown> | null>(null)

vi.mock('@/composables', () => ({
  useAuth: () => ({
    currentAgent: mockCurrentAgent
  })
}))

const mockAssignConversationToTeam = vi.fn()

vi.mock('@/stores/conversations', () => ({
  useConversationsStore: () => ({
    assignConversationToTeam: mockAssignConversationToTeam
  })
}))

const mockCanAssignConversation = vi.fn().mockReturnValue(true)
const mockCanViewTeamMembers = vi.fn().mockReturnValue(true)

vi.mock('@/services/permissionService', () => ({
  usePermissions: () => ({
    canAssignConversation: mockCanAssignConversation,
    canViewTeamMembers: mockCanViewTeamMembers
  })
}))

const mockGetTeamMembers = vi.fn()

vi.mock('@/api/team', () => ({
  teamApi: {
    getTeamMembers: (...args: unknown[]) => mockGetTeamMembers(...args)
  }
}))

// Stub icon components
vi.mock('@/components/icons', () => ({
  UserPlusIcon: { template: '<svg class="user-plus-icon" />' },
  TeamIcon: { template: '<svg class="team-icon" />' },
  ChevronDownIcon: { template: '<svg class="chevron-down-icon" />' },
  XIcon: { template: '<svg class="x-icon" />' },
  UserCheckIcon: { template: '<svg class="user-check-icon" />' }
}))

vi.mock('@/components/ui/HamsterLoader.vue', () => ({
  default: { template: '<div class="hamster-loader"><slot /></div>', props: ['message'] }
}))

// --- Helpers ---

const NOW = new Date().toISOString()

function createConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    userId: 'user-1',
    status: 'active',
    platform: 'line',
    unreadCount: 0,
    lastMessageAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    customer: {
      id: 'customer-1',
      name: 'Test Customer',
      platform: 'line',
      platformUserId: 'line-user-1',
      createdAt: NOW
    },
    ...overrides
  }
}

function createAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agent-1',
    email: 'agent@test.com',
    name: 'Agent One',
    displayName: 'Agent One',
    role: 'agent',
    primaryTeamId: 1,
    isActive: true,
    createdAt: NOW,
    ...overrides
  }
}

function createTeamMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 'member-1',
    loginId: 'member@test.com',
    name: 'Member One',
    email: 'member@test.com',
    role: 'agent',
    status: 'active',
    primaryTeamId: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

let pinia: Pinia

function createWrapper(conversation: Conversation, compactMode = false) {
  return mount(QuickAssignActions, {
    props: { conversation, compactMode },
    global: {
      plugins: [pinia]
    }
  })
}

// --- Tests ---

describe('QuickAssignActions.vue', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    mockCurrentAgent.value = createAgent()
    mockCanAssignConversation.mockReturnValue(true)
    mockCanViewTeamMembers.mockReturnValue(true)
    mockAssignConversationToTeam.mockResolvedValue(true)
    mockGetTeamMembers.mockResolvedValue({
      success: true,
      data: [
        createTeamMember({ id: 'member-2', name: 'Member Two', loginId: 'member2@test.com', primaryTeamId: 3 }),
        createTeamMember({ id: 'member-3', name: 'Member Three', loginId: 'member3@test.com', role: 'agent', primaryTeamId: 4 })
      ]
    })
  })

  // -------------------------------------------------------
  // Rendering & Visibility
  // -------------------------------------------------------
  describe('rendering and visibility', () => {
    it('should render when conversation has an open status', () => {
      const statuses = ['active', 'pending', 'in-progress', 'assigned', 'waiting'] as const
      for (const status of statuses) {
        const wrapper = createWrapper(createConversation({ status }))
        expect(wrapper.find('div').exists()).toBe(true)
        wrapper.unmount()
      }
    })

    it('should NOT render when conversation has a non-open status', () => {
      // isOpenConversation returns false for unknown statuses
      const wrapper = createWrapper(createConversation({ status: 'resolved' as Conversation['status'] }))
      expect(wrapper.find('.assign-me-btn').exists()).toBe(false)
    })

    it('should apply compactMode classes', () => {
      const wrapper = createWrapper(createConversation(), true)
      const root = wrapper.find('div')
      expect(root.classes()).toContain('gap-1')
    })

    it('should apply default (non-compact) classes', () => {
      const wrapper = createWrapper(createConversation(), false)
      const root = wrapper.find('div')
      expect(root.classes()).toContain('gap-2')
    })
  })

  // -------------------------------------------------------
  // Permission-based visibility
  // -------------------------------------------------------
  describe('permission-based visibility', () => {
    it('should show "assign to me" button when canAssignConversation returns true', () => {
      const wrapper = createWrapper(createConversation())
      expect(wrapper.find('.assign-me-btn').exists()).toBe(true)
    })

    it('should hide "assign to me" button when canAssignConversation returns false', () => {
      mockCanAssignConversation.mockReturnValue(false)
      const wrapper = createWrapper(createConversation())
      expect(wrapper.find('.assign-me-btn').exists()).toBe(false)
    })

    it('should hide "assign to me" when conversation is already assigned to agent team', () => {
      mockCurrentAgent.value = createAgent({ primaryTeamId: 5 })
      const wrapper = createWrapper(createConversation({ assignedTeamId: 5 }))
      expect(wrapper.find('.assign-me-btn').exists()).toBe(false)
    })

    it('should hide "assign to me" when currentAgent is null', () => {
      mockCurrentAgent.value = null
      const wrapper = createWrapper(createConversation())
      expect(wrapper.find('.assign-me-btn').exists()).toBe(false)
    })

    it('should show "assign to others" button when both permissions are true', () => {
      const wrapper = createWrapper(createConversation())
      // The button with TeamIcon text
      expect(wrapper.text()).toContain('指派他人')
    })

    it('should hide "assign to others" when canViewTeamMembers is false', () => {
      mockCanViewTeamMembers.mockReturnValue(false)
      const wrapper = createWrapper(createConversation())
      expect(wrapper.text()).not.toContain('指派他人')
    })

    it('should hide "assign to others" when canAssignConversation is false', () => {
      mockCanAssignConversation.mockReturnValue(false)
      const wrapper = createWrapper(createConversation())
      expect(wrapper.text()).not.toContain('指派他人')
    })
  })

  // -------------------------------------------------------
  // Assign to me flow
  // -------------------------------------------------------
  describe('assign to me', () => {
    it('should call assignConversationToTeam with agent primaryTeamId', async () => {
      const conv = createConversation()
      const wrapper = createWrapper(conv)
      await wrapper.find('.assign-me-btn').trigger('click')
      await flushPromises()

      expect(mockAssignConversationToTeam).toHaveBeenCalledWith('conv-1', 1, '我的團隊')
    })

    it('should emit "assigned" on success', async () => {
      const conv = createConversation()
      const wrapper = createWrapper(conv)
      await wrapper.find('.assign-me-btn').trigger('click')
      await flushPromises()

      const emitted = wrapper.emitted('assigned')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toEqual(conv)
      expect(emitted![0][1]).toBe('1')
    })

    it('should emit "error" when store returns false', async () => {
      mockAssignConversationToTeam.mockResolvedValue(false)
      const wrapper = createWrapper(createConversation())
      await wrapper.find('.assign-me-btn').trigger('click')
      await flushPromises()

      const emitted = wrapper.emitted('error')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toContain('指派失敗')
    })

    it('should emit "error" when store throws', async () => {
      mockAssignConversationToTeam.mockRejectedValue(new Error('Network error'))
      const wrapper = createWrapper(createConversation())
      await wrapper.find('.assign-me-btn').trigger('click')
      await flushPromises()

      const emitted = wrapper.emitted('error')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toContain('指派過程中發生錯誤')
    })

    it('should emit "error" when agent has no primaryTeamId', async () => {
      // Set primaryTeamId to 0 (falsy but not undefined) so the button renders
      // since assignedTeamId (undefined) !== primaryTeamId (0)
      mockCurrentAgent.value = createAgent({ primaryTeamId: 0 })
      const wrapper = createWrapper(createConversation())
      await wrapper.find('.assign-me-btn').trigger('click')
      await flushPromises()

      const emitted = wrapper.emitted('error')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toContain('尚未加入任何團隊')
    })

    it('should show loading text while assigning', async () => {
      // Make the assign never resolve during this test
      let resolveAssign!: (_v: boolean) => void
      mockAssignConversationToTeam.mockReturnValue(new Promise(r => { resolveAssign = r }))

      const wrapper = createWrapper(createConversation())
      await wrapper.find('.assign-me-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.assign-me-btn').text()).toContain('指派中...')
      expect(wrapper.find('.assign-me-btn').attributes('disabled')).toBeDefined()

      // Resolve to clean up
      resolveAssign(true)
      await flushPromises()
    })

    it('should not trigger assign when already assigning', async () => {
      let resolveAssign!: (_v: boolean) => void
      mockAssignConversationToTeam.mockReturnValue(new Promise(r => { resolveAssign = r }))

      const wrapper = createWrapper(createConversation())
      await wrapper.find('.assign-me-btn').trigger('click')
      await wrapper.vm.$nextTick()

      // Click again while assigning
      await wrapper.find('.assign-me-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(mockAssignConversationToTeam).toHaveBeenCalledTimes(1)

      resolveAssign(true)
      await flushPromises()
    })
  })

  // -------------------------------------------------------
  // Assign to others (menu & member assignment)
  // -------------------------------------------------------
  describe('assign to others', () => {
    it('should open assign menu and load team members on click', async () => {
      const wrapper = createWrapper(createConversation())

      // Find "assign to others" button
      const buttons = wrapper.findAll('.quick-action-btn')
      const assignOthersBtn = buttons.find(b => b.text().includes('指派他人'))
      expect(assignOthersBtn).toBeTruthy()

      await assignOthersBtn!.trigger('click')
      await flushPromises()

      expect(mockGetTeamMembers).toHaveBeenCalledWith(1) // currentAgent.primaryTeamId
      expect(wrapper.find('.assign-menu').exists()).toBe(true)
      // Should show members (excluding current agent)
      expect(wrapper.text()).toContain('Member Two')
      expect(wrapper.text()).toContain('Member Three')
    })

    it('should show loading state while fetching team members', async () => {
      let resolveMembers!: (_v: unknown) => void
      mockGetTeamMembers.mockReturnValue(new Promise(r => { resolveMembers = r }))

      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.assign-menu').exists()).toBe(true)
      expect(wrapper.text()).toContain('載入團隊成員中...')

      resolveMembers({ success: true, data: [] })
      await flushPromises()
    })

    it('should show empty message when no members available', async () => {
      mockGetTeamMembers.mockResolvedValue({ success: true, data: [] })
      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('暫無可指派的成員')
    })

    it('should filter out current agent from team members list', async () => {
      mockGetTeamMembers.mockResolvedValue({
        success: true,
        data: [
          createTeamMember({ id: 'agent-1', name: 'Agent One (self)', role: 'agent' }),
          createTeamMember({ id: 'member-2', name: 'Other Agent', role: 'agent' })
        ]
      })

      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      expect(wrapper.text()).not.toContain('Agent One (self)')
      expect(wrapper.text()).toContain('Other Agent')
    })

    it('should filter out admin role members from team members list', async () => {
      mockGetTeamMembers.mockResolvedValue({
        success: true,
        data: [
          createTeamMember({ id: 'member-2', name: 'Admin User', role: 'admin' }),
          createTeamMember({ id: 'member-3', name: 'Agent User', role: 'agent' })
        ]
      })

      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      expect(wrapper.text()).not.toContain('Admin User')
      expect(wrapper.text()).toContain('Agent User')
    })

    it('should close assign menu via close button', async () => {
      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      expect(wrapper.find('.assign-menu').exists()).toBe(true)

      // Click X button
      const closeBtn = wrapper.find('.assign-menu button')
      await closeBtn.trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.assign-menu').exists()).toBe(false)
    })

    it('should toggle menu closed if already open', async () => {
      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))

      // Open
      await assignOthersBtn!.trigger('click')
      await flushPromises()
      expect(wrapper.find('.assign-menu').exists()).toBe(true)

      // Toggle closed
      await assignOthersBtn!.trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.assign-menu').exists()).toBe(false)
    })

    it('should assign to member team on member click', async () => {
      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      // Click the first team member item
      const memberItems = wrapper.findAll('.team-member-item')
      expect(memberItems.length).toBeGreaterThan(0)
      await memberItems[0].trigger('click')
      await flushPromises()

      expect(mockAssignConversationToTeam).toHaveBeenCalledWith(
        'conv-1',
        3, // Member Two's primaryTeamId
        'Member Two 的團隊'
      )

      const emitted = wrapper.emitted('assigned')
      expect(emitted).toBeTruthy()
      expect(emitted![0][1]).toBe('3')
    })

    it('should close menu after successful member assignment', async () => {
      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      const memberItems = wrapper.findAll('.team-member-item')
      await memberItems[0].trigger('click')
      await flushPromises()

      expect(wrapper.find('.assign-menu').exists()).toBe(false)
    })

    it('should emit "error" when member has no primaryTeamId', async () => {
      mockGetTeamMembers.mockResolvedValue({
        success: true,
        data: [
          createTeamMember({ id: 'member-2', name: 'No Team', role: 'agent', primaryTeamId: undefined })
        ]
      })

      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      const memberItems = wrapper.findAll('.team-member-item')
      await memberItems[0].trigger('click')
      await flushPromises()

      const emitted = wrapper.emitted('error')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toContain('尚未加入任何團隊')
    })

    it('should emit "error" when member assignment fails', async () => {
      mockAssignConversationToTeam.mockResolvedValue(false)
      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      const memberItems = wrapper.findAll('.team-member-item')
      await memberItems[0].trigger('click')
      await flushPromises()

      const emitted = wrapper.emitted('error')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toContain('指派給 Member Two 的團隊失敗')
    })

    it('should emit "error" when member assignment throws', async () => {
      mockAssignConversationToTeam.mockRejectedValue(new Error('API crash'))
      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      const memberItems = wrapper.findAll('.team-member-item')
      await memberItems[0].trigger('click')
      await flushPromises()

      const emitted = wrapper.emitted('error')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toContain('指派過程中發生錯誤')
    })

    it('should emit "error" when loading team members fails', async () => {
      mockGetTeamMembers.mockRejectedValue(new Error('Network'))
      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      const emitted = wrapper.emitted('error')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toContain('載入團隊成員失敗')
    })

    it('should not reload team members if already loaded', async () => {
      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))

      // Open and load
      await assignOthersBtn!.trigger('click')
      await flushPromises()
      expect(mockGetTeamMembers).toHaveBeenCalledTimes(1)

      // Close and reopen
      await assignOthersBtn!.trigger('click')
      await wrapper.vm.$nextTick()
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      // Should NOT call again since members were already loaded
      expect(mockGetTeamMembers).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------
  // Assigned status display
  // -------------------------------------------------------
  describe('assigned status display', () => {
    it('should show assigned team info for in-progress conversation with assignedTeam', () => {
      const wrapper = createWrapper(createConversation({
        status: 'in-progress',
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team' }
      }))

      expect(wrapper.text()).toContain('Support Team')
      expect(wrapper.find('.user-check-icon').exists()).toBe(true)
    })

    it('should not show assigned team info for non in-progress status', () => {
      const wrapper = createWrapper(createConversation({
        status: 'active',
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team' }
      }))

      // The assigned status badge should not appear for 'active' status
      const badge = wrapper.findAll('div').filter(d =>
        d.classes().some(c => c.includes('bg-green-50'))
      )
      // The component checks for CONVERSATION_STATUS.IN_PROGRESS specifically
      expect(badge.length).toBe(0)
    })
  })

  // -------------------------------------------------------
  // Helper functions (via template rendering)
  // -------------------------------------------------------
  describe('helper functions', () => {
    it('should display role names in Chinese', async () => {
      mockGetTeamMembers.mockResolvedValue({
        success: true,
        data: [
          createTeamMember({ id: 'member-2', name: 'Agent User', role: 'agent' })
        ]
      })

      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('客服專員')
    })

    it('should display initials from member name', async () => {
      mockGetTeamMembers.mockResolvedValue({
        success: true,
        data: [
          createTeamMember({ id: 'member-2', name: 'John Doe', role: 'agent' })
        ]
      })

      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      const avatar = wrapper.find('.member-avatar')
      expect(avatar.text()).toBe('JD')
    })

    it('should use loginId when name is not available', async () => {
      mockGetTeamMembers.mockResolvedValue({
        success: true,
        data: [
          createTeamMember({ id: 'member-2', name: undefined, loginId: 'user@test.com', role: 'agent' })
        ]
      })

      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('user@test.com')
    })
  })

  // -------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------
  describe('edge cases', () => {
    it('should not call loadTeamMembers when agent has no primaryTeamId', async () => {
      mockCurrentAgent.value = createAgent({ primaryTeamId: undefined })
      // canAssignConversation still true but canAssignToOthers checks separately
      const wrapper = createWrapper(createConversation())

      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      if (assignOthersBtn) {
        await assignOthersBtn.trigger('click')
        await flushPromises()
        // Should not call API since no primaryTeamId
        expect(mockGetTeamMembers).not.toHaveBeenCalled()
      }
    })

    it('should handle member with "team" role as assignable', async () => {
      mockGetTeamMembers.mockResolvedValue({
        success: true,
        data: [
          createTeamMember({ id: 'member-2', name: 'Team Lead', role: 'team' as TeamMember['role'], primaryTeamId: 5 })
        ]
      })

      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('Team Lead')
      expect(wrapper.text()).toContain('團隊主管')
    })

    it('should disable member items while assigning', async () => {
      let resolveAssign!: (_v: boolean) => void
      mockAssignConversationToTeam.mockReturnValue(new Promise(r => { resolveAssign = r }))

      const wrapper = createWrapper(createConversation())
      const assignOthersBtn = wrapper.findAll('.quick-action-btn').find(b => b.text().includes('指派他人'))
      await assignOthersBtn!.trigger('click')
      await flushPromises()

      const memberItems = wrapper.findAll('.team-member-item')
      await memberItems[0].trigger('click')
      await wrapper.vm.$nextTick()

      // All member items should be disabled
      const disabledItems = wrapper.findAll('.team-member-item[disabled]')
      expect(disabledItems.length).toBeGreaterThan(0)

      resolveAssign(true)
      await flushPromises()
    })

    it('should add and remove click outside listener on mount/unmount', () => {
      const addSpy = vi.spyOn(document, 'addEventListener')
      const removeSpy = vi.spyOn(document, 'removeEventListener')

      const wrapper = createWrapper(createConversation())
      expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function))

      wrapper.unmount()
      expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function))

      addSpy.mockRestore()
      removeSpy.mockRestore()
    })
  })
})
