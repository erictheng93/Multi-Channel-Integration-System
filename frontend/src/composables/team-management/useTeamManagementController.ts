/**
 * Team Management Controller
 *
 * 主控制器 - 集成所有团队管理功能
 *
 * 职责：
 * - 协调各个子控制器
 * - 管理全局状态
 * - 提供统一接口给视图层
 * - 处理生命周期（初始化、清理）
 *
 * @module composables/team-management/useTeamManagementController
 */

import { computed, type ComputedRef, type Ref } from 'vue'
import { useTeamStore } from '@/stores/team'
import { useMemberOperations, type UseMemberOperationsReturn } from './useMemberOperations'
import { useTeamOperations, type UseTeamOperationsReturn } from './useTeamOperations'
import { useTeamStats, type TeamStatsData } from './useTeamStats'
import {
  useMemberListSorting,
  useTeamListSorting,
  type SortState,
  type SortOption,
  type MemberSortField,
  type TeamSortField
} from '@/composables/useListSorting'
import type { TeamMember } from '@/types'

// ==================== Types ====================

export interface Team {
  id: number
  name: string
  description?: string
  qrCode?: string
  lineUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  memberCount?: number
}

// Sorting Types
export interface ListSortingControls<T extends string> {
  sortState: Ref<SortState<T>>
  sortOptions: SortOption<T>[]
  currentSortLabel: ComputedRef<string>
  setSortField: (field: T) => void
  toggleSortOrder: () => void
}

export interface UseTeamManagementControllerReturn {
  // Global State
  loading: ComputedRef<boolean>
  teams: ComputedRef<Team[]>
  members: ComputedRef<TeamMember[]>
  stats: ComputedRef<TeamStatsData>

  // Sorting Controls
  memberSorting: ListSortingControls<MemberSortField>
  teamSorting: ListSortingControls<TeamSortField>

  // Sub-Controllers
  member: UseMemberOperationsReturn
  team: UseTeamOperationsReturn

  // Lifecycle
  initialize: () => Promise<void>
  cleanup: () => void
  refresh: () => Promise<void>
}

// ==================== Composable ====================

/**
 * 团队管理主控制器
 *
 * 这是团队管理功能的统一入口，集成了所有子功能模块。
 *
 * @example
 * ```typescript
 * // 在 TeamManagement.vue 中使用
 * const controller = useTeamManagementController()
 *
 * onMounted(async () => {
 *   await controller.initialize()
 * })
 *
 * onUnmounted(() => {
 *   controller.cleanup()
 * })
 *
 * // 访问成员操作
 * controller.member.openAddMemberModal()
 *
 * // 访问团队操作
 * controller.team.openAddTeamModal()
 *
 * // 访问统计数据
 * console.log(controller.stats.value.totalMembers)
 * ```
 */
export function useTeamManagementController(): UseTeamManagementControllerReturn {
  const teamStore = useTeamStore()

  // ==================== Sub-Controllers ====================

  // 成员操作控制器
  const memberOps = useMemberOperations()

  // 团队操作控制器
  const teamOps = useTeamOperations()

  // 统计数据控制器
  const statsOps = useTeamStats()

  // ==================== Sorting ====================

  // 成员列表排序（含 localStorage 持久化）
  const memberSortingOps = useMemberListSorting()

  // 团队列表排序（含 localStorage 持久化）
  const teamSortingOps = useTeamListSorting()

  // ==================== Global State ====================

  /**
   * 全局加载状态
   */
  const loading = computed(() => teamStore.loading)

  /**
   * 团队列表（响应式）
   * 使用 computed 确保数据是最新的，并且与 Store 同步
   * 应用前端排序
   */
  const teams = computed(() => {
    return teamSortingOps.sortFn(teamStore.teams, (team, field) => {
      switch (field) {
        case 'createdAt': return team.createdAt
        case 'name': return team.name
        case 'memberCount': return team.memberCount ?? 0
        case 'isActive': return team.isActive
        default: return team.createdAt
      }
    })
  })

  /**
   * 成员列表（响应式）
   * 系统管理员固定在顶部，其餘應用排序
   */
  const members = computed(() => {
    const allMembers = teamStore.members

    // 識別系統管理員
    const systemAdmin = allMembers.find(member =>
      member.role === 'admin' && (
        member.name?.includes('系統管理員') ||
        member.name?.includes('System Administrator') ||
        member.name?.toLowerCase().includes('admin') ||
        member.loginId === 'admin' ||
        member.email?.includes('admin')
      )
    )

    // 過濾出其他成員
    const otherMembers = allMembers.filter(member =>
      !(member.role === 'admin' && (
        member.name?.includes('系統管理員') ||
        member.name?.includes('System Administrator') ||
        member.name?.toLowerCase().includes('admin') ||
        member.loginId === 'admin' ||
        member.email?.includes('admin')
      ))
    )

    // 對其他成員進行排序
    const sortedOtherMembers = memberSortingOps.sortFn(otherMembers, (member, field) => {
      switch (field) {
        case 'createdAt': return member.createdAt
        case 'name': return member.name || member.loginId
        case 'email': return member.email
        case 'role': return member.role
        case 'isActive': return member.status === 'active'
        default: return member.createdAt
      }
    })

    // 系統管理員固定在頂部
    return systemAdmin ? [systemAdmin, ...sortedOtherMembers] : sortedOtherMembers
  })

  /**
   * 统计数据（响应式）
   */
  const stats = computed(() => statsOps.stats.value)

  // ==================== Lifecycle Methods ====================

  /**
   * 初始化
   * 载入所有必要的数据
   */
  async function initialize() {
    console.log('🚀 [TeamManagementController] Initializing...')

    try {
      // 并行载入团队和成员数据
      await Promise.all([
        teamStore.loadMembers(),
        teamStore.loadTeams()
      ])

      console.log('✅ [TeamManagementController] Data loaded successfully')
      console.log(`   - Teams: ${teams.value.length}`)
      console.log(`   - Members: ${members.value.length}`)
    } catch (error) {
      console.error('❌ [TeamManagementController] Initialization failed:', error)
      throw error
    }
  }

  /**
   * 清理
   * 停止所有后台任务
   */
  function cleanup() {
    console.log('🧹 [TeamManagementController] Cleaning up...')
    console.log('✅ [TeamManagementController] Cleanup complete')
  }

  /**
   * 刷新数据
   * 强制重新载入所有数据
   */
  async function refresh() {
    console.log('🔄 [TeamManagementController] Refreshing data...')

    try {
      await initialize()
      console.log('✅ [TeamManagementController] Refresh complete')
    } catch (error) {
      console.error('❌ [TeamManagementController] Refresh failed:', error)
      throw error
    }
  }

  // ==================== Return ====================

  return {
    // Global State
    loading,
    teams,
    members,
    stats,

    // Sorting Controls
    memberSorting: {
      sortState: memberSortingOps.sortState,
      sortOptions: memberSortingOps.sortOptions,
      currentSortLabel: memberSortingOps.currentSortLabel,
      setSortField: memberSortingOps.setSortField,
      toggleSortOrder: memberSortingOps.toggleSortOrder
    },
    teamSorting: {
      sortState: teamSortingOps.sortState,
      sortOptions: teamSortingOps.sortOptions,
      currentSortLabel: teamSortingOps.currentSortLabel,
      setSortField: teamSortingOps.setSortField,
      toggleSortOrder: teamSortingOps.toggleSortOrder
    },

    // Sub-Controllers
    // 成员操作（新增、编辑、删除、密码重置等）
    member: memberOps,

    // 团队操作（新增、编辑、删除、状态切换等）
    team: teamOps,

    // Lifecycle
    initialize,
    cleanup,
    refresh
  }
}
