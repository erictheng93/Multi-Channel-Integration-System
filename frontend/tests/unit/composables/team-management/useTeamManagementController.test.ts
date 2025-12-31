/**
 * useTeamManagementController 集成测试
 *
 * 测试主控制器是否正确集成所有子控制器
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTeamManagementController } from '@/composables/team-management/useTeamManagementController'
import { useTeamStore } from '@/stores/team'
import { ROLES } from '@/constants/roles'

// Mock 子模块
vi.mock('@/composables/team-management/useMemberOperations', () => ({
  useMemberOperations: () => ({
    addMemberModal: { value: false },
    openAddMemberModal: vi.fn()
  })
}))

vi.mock('@/composables/team-management/useTeamOperations', () => ({
  useTeamOperations: () => ({
    addTeamModal: { value: false },
    openAddTeamModal: vi.fn()
  })
}))

vi.mock('@/composables/team-management/useQRCodeOperations', () => ({
  useQRCodeOperations: () => ({
    qrModal: { value: false },
    viewQR: vi.fn(),
    startBackgroundPreload: vi.fn(),
    stopBackgroundPreload: vi.fn()
  })
}))

describe('useTeamManagementController', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('全局状态', () => {
    it('应该提供 loading 状态', () => {
      const teamStore = useTeamStore()
      teamStore.loading = true

      const controller = useTeamManagementController()

      expect(controller.loading.value).toBe(true)
    })

    it('应该提供 teams 列表', () => {
      const teamStore = useTeamStore()
      teamStore.teams = [
        { id: 1, name: 'Team 1' } as any,
        { id: 2, name: 'Team 2' } as any
      ]

      const controller = useTeamManagementController()

      expect(controller.teams.value).toHaveLength(2)
      expect(controller.teams.value[0].name).toBe('Team 1')
    })

    it('应该提供 members 列表（系统管理员在顶部）', () => {
      const teamStore = useTeamStore()
      teamStore.members = [
        { id: '1', name: 'User 1', role: ROLES.AGENT } as any,
        { id: '2', name: 'System Administrator', role: ROLES.ADMIN, email: 'admin@example.com' } as any,
        { id: '3', name: 'User 3', role: ROLES.AGENT } as any
      ]

      const controller = useTeamManagementController()

      expect(controller.members.value).toHaveLength(3)
      // 系统管理员应该在第一个
      expect(controller.members.value[0].name).toBe('System Administrator')
    })

    it('应该提供统计数据', () => {
      const teamStore = useTeamStore()
      teamStore.members = [
        { id: '1', name: 'Admin', role: ROLES.ADMIN } as any,
        { id: '2', name: 'Agent 1', role: ROLES.AGENT } as any,
        { id: '3', name: 'Agent 2', role: ROLES.AGENT } as any
      ]
      teamStore.teams = [
        { id: 1, name: 'Team 1' } as any,
        { id: 2, name: 'Team 2' } as any
      ]

      const controller = useTeamManagementController()

      expect(controller.stats.value.totalMembers).toBe(3)
      expect(controller.stats.value.adminCount).toBe(1)
      expect(controller.stats.value.teamCount).toBe(2)
    })
  })

  describe('子控制器集成', () => {
    it('应该提供 member 子控制器', () => {
      const controller = useTeamManagementController()

      expect(controller.member).toBeDefined()
      expect(controller.member.addMemberModal).toBeDefined()
    })

    it('应该提供 team 子控制器', () => {
      const controller = useTeamManagementController()

      expect(controller.team).toBeDefined()
      expect(controller.team.addTeamModal).toBeDefined()
    })

    it('应该提供 qr 子控制器', () => {
      const controller = useTeamManagementController()

      expect(controller.qr).toBeDefined()
      expect(controller.qr.qrModal).toBeDefined()
    })
  })

  describe('生命周期方法', () => {
    it('应该提供 initialize 方法', () => {
      const controller = useTeamManagementController()

      expect(controller.initialize).toBeInstanceOf(Function)
    })

    it('应该提供 cleanup 方法', () => {
      const controller = useTeamManagementController()

      expect(controller.cleanup).toBeInstanceOf(Function)
    })

    it('应该提供 refresh 方法', () => {
      const controller = useTeamManagementController()

      expect(controller.refresh).toBeInstanceOf(Function)
    })

    it('cleanup 应该调用 QR 预加载的 stop 方法', () => {
      const controller = useTeamManagementController()

      controller.cleanup()

      expect(controller.qr.stopBackgroundPreload).toHaveBeenCalled()
    })
  })

  describe('数据响应性', () => {
    it('teams 应该是响应式的', () => {
      const teamStore = useTeamStore()
      teamStore.teams = [
        { id: 1, name: 'Team 1' } as any
      ]

      const controller = useTeamManagementController()

      expect(controller.teams.value).toHaveLength(1)

      // 添加新团队
      teamStore.teams.push({ id: 2, name: 'Team 2' } as any)

      // 应该自动更新
      expect(controller.teams.value).toHaveLength(2)
    })

    it('members 应该是响应式的', () => {
      const teamStore = useTeamStore()
      teamStore.members = [
        { id: '1', name: 'User 1', role: ROLES.AGENT } as any
      ]

      const controller = useTeamManagementController()

      expect(controller.members.value).toHaveLength(1)

      // 添加新成员
      teamStore.members.push({ id: '2', name: 'User 2', role: ROLES.AGENT } as any)

      // 应该自动更新
      expect(controller.members.value).toHaveLength(2)
    })

    it('stats 应该是响应式的', () => {
      const teamStore = useTeamStore()
      teamStore.members = [
        { id: '1', name: 'Admin', role: ROLES.ADMIN } as any
      ]

      const controller = useTeamManagementController()

      expect(controller.stats.value.totalMembers).toBe(1)

      // 添加新成员
      teamStore.members.push({ id: '2', name: 'Agent', role: ROLES.AGENT } as any)

      // 统计应该自动更新
      expect(controller.stats.value.totalMembers).toBe(2)
    })
  })
})
