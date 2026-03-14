/**
 * Activity Stream Composable
 * WebSocket-based实时活动流 - Dashboard活动动态展示
 *
 * Phase B3: Migrated to use global WebSocket Store with subscription pattern
 */

import { ref, computed, watch, onMounted, onUnmounted, type Ref } from 'vue'
import { useWebSocketStore, type SubscriptionId, type WebSocketConnectionState } from '@/stores/websocket'
import type { WebSocketMessage } from '@/services/websocketClient'
import type { Activity, ActivityType, ActivityPriority } from '@/types/activity'
import type { Message } from '@/types'

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

  // Global WebSocket Store (Phase B3)
  const wsStore = useWebSocketStore()

  // Subscription management
  let activitySubscriptionId: SubscriptionId | null = null

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
   * 处理实时活动更新 (Phase B3)
   * Handles WebSocket messages from the 'activity' channel
   */
  function handleRealtimeActivity(message: WebSocketMessage) {
    console.log('[ActivityStream] Real-time activity:', message.type)

    try {
      switch (message.type) {
        case 'new_message':
          if (message.conversationId && message.data) {
            handleNewMessage(message.conversationId, message.data as Message)
          }
          break

        case 'conversation_updated':
          if (message.conversationId && message.data) {
            handleConversationUpdate(message.conversationId, message.data)
          }
          break

        case 'notification':
          if (message.data) {
            handleNotification(message.data)
          }
          break

        case 'activity':
          // Generic activity event
          if (message.data) {
            const activityData = message.data as {
              type: ActivityType
              title: string
              description: string
              priority?: ActivityPriority
            }
            const activity = createActivity(
              activityData.type,
              activityData.title,
              activityData.description
            )
            if (activityData.priority) {
              activity.priority = activityData.priority
            }
            addActivity(activity)
          }
          break

        default:
          console.warn('[ActivityStream] Unhandled message type:', message.type)
      }
    } catch (err) {
      console.error('[ActivityStream] Error handling activity:', err)
      if (err instanceof Error) {
        handleError(err)
      }
    }
  }

  /**
   * 初始化 WebSocket 订阅 (Phase B3)
   */
  async function setupWebSocketListeners() {
    console.log('[ActivityStream] Initializing WebSocket subscription...')

    // Ensure global WebSocket is connected
    if (!wsStore.isConnected) {
      await wsStore.connect()
    }

    // Subscribe to activity channel
    activitySubscriptionId = wsStore.subscribe('activity', (message) => {
      handleRealtimeActivity(message)
    })

    console.log(`[ActivityStream] Subscribed to activity channel (ID: ${activitySubscriptionId?.substring(0, 8)})`)
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

  // ==================== Connection State Watcher ====================

  /**
   * 上一次連線狀態（用於偵測狀態變化）
   */
  let previousConnectionState: WebSocketConnectionState | null = null

  /**
   * 監聽連線狀態變化，添加對應的活動記錄
   * 這是事件驅動的方式，只有當狀態真正改變時才會添加活動
   */
  function setupConnectionStateWatcher() {
    watch(
      () => wsStore.connectionState,
      (newState, oldState) => {
        // 避免重複處理相同狀態
        if (newState === previousConnectionState) {
          return
        }
        previousConnectionState = newState

        console.log(`[ActivityStream] Connection state: ${oldState} → ${newState}`)

        switch (newState) {
          case 'connecting':
            addActivity(createActivity(
              'system-info',
              '正在連接',
              '即時更新服務連接中...',
              { timestamp: Date.now() }
            ))
            break

          case 'connected':
            addActivity(createActivity(
              'system-success',
              '即時更新已啟用',
              oldState === 'reconnecting'
                ? '重新連線成功，即時更新已恢復'
                : '已成功連接即時更新服務',
              { timestamp: Date.now() }
            ))
            break

          case 'reconnecting':
            addActivity(createActivity(
              'system-warning',
              '正在重新連線',
              `連線中斷，正在嘗試重新連線 (第 ${wsStore.reconnectAttempts} 次)...`,
              { timestamp: Date.now(), attempt: wsStore.reconnectAttempts }
            ))
            break

          case 'error':
            addActivity(createActivity(
              'system-error',
              '連線失敗',
              '即時更新服務連線失敗，新訊息可能延遲顯示',
              { timestamp: Date.now(), error: wsStore.lastError?.message }
            ))
            break

          case 'disconnected':
            // 只有從連線狀態變成斷線時才顯示
            if (oldState === 'connected' || oldState === 'reconnecting') {
              addActivity(createActivity(
                'system-warning',
                '即時更新已暫停',
                '連線已中斷，請點擊重新連線按鈕恢復即時更新',
                { timestamp: Date.now() }
              ))
            }
            break
        }
      },
      { immediate: false } // 不立即觸發，等待真正的狀態變化
    )
  }

  // Lifecycle
  onMounted(async () => {
    if (autoConnect) {
      // 設置連線狀態監聽器（事件驅動）
      setupConnectionStateWatcher()

      // 設置 WebSocket 訂閱
      await setupWebSocketListeners()
    }
  })

  onUnmounted(() => {
    console.log('[ActivityStream] Cleaning up...')

    // Unsubscribe from activity channel
    if (activitySubscriptionId) {
      wsStore.unsubscribe(activitySubscriptionId)
      activitySubscriptionId = null
      console.log('[ActivityStream] Unsubscribed from activity channel')
    }
  })

  return {
    // State
    activities: filteredActivities,
    allActivities: activities,
    loading,
    error,
    isConnected: computed(() => wsStore.isConnected),
    isConnecting: computed(() => wsStore.isConnecting),
    connectionState: computed(() => wsStore.connectionState),
    reconnectAttempts: computed(() => wsStore.reconnectAttempts),
    latency: computed(() => wsStore.latency),

    // Computed
    highPriorityActivities,
    mediumPriorityActivities,
    recentActivities,

    // Methods
    connect: () => wsStore.connect(),
    disconnect: () => {
      if (activitySubscriptionId) {
        wsStore.unsubscribe(activitySubscriptionId)
        activitySubscriptionId = null
      }
    },
    reconnect: () => wsStore.reconnect(),
    clearActivities,
    addManualActivity,
    setupWebSocketListeners
  }
}
