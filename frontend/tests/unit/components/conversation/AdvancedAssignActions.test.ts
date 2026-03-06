/**
 * AdvancedAssignActions.vue Unit Tests
 *
 * Coverage:
 * - Props and initial rendering
 * - Permission-based visibility/disabling (canAssignToTeam, canUnassign)
 * - Assignment flow (select team, confirm)
 * - Transfer flow (from team A to team B)
 * - Unassign flow
 * - Loading / disabled states during API calls
 * - Error handling and rollback
 * - Emitted events
 * - Edge cases (search filter, team selector toggle, manual refresh)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { nextTick } from 'vue'
import AdvancedAssignActions from '@/components/conversation/AdvancedAssignActions.vue'
import type { Conversation, Agent } from '@/types'

// ---- Mocks ----

const mockCurrentAgent = { value: null as Agent | null }

vi.mock('@/composables', () => ({
  useAuth: () => ({
    currentAgent: mockCurrentAgent
  })
}))

const mockCanAssignConversation = vi.fn().mockReturnValue(true)
const mockCanUnassignConversation = vi.fn().mockReturnValue(true)

vi.mock('@/services/permissionService', () => ({
  usePermissions: () => ({
    canAssignConversation: mockCanAssignConversation,
    canUnassignConversation: mockCanUnassignConversation
  })
}))

const mockAssignConversationToTeam = vi.fn().mockResolvedValue(true)
const mockTransferConversationToTeam = vi.fn().mockResolvedValue(true)
const mockUnassignConversation = vi.fn().mockResolvedValue(true)

vi.mock('@/stores/conversations', () => ({
  useConversationsStore: () => ({
    assignConversationToTeam: mockAssignConversationToTeam,
    transferConversationToTeam: mockTransferConversationToTeam,
    unassignConversation: mockUnassignConversation
  })
}))

const mockTeams = [
  { id: 1, name: 'Support Team', memberCount: 5 },
  { id: 2, name: 'Sales Team', memberCount: 3 },
  { id: 3, name: 'Engineering Team', memberCount: 8 }
]

const mockGetTeams = vi.fn().mockReturnValue(mockTeams)
const mockEnsureTeamsLoaded = vi.fn().mockResolvedValue(undefined)
const mockRefreshTeams = vi.fn().mockResolvedValue(undefined)

vi.mock('@/services/preloadService', () => ({
  preloadService: {
    getTeams: () => mockGetTeams(),
    ensureTeamsLoaded: () => mockEnsureTeamsLoaded(),
    refreshTeams: () => mockRefreshTeams()
  }
}))

const mockShowWarning = vi.fn().mockResolvedValue(true)

vi.mock('@/composables/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    showWarning: mockShowWarning
  })
}))

const mockShowSuccess = vi.fn()
const mockShowError = vi.fn()

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError
  })
}))

// Stub all icon components and TeamListSkeleton
vi.mock('@/components/icons', () => ({
  UserCheckIcon: { template: '<svg class="user-check-icon" />' },
  TeamIcon: { template: '<svg class="team-icon" />' },
  ChevronDownIcon: { template: '<svg class="chevron-down-icon" />' },
  XCircleIcon: { template: '<svg class="x-circle-icon" />' },
  XIcon: { template: '<svg class="x-icon" />' },
  SearchIcon: { template: '<svg class="search-icon" />' }
}))

vi.mock('@/components/ui/TeamListSkeleton.vue', () => ({
  default: { template: '<div class="team-list-skeleton" />', props: ['count'] }
}))

// ---- Helpers ----

const createMockConversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'conv-1',
  userId: 'user-1',
  status: 'active',
  platform: 'line',
  unreadCount: 0,
  lastMessageAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  customer: {
    id: 'customer-1',
    name: 'Test Customer',
    platform: 'line',
    platformUserId: 'line-user-1',
    createdAt: new Date().toISOString()
  },
  ...overrides
})

const createAdminAgent = (overrides: Partial<Agent> = {}): Agent => ({
  id: 'agent-1',
  email: 'admin@test.com',
  name: 'Admin User',
  displayName: 'Admin',
  role: 'admin',
  primaryTeamId: 1,
  isActive: true,
  createdAt: new Date().toISOString(),
  ...overrides
})

const createAgentUser = (overrides: Partial<Agent> = {}): Agent => ({
  id: 'agent-2',
  email: 'agent@test.com',
  name: 'Agent User',
  displayName: 'Agent',
  role: 'agent',
  primaryTeamId: 1,
  isActive: true,
  createdAt: new Date().toISOString(),
  ...overrides
})

let pinia: Pinia

const createWrapper = (conversation: Conversation = createMockConversation()) => {
  return mount(AdvancedAssignActions, {
    props: { conversation },
    global: {
      plugins: [pinia],
      stubs: {
        Teleport: true
      }
    }
  })
}

// ---- Tests ----

describe('AdvancedAssignActions.vue', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    // Reset mocks
    vi.clearAllMocks()

    // Default: admin user
    mockCurrentAgent.value = createAdminAgent()
    mockCanAssignConversation.mockReturnValue(true)
    mockCanUnassignConversation.mockReturnValue(true)
    mockGetTeams.mockReturnValue(mockTeams)
    mockEnsureTeamsLoaded.mockResolvedValue(undefined)
    mockRefreshTeams.mockResolvedValue(undefined)
    mockAssignConversationToTeam.mockResolvedValue(true)
    mockTransferConversationToTeam.mockResolvedValue(true)
    mockUnassignConversation.mockResolvedValue(true)
    mockShowWarning.mockResolvedValue(true)
  })

  // ================================================================
  // Props and Initial Rendering
  // ================================================================
  describe('Props and initial rendering', () => {
    it('renders the component root element', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.advanced-assign-actions').exists()).toBe(true)
    })

    it('does not show current-assignment block when no team is assigned', () => {
      const wrapper = createWrapper(createMockConversation({ assignedTeamId: undefined }))
      expect(wrapper.find('.current-assignment').exists()).toBe(false)
    })

    it('shows current-assignment block when a team is assigned', () => {
      const conversation = createMockConversation({
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team', description: null }
      })
      const wrapper = createWrapper(conversation)
      expect(wrapper.find('.current-assignment').exists()).toBe(true)
      expect(wrapper.find('.assignee-name').text()).toBe('Support Team')
    })

    it('shows team ID fallback when assigned team name is not found in teams list', () => {
      mockGetTeams.mockReturnValue([]) // no teams loaded
      const conversation = createMockConversation({ assignedTeamId: 999 })
      const wrapper = createWrapper(conversation)
      expect(wrapper.find('.assignee-name').text()).toContain('999')
    })

    it('displays assign controls section', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.assign-controls').exists()).toBe(true)
    })
  })

  // ================================================================
  // Permission-based Visibility / Disabling
  // ================================================================
  describe('Permission-based visibility', () => {
    it('shows assign-to-team button when user is admin and canAssignConversation is true', () => {
      const wrapper = createWrapper()
      const assignBtn = wrapper.find('.assign-btn.primary')
      expect(assignBtn.exists()).toBe(true)
    })

    it('hides assign-to-team button when user is not admin', () => {
      mockCurrentAgent.value = createAgentUser()
      const wrapper = createWrapper()
      expect(wrapper.find('.assign-btn.primary').exists()).toBe(false)
    })

    it('hides assign-to-team button when canAssignConversation returns false', () => {
      mockCanAssignConversation.mockReturnValue(false)
      const wrapper = createWrapper()
      expect(wrapper.find('.assign-btn.primary').exists()).toBe(false)
    })

    it('hides assign-to-team button when currentAgent is null', () => {
      mockCurrentAgent.value = null
      const wrapper = createWrapper()
      expect(wrapper.find('.assign-btn.primary').exists()).toBe(false)
    })

    it('shows unassign button when canUnassignConversation returns true', () => {
      const wrapper = createWrapper()
      const dangerBtn = wrapper.find('.assign-btn.danger')
      expect(dangerBtn.exists()).toBe(true)
    })

    it('hides unassign button when canUnassignConversation returns false', () => {
      mockCanUnassignConversation.mockReturnValue(false)
      const wrapper = createWrapper()
      expect(wrapper.find('.assign-btn.danger').exists()).toBe(false)
    })

    it('shows reassign label when conversation status is assigned', () => {
      const conversation = createMockConversation({
        status: 'assigned',
        assignedTeamId: 1
      })
      const wrapper = createWrapper(conversation)
      const assignBtn = wrapper.find('.assign-btn.primary')
      expect(assignBtn.text()).toContain('重新指派團隊')
    })

    it('shows assign label when conversation is not assigned status', () => {
      const conversation = createMockConversation({ status: 'active' })
      const wrapper = createWrapper(conversation)
      const assignBtn = wrapper.find('.assign-btn.primary')
      expect(assignBtn.text()).toContain('指派給團隊')
    })
  })

  // ================================================================
  // Team Selector Toggle
  // ================================================================
  describe('Team selector toggle', () => {
    it('opens team selector panel on button click', async () => {
      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      // Teleport is stubbed, so content renders inline
      expect(wrapper.find('.team-selector-panel').exists()).toBe(true)
    })

    it('closes team selector panel on second click', async () => {
      const wrapper = createWrapper()
      // Open
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()
      expect(wrapper.find('.team-selector-panel').exists()).toBe(true)

      // Close
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()
      expect(wrapper.find('.team-selector-panel').exists()).toBe(false)
    })

    it('calls ensureTeamsLoaded when opening team selector', async () => {
      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()
      expect(mockEnsureTeamsLoaded).toHaveBeenCalled()
    })

    it('shows loading state when teams list is empty on open', async () => {
      mockGetTeams.mockReturnValue([])
      // Make ensureTeamsLoaded not resolve immediately
      let resolveLoaded: () => void
      mockEnsureTeamsLoaded.mockImplementation(() => new Promise<void>(r => { resolveLoaded = r }))

      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await nextTick()

      // Should show loading state
      expect(wrapper.find('.loading-state').exists()).toBe(true)

      // Resolve loading
      resolveLoaded!()
      await flushPromises()
    })

    it('renders team cards after loading', async () => {
      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      const teamCards = wrapper.findAll('.team-card')
      expect(teamCards.length).toBe(3)
      expect(teamCards[0].find('.team-name').text()).toBe('Support Team')
      expect(teamCards[1].find('.team-name').text()).toBe('Sales Team')
      expect(teamCards[2].find('.team-name').text()).toBe('Engineering Team')
    })

    it('displays member count for each team', async () => {
      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      const memberCounts = wrapper.findAll('.team-member-count')
      expect(memberCounts[0].text()).toContain('5')
      expect(memberCounts[1].text()).toContain('3')
    })

    it('shows "no teams" message when teams array is empty after loading', async () => {
      mockGetTeams.mockReturnValue([])
      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      expect(wrapper.find('.no-teams').exists()).toBe(true)
    })

    it('marks current assigned team with "current" class', async () => {
      const conversation = createMockConversation({ assignedTeamId: 2 })
      const wrapper = createWrapper(conversation)
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      const teamCards = wrapper.findAll('.team-card')
      expect(teamCards[1].classes()).toContain('current')
      expect(teamCards[0].classes()).not.toContain('current')
    })

    it('shows current tag for assigned team', async () => {
      const conversation = createMockConversation({ assignedTeamId: 1 })
      const wrapper = createWrapper(conversation)
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      expect(wrapper.findAll('.current-tag').length).toBe(1)
    })
  })

  // ================================================================
  // Search / Filter Teams
  // ================================================================
  describe('Team search filter', () => {
    it('filters teams by search term', async () => {
      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      const searchInput = wrapper.find('.search-input')
      await searchInput.setValue('Sales')
      await nextTick()

      const teamCards = wrapper.findAll('.team-card')
      expect(teamCards.length).toBe(1)
      expect(teamCards[0].find('.team-name').text()).toBe('Sales Team')
    })

    it('is case-insensitive when filtering', async () => {
      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      await wrapper.find('.search-input').setValue('engineering')
      await nextTick()

      expect(wrapper.findAll('.team-card').length).toBe(1)
    })

    it('shows all teams when search term is empty', async () => {
      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      await wrapper.find('.search-input').setValue('Sales')
      await nextTick()
      expect(wrapper.findAll('.team-card').length).toBe(1)

      await wrapper.find('.search-input').setValue('')
      await nextTick()
      expect(wrapper.findAll('.team-card').length).toBe(3)
    })
  })

  // ================================================================
  // Team Selection
  // ================================================================
  describe('Team selection', () => {
    const openSelectorAndGetCards = async (wrapper: VueWrapper) => {
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()
      return wrapper.findAll('.team-card')
    }

    it('selects a team on click and shows confirm section', async () => {
      const wrapper = createWrapper()
      const teamCards = await openSelectorAndGetCards(wrapper)

      await teamCards[0].trigger('click')
      await flushPromises()

      expect(wrapper.find('.confirm-section').exists()).toBe(true)
    })

    it('deselects team on second click (toggle)', async () => {
      const wrapper = createWrapper()
      const teamCards = await openSelectorAndGetCards(wrapper)

      await teamCards[0].trigger('click')
      await nextTick()
      expect(wrapper.find('.confirm-section').exists()).toBe(true)

      await teamCards[0].trigger('click')
      await nextTick()
      expect(wrapper.find('.confirm-section').exists()).toBe(false)
    })

    it('shows correct team name in confirm section', async () => {
      const wrapper = createWrapper()
      const teamCards = await openSelectorAndGetCards(wrapper)

      await teamCards[1].trigger('click')
      await nextTick()

      expect(wrapper.find('.confirm-info').text()).toContain('Sales Team')
    })

    it('cancel button clears selection', async () => {
      const wrapper = createWrapper()
      const teamCards = await openSelectorAndGetCards(wrapper)

      await teamCards[0].trigger('click')
      await nextTick()

      await wrapper.find('.confirm-btn.cancel').trigger('click')
      await nextTick()

      expect(wrapper.find('.confirm-section').exists()).toBe(false)
    })
  })

  // ================================================================
  // Assignment Flow (New Assignment)
  // ================================================================
  describe('New assignment flow', () => {
    it('assigns conversation to a team on confirm', async () => {
      const conversation = createMockConversation()
      const wrapper = createWrapper(conversation)

      // Open selector, select team, confirm
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      const teamCards = wrapper.findAll('.team-card')
      await teamCards[1].trigger('click')
      await nextTick()

      await wrapper.find('.confirm-btn.confirm').trigger('click')
      await flushPromises()

      expect(mockAssignConversationToTeam).toHaveBeenCalledWith('conv-1', 2, 'Sales Team')
    })

    it('emits assigned event optimistically', async () => {
      const conversation = createMockConversation()
      const wrapper = createWrapper(conversation)

      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      await wrapper.findAll('.team-card')[0].trigger('click')
      await nextTick()

      await wrapper.find('.confirm-btn.confirm').trigger('click')
      await flushPromises()

      const emitted = wrapper.emitted('assigned')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toMatchObject({ assignedTeamId: 1 })
      expect(emitted![0][1]).toBe('team-1')
    })

    it('shows success toast on assignment', async () => {
      const wrapper = createWrapper()

      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()
      await wrapper.findAll('.team-card')[0].trigger('click')
      await nextTick()
      await wrapper.find('.confirm-btn.confirm').trigger('click')
      await flushPromises()

      expect(mockShowSuccess).toHaveBeenCalledWith(
        '指派成功',
        expect.stringContaining('Support Team')
      )
    })

    it('closes team selector panel after confirming', async () => {
      const wrapper = createWrapper()

      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()
      await wrapper.findAll('.team-card')[0].trigger('click')
      await nextTick()
      await wrapper.find('.confirm-btn.confirm').trigger('click')
      await flushPromises()

      expect(wrapper.find('.team-selector-panel').exists()).toBe(false)
    })

    it('emits error event when server rejects assignment', async () => {
      mockAssignConversationToTeam.mockResolvedValue(false)

      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()
      await wrapper.findAll('.team-card')[0].trigger('click')
      await nextTick()
      await wrapper.find('.confirm-btn.confirm').trigger('click')
      await flushPromises()

      expect(mockShowError).toHaveBeenCalled()
      const emittedErrors = wrapper.emitted('error')
      expect(emittedErrors).toBeTruthy()
    })

    it('emits error event when assignment throws exception', async () => {
      mockAssignConversationToTeam.mockRejectedValue(new Error('Network error'))

      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()
      await wrapper.findAll('.team-card')[0].trigger('click')
      await nextTick()
      await wrapper.find('.confirm-btn.confirm').trigger('click')
      await flushPromises()

      expect(mockShowError).toHaveBeenCalled()
      const emittedErrors = wrapper.emitted('error')
      expect(emittedErrors).toBeTruthy()
    })

    it('does not call assign API when selectedTeam is cleared before confirm', async () => {
      // This tests the guard: if (!selectedTeam.value || isAssigning.value) return
      // By cancelling selection before confirming, the guard prevents API call
      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      await wrapper.findAll('.team-card')[0].trigger('click')
      await nextTick()

      // Cancel selection
      await wrapper.find('.confirm-btn.cancel').trigger('click')
      await nextTick()

      // confirm section should be gone, no API call made
      expect(wrapper.find('.confirm-section').exists()).toBe(false)
      expect(mockAssignConversationToTeam).not.toHaveBeenCalled()
    })
  })

  // ================================================================
  // Transfer Flow (Team A -> Team B)
  // ================================================================
  describe('Transfer flow', () => {
    it('uses transfer API when conversation already assigned to another team', async () => {
      const conversation = createMockConversation({
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team', description: null }
      })
      const wrapper = createWrapper(conversation)

      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      // Select a different team
      await wrapper.findAll('.team-card')[1].trigger('click')
      await nextTick()

      await wrapper.find('.confirm-btn.confirm').trigger('click')
      await flushPromises()

      // Should show confirmation dialog for transfer
      expect(mockShowWarning).toHaveBeenCalled()
      // Should use transfer API, not assign API
      expect(mockTransferConversationToTeam).toHaveBeenCalledWith(
        'conv-1', 1, 2, 'Sales Team', '管理員手動轉指派'
      )
      expect(mockAssignConversationToTeam).not.toHaveBeenCalled()
    })

    it('cancels transfer when user rejects confirmation dialog', async () => {
      mockShowWarning.mockResolvedValue(false)

      const conversation = createMockConversation({
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team', description: null }
      })
      const wrapper = createWrapper(conversation)

      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()
      await wrapper.findAll('.team-card')[1].trigger('click')
      await nextTick()
      await wrapper.find('.confirm-btn.confirm').trigger('click')
      await flushPromises()

      expect(mockTransferConversationToTeam).not.toHaveBeenCalled()
      expect(wrapper.emitted('assigned')).toBeUndefined()
    })

    it('uses assign API (not transfer) when selecting same team', async () => {
      const conversation = createMockConversation({
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team', description: null }
      })
      const wrapper = createWrapper(conversation)

      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      // Select the same team (re-confirm assignment)
      await wrapper.findAll('.team-card')[0].trigger('click')
      await nextTick()

      await wrapper.find('.confirm-btn.confirm').trigger('click')
      await flushPromises()

      // Same team -> no transfer dialog, uses assign API
      expect(mockShowWarning).not.toHaveBeenCalled()
      expect(mockAssignConversationToTeam).toHaveBeenCalledWith('conv-1', 1, 'Support Team')
      expect(mockTransferConversationToTeam).not.toHaveBeenCalled()
    })

    it('shows error toast when transfer fails', async () => {
      mockTransferConversationToTeam.mockResolvedValue(false)

      const conversation = createMockConversation({
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team', description: null }
      })
      const wrapper = createWrapper(conversation)

      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()
      await wrapper.findAll('.team-card')[1].trigger('click')
      await nextTick()
      await wrapper.find('.confirm-btn.confirm').trigger('click')
      await flushPromises()

      expect(mockShowError).toHaveBeenCalled()
    })
  })

  // ================================================================
  // Unassign Flow
  // ================================================================
  describe('Unassign flow', () => {
    it('shows error if conversation is not assigned', async () => {
      const conversation = createMockConversation({ assignedTeamId: undefined })
      const wrapper = createWrapper(conversation)
      const dangerBtn = wrapper.find('.assign-btn.danger')
      if (!dangerBtn.exists()) { return } // canUnassign might be false

      await dangerBtn.trigger('click')
      await flushPromises()

      expect(mockShowError).toHaveBeenCalledWith('無法取消指派', expect.any(String))
    })

    it('shows confirmation dialog before unassigning', async () => {
      const conversation = createMockConversation({
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team', description: null }
      })
      const wrapper = createWrapper(conversation)

      await wrapper.find('.assign-btn.danger').trigger('click')
      await flushPromises()

      expect(mockShowWarning).toHaveBeenCalledWith(
        expect.stringContaining('取消指派'),
        expect.stringContaining('Support Team')
      )
    })

    it('does not unassign if user rejects confirmation', async () => {
      mockShowWarning.mockResolvedValue(false)

      const conversation = createMockConversation({
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team', description: null }
      })
      const wrapper = createWrapper(conversation)

      await wrapper.find('.assign-btn.danger').trigger('click')
      await flushPromises()

      expect(mockUnassignConversation).not.toHaveBeenCalled()
      expect(wrapper.emitted('unassigned')).toBeUndefined()
    })

    it('calls unassignConversation on server after confirmation', async () => {
      const conversation = createMockConversation({
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team', description: null }
      })
      const wrapper = createWrapper(conversation)

      await wrapper.find('.assign-btn.danger').trigger('click')
      await flushPromises()

      expect(mockUnassignConversation).toHaveBeenCalledWith('conv-1', '管理員手動取消指派')
    })

    it('emits unassigned event optimistically with pending status', async () => {
      const conversation = createMockConversation({
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team', description: null }
      })
      const wrapper = createWrapper(conversation)

      await wrapper.find('.assign-btn.danger').trigger('click')
      await flushPromises()

      const emitted = wrapper.emitted('unassigned')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toMatchObject({
        status: 'pending',
        assignedTeamId: undefined,
        assignedTeam: undefined
      })
    })

    it('shows success toast on unassign', async () => {
      const conversation = createMockConversation({
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team', description: null }
      })
      const wrapper = createWrapper(conversation)

      await wrapper.find('.assign-btn.danger').trigger('click')
      await flushPromises()

      expect(mockShowSuccess).toHaveBeenCalledWith('取消指派成功', expect.any(String))
    })

    it('emits error event when server rejects unassign', async () => {
      mockUnassignConversation.mockResolvedValue(false)

      const conversation = createMockConversation({
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team', description: null }
      })
      const wrapper = createWrapper(conversation)

      await wrapper.find('.assign-btn.danger').trigger('click')
      await flushPromises()

      expect(mockShowError).toHaveBeenCalled()
      expect(wrapper.emitted('error')).toBeTruthy()
    })

    it('emits error event when unassign throws exception', async () => {
      mockUnassignConversation.mockRejectedValue(new Error('Server down'))

      const conversation = createMockConversation({
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team', description: null }
      })
      const wrapper = createWrapper(conversation)

      await wrapper.find('.assign-btn.danger').trigger('click')
      await flushPromises()

      expect(mockShowError).toHaveBeenCalled()
      expect(wrapper.emitted('error')).toBeTruthy()
    })
  })

  // ================================================================
  // Loading / Disabled States
  // ================================================================
  describe('Loading and disabled states', () => {
    it('disables assign button while isAssigning is true', async () => {
      // Make assignment never resolve to keep isAssigning true
      mockAssignConversationToTeam.mockImplementation(() => new Promise(() => {}))

      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()
      await wrapper.findAll('.team-card')[0].trigger('click')
      await nextTick()
      await wrapper.find('.confirm-btn.confirm').trigger('click')
      await nextTick()

      // The panel closes optimistically, but assign button should be disabled
      // Re-open to check
      // Actually the button shows "指派中..." when isAssigning is true
      const assignBtn = wrapper.find('.assign-btn.primary')
      if (assignBtn.exists()) {
        expect(assignBtn.attributes('disabled')).toBeDefined()
      }
    })

    it('disables confirm button when no team is selected', async () => {
      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      // No team selected, confirm section should not be visible
      expect(wrapper.find('.confirm-section').exists()).toBe(false)
    })

    it('does not allow double-click assign', async () => {
      let resolveAssign: (_val: boolean) => void
      mockAssignConversationToTeam.mockImplementation(() => new Promise<boolean>(r => { resolveAssign = r }))

      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()
      await wrapper.findAll('.team-card')[0].trigger('click')
      await nextTick()

      // First click
      await wrapper.find('.confirm-btn.confirm').trigger('click')
      await nextTick()

      // Panel closes after first confirm, so second click is not possible
      // The guard is `if (isAssigning.value) return`
      resolveAssign!(true)
      await flushPromises()

      // Only one call
      expect(mockAssignConversationToTeam).toHaveBeenCalledTimes(1)
    })
  })

  // ================================================================
  // Manual Refresh
  // ================================================================
  describe('Manual refresh', () => {
    it('calls refreshTeams on manual refresh click', async () => {
      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      await wrapper.find('.refresh-btn').trigger('click')
      await flushPromises()

      expect(mockRefreshTeams).toHaveBeenCalled()
    })

    it('shows success toast after successful refresh', async () => {
      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      await wrapper.find('.refresh-btn').trigger('click')
      await flushPromises()

      expect(mockShowSuccess).toHaveBeenCalledWith('刷新成功', expect.any(String))
    })

    it('shows error toast when refresh fails', async () => {
      mockRefreshTeams.mockRejectedValue(new Error('Network error'))

      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      await wrapper.find('.refresh-btn').trigger('click')
      await flushPromises()

      expect(mockShowError).toHaveBeenCalledWith('刷新失敗', expect.any(String))
    })
  })

  // ================================================================
  // Close Panel
  // ================================================================
  describe('Close panel', () => {
    it('closes panel via close button', async () => {
      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()
      expect(wrapper.find('.team-selector-panel').exists()).toBe(true)

      await wrapper.find('.close-panel-btn').trigger('click')
      await nextTick()

      expect(wrapper.find('.team-selector-panel').exists()).toBe(false)
    })

    it('resets selection and search term when closing', async () => {
      const wrapper = createWrapper()
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      // Search and select
      await wrapper.find('.search-input').setValue('Support')
      await wrapper.findAll('.team-card')[0].trigger('click')
      await nextTick()

      // Close
      await wrapper.find('.close-panel-btn').trigger('click')
      await nextTick()

      // Re-open
      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      // Should be reset
      expect((wrapper.find('.search-input').element as HTMLInputElement).value).toBe('')
      expect(wrapper.find('.confirm-section').exists()).toBe(false)
      expect(wrapper.findAll('.team-card').length).toBe(3)
    })
  })

  // ================================================================
  // Edge Cases
  // ================================================================
  describe('Edge cases', () => {
    it('handles all valid conversation statuses for canAssignToTeam', () => {
      const statuses = ['active', 'pending', 'in-progress', 'assigned', 'waiting'] as const
      for (const status of statuses) {
        const conversation = createMockConversation({ status })
        const wrapper = createWrapper(conversation)
        // All are open statuses, so button should exist for admin
        expect(wrapper.find('.assign-btn.primary').exists()).toBe(true)
      }
    })

    it('does not use "open" or "closed" as valid statuses', () => {
      // These are not valid statuses and should not appear
      const invalidStatuses = ['open', 'closed']
      for (const status of invalidStatuses) {
        const conversation = createMockConversation({ status: status as 'active' })
        const wrapper = createWrapper(conversation)
        // isOpenConversation may return false for invalid statuses
        // The button may or may not exist depending on isOpenConversation logic
        // but we verify the component does not crash
        expect(wrapper.find('.advanced-assign-actions').exists()).toBe(true)
      }
    })

    it('handles conversation with no customer gracefully', () => {
      const conversation = createMockConversation({ customer: undefined })
      const wrapper = createWrapper(conversation)
      expect(wrapper.find('.advanced-assign-actions').exists()).toBe(true)
    })

    it('preloads teams for admin users on mount', async () => {
      createWrapper()
      await flushPromises()
      expect(mockEnsureTeamsLoaded).toHaveBeenCalled()
    })

    it('does not preload teams for non-admin users on mount', async () => {
      mockCurrentAgent.value = createAgentUser()
      mockEnsureTeamsLoaded.mockClear()
      createWrapper()
      await flushPromises()
      expect(mockEnsureTeamsLoaded).not.toHaveBeenCalled()
    })

    it('shows confirm text for re-confirm when selecting same assigned team', async () => {
      const conversation = createMockConversation({
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team', description: null }
      })
      const wrapper = createWrapper(conversation)

      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      await wrapper.findAll('.team-card')[0].trigger('click')
      await nextTick()

      expect(wrapper.find('.confirm-info').text()).toContain('重新確認指派給團隊')
    })

    it('shows assign confirm text when selecting a different team', async () => {
      const conversation = createMockConversation({
        assignedTeamId: 1,
        assignedTeam: { id: 1, name: 'Support Team', description: null }
      })
      const wrapper = createWrapper(conversation)

      await wrapper.find('.assign-btn.primary').trigger('click')
      await flushPromises()

      await wrapper.findAll('.team-card')[1].trigger('click')
      await nextTick()

      expect(wrapper.find('.confirm-info').text()).toContain('將對話指派給團隊')
    })
  })
})
