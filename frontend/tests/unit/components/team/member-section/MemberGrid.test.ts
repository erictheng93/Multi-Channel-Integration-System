/**
 * MemberGrid Component - Unit Tests
 *
 * Tests member list display, avatars, and remove button
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MemberGrid from '@/components/team/member-section/MemberGrid.vue'
import type { TeamMember } from '@/types'

describe('MemberGrid', () => {
  const mockMembers: TeamMember[] = [
    {
      id: 'member-1',
      loginId: 'alice@example.com',
      name: 'Alice Wang',
      email: 'alice@example.com',
      role: 'admin',
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
    },
    {
      id: 'member-3',
      loginId: 'charlie',
      email: 'charlie@example.com',
      role: 'agent',
      status: 'inactive',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    }
  ]

  it('should render all members', () => {
    const wrapper = mount(MemberGrid, {
      props: {
        members: mockMembers,
        removingMemberId: null
      }
    })

    const memberItems = wrapper.findAll('.member-item')
    expect(memberItems).toHaveLength(3)
  })

  it('should display member names correctly', () => {
    const wrapper = mount(MemberGrid, {
      props: {
        members: mockMembers,
        removingMemberId: null
      }
    })

    expect(wrapper.text()).toContain('Alice Wang')
    expect(wrapper.text()).toContain('Bob Chen')
    expect(wrapper.text()).toContain('charlie') // Falls back to loginId when no name
  })

  it('should display role names in Chinese', () => {
    const wrapper = mount(MemberGrid, {
      props: {
        members: mockMembers,
        removingMemberId: null
      }
    })

    expect(wrapper.text()).toContain('管理員') // admin
    expect(wrapper.text()).toContain('客服') // agent
  })

  it('should generate correct initials for full names', () => {
    const wrapper = mount(MemberGrid, {
      props: {
        members: [mockMembers[0]], // Alice Wang
        removingMemberId: null
      }
    })

    const avatar = wrapper.find('.member-avatar')
    expect(avatar.text()).toBe('AW')
  })

  it('should generate correct initials for single names', () => {
    const singleNameMember: TeamMember = {
      id: 'member-4',
      loginId: 'david',
      name: 'David',
      email: 'david@example.com',
      role: 'agent',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    }

    const wrapper = mount(MemberGrid, {
      props: {
        members: [singleNameMember],
        removingMemberId: null
      }
    })

    const avatar = wrapper.find('.member-avatar')
    expect(avatar.text()).toBe('D')
  })

  it('should emit remove-member event when remove button clicked', async () => {
    const wrapper = mount(MemberGrid, {
      props: {
        members: mockMembers,
        removingMemberId: null
      }
    })

    const firstRemoveBtn = wrapper.find('.btn-remove')
    await firstRemoveBtn.trigger('click')

    expect(wrapper.emitted('remove-member')).toBeTruthy()
    expect(wrapper.emitted('remove-member')?.[0]).toEqual([mockMembers[0]])
  })

  it('should disable remove button when member is being removed', () => {
    const wrapper = mount(MemberGrid, {
      props: {
        members: mockMembers,
        removingMemberId: 'member-1'
      }
    })

    const firstRemoveBtn = wrapper.find('.btn-remove')
    expect(firstRemoveBtn.attributes('disabled')).toBeDefined()
    expect(firstRemoveBtn.text()).toContain('移除中')
  })

  it('should show remove icon when not removing', () => {
    const wrapper = mount(MemberGrid, {
      props: {
        members: mockMembers,
        removingMemberId: null
      }
    })

    const firstRemoveBtn = wrapper.find('.btn-remove')
    expect(firstRemoveBtn.text()).toBe('✕')
  })

  it('should handle empty member name with fallback to loginId', () => {
    const noNameMember: TeamMember = {
      id: 'member-5',
      loginId: 'test@example.com',
      email: 'test@example.com',
      role: 'agent',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    }

    const wrapper = mount(MemberGrid, {
      props: {
        members: [noNameMember],
        removingMemberId: null
      }
    })

    expect(wrapper.text()).toContain('test@example.com')
  })

  it('should apply grid layout class', () => {
    const wrapper = mount(MemberGrid, {
      props: {
        members: mockMembers,
        removingMemberId: null
      }
    })

    expect(wrapper.find('.members-grid').exists()).toBe(true)
  })
})
