/**
 * Team Statistics Composable
 *
 * 职责：
 * - 计算团队和成员统计数据
 * - 提供实时响应式统计
 * - 无副作用的纯计算逻辑
 *
 * @module composables/team-management/useTeamStats
 */

import { computed, type ComputedRef } from 'vue'
import { useTeamStore } from '@/stores/team'
import { ROLES } from '@/constants/roles'

export interface TeamStatsData {
  totalMembers: number
  teamCount: number
  adminCount: number
  agentCount: number
  activeTeams: number
  inactiveTeams: number
  averageMembersPerTeam: number
}

export interface UseTeamStatsReturn {
  stats: ComputedRef<TeamStatsData>
  totalMembers: ComputedRef<number>
  teamCount: ComputedRef<number>
  adminCount: ComputedRef<number>
  agentCount: ComputedRef<number>
  activeTeams: ComputedRef<number>
  inactiveTeams: ComputedRef<number>
  averageMembersPerTeam: ComputedRef<number>
}

/**
 * 团队统计数据 Composable
 *
 * @example
 * ```typescript
 * const { stats, totalMembers, adminCount } = useTeamStats()
 *
 * console.log(stats.value.totalMembers) // 15
 * console.log(totalMembers.value)       // 15
 * ```
 */
export function useTeamStats(): UseTeamStatsReturn {
  const teamStore = useTeamStore()

  // 总成员数
  const totalMembers = computed(() => {
    return teamStore.members.length
  })

  // 团队总数
  const teamCount = computed(() => {
    return teamStore.teams.length
  })

  // 管理员数量
  const adminCount = computed(() => {
    return teamStore.members.filter(member =>
      member.role === ROLES.ADMIN
    ).length
  })

  // 客服数量
  const agentCount = computed(() => {
    return teamStore.members.filter(member =>
      member.role === ROLES.AGENT
    ).length
  })

  // 活跃团队数量
  const activeTeams = computed(() => {
    return teamStore.teams.filter(team => team.isActive).length
  })

  // 不活跃团队数量
  const inactiveTeams = computed(() => {
    return teamStore.teams.filter(team => !team.isActive).length
  })

  // 平均每个团队的成员数
  const averageMembersPerTeam = computed(() => {
    const totalTeams = teamCount.value
    if (totalTeams === 0) {
      return 0
    }

    const totalTeamMembers = teamStore.teams.reduce((sum, team) => {
      return sum + (team.memberCount || 0)
    }, 0)

    return Math.round((totalTeamMembers / totalTeams) * 10) / 10 // 保留一位小数
  })

  // 聚合统计对象
  const stats = computed<TeamStatsData>(() => ({
    totalMembers: totalMembers.value,
    teamCount: teamCount.value,
    adminCount: adminCount.value,
    agentCount: agentCount.value,
    activeTeams: activeTeams.value,
    inactiveTeams: inactiveTeams.value,
    averageMembersPerTeam: averageMembersPerTeam.value
  }))

  return {
    // 聚合对象
    stats,

    // 单独访问（便于模板使用）
    totalMembers,
    teamCount,
    adminCount,
    agentCount,
    activeTeams,
    inactiveTeams,
    averageMembersPerTeam
  }
}
