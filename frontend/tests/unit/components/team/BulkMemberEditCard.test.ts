/**
 * BulkMemberEditCard Component - Unit Tests
 *
 * Tests for the individual member edit card component including:
 * - Rendering with different member states
 * - Avatar display (image vs initials)
 * - Form field interactions
 * - Self-edit prevention
 * - Event emissions
 * - Error styling
 * - Role-based UI (team section vs admin notice)
 *
 * @module tests/unit/components/team/BulkMemberEditCard.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import BulkMemberEditCard from '@/components/team/BulkMemberEditCard.vue'
import type { TeamMember, Team, AgentTeamMembership } from '@/types'
import type { BulkMemberEditState, PendingTeamChange } from '@/composables/team-management/useBulkMemberEdit'
import { ROLES } from '@/constants/roles'

// ============================================================================
// Mock Dependencies
// ============================================================================

vi.mock('@/components/team/multi-team/MultiTeamSelector.vue', () => ({
  default: {
    name: 'MultiTeamSelector',
    template: `
      <div class="mock-multi-team-selector" data-testid="multi-team-selector">
        <button @click="$emit('add-team', 1, 'Test Team')">Add Team</button>
        <button @click="$emit('remove-team', 1)">Remove Team</button>
        <button @click="$emit('teams-loaded', [])">Teams Loaded</button>
      </div>
    `,
    props: ['memberId', 'allTeams', 'deferredMode', 'teams', 'pendingChanges', 'loading', 'hideStatusMessage'],
    emits: ['add-team', 'remove-team', 'teams-loaded']
  }
}))

vi.mock('@/components/icons/WarningIcon.vue', () => ({
  default: {
    name: 'WarningIcon',
    template: '<span class="warning-icon" data-testid="warning-icon"></span>'
  }
}))

// ============================================================================
// Test Data
// ============================================================================

const createMockMember = (overrides: Partial<TeamMember> = {}): TeamMember => ({
  id: 'member-1',
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

const createMockFormData = (overrides: Partial<BulkMemberEditState['formData']> = {}): BulkMemberEditState['formData'] => ({
  displayName: 'Test Member',
  email: 'test@example.com',
  role: 'agent',
  ...overrides
})

// ============================================================================
// Test Suite
// ============================================================================

describe('BulkMemberEditCard', () => {
  const defaultMember = createMockMember()
  const defaultFormData = createMockFormData()
  const defaultProps = {
    member: defaultMember,
    formData: defaultFormData,
    errors: {},
    pendingTeamChanges: [] as PendingTeamChange[],
    displayTeams: [] as AgentTeamMembership[],
    allTeams: [createMockTeam()],
    isDirty: false,
    currentUserId: 'different-user-id'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe('Rendering', () => {
    it('should render member card', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: defaultProps
      })

      expect(wrapper.find('.member-edit-card').exists()).toBe(true)
    })

    it('should display member loginId', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: defaultProps
      })

      expect(wrapper.find('.member-login').text()).toBe('test@example.com')
    })

    it('should show initials when no avatar', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: defaultProps
      })

      expect(wrapper.find('.avatar-placeholder').exists()).toBe(true)
      expect(wrapper.find('.avatar-placeholder').text()).toBe('T')
    })

    it('should show avatar image when available', () => {
      const memberWithAvatar = createMockMember({ avatar: 'https://example.com/avatar.png' })

      const wrapper = mount(BulkMemberEditCard, {
        props: { ...defaultProps, member: memberWithAvatar }
      })

      expect(wrapper.find('.avatar-image').exists()).toBe(true)
      expect(wrapper.find('.avatar-image').attributes('src')).toBe('https://example.com/avatar.png')
    })

    it('should show form fields with correct values', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: defaultProps
      })

      const nameInput = wrapper.find('input[placeholder="請輸入姓名"]')
      const emailInput = wrapper.find('input[placeholder="請輸入電子郵件"]')
      const roleSelect = wrapper.find('.form-select')

      expect(nameInput.exists()).toBe(true)
      expect((nameInput.element as HTMLInputElement).value).toBe('Test Member')

      expect(emailInput.exists()).toBe(true)
      expect((emailInput.element as HTMLInputElement).value).toBe('test@example.com')

      expect(roleSelect.exists()).toBe(true)
      expect((roleSelect.element as HTMLSelectElement).value).toBe('agent')
    })
  })

  // ============================================================================
  // Dirty State Tests
  // ============================================================================

  describe('Dirty State', () => {
    it('should show change indicator when isDirty is true', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: { ...defaultProps, isDirty: true }
      })

      expect(wrapper.find('.change-indicator').exists()).toBe(true)
      expect(wrapper.text()).toContain('有變更')
    })

    it('should not show change indicator when isDirty is false', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: { ...defaultProps, isDirty: false }
      })

      expect(wrapper.find('.change-indicator').exists()).toBe(false)
    })

    it('should have has-changes class when isDirty is true', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: { ...defaultProps, isDirty: true }
      })

      expect(wrapper.find('.member-edit-card.has-changes').exists()).toBe(true)
    })
  })

  // ============================================================================
  // Error State Tests
  // ============================================================================

  describe('Error State', () => {
    it('should have has-errors class when errors exist', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          errors: { displayName: '姓名為必填欄位' }
        }
      })

      expect(wrapper.find('.member-edit-card.has-errors').exists()).toBe(true)
    })

    it('should show error message for displayName', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          errors: { displayName: '姓名為必填欄位' }
        }
      })

      expect(wrapper.find('.error-message').text()).toBe('姓名為必填欄位')
    })

    it('should show error message for email', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          errors: { email: '請輸入有效的電子郵件' }
        }
      })

      const errorMessages = wrapper.findAll('.error-message')
      expect(errorMessages.length).toBe(1)
      expect(errorMessages[0].text()).toBe('請輸入有效的電子郵件')
    })

    it('should show has-error class on input with error', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          errors: { displayName: '姓名為必填欄位' }
        }
      })

      expect(wrapper.find('input.has-error').exists()).toBe(true)
    })
  })

  // ============================================================================
  // Self-Edit Prevention Tests
  // ============================================================================

  describe('Self-Edit Prevention', () => {
    it('should show self badge when currentUserId matches member.id', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          currentUserId: 'member-1'  // Same as member.id
        }
      })

      expect(wrapper.find('.self-badge').exists()).toBe(true)
      expect(wrapper.text()).toContain('自己')
    })

    it('should show disabled overlay when is current user', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          currentUserId: 'member-1'
        }
      })

      expect(wrapper.find('.disabled-overlay').exists()).toBe(true)
      expect(wrapper.find('.disabled-message').text()).toBe('無法編輯自己的帳號')
    })

    it('should disable form inputs when is current user', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          currentUserId: 'member-1'
        }
      })

      const nameInput = wrapper.find('input[placeholder="請輸入姓名"]')
      const emailInput = wrapper.find('input[placeholder="請輸入電子郵件"]')
      const roleSelect = wrapper.find('.form-select')

      expect((nameInput.element as HTMLInputElement).disabled).toBe(true)
      expect((emailInput.element as HTMLInputElement).disabled).toBe(true)
      expect((roleSelect.element as HTMLSelectElement).disabled).toBe(true)
    })

    it('should not emit update:field event when is current user', async () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          currentUserId: 'member-1'
        }
      })

      const nameInput = wrapper.find('input[placeholder="請輸入姓名"]')
      await nameInput.setValue('New Name')

      expect(wrapper.emitted('update:field')).toBeFalsy()
    })

    it('should not show self badge when currentUserId is different', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          currentUserId: 'different-user-id'
        }
      })

      expect(wrapper.find('.self-badge').exists()).toBe(false)
      expect(wrapper.find('.disabled-overlay').exists()).toBe(false)
    })
  })

  // ============================================================================
  // Event Emission Tests
  // ============================================================================

  describe('Event Emissions', () => {
    it('should emit update:field when name input changes', async () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: defaultProps
      })

      const nameInput = wrapper.find('input[placeholder="請輸入姓名"]')
      await nameInput.setValue('New Name')

      expect(wrapper.emitted('update:field')).toBeTruthy()
      expect(wrapper.emitted('update:field')![0]).toEqual([
        'member-1',
        'displayName',
        'New Name'
      ])
    })

    it('should emit update:field when email input changes', async () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: defaultProps
      })

      const emailInput = wrapper.find('input[placeholder="請輸入電子郵件"]')
      await emailInput.setValue('new@example.com')

      expect(wrapper.emitted('update:field')).toBeTruthy()
      expect(wrapper.emitted('update:field')![0]).toEqual([
        'member-1',
        'email',
        'new@example.com'
      ])
    })

    it('should emit update:field when role changes', async () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: defaultProps
      })

      const roleSelect = wrapper.find('.form-select')
      await roleSelect.setValue('admin')

      expect(wrapper.emitted('update:field')).toBeTruthy()
      expect(wrapper.emitted('update:field')![0]).toEqual([
        'member-1',
        'role',
        'admin'
      ])
    })

    it('should emit add-team when team selector emits add-team', async () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: defaultProps
      })

      // MultiTeamSelector only shows for agents
      const addTeamButton = wrapper.find('[data-testid="multi-team-selector"] button:first-child')
      await addTeamButton.trigger('click')

      expect(wrapper.emitted('add-team')).toBeTruthy()
      expect(wrapper.emitted('add-team')![0]).toEqual(['member-1', 1, 'Test Team'])
    })

    it('should emit remove-team when team selector emits remove-team', async () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: defaultProps
      })

      const buttons = wrapper.findAll('[data-testid="multi-team-selector"] button')
      await buttons[1].trigger('click') // Remove Team button

      expect(wrapper.emitted('remove-team')).toBeTruthy()
      expect(wrapper.emitted('remove-team')![0]).toEqual(['member-1', 1])
    })

    it('should emit teams-loaded when team selector emits teams-loaded', async () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: defaultProps
      })

      const buttons = wrapper.findAll('[data-testid="multi-team-selector"] button')
      await buttons[2].trigger('click') // Teams Loaded button

      expect(wrapper.emitted('teams-loaded')).toBeTruthy()
      expect(wrapper.emitted('teams-loaded')![0][0]).toBe('member-1')
    })
  })

  // ============================================================================
  // Role-Based UI Tests
  // ============================================================================

  describe('Role-Based UI', () => {
    it('should show team section for agents', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          formData: createMockFormData({ role: 'agent' })
        }
      })

      expect(wrapper.find('.team-section').exists()).toBe(true)
      expect(wrapper.find('[data-testid="multi-team-selector"]').exists()).toBe(true)
    })

    it('should show admin notice for admins', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          formData: createMockFormData({ role: 'admin' })
        }
      })

      expect(wrapper.find('.admin-notice').exists()).toBe(true)
      expect(wrapper.text()).toContain('管理員無需分配團隊')
    })

    it('should not show team section for admins', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          formData: createMockFormData({ role: 'admin' })
        }
      })

      expect(wrapper.find('.team-section').exists()).toBe(false)
      expect(wrapper.find('[data-testid="multi-team-selector"]').exists()).toBe(false)
    })

    it('should not show admin notice for agents', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          formData: createMockFormData({ role: 'agent' })
        }
      })

      expect(wrapper.find('.admin-notice').exists()).toBe(false)
    })
  })

  // ============================================================================
  // Avatar/Initials Tests
  // ============================================================================

  describe('Avatar and Initials', () => {
    it('should display first character of name as initial', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          member: createMockMember({ name: 'John Doe' })
        }
      })

      expect(wrapper.find('.avatar-placeholder').text()).toBe('J')
    })

    it('should use loginId for initials when name is empty', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          member: createMockMember({ name: '', loginId: 'user@example.com' })
        }
      })

      expect(wrapper.find('.avatar-placeholder').text()).toBe('U')
    })

    it('should capitalize the initial letter', () => {
      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          member: createMockMember({ name: 'alice' })
        }
      })

      expect(wrapper.find('.avatar-placeholder').text()).toBe('A')
    })
  })

  // ============================================================================
  // Props Passing Tests
  // ============================================================================

  describe('Props Passing', () => {
    it('should pass correct props to MultiTeamSelector', () => {
      const displayTeams: AgentTeamMembership[] = [
        { teamId: 1, teamName: 'Team 1', teamRole: 'member', isPending: false }
      ]
      const pendingChanges: PendingTeamChange[] = [
        { type: 'add', teamId: 2, teamName: 'Team 2' }
      ]
      const allTeams = [createMockTeam(), createMockTeam({ id: 2, name: 'Team 2' })]

      const wrapper = mount(BulkMemberEditCard, {
        props: {
          ...defaultProps,
          displayTeams,
          pendingTeamChanges: pendingChanges,
          allTeams
        }
      })

      const selector = wrapper.findComponent({ name: 'MultiTeamSelector' })
      expect(selector.props('memberId')).toBe('member-1')
      expect(selector.props('allTeams')).toEqual(allTeams)
      expect(selector.props('deferredMode')).toBe(true)
      expect(selector.props('teams')).toEqual(displayTeams)
      expect(selector.props('pendingChanges')).toEqual(pendingChanges)
      expect(selector.props('loading')).toBe(false)
      expect(selector.props('hideStatusMessage')).toBe(true)
    })
  })
})
