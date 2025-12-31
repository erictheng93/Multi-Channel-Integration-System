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

import { computed, type ComputedRef } from 'vue'
import { useTeamStore } from '@/stores/team'
import { useMemberOperations, type UseMemberOperationsReturn } from './useMemberOperations'
import { useTeamOperations, type UseTeamOperationsReturn } from './useTeamOperations'
import { useQRCodeOperations, type UseQRCodeOperationsReturn } from './useQRCodeOperations'
import { useTeamStats, type TeamStatsData } from './useTeamStats'
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

export interface UseTeamManagementControllerReturn {
  // Global State
  loading: ComputedRef<boolean>
  teams: ComputedRef<Team[]>
  members: ComputedRef<TeamMember[]>
  stats: ComputedRef<TeamStatsData>

  // Sub-Controllers
  member: UseMemberOperationsReturn
  team: UseTeamOperationsReturn
  qr: UseQRCodeOperationsReturn

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
 * // 访问 QR 码操作
 * await controller.qr.viewQR(team)
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

  // QR 码操作控制器
  const qrOps = useQRCodeOperations()

  // 统计数据控制器
  const statsOps = useTeamStats()

  // ==================== Global State ====================

  /**
   * 全局加载状态
   */
  const loading = computed(() => teamStore.loading)

  /**
   * 团队列表（响应式）
   * 使用 computed 确保数据是最新的，并且与 Store 同步
   */
  const teams = computed(() => teamStore.teams)

  /**
   * 成员列表（响应式）
   * 系统管理员固定在顶部
   */
  const members = computed(() => {
    const allMembers = teamStore.members
    const systemAdmin = allMembers.find(member =>
      member.role === 'admin' && (
        member.name?.includes('系統管理員') ||
        member.name?.includes('System Administrator') ||
        member.name?.toLowerCase().includes('admin') ||
        member.loginId === 'admin' ||
        member.email?.includes('admin')
      )
    )
    const otherMembers = allMembers.filter(member =>
      !(member.role === 'admin' && (
        member.name?.includes('系統管理員') ||
        member.name?.includes('System Administrator') ||
        member.name?.toLowerCase().includes('admin') ||
        member.loginId === 'admin' ||
        member.email?.includes('admin')
      ))
    )

    return systemAdmin ? [systemAdmin, ...otherMembers] : allMembers
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

      // 启动背景 QR 预加载
      qrOps.startBackgroundPreload(teams.value)
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

    // 停止 QR 预加载
    qrOps.stopBackgroundPreload()

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

    // Sub-Controllers
    // 成员操作（新增、编辑、删除、密码重置等）
    member: memberOps,

    // 团队操作（新增、编辑、删除、状态切换等）
    team: teamOps,

    // QR 码操作（查看、下载、预加载等）
    qr: qrOps,

    // Lifecycle
    initialize,
    cleanup,
    refresh
  }
}
