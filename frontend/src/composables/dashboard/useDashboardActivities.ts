/**
 * Dashboard 活动流数据管理 Composable
 *
 * 功能：
 * - 管理 WebSocket 活动流
 * - 过滤和筛选重要活动
 * - 提供活动图标和时间格式化
 *
 * 使用场景：
 * - Dashboard 活动动态卡片
 * - 实时活动流展示
 */

import { computed } from 'vue'
import { useActivityStream } from '@/composables/useActivityStream'
import { ChatIcon, UserIcon, MessageCircleIcon } from '@/components/icons'
import type { Component } from 'vue'

export interface Activity {
  id: string
  type: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  createdAt: Date
}

export interface UseDashboardActivitiesOptions {
  /**
   * 最大活动数量
   * @default 50
   */
  maxActivities?: number

  /**
   * 是否自动连接
   * @default true
   */
  autoConnect?: boolean

  /**
   * 优先级过滤
   * @default [] (显示所有优先级)
   */
  priorityFilter?: Array<'high' | 'medium' | 'low'>

  /**
   * 重要活动的时间范围（小时）
   * @default 2
   */
  importantTimeRange?: number

  /**
   * 最多显示的重要活动数量
   * @default 8
   */
  maxImportantActivities?: number
}

/**
 * Dashboard 活动流数据管理
 */
export function useDashboardActivities(options: UseDashboardActivitiesOptions = {}) {
  const {
    maxActivities = 50,
    autoConnect = true,
    priorityFilter = [],
    importantTimeRange = 2,
    maxImportantActivities = 8
  } = options

  // WebSocket-based Activity Stream
  const activityStreamData = useActivityStream({
    maxActivities,
    autoConnect,
    priorityFilter
  })

  const activities = activityStreamData.activities
  const isConnected = activityStreamData.isConnected

  /**
   * 筛选重要活动
   * 只显示指定时间范围内的高优先级和中优先级活动
   */
  const importantActivities = computed(() => {
    const timeRangeMs = importantTimeRange * 60 * 60 * 1000
    const cutoffTime = Date.now() - timeRangeMs

    return activities.value
      .filter((activity) => {
        const activityTime = new Date(activity.createdAt).getTime()
        const isRecent = activityTime > cutoffTime
        const isImportant = activity.priority === 'high' || activity.priority === 'medium'
        return isRecent && isImportant
      })
      .slice(0, maxImportantActivities)
  })

  /**
   * 获取活动类型对应的图标
   */
  const getActivityIcon = (type: string): Component => {
    const icons: Record<string, Component> = {
      // 业务活动
      message: MessageCircleIcon,
      assignment: UserIcon,
      resolved: ChatIcon,
      urgent: MessageCircleIcon,

      // 系统状态
      'system-error': MessageCircleIcon,
      'system-success': MessageCircleIcon,
      'system-warning': MessageCircleIcon,
      'system-info': MessageCircleIcon,

      // 用户和设定
      user: UserIcon,
      settings: MessageCircleIcon,
      'settings-critical': MessageCircleIcon
    }
    return icons[type] || MessageCircleIcon
  }

  /**
   * 格式化活动时间为相对时间
   */
  const formatTime = (date: Date): string => {
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) { return '剛剛' }
    if (diffInMinutes < 60) { return `${diffInMinutes} 分鐘前` }
    if (diffInMinutes < 1440) { return `${Math.floor(diffInMinutes / 60)} 小時前` }
    return date.toLocaleDateString('zh-TW')
  }

  return {
    /**
     * 所有活动
     */
    activities,

    /**
     * 重要活动（筛选后）
     */
    importantActivities,

    /**
     * WebSocket 连接状态
     */
    isConnected,

    /**
     * 获取活动图标
     */
    getActivityIcon,

    /**
     * 格式化时间
     */
    formatTime
  }
}
