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

import { computed, onMounted } from 'vue'
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
    fetchConversations,
    refreshConversations
  } = conversationsData

  // 初始化時自動載入對話數據
  onMounted(async () => {
    // 只在沒有數據時載入，避免重複請求
    if (!conversations.value || conversations.value.length === 0) {
      console.log('[useDashboardData] 自動載入對話數據...')
      await fetchConversations()
    }
  })

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
   * 最近对话（按時間排序，從新到舊）
   * 優先使用 lastMessageAt，fallback 到 updatedAt
   */
  const recentConversations = computed(() => {
    if (!conversations.value || conversations.value.length === 0) {
      return []
    }

    // 複製陣列避免修改原始數據，然後排序
    return [...conversations.value]
      .sort((a, b) => {
        // 優先使用 lastMessageAt，fallback 到 updatedAt
        const timeA = a.lastMessageAt || a.updatedAt || 0
        const timeB = b.lastMessageAt || b.updatedAt || 0
        // 降序排序（從新到舊）
        return timeB - timeA
      })
      .slice(0, recentConversationsCount)
  })

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
