/**
 * BulkEditMemberModal Component - Unit Tests
 *
 * Tests for the bulk member editing modal component including:
 * - Rendering with different member counts
 * - Virtual scrolling threshold (10+ members)
 * - Button states (disabled when no changes/loading)
 * - Event emissions (close, saved)
 * - Member count display
 *
 * @module tests/unit/components/team/BulkEditMemberModal.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, type Ref } from 'vue'
import BulkEditMemberModal from '@/components/team/BulkEditMemberModal.vue'
import type { TeamMember, Team } from '@/types'
import { ROLES } from '@/constants/roles'

// ============================================================================
// Mock Dependencies
// ============================================================================

// Create actual Vue refs for mock state (these are created at module load time)
const mockMemberStates: Ref<Map<string, any>> = ref(new Map())
const mockIsLoading: Ref<boolean> = ref(false)
const mockHasAnyChanges: Ref<boolean> = ref(false)
const mockChangedMemberCount: Ref<number> = ref(0)
const mockIsAllFormsValid: Ref<boolean> = ref(true)

// Mock functions
const mockFns = {
  initializeMembers: vi.fn(),
  updateMemberForm: vi.fn(),
  addTeamToMember: vi.fn(),
  removeTeamFromMember: vi.fn(),
  initMemberTeams: vi.fn(),
  getDisplayTeams: vi.fn().mockReturnValue([]),
  isMemberDirty: vi.fn().mockReturnValue(false),
  isMemberValid: vi.fn().mockReturnValue(true),
  saveAllChanges: vi.fn().mockResolvedValue({
    success: true,
    updatedCount: 2,
    errors: [],
    undoToken: 'undo-token-123',
    undoExpiresAt: '2024-01-01T00:01:00Z'
  }),
  reset: vi.fn()
}

vi.mock('@/composables/team-management/useBulkMemberEdit', () => ({
  useBulkMemberEdit: () => ({
    memberStates: mockMemberStates,
    isLoading: mockIsLoading,
    hasAnyChanges: mockHasAnyChanges,
    changedMemberCount: mockChangedMemberCount,
    isAllFormsValid: mockIsAllFormsValid,
    ...mockFns
  })
}))

// Mock child components to simplify testing
vi.mock('@/components/ui/Modal.vue', () => ({
  default: {
    name: 'Modal',
    template: `
      <div v-if="show" class="mock-modal" data-testid="modal">
        <div class="modal-header">{{ title }}</div>
        <slot></slot>
        <div class="modal-footer"><slot name="footer"></slot></div>
      </div>
    `,
    props: ['show', 'title', 'size']
  }
}))

vi.mock('@/components/team/BulkMemberEditCard.vue', () => ({
  default: {
    name: 'BulkMemberEditCard',
    template: '<div class="mock-member-card" :data-member-id="member?.id">{{ member?.name }}</div>',
    props: ['member', 'formData', 'errors', 'pendingTeamChanges', 'displayTeams', 'allTeams', 'isDirty', 'currentUserId'],
    emits: ['update:field', 'add-team', 'remove-team', 'teams-loaded']
  }
}))

vi.mock('@/components/icons/UsersIcon.vue', () => ({
  default: {
    name: 'UsersIcon',
    template: '<span class="users-icon">Users</span>'
  }
}))

vi.mock('@/components/icons/WarningIcon.vue', () => ({
  default: {
    name: 'WarningIcon',
    template: '<span class="warning-icon">Warning</span>'
  }
}))

// Mock useVirtualizer for virtual scrolling tests
const mockVirtualizer = {
  getTotalSize: vi.fn().mockReturnValue(1000),
  getVirtualItems: vi.fn().mockReturnValue([]),
  measureElement: vi.fn()
}

vi.mock('@tanstack/vue-virtual', () => ({
  useVirtualizer: () => mockVirtualizer
}))

// ============================================================================
// Test Data
// ============================================================================

const createMockMember = (overrides: Partial<TeamMember> = {}): TeamMember => ({
  id: `member-${Math.random().toString(36).substring(7)}`,
  loginId: 'test@example.com',
  name: 'Test Member',
  email: 'test@example.com',
  role: ROLES.AGENT,
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides
})

const createMockTeam = (overrides: Partial<Team> = {}): Team => ({
  id: 1,
  name: 'Test Team',
  status: 'active',
  description: 'Test description',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  memberCount: 5,
  ...overrides
})

const createMockMembers = (count: number): TeamMember[] =>
  Array.from({ length: count }, (_, i) =>
    createMockMember({
      id: `member-${i + 1}`,
      name: `Member ${i + 1}`,
      email: `member${i + 1}@example.com`
    })
  )

// ============================================================================
// Test Suite
// ============================================================================

describe('BulkEditMemberModal', () => {
  const defaultMembers = createMockMembers(3)
  const defaultProps = {
    visible: true,
    selectedMembers: defaultMembers,
    allTeams: [createMockTeam()],
    currentUserId: 'current-user-id'
  }

  /**
   * Helper to create member states map from members array
   */
  const createMemberStatesMap = (members: TeamMember[]) => {
    const statesMap = new Map()
    members.forEach(m => {
      statesMap.set(m.id, {
        memberId: m.id,
        originalMember: m,
        formData: { displayName: m.name || '', email: m.email || '', role: m.role as 'admin' | 'agent' },
        originalFormData: { displayName: m.name || '', email: m.email || '', role: m.role as 'admin' | 'agent' },
        currentTeams: [],
        pendingTeamChanges: [],
        errors: {},
        teamsLoaded: false
      })
    })
    return statesMap
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock ref values with proper member states
    mockMemberStates.value = createMemberStatesMap(defaultMembers)
    mockIsLoading.value = false
    mockHasAnyChanges.value = false
    mockChangedMemberCount.value = 0
    mockIsAllFormsValid.value = true
    // Reset mock function return values
    mockFns.saveAllChanges.mockResolvedValue({
      success: true,
      updatedCount: 2,
      errors: [],
      undoToken: 'undo-token-123',
      undoExpiresAt: '2024-01-01T00:01:00Z'
    })
  })

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe('Rendering', () => {
    it('should render when visible is true', () => {
      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      expect(wrapper.find('[data-testid="modal"]').exists()).toBe(true)
    })

    it('should not render when visible is false', () => {
      const wrapper = mount(BulkEditMemberModal, {
        props: { ...defaultProps, visible: false }
      })

      expect(wrapper.find('[data-testid="modal"]').exists()).toBe(false)
    })

    it('should display correct member count in summary', () => {
      const members = createMockMembers(5)
      mockMemberStates.value = createMemberStatesMap(members)

      const wrapper = mount(BulkEditMemberModal, {
        props: { ...defaultProps, selectedMembers: members }
      })

      expect(wrapper.text()).toContain('5')
    })

    it('should show changes badge when members have changes', () => {
      // Changes badge only shows when changedMemberCount > 0
      mockChangedMemberCount.value = 3
      mockHasAnyChanges.value = true

      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      expect(wrapper.text()).toContain('3')
      // The badge shows "X 位有變更"
      expect(wrapper.text()).toContain('位有變更')
    })

    it('should show warning note about self-edit restriction', () => {
      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      expect(wrapper.text()).toContain('無法編輯自己的帳號')
    })
  })

  // ============================================================================
  // Virtual Scrolling Tests
  // ============================================================================

  describe('Virtual Scrolling', () => {
    it('should NOT use virtual scrolling for less than 10 members', () => {
      const members = createMockMembers(5)
      mockMemberStates.value = createMemberStatesMap(members)

      const wrapper = mount(BulkEditMemberModal, {
        props: { ...defaultProps, selectedMembers: members }
      })

      // Should not have virtual-scroll class
      expect(wrapper.find('.members-list-container.virtual-scroll').exists()).toBe(false)
      // Should not show virtual badge
      expect(wrapper.find('.virtual-badge').exists()).toBe(false)
    })

    it('should use virtual scrolling for 10 or more members', () => {
      const members = createMockMembers(10)
      mockMemberStates.value = createMemberStatesMap(members)

      const wrapper = mount(BulkEditMemberModal, {
        props: { ...defaultProps, selectedMembers: members }
      })

      // Should have virtual-scroll class
      expect(wrapper.find('.members-list-container.virtual-scroll').exists()).toBe(true)
      // Should show virtual badge
      expect(wrapper.find('.virtual-badge').exists()).toBe(true)
    })

    it('should show virtual scroll badge text when enabled', () => {
      const members = createMockMembers(15)
      mockMemberStates.value = createMemberStatesMap(members)

      const wrapper = mount(BulkEditMemberModal, {
        props: { ...defaultProps, selectedMembers: members }
      })

      expect(wrapper.text()).toContain('虛擬滾動已啟用')
    })
  })

  // ============================================================================
  // Button State Tests
  // ============================================================================

  describe('Button States', () => {
    it('should disable save button when no changes', () => {
      mockHasAnyChanges.value = false

      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      const saveButton = wrapper.find('.btn-primary')
      expect(saveButton.attributes('disabled')).toBeDefined()
    })

    it('should disable save button when loading', () => {
      mockHasAnyChanges.value = true
      mockIsLoading.value = true

      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      const saveButton = wrapper.find('.btn-primary')
      expect(saveButton.attributes('disabled')).toBeDefined()
    })

    it('should disable save button when forms are invalid', () => {
      mockHasAnyChanges.value = true
      mockIsAllFormsValid.value = false

      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      const saveButton = wrapper.find('.btn-primary')
      expect(saveButton.attributes('disabled')).toBeDefined()
    })

    it('should enable save button when changes exist and forms are valid', () => {
      mockHasAnyChanges.value = true
      mockIsAllFormsValid.value = true
      mockIsLoading.value = false

      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      const saveButton = wrapper.find('.btn-primary')
      // When enabled, disabled attribute should not be present (returns undefined or empty string depending on browser)
      expect(saveButton.attributes('disabled')).toBeFalsy()
    })

    it('should show loading text on save button when loading', () => {
      mockIsLoading.value = true
      mockHasAnyChanges.value = true

      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      expect(wrapper.find('.btn-primary').text()).toContain('儲存中')
    })

    it('should show changed count on save button', () => {
      mockHasAnyChanges.value = true
      mockChangedMemberCount.value = 5
      mockIsLoading.value = false

      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      expect(wrapper.find('.btn-primary').text()).toContain('5')
    })
  })

  // ============================================================================
  // Event Tests
  // ============================================================================

  describe('Events', () => {
    it('should emit close when cancel button clicked', async () => {
      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      await wrapper.find('.btn-secondary').trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('should emit saved with payload when save succeeds', async () => {
      // Enable button by setting required states
      mockHasAnyChanges.value = true
      mockIsAllFormsValid.value = true
      mockIsLoading.value = false

      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      // Verify button is enabled before clicking
      const saveButton = wrapper.find('.btn-primary')
      expect(saveButton.attributes('disabled')).toBeFalsy()

      await saveButton.trigger('click')
      await flushPromises()

      expect(wrapper.emitted('saved')).toBeTruthy()
      const savedPayload = wrapper.emitted('saved')![0][0] as {
        updatedCount: number
        undoToken?: string
        undoExpiresAt?: string
      }
      expect(savedPayload.updatedCount).toBe(2)
      expect(savedPayload.undoToken).toBe('undo-token-123')
    })

    it('should emit close after successful save', async () => {
      // Enable button by setting required states
      mockHasAnyChanges.value = true
      mockIsAllFormsValid.value = true
      mockIsLoading.value = false

      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      // Verify button is enabled before clicking
      const saveButton = wrapper.find('.btn-primary')
      expect(saveButton.attributes('disabled')).toBeFalsy()

      await saveButton.trigger('click')
      await flushPromises()

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('should not emit saved when save returns 0 updated', async () => {
      // Enable button first
      mockHasAnyChanges.value = true
      mockIsAllFormsValid.value = true
      mockIsLoading.value = false
      mockFns.saveAllChanges.mockResolvedValueOnce({
        success: false,
        updatedCount: 0,
        errors: ['No changes']
      })

      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      await wrapper.find('.btn-primary').trigger('click')
      await flushPromises()

      expect(wrapper.emitted('saved')).toBeFalsy()
    })
  })

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should call initializeMembers when modal becomes visible', async () => {
      const wrapper = mount(BulkEditMemberModal, {
        props: { ...defaultProps, visible: false }
      })

      expect(mockFns.initializeMembers).not.toHaveBeenCalled()

      await wrapper.setProps({ visible: true })

      expect(mockFns.initializeMembers).toHaveBeenCalledWith(
        defaultProps.selectedMembers
      )
    })

    it('should call reset when modal becomes hidden', async () => {
      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      // Reset is called on initialization too, so clear it
      mockFns.reset.mockClear()

      await wrapper.setProps({ visible: false })

      expect(mockFns.reset).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Footer Info Tests
  // ============================================================================

  describe('Footer Info', () => {
    it('should show changes summary when changes exist', () => {
      mockHasAnyChanges.value = true
      mockChangedMemberCount.value = 3

      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      expect(wrapper.find('.changes-summary').exists()).toBe(true)
      expect(wrapper.text()).toContain('3 位成員有待儲存的變更')
    })

    it('should not show changes summary when no changes', () => {
      mockHasAnyChanges.value = false

      const wrapper = mount(BulkEditMemberModal, {
        props: defaultProps
      })

      expect(wrapper.find('.changes-summary').exists()).toBe(false)
    })
  })
})
