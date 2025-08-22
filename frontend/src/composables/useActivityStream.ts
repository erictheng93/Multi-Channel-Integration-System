// SSE 活動流 Composable
import { ref, onMounted, onUnmounted, readonly, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
// ActivityLog type definition (matching backend)
interface ActivityLog {
  id: number
  userId: string
  userName: string
  userRole: string
  action: string
  resourceType: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

interface SSEMessage {
  type: 'connected' | 'activities_update' | 'heartbeat' | 'error'
  data?: ActivityLog[]
  message?: string
  timestamp: string
  userId?: string
}

export function useActivityStream() {
  const authStore = useAuthStore()
  const token = computed(() => authStore.token)
  const isAuthenticated = computed(() => authStore.isAuthenticated)
  
  // 狀態管理
  const activities = ref<ActivityLog[]>([])
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const error = ref<string | null>(null)
  const lastUpdateTime = ref<Date | null>(null)
  const retryCount = ref(0)
  const maxRetries = 5
  
  // SSE 相關
  let eventSource: EventSource | null = null
  let reconnectTimer: number | null = null
  let connectionCheckTimer: number | null = null

  // 計算屬性
  const connectionStatus = computed(() => {
    if (!isAuthenticated.value) {return '🔐 未登入'}
    if (isConnecting.value) {return '🔄 連線中...'}
    if (isConnected.value) {return '🟢 即時連線'}
    if (error.value) {return '🔴 連線錯誤'}
    return '⚪ 離線'
  })

  const hasRecentUpdate = computed(() => {
    if (!lastUpdateTime.value) {return false}
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    return lastUpdateTime.value > fiveMinutesAgo
  })

  // 建立 SSE 連接
  const connect = () => {
    if (!token.value || !isAuthenticated.value) {
      error.value = '需要登入才能建立連線'
      console.warn('❌ Cannot connect: not authenticated')
      return
    }

    if (eventSource) {
      console.log('🔄 Closing existing connection before reconnecting')
      disconnect()
    }

    isConnecting.value = true
    error.value = null

    try {
      console.log('🚀 Establishing SSE connection...')
      
      // 建立 EventSource 連接，通過查詢參數傳遞 token
      const url = `/api/activities/stream?token=${encodeURIComponent(token.value)}`
      eventSource = new EventSource(url, {
        withCredentials: false
      })
      
      eventSource.onopen = () => {
        console.log('✅ SSE connection established')
        isConnected.value = true
        isConnecting.value = false
        error.value = null
        retryCount.value = 0
        lastUpdateTime.value = new Date()
        
        // 開始連接檢查
        startConnectionCheck()
      }

      eventSource.onmessage = (event) => {
        try {
          const data: SSEMessage = JSON.parse(event.data)
          handleSSEMessage(data)
        } catch (err) {
          console.error('❌ Failed to parse SSE message:', err, event.data)
        }
      }

      eventSource.onerror = (event) => {
        console.error('❌ SSE connection error:', event)
        isConnected.value = false
        isConnecting.value = false
        error.value = '連線中斷'
        
        // 自動重連機制
        if (retryCount.value < maxRetries) {
          scheduleReconnect()
        } else {
          error.value = `連線失敗，已嘗試 ${maxRetries} 次`
          console.error(`❌ Max retries (${maxRetries}) reached`)
        }
      }

    } catch (err) {
      console.error('❌ Failed to create EventSource:', err)
      isConnecting.value = false
      error.value = '無法建立連線'
    }
  }

  // 處理 SSE 訊息
  const handleSSEMessage = (data: SSEMessage) => {
    lastUpdateTime.value = new Date()
    
    switch (data.type) {
      case 'connected':
        console.log('🔗 SSE connection confirmed:', data.message)
        break
        
      case 'activities_update':
        if (data.data && Array.isArray(data.data)) {
          activities.value = data.data
          console.log(`📊 Received ${data.data.length} activities`)
        }
        break
        
      case 'heartbeat':
        console.log('💓 Heartbeat received')
        break
        
      case 'error':
        console.error('❌ Server error:', data.message)
        error.value = data.message || '伺服器錯誤'
        break
        
      default:
        console.log('❓ Unknown SSE message type:', data.type)
    }
  }

  // 排程重連
  const scheduleReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
    }
    
    retryCount.value++
    const delay = Math.min(1000 * Math.pow(2, retryCount.value - 1), 30000) // 指數退避，最多30秒
    
    console.log(`🔄 Scheduling reconnect #${retryCount.value} in ${delay}ms`)
    
    reconnectTimer = window.setTimeout(() => {
      if (isAuthenticated.value) {
        connect()
      }
    }, delay)
  }

  // 開始連接檢查
  const startConnectionCheck = () => {
    if (connectionCheckTimer) {
      clearInterval(connectionCheckTimer)
    }
    
    connectionCheckTimer = window.setInterval(() => {
      if (eventSource && eventSource.readyState === EventSource.CLOSED) {
        console.log('🔍 Connection check: connection is closed, attempting reconnect')
        isConnected.value = false
        scheduleReconnect()
      }
    }, 10000) // 每10秒檢查一次
  }

  // 斷開連接
  const disconnect = () => {
    console.log('🔌 Disconnecting SSE stream')
    
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    
    if (connectionCheckTimer) {
      clearInterval(connectionCheckTimer)
      connectionCheckTimer = null
    }
    
    isConnected.value = false
    isConnecting.value = false
    retryCount.value = 0
  }

  // 手動重連
  const reconnect = () => {
    console.log('🔄 Manual reconnect requested')
    disconnect()
    error.value = null
    retryCount.value = 0
    
    if (isAuthenticated.value) {
      connect()
    }
  }

  // 手動刷新活動
  const refreshActivities = async () => {
    try {
      // 發送一個請求到後端強制刷新
      // 或者重新連接來獲取最新數據
      reconnect()
    } catch (err) {
      console.error('❌ Failed to refresh activities:', err)
    }
  }

  // 生命週期管理
  onMounted(() => {
    console.log('🎯 useActivityStream mounted')
    if (isAuthenticated.value) {
      connect()
    }
  })

  onUnmounted(() => {
    console.log('🔚 useActivityStream unmounted')
    disconnect()
  })

  return {
    // 狀態
    activities: readonly(activities),
    isConnected: readonly(isConnected),
    isConnecting: readonly(isConnecting),
    error: readonly(error),
    lastUpdateTime: readonly(lastUpdateTime),
    retryCount: readonly(retryCount),
    
    // 計算屬性
    connectionStatus,
    hasRecentUpdate,
    
    // 方法
    connect,
    disconnect,
    reconnect,
    refreshActivities
  }
}