/**
 * useTeamStats 单元测试
 *
 * 测试统计数据计算的正确性
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTeamStats } from '@/composables/team-management/useTeamStats'
import { useTeamStore } from '@/stores/team'
import { ROLES } from '@/constants/roles'

describe('useTeamStats', () => {
  beforeEach(() => {
    // 为每个测试创建新的 Pinia 实例
    setActivePinia(createPinia())
  })

  it('应该正确计算总成员数', () => {
    const teamStore = useTeamStore()
    teamStore.members = [
      { id: '1', name: 'User 1', role: ROLES.ADMIN } as any,
      { id: '2', name: 'User 2', role: ROLES.AGENT } as any,
      { id: '3', name: 'User 3', role: ROLES.AGENT } as any
    ]

    const { totalMembers } = useTeamStats()

    expect(totalMembers.value).toBe(3)
  })

  it('应该正确计算团队总数', () => {
    const teamStore = useTeamStore()
    teamStore.teams = [
      { id: 1, name: 'Team 1', isActive: true } as any,
      { id: 2, name: 'Team 2', isActive: false } as any
    ]

    const { teamCount } = useTeamStats()

    expect(teamCount.value).toBe(2)
  })

  it('应该正确计算管理员数量', () => {
    const teamStore = useTeamStore()
    teamStore.members = [
      { id: '1', name: 'Admin 1', role: ROLES.ADMIN } as any,
      { id: '2', name: 'Admin 2', role: ROLES.ADMIN } as any,
      { id: '3', name: 'Agent 1', role: ROLES.AGENT } as any
    ]

    const { adminCount } = useTeamStats()

    expect(adminCount.value).toBe(2)
  })

  it('应该正确计算客服数量', () => {
    const teamStore = useTeamStore()
    teamStore.members = [
      { id: '1', name: 'Admin 1', role: ROLES.ADMIN } as any,
      { id: '2', name: 'Agent 1', role: ROLES.AGENT } as any,
      { id: '3', name: 'Agent 2', role: ROLES.AGENT } as any
    ]

    const { agentCount } = useTeamStats()

    expect(agentCount.value).toBe(2)
  })

  it('应该正确计算活跃团队数量', () => {
    const teamStore = useTeamStore()
    teamStore.teams = [
      { id: 1, name: 'Team 1', isActive: true } as any,
      { id: 2, name: 'Team 2', isActive: true } as any,
      { id: 3, name: 'Team 3', isActive: false } as any
    ]

    const { activeTeams } = useTeamStats()

    expect(activeTeams.value).toBe(2)
  })

  it('应该正确计算不活跃团队数量', () => {
    const teamStore = useTeamStore()
    teamStore.teams = [
      { id: 1, name: 'Team 1', isActive: true } as any,
      { id: 2, name: 'Team 2', isActive: false } as any,
      { id: 3, name: 'Team 3', isActive: false } as any
    ]

    const { inactiveTeams } = useTeamStats()

    expect(inactiveTeams.value).toBe(2)
  })

  it('应该正确计算平均每个团队的成员数', () => {
    const teamStore = useTeamStore()
    teamStore.teams = [
      { id: 1, name: 'Team 1', memberCount: 5 } as any,
      { id: 2, name: 'Team 2', memberCount: 3 } as any,
      { id: 3, name: 'Team 3', memberCount: 2 } as any
    ]

    const { averageMembersPerTeam } = useTeamStats()

    // (5 + 3 + 2) / 3 = 3.33... ≈ 3.3 (保留一位小数)
    expect(averageMembersPerTeam.value).toBe(3.3)
  })

  it('当没有团队时，平均成员数应该为 0', () => {
    const teamStore = useTeamStore()
    teamStore.teams = []

    const { averageMembersPerTeam } = useTeamStats()

    expect(averageMembersPerTeam.value).toBe(0)
  })

  it('应该返回聚合的统计对象', () => {
    const teamStore = useTeamStore()
    teamStore.members = [
      { id: '1', name: 'Admin 1', role: ROLES.ADMIN } as any,
      { id: '2', name: 'Agent 1', role: ROLES.AGENT } as any,
      { id: '3', name: 'Agent 2', role: ROLES.AGENT } as any
    ]
    teamStore.teams = [
      { id: 1, name: 'Team 1', isActive: true, memberCount: 2 } as any,
      { id: 2, name: 'Team 2', isActive: false, memberCount: 1 } as any
    ]

    const { stats } = useTeamStats()

    expect(stats.value).toEqual({
      totalMembers: 3,
      teamCount: 2,
      adminCount: 1,
      agentCount: 2,
      activeTeams: 1,
      inactiveTeams: 1,
      averageMembersPerTeam: 1.5
    })
  })

  it('统计数据应该是响应式的', async () => {
    const teamStore = useTeamStore()
    teamStore.members = [
      { id: '1', name: 'User 1', role: ROLES.ADMIN } as any
    ]

    const { totalMembers } = useTeamStats()

    expect(totalMembers.value).toBe(1)

    // 添加新成员
    teamStore.members.push({ id: '2', name: 'User 2', role: ROLES.AGENT } as any)

    // 统计应该自动更新
    expect(totalMembers.value).toBe(2)
  })
})
