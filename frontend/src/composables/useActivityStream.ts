/**
 * Activity Stream Composable
 * WebSocket-based实时活动流 - Dashboard活动动态展示
 */

import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'
import { useWebSocket } from './useWebSocket'
import type { Activity, ActivityType, ActivityPriority } from '@/types/activity'
import type { Message } from '@/types'
import { getWebSocketManager } from '@/services/websocketManager'

export interface UseActivityStreamOptions {
  maxActivities?: number
  autoConnect?: boolean
  priorityFilter?: ActivityPriority[]
}

export function useActivityStream(options: UseActivityStreamOptions = {}) {
  const {
    maxActivities = 50,
    autoConnect = true,
    priorityFilter = []
  } = options

  // WebSocket connection
  const { isConnected, connect, disconnect } = useWebSocket({
    autoConnect,
    reconnectOnAuth: true
  })

  // State
  const activities: Ref<Activity[]> = ref([])
  const loading = ref(false)
  const error: Ref<Error | null> = ref(null)

  // Activity priority mapping
  const activityPriorityMap: Record<string, ActivityPriority> = {
    'message': 'medium',
    'assignment': 'high',
    'resolved': 'medium',
    'urgent': 'high',
    'system-error': 'high',
    'system-success': 'low',
    'system-warning': 'medium',
    'system-info': 'low',
    'user': 'low',
    'settings': 'medium',
    'settings-critical': 'high'
  }

  // Computed
  const filteredActivities = computed(() => {
    if (priorityFilter.length === 0) {
      return activities.value
    }
    return activities.value.filter(activity =>
      priorityFilter.includes(activity.priority)
    )
  })

  const highPriorityActivities = computed(() =>
    activities.value.filter(a => a.priority === 'high')
  )

  const mediumPriorityActivities = computed(() =>
    activities.value.filter(a => a.priority === 'medium')
  )

  const recentActivities = computed(() =>
    activities.value.slice(0, 10)
  )

  /**
   * 添加活动到列表
   */
  function addActivity(activity: Activity) {
    activities.value.unshift(activity)

    // 限制最大数量
    if (activities.value.length > maxActivities) {
      activities.value = activities.value.slice(0, maxActivities)
    }
  }

  /**
   * 创建活动对象
   */
  function createActivity(
    type: ActivityType,
    title: string,
    description: string,
    metadata?: Record<string, unknown>
  ): Activity {
    return {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      priority: activityPriorityMap[type] || 'low',
      title,
      description,
      createdAt: new Date(),
      metadata
    }
  }

  /**
   * 处理新消息事件
   */
  function handleNewMessage(conversationId: string, message: Message) {
    const activity = createActivity(
      'message',
      '新消息',
      `收到來自對話 #${conversationId.slice(0, 8)} 的新訊息`,
      {
        conversationId,
        messageId: message.id,
        senderId: message.senderId
      }
    )
    addActivity(activity)
  }

  /**
   * 处理对话更新事件
   */
  function handleConversationUpdate(conversationId: string, data: unknown) {
    const updateData = data as { status?: string; assignedTo?: string }

    if (updateData.status === 'resolved') {
      const activity = createActivity(
        'resolved',
        '對話已解決',
        `對話 #${conversationId.slice(0, 8)} 已成功解決`,
        { conversationId }
      )
      addActivity(activity)
    } else if (updateData.assignedTo) {
      const activity = createActivity(
        'assignment',
        '對話分配',
        `對話 #${conversationId.slice(0, 8)} 已分配給客服人員`,
        { conversationId, assignedTo: updateData.assignedTo }
      )
      addActivity(activity)
    }
  }

  /**
   * 处理通知事件
   */
  function handleNotification(notification: unknown) {
    const notifData = notification as {
      type?: string
      message?: string
      priority?: ActivityPriority
    }

    const activity = createActivity(
      'system-info',
      '系統通知',
      notifData.message || '收到新的系統通知',
      { notification }
    )

    // 如果通知有优先级，使用它
    if (notifData.priority) {
      activity.priority = notifData.priority
    }

    addActivity(activity)
  }

  /**
   * 处理错误
   */
  function handleError(err: Error) {
    error.value = err

    const activity = createActivity(
      'system-error',
      'WebSocket 錯誤',
      err.message || '連線發生錯誤',
      { error: err.message }
    )
    addActivity(activity)
  }

  /**
   * 初始化 WebSocket 事件监听
   */
  function setupWebSocketListeners() {
    const manager = getWebSocketManager()

    manager.setEventCallbacks({
      onConversationMessage: handleNewMessage,
      onConversationUpdate: handleConversationUpdate,
      onNotification: handleNotification,
      onError: handleError
    })
  }

  /**
   * 清理活动列表
   */
  function clearActivities() {
    activities.value = []
  }

  /**
   * 手动添加活动（用于测试或系统生成）
   */
  function addManualActivity(
    type: ActivityType,
    title: string,
    description: string,
    priority?: ActivityPriority
  ) {
    const activity = createActivity(type, title, description)
    if (priority) {
      activity.priority = priority
    }
    addActivity(activity)
  }

  // Lifecycle
  onMounted(() => {
    if (autoConnect) {
      setupWebSocketListeners()

      // 添加一个欢迎活动
      addActivity(createActivity(
        'system-success',
        '活動流已啟動',
        'WebSocket 活動流已成功連接',
        { timestamp: Date.now() }
      ))
    }
  })

  onUnmounted(() => {
    // 清理资源
    if (isConnected.value) {
      disconnect()
    }
  })

  return {
    // State
    activities: filteredActivities,
    allActivities: activities,
    loading,
    error,
    isConnected,

    // Computed
    highPriorityActivities,
    mediumPriorityActivities,
    recentActivities,

    // Methods
    connect,
    disconnect,
    clearActivities,
    addManualActivity,
    setupWebSocketListeners
  }
}
