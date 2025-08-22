// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/unit/views/TeamManagement.test.ts
// Created by: View Test Developer

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import TeamManagement from '@/views/TeamManagement.vue'
import { useTeamStore } from '@/stores/team'

// Mock the stores
vi.mock('../../../frontend/src/stores/team', () => ({
  useTeamStore: vi.fn(() => ({
    members: [
      {
        id: 'member-1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        status: 'active',
        lastLogin: new Date('2024-01-01T10:00:00Z')
      },
      {
        id: 'member-2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'agent',
        status: 'active',
        lastLogin: new Date('2024-01-01T09:00:00Z')
      }
    ],
    invitations: [
      {
        id: 'invite-1',
        email: 'newuser@example.com',
        role: 'agent',
        status: 'pending',
        createdAt: new Date('2024-01-01T08:00:00Z'),
        expiresAt: new Date('2024-01-08T08:00:00Z'),
        token: 'invite-token-123'
      }
    ],
    loading: false,
    stats: {
      totalMembers: 2,
      activeMembers: 2,
      pendingInvitations: 1,
      adminCount: 1
    },
    loadAll: vi.fn().mockResolvedValue(undefined),
    inviteMember: vi.fn().mockResolvedValue(undefined),
    updateMemberRole: vi.fn().mockResolvedValue(undefined),
    updateMemberStatus: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    removeMember: vi.fn().mockResolvedValue(undefined),
    resendInvitation: vi.fn().mockResolvedValue(undefined),
    cancelInvitation: vi.fn().mockResolvedValue(undefined)
  }))
}))

vi.mock('../../../frontend/src/composables/useAuth', () => ({
  useAuth: vi.fn(() => ({
    currentAgent: { id: 'agent-1', name: 'Current Agent', role: 'admin' }
  }))
}))

// Mock child components
vi.mock('../../../frontend/src/components/team/TeamMemberCard.vue', () => ({
  default: {
    template: `
      <div class="team-member-card" data-testid="team-member-card">
        <h3>{{ member.name }}</h3>
        <p>{{ member.email }}</p>
        <span class="role">{{ member.role }}</span>
        <span class="status">{{ member.status }}</span>
        <button @click="$emit('update-role', member.id, 'agent')">Update Role</button>
        <button @click="$emit('toggle-status', member)">Toggle Status</button>
        <button @click="$emit('reset-password', member)">Reset Password</button>
        <button @click="$emit('remove-member', member)">Remove</button>
      </div>
    `,
    props: ['member', 'currentUserId', 'loading'],
    emits: ['update-role', 'toggle-status', 'reset-password', 'remove-member']
  }
}))

vi.mock('../../../frontend/src/components/team/InvitationCard.vue', () => ({
  default: {
    template: `
      <div class="invitation-card" data-testid="invitation-card">
        <h3>{{ invitation.email }}</h3>
        <span class="role">{{ invitation.role }}</span>
        <span class="status">{{ invitation.status }}</span>
        <button @click="$emit('resend', invitation.id)">Resend</button>
        <button @click="$emit('copy-link', invitation.token)">Copy Link</button>
        <button @click="$emit('cancel', invitation.id)">Cancel</button>
      </div>
    `,
    props: ['invitation', 'loading'],
    emits: ['resend', 'copy-link', 'cancel']
  }
}))

describe('TeamManagement Component', () => {
  let pinia: any
  let router: any

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/team', component: { template: '<div>Team</div>' } }
      ]
    })

    // Mock window.alert and window.confirm
    global.alert = vi.fn()
    global.confirm = vi.fn().mockReturnValue(true)

    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })
  })

  const createWrapper = () => {
    return mount(TeamManagement, {
      global: {
        plugins: [pinia, router]
      }
    })
  }

  describe('Component Rendering', () => {
    it('should render team management page with header', () => {
      const wrapper = createWrapper()

      expect(wrapper.find('.team-management').exists()).toBe(true)
      expect(wrapper.find('.page-header h1').text()).toBe('團隊管理')
      expect(wrapper.find('.btn-primary').text()).toContain('邀請成員')
    })

    it('should display statistics cards', () => {
      const wrapper = createWrapper()
      const statCards = wrapper.findAll('.stat-card')

      expect(statCards).toHaveLength(4)
      
      const statValues = wrapper.findAll('.stat-value')
      expect(statValues[0].text()).toBe('2') // totalMembers
      expect(statValues[1].text()).toBe('2') // activeMembers
      expect(statValues[2].text()).toBe('1') // pendingInvitations
      expect(statValues[3].text()).toBe('1') // adminCount
    })

    it('should render tabs for members and invitations', () => {
      const wrapper = createWrapper()
      const tabButtons = wrapper.findAll('.tab-button')

      expect(tabButtons).toHaveLength(2)
      expect(tabButtons[0].text()).toContain('團隊成員 (2)')
      expect(tabButtons[1].text()).toContain('待處理邀請 (1)')
      expect(tabButtons[0].classes()).toContain('active')
    })

    it('should display team members by default', () => {
      const wrapper = createWrapper()

      expect(wrapper.find('.members-section').exists()).toBe(true)
      expect(wrapper.findAll('[data-testid="team-member-card"]')).toHaveLength(2)
    })
  })

  describe('Tab Navigation', () => {
    it('should switch to invitations tab when clicked', async () => {
      const wrapper = createWrapper()
      const invitationsTab = wrapper.findAll('.tab-button')[1]

      await invitationsTab.trigger('click')

      expect(wrapper.vm.activeTab).toBe('invitations')
      expect(invitationsTab.classes()).toContain('active')
      expect(wrapper.find('.invitations-section').exists()).toBe(true)
      expect(wrapper.findAll('[data-testid="invitation-card"]')).toHaveLength(1)
    })

    it('should switch back to members tab', async () => {
      const wrapper = createWrapper()
      
      // Switch to invitations first
      await wrapper.findAll('.tab-button')[1].trigger('click')
      expect(wrapper.vm.activeTab).toBe('invitations')

      // Switch back to members
      await wrapper.findAll('.tab-button')[0].trigger('click')
      expect(wrapper.vm.activeTab).toBe('members')
      expect(wrapper.find('.members-section').exists()).toBe(true)
    })
  })

  describe('Invite Member Modal', () => {
    it('should open invite modal when invite button is clicked', async () => {
      const wrapper = createWrapper()

      await wrapper.find('.btn-primary').trigger('click')

      expect(wrapper.find('.modal-overlay').exists()).toBe(true)
      expect(wrapper.find('.modal-header h2').text()).toBe('邀請新成員')
    })

    it('should close invite modal when close button is clicked', async () => {
      const wrapper = createWrapper()

      await wrapper.find('.btn-primary').trigger('click')
      expect(wrapper.find('.modal-overlay').exists()).toBe(true)

      await wrapper.find('.close-btn').trigger('click')
      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })

    it('should close invite modal when overlay is clicked', async () => {
      const wrapper = createWrapper()

      await wrapper.find('.btn-primary').trigger('click')
      expect(wrapper.find('.modal-overlay').exists()).toBe(true)

      await wrapper.find('.modal-overlay').trigger('click')
      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })

    it('should not close modal when modal content is clicked', async () => {
      const wrapper = createWrapper()

      await wrapper.find('.btn-primary').trigger('click')
      expect(wrapper.find('.modal-overlay').exists()).toBe(true)

      await wrapper.find('.modal').trigger('click')
      expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    })
  })

  describe('Invite Form', () => {
    it('should have form fields with correct initial values', async () => {
      const wrapper = createWrapper()

      await wrapper.find('.btn-primary').trigger('click')

      const emailInput = wrapper.find('#email')
      const roleSelect = wrapper.find('#role')
      const messageTextarea = wrapper.find('#message')
      const qrCheckbox = wrapper.find('input[type="checkbox"]')

      expect(emailInput.element.value).toBe('')
      expect(roleSelect.element.value).toBe('agent')
      expect(messageTextarea.element.value).toBe('')
      expect(qrCheckbox.element.checked).toBe(false)
    })

    it('should update form data when inputs change', async () => {
      const wrapper = createWrapper()

      await wrapper.find('.btn-primary').trigger('click')

      await wrapper.find('#email').setValue('test@example.com')
      await wrapper.find('#role').setValue('admin')
      await wrapper.find('#message').setValue('Welcome to the team!')
      await wrapper.find('input[type="checkbox"]').setChecked(true)

      expect(wrapper.vm.inviteForm.email).toBe('test@example.com')
      expect(wrapper.vm.inviteForm.role).toBe('admin')
      expect(wrapper.vm.inviteForm.message).toBe('Welcome to the team!')
      expect(wrapper.vm.inviteForm.useQR).toBe(true)
    })

    it('should submit invitation form', async () => {
      const wrapper = createWrapper()
      const teamStore = wrapper.vm.teamStore

      await wrapper.find('.btn-primary').trigger('click')

      await wrapper.find('#email').setValue('test@example.com')
      await wrapper.find('#role').setValue('admin')

      await wrapper.find('form').trigger('submit')

      expect(teamStore.inviteMember).toHaveBeenCalledWith({
        email: 'test@example.com',
        role: 'admin',
        message: '',
        useQR: false
      })
    })

    it('should reset form after successful submission', async () => {
      const wrapper = createWrapper()

      await wrapper.find('.btn-primary').trigger('click')

      await wrapper.find('#email').setValue('test@example.com')
      await wrapper.find('#role').setValue('admin')

      await wrapper.find('form').trigger('submit')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.inviteForm.email).toBe('')
      expect(wrapper.vm.inviteForm.role).toBe('agent')
      expect(wrapper.vm.inviteForm.message).toBe('')
      expect(wrapper.vm.inviteForm.useQR).toBe(false)
    })
  })

  describe('Member Actions', () => {
    it('should handle member role update', async () => {
      const wrapper = createWrapper()
      const teamStore = wrapper.vm.teamStore
      const memberCard = wrapper.find('[data-testid="team-member-card"]')

      await memberCard.find('button').trigger('click') // Update Role button

      expect(teamStore.updateMemberRole).toHaveBeenCalledWith('member-1', 'agent')
    })

    it('should handle member status toggle', async () => {
      const wrapper = createWrapper()
      const teamStore = wrapper.vm.teamStore
      const memberCard = wrapper.find('[data-testid="team-member-card"]')

      await memberCard.findAll('button')[1].trigger('click') // Toggle Status button

      expect(teamStore.updateMemberStatus).toHaveBeenCalled()
    })

    it('should handle password reset with confirmation', async () => {
      const wrapper = createWrapper()
      const teamStore = wrapper.vm.teamStore

      const memberCard = wrapper.find('[data-testid="team-member-card"]')
      await memberCard.findAll('button')[2].trigger('click') // Reset Password button

      expect(wrapper.find('.confirm-modal').exists()).toBe(true)
      
      await wrapper.find('.btn-danger').trigger('click') // Confirm button

      expect(teamStore.resetPassword).toHaveBeenCalledWith('member-1')
      expect(global.alert).toHaveBeenCalledWith('密碼重設成功，新密碼已發送至用戶郵箱')
    })

    it('should handle member removal with confirmation', async () => {
      const wrapper = createWrapper()
      const teamStore = wrapper.vm.teamStore

      const memberCard = wrapper.find('[data-testid="team-member-card"]')
      await memberCard.findAll('button')[3].trigger('click') // Remove button

      expect(wrapper.find('.confirm-modal').exists()).toBe(true)
      
      await wrapper.find('.btn-danger').trigger('click') // Confirm button

      expect(teamStore.removeMember).toHaveBeenCalledWith('member-1')
    })
  })

  describe('Invitation Actions', () => {
    it('should handle invitation resend', async () => {
      const wrapper = createWrapper()
      const teamStore = wrapper.vm.teamStore

      // Switch to invitations tab
      await wrapper.findAll('.tab-button')[1].trigger('click')

      const invitationCard = wrapper.find('[data-testid="invitation-card"]')
      await invitationCard.find('button').trigger('click') // Resend button

      expect(teamStore.resendInvitation).toHaveBeenCalledWith('invite-1')
    })

    it('should handle invitation link copy', async () => {
      const wrapper = createWrapper()

      // Switch to invitations tab
      await wrapper.findAll('.tab-button')[1].trigger('click')

      const invitationCard = wrapper.find('[data-testid="invitation-card"]')
      await invitationCard.findAll('button')[1].trigger('click') // Copy Link button

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        `${window.location.origin}/invite/invite-token-123`
      )
      expect(global.alert).toHaveBeenCalledWith('連結已複製到剪貼板')
    })

    it('should handle invitation cancellation', async () => {
      const wrapper = createWrapper()
      const teamStore = wrapper.vm.teamStore

      // Switch to invitations tab
      await wrapper.findAll('.tab-button')[1].trigger('click')

      const invitationCard = wrapper.find('[data-testid="invitation-card"]')
      await invitationCard.findAll('button')[2].trigger('click') // Cancel button

      expect(teamStore.cancelInvitation).toHaveBeenCalledWith('invite-1')
    })
  })

  describe('Loading States', () => {
    it('should show loading state when data is loading', async () => {
      // Mock loading state
      vi.mocked(useTeamStore).mockReturnValue({
        members: [],
        invitations: [],
        loading: true,
        stats: { totalMembers: 0, activeMembers: 0, pendingInvitations: 0, adminCount: 0 },
        loadAll: vi.fn(),
        inviteMember: vi.fn(),
        updateMemberRole: vi.fn(),
        updateMemberStatus: vi.fn(),
        resetPassword: vi.fn(),
        removeMember: vi.fn(),
        resendInvitation: vi.fn(),
        cancelInvitation: vi.fn()
      })

      const wrapper = createWrapper()

      expect(wrapper.find('.loading').exists()).toBe(true)
      expect(wrapper.find('.loading').text()).toBe('載入中...')
    })

    it('should show empty state when no members exist', async () => {
      // Mock empty state
      vi.mocked(useTeamStore).mockReturnValue({
        members: [],
        invitations: [],
        loading: false,
        stats: { totalMembers: 0, activeMembers: 0, pendingInvitations: 0, adminCount: 0 },
        loadAll: vi.fn(),
        inviteMember: vi.fn(),
        updateMemberRole: vi.fn(),
        updateMemberStatus: vi.fn(),
        resetPassword: vi.fn(),
        removeMember: vi.fn(),
        resendInvitation: vi.fn(),
        cancelInvitation: vi.fn()
      })

      const wrapper = createWrapper()

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.find('.empty-state p').text()).toBe('尚無團隊成員')
    })
  })

  describe('Responsive Design', () => {
    it('should have responsive CSS classes', () => {
      const wrapper = createWrapper()

      expect(wrapper.find('.team-management').exists()).toBe(true)
      expect(wrapper.find('.stats-grid').exists()).toBe(true)
      expect(wrapper.find('.page-header').exists()).toBe(true)
    })
  })

  describe('Lifecycle', () => {
    it('should load data on component mount', () => {
      const wrapper = createWrapper()
      const teamStore = wrapper.vm.teamStore

      expect(teamStore.loadAll).toHaveBeenCalled()
    })
  })
})