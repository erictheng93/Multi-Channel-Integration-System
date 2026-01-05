/**
 * Dashboard 整合数据管理 Composable
 *
 * 功能：
 * - 整合对话数据
 * - 提供格式化的日期
 * - 统一刷新接口
 * - 导航辅助函数
 *
 * 使用场景：
 * - Dashboard 主组件数据整合
 * - 多数据源协调
 */

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useConversations } from '@/composables/useConversations'
import type { Conversation } from '@/types'

export interface UseDashboardDataOptions {
  /**
   * 显示的最近对话数量
   * @default 5
   */
  recentConversationsCount?: number
}

/**
 * Dashboard 整合数据管理
 */
export function useDashboardData(options: UseDashboardDataOptions = {}) {
  const {
    recentConversationsCount = 5
  } = options

  const router = useRouter()

  // 对话数据
  const conversationsData = useConversations()
  const {
    conversations,
    openConversations,
    assignedConversations,
    loading: conversationsLoading,
    refreshConversations
  } = conversationsData

  /**
   * 当前日期（格式化）
   */
  const currentDate = computed(() => {
    return new Date().toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  })

  /**
   * 最近对话（限制数量）
   */
  const recentConversations = computed(() =>
    conversations.value?.slice(0, recentConversationsCount) || []
  )

  /**
   * 导航到对话详情
   */
  const goToConversation = (conversation: Conversation) => {
    router.push(`/conversations/${conversation.id}`)
  }

  /**
   * 刷新对话数据
   */
  const refresh = async () => {
    await refreshConversations()
  }

  return {
    /**
     * 所有对话
     */
    conversations,

    /**
     * 待处理对话（open 状态）
     */
    openConversations,

    /**
     * 处理中对话（assigned 状态）
     */
    assignedConversations,

    /**
     * 最近对话
     */
    recentConversations,

    /**
     * 对话数据加载状态
     */
    loading: conversationsLoading,

    /**
     * 当前日期（格式化）
     */
    currentDate,

    /**
     * 导航到对话详情
     */
    goToConversation,

    /**
     * 刷新对话数据
     */
    refresh
  }
}
