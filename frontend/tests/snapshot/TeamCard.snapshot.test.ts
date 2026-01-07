/**
 * TeamCard.vue - Snapshot Tests (Before Refactoring)
 *
 * Purpose: Establish baseline behavior before Phase 1 refactoring
 * These snapshots ensure that after refactoring, the component's
 * rendered output remains functionally identical
 *
 * Critical: Run these tests BEFORE any refactoring begins
 * Date Created: 2025-01-06
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TeamCard from '@/components/team/TeamCard.vue'
import type { Team, TeamMember, LiffQRCode } from '@/types'

// Mock the API module
vi.mock('@/api/team', () => ({
  teamApi: {
    getTeamMembersWithTeams: vi.fn(),
    updateTeam: vi.fn(),
    removeMemberFromTeam: vi.fn()
  }
}))

// Mock composables
vi.mock('@/composables/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    showDanger: vi.fn(() => Promise.resolve(true)),
    showWarning: vi.fn(() => Promise.resolve(true)),
    showConfirm: vi.fn(() => Promise.resolve(true))
  })
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn()
  })
}))

vi.mock('@/composables/team-management', () => ({
  useMemberOperations: () => ({
    addMemberModal: { value: false },
    addMemberForm: {
      email: '',
      displayName: '',
      role: 'agent',
      password: ''
    },
    addMemberLoading: { value: false },
    showAddPassword: { value: false },
    openAddMemberModal: vi.fn(),
    closeAddMemberModal: vi.fn(),
    submitAddMember: vi.fn(),
    toggleAddPasswordVisibility: vi.fn()
  })
}))

// Mock config/runtime
vi.mock('@/config/runtime', () => ({
  getBackendUrl: () => 'http://localhost:8787',
  getStoragePublicUrl: () => 'http://localhost:8787/storage'
}))

describe('TeamCard.vue - Snapshot Tests (Before Refactoring)', () => {
  let pinia: ReturnType<typeof createPinia>

  const mockTeam: Team = {
    id: 1,
    name: '測試團隊',
    description: '這是一個測試團隊的描述',
    isActive: true,
    memberCount: 5,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z'
  }

  const mockMembers: TeamMember[] = [
    {
      id: 'member-1',
      loginId: 'alice@example.com',
      name: 'Alice Wang',
      email: 'alice@example.com',
      role: 'agent',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    },
    {
      id: 'member-2',
      loginId: 'bob@example.com',
      name: 'Bob Chen',
      email: 'bob@example.com',
      role: 'agent',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    }
  ]

  const mockQRCode: LiffQRCode = {
    id: 'qr-1',
    liffUrl: 'https://liff.line.me/1234567890-abcdefgh',
    qrCodeUrl: 'http://localhost:8787/storage/qr-codes/team-1-qr.png',
    scanCount: 42,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z'
  }

  beforeEach(() => {
    // Create fresh Pinia instance for each test
    pinia = createPinia()
    setActivePinia(pinia)

    // Reset all mocks
    vi.clearAllMocks()
  })

  it('should match snapshot - basic card render (closed modal)', () => {
    const wrapper = mount(TeamCard, {
      props: { team: mockTeam },
      global: {
        plugins: [pinia],
        stubs: {
          Modal: true,
          HamsterLoader: true,
          AddMemberModal: true
        }
      }
    })

    expect(wrapper.html()).toMatchSnapshot()
  })

  it('should match snapshot - card with loading state', () => {
    const wrapper = mount(TeamCard, {
      props: {
        team: mockTeam,
        loading: true
      },
      global: {
        plugins: [pinia],
        stubs: {
          Modal: true,
          HamsterLoader: true,
          AddMemberModal: true
        }
      }
    })

    expect(wrapper.html()).toMatchSnapshot()
  })

  it('should match snapshot - inactive team', () => {
    const inactiveTeam: Team = {
      ...mockTeam,
      isActive: false
    }

    const wrapper = mount(TeamCard, {
      props: { team: inactiveTeam },
      global: {
        plugins: [pinia],
        stubs: {
          Modal: true,
          HamsterLoader: true,
          AddMemberModal: true
        }
      }
    })

    expect(wrapper.html()).toMatchSnapshot()
  })

  it('should match snapshot - team with no description', () => {
    const noDescTeam: Team = {
      ...mockTeam,
      description: undefined
    }

    const wrapper = mount(TeamCard, {
      props: { team: noDescTeam },
      global: {
        plugins: [pinia],
        stubs: {
          Modal: true,
          HamsterLoader: true,
          AddMemberModal: true
        }
      }
    })

    expect(wrapper.html()).toMatchSnapshot()
  })

  // Note: More complex snapshots (modal open, QR code displayed, member list)
  // require async state management and store mocking which is complex
  // These basic snapshots establish the baseline for the card's closed state

  // Future Enhancement: Add snapshots for:
  // - Modal open with team details
  // - QR Code section displayed
  // - Member list rendered
  // - Edit mode active
  // These would require more sophisticated mocking of stores and async operations
})
