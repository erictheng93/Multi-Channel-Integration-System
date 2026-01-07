/**
 * TeamMemberCard.vue - Snapshot Tests (Before Phase 4 Refactoring)
 *
 * These snapshot tests establish a baseline for TeamMemberCard.vue
 * before Phase 4 refactoring (Multi-Team Management Extraction).
 *
 * Purpose:
 * - Capture current component structure and rendering
 * - Ensure zero breaking changes during refactoring
 * - Validate multi-team management functionality
 */

import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import TeamMemberCard from '@/components/team/TeamMemberCard.vue'
import type { TeamMember } from '@/types'

// Mock composables and APIs
vi.mock('@/composables/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    showWarning: vi.fn(() => Promise.resolve(true)),
    showDanger: vi.fn(() => Promise.resolve(true)),
    showConfirm: vi.fn(() => Promise.resolve(true))
  })
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn()
  })
}))

vi.mock('@/api/team', () => ({
  teamApi: {
    getAllTeams: vi.fn(() => Promise.resolve({ success: true, data: [] })),
    getMemberTeams: vi.fn(() => Promise.resolve({ success: true, data: [] })),
    addMemberToTeam: vi.fn(() => Promise.resolve({ success: true })),
    removeMemberFromTeam: vi.fn(() => Promise.resolve({ success: true })),
    setPrimaryTeam: vi.fn(() => Promise.resolve({ success: true })),
    updateMember: vi.fn(() => Promise.resolve({ success: true }))
  }
}))

describe('TeamMemberCard.vue - Snapshot Tests (Before Phase 4 Refactoring)', () => {
  const mockMember: TeamMember = {
    id: 'agent-001',
    loginId: 'john.doe@example.com',
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'agent',
    status: 'active',
    teams: [
      { id: 1, name: 'Sales Team', isPrimary: true },
      { id: 2, name: 'Support Team', isPrimary: false }
    ],
    teamCount: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z'
  }

  const mockAdminMember: TeamMember = {
    ...mockMember,
    id: 'admin-001',
    name: 'Admin User',
    role: 'admin',
    teams: []
  }

  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    const pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  it('should match snapshot - basic member card render', () => {
    const wrapper = mount(TeamMemberCard, {
      props: {
        member: mockMember,
        allTeams: [
          { id: 1, name: 'Sales Team', description: 'Sales', isActive: true, memberCount: 5, createdAt: '', updatedAt: '' },
          { id: 2, name: 'Support Team', description: 'Support', isActive: true, memberCount: 3, createdAt: '', updatedAt: '' }
        ]
      },
      global: {
        plugins: [createPinia()]
      }
    })

    expect(wrapper.html()).toMatchSnapshot()
  })

  it('should match snapshot - admin member card', () => {
    const wrapper = mount(TeamMemberCard, {
      props: {
        member: mockAdminMember,
        allTeams: []
      },
      global: {
        plugins: [createPinia()]
      }
    })

    expect(wrapper.html()).toMatchSnapshot()
  })

  it('should match snapshot - member with single team', () => {
    const singleTeamMember: TeamMember = {
      ...mockMember,
      teams: [{ id: 1, name: 'Sales Team', isPrimary: true }],
      teamCount: 1
    }

    const wrapper = mount(TeamMemberCard, {
      props: {
        member: singleTeamMember,
        allTeams: [
          { id: 1, name: 'Sales Team', description: 'Sales', isActive: true, memberCount: 5, createdAt: '', updatedAt: '' }
        ]
      },
      global: {
        plugins: [createPinia()]
      }
    })

    expect(wrapper.html()).toMatchSnapshot()
  })

  it('should match snapshot - member with no teams', () => {
    const noTeamMember: TeamMember = {
      ...mockMember,
      teams: [],
      teamCount: 0
    }

    const wrapper = mount(TeamMemberCard, {
      props: {
        member: noTeamMember,
        allTeams: [
          { id: 1, name: 'Sales Team', description: 'Sales', isActive: true, memberCount: 5, createdAt: '', updatedAt: '' },
          { id: 2, name: 'Support Team', description: 'Support', isActive: true, memberCount: 3, createdAt: '', updatedAt: '' }
        ]
      },
      global: {
        plugins: [createPinia()]
      }
    })

    expect(wrapper.html()).toMatchSnapshot()
  })

  it('should match snapshot - inactive member', () => {
    const inactiveMember: TeamMember = {
      ...mockMember,
      status: 'inactive'
    }

    const wrapper = mount(TeamMemberCard, {
      props: {
        member: inactiveMember,
        allTeams: []
      },
      global: {
        plugins: [createPinia()]
      }
    })

    expect(wrapper.html()).toMatchSnapshot()
  })

  it('should match snapshot - member with loading state', () => {
    const wrapper = mount(TeamMemberCard, {
      props: {
        member: mockMember,
        allTeams: [],
        loading: true
      },
      global: {
        plugins: [createPinia()]
      }
    })

    expect(wrapper.html()).toMatchSnapshot()
  })
})
