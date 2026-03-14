/**
 * Dashboard 统计数据管理 Composable
 *
 * 功能：
 * - 获取和管理 Dashboard 统计数据
 * - 自动错误处理和默认值
 * - 提供刷新功能
 *
 * 使用场景：
 * - Dashboard 页面统计卡片
 * - 实时数据更新
 */

import { useAsyncData } from '@/composables/useAsyncData'

export interface DashboardStats {
  todayMessages: number
  onlineAgents: number
  responseTime: string | number
  satisfactionRate: number
  resolvedToday: number
}

export interface UseDashboardStatsOptions {
  /**
   * 是否立即获取数据
   * @default true
   */
  immediate?: boolean

  /**
   * 错误时的默认值
   */
  defaultStats?: Partial<DashboardStats>
}

/**
 * Dashboard 统计数据管理
 */
export function useDashboardStats(options: UseDashboardStatsOptions = {}) {
  const {
    immediate = true,
    defaultStats = {}
  } = options

  // 默认统计数据
  const DEFAULT_STATS: DashboardStats = {
    todayMessages: 0,
    onlineAgents: 0,
    responseTime: '-',
    satisfactionRate: 0,
    resolvedToday: 0,
    ...defaultStats
  }

  // 使用 useAsyncData 获取统计数据
  const { data: stats, pending: loading, refresh } = useAsyncData<DashboardStats>(
    'dashboard-stats',
    async () => {
      try {
        // 调用真实 API 获取统计数据
        const { systemApi } = await import('@/api/system')
        const response = await systemApi.getDashboardStats()

        if (!response.success || !response.data) {
          console.error(' Failed to fetch dashboard stats:', response)
          throw new Error('Failed to fetch dashboard stats')
        }

        console.log(' Dashboard stats fetched successfully:', response.data)

        // 返回真实统计数据
        return {
          todayMessages: response.data.todayMessages,
          onlineAgents: response.data.onlineAgents,
          responseTime: response.data.responseTime,
          satisfactionRate: response.data.satisfactionRate,
          resolvedToday: response.data.resolvedToday
        }
      } catch (error) {
        console.error(' Error fetching dashboard stats:', error)
        // 发生错误时返回默认值
        return DEFAULT_STATS
      }
    },
    { immediate }
  )

  return {
    /**
     * 统计数据
     */
    stats,

    /**
     * 加载状态
     */
    loading,

    /**
     * 刷新统计数据
     */
    refresh
  }
}
