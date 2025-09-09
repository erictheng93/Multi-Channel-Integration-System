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
  let eventSource: globalThis.EventSource | null = null
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
  const connect = async () => {
    if (!token.value || !isAuthenticated.value) {
      error.value = '需要登入才能建立連線'
      console.warn('❌ [SSE Client] Cannot connect: not authenticated')
      return
    }

    // 檢查 token 是否需要刷新
    if (authStore.shouldRefreshToken()) {
      console.log('🔄 [SSE Client] Token needs refresh before connecting')
      try {
        const refreshResult = await authStore.refreshAuthToken()
        if (!refreshResult.success) {
          error.value = '認證失敗，無法連線'
          console.error('❌ [SSE Client] Token refresh failed before connect:', refreshResult.error)
          return
        }
        console.log('✅ [SSE Client] Token refreshed successfully before connect')
      } catch (refreshError) {
        error.value = '認證失敗，無法連線'
        console.error('❌ [SSE Client] Token refresh exception before connect:', refreshError)
        return
      }
    }

    if (eventSource) {
      console.log('🔄 [SSE Client] Closing existing connection before reconnecting')
      disconnect()
    }

    isConnecting.value = true
    error.value = null

    try {
      console.log('🚀 [SSE Client] Establishing SSE connection...')
      
      // 建立 EventSource 連接，通過查詢參數傳遞 token
      // 根據環境決定 URL
      const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
      const isRemoteApi = baseUrl && !baseUrl.includes('localhost')
      
      // 如果是遠端 API，直接使用完整 URL；否則使用相對路徑
      const url = isRemoteApi 
        ? `${baseUrl}/api/activities/stream?token=${encodeURIComponent(token.value)}`
        : `/api/activities/stream?token=${encodeURIComponent(token.value)}`
      
      console.log('🌐 [SSE Client] Connecting to:', url.replace(/token=[^&]+/, 'token=***'))
      
      eventSource = new globalThis.EventSource(url, {
        withCredentials: false
      })
      
      eventSource.onopen = () => {
        console.log('✅ [SSE Client] Connection established successfully')
        console.log('📊 [SSE Client] Connection state:', {
          readyState: eventSource?.readyState,
          url: eventSource?.url?.replace(/token=[^&]+/, 'token=***')
        })
        isConnected.value = true
        isConnecting.value = false
        error.value = null
        retryCount.value = 0
        lastUpdateTime.value = new Date()
        
        // 開始連接檢查
        startConnectionCheck()
      }

      eventSource.onmessage = (event) => {
        console.log('📩 [SSE Client] Received message:', {
          timestamp: new Date().toISOString(),
          data: event.data.substring(0, 200) + (event.data.length > 200 ? '...' : '')
        })
        
        try {
          const data: SSEMessage = JSON.parse(event.data)
          console.log('📋 [SSE Client] Parsed message:', {
            type: data.type,
            dataLength: data.data?.length || 0,
            timestamp: data.timestamp
          })
          handleSSEMessage(data)
        } catch (err) {
          console.error('❌ [SSE Client] Failed to parse SSE message:', err, event.data)
        }
      }

      eventSource.onerror = async (event) => {
        console.error('❌ [SSE Client] Connection error:', {
          readyState: eventSource?.readyState,
          error: event,
          timestamp: new Date().toISOString()
        })
        isConnected.value = false
        isConnecting.value = false
        error.value = '連線中斷'
        
        // 檢查是否為認證錯誤 (401) - EventSource doesn't expose HTTP status directly, 
        // but we can infer from connection failures with valid tokens
        if (eventSource?.readyState === (window as any).EventSource.CLOSED && token.value && authStore.shouldRefreshToken()) {
          console.log('🔄 [SSE Client] Attempting token refresh before reconnect')
          try {
            const refreshResult = await authStore.refreshAuthToken()
            if (refreshResult.success) {
              console.log('✅ [SSE Client] Token refreshed successfully, reconnecting...')
              // Reset retry count since we have a new token
              retryCount.value = 0
              scheduleReconnect()
              return
            } else {
              console.error('❌ [SSE Client] Token refresh failed:', refreshResult.error)
              error.value = '認證失敗'
              return
            }
          } catch (refreshError) {
            console.error('❌ [SSE Client] Token refresh exception:', refreshError)
            error.value = '認證失敗'
            return
          }
        }
        
        // 自動重連機制
        if (retryCount.value < maxRetries) {
          console.log(`🔄 [SSE Client] Scheduling reconnect attempt ${retryCount.value + 1}/${maxRetries}`)
          scheduleReconnect()
        } else {
          error.value = `連線失敗，已嘗試 ${maxRetries} 次`
          console.error(`❌ [SSE Client] Max retries (${maxRetries}) reached`)
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
    
    console.log('🔄 [SSE Client] Processing message type:', data.type)
    
    switch (data.type) {
      case 'connected':
        console.log('🔗 [SSE Client] Connection confirmed:', data.message)
        break
        
      case 'activities_update':
        if (data.data && Array.isArray(data.data)) {
          const previousCount = activities.value.length
          activities.value = data.data
          console.log(`📊 [SSE Client] Activities updated: ${previousCount} → ${data.data.length}`)
          console.log('📋 [SSE Client] Latest activities:', data.data.slice(0, 3).map(a => ({
            action: a.action,
            resourceType: a.resourceType,
            createdAt: a.createdAt
          })))
        } else {
          console.warn('⚠️ [SSE Client] Invalid activities_update data:', data.data)
        }
        break
        
      case 'heartbeat':
        console.log('💓 [SSE Client] Heartbeat received at', data.timestamp)
        break
        
      case 'error':
        console.error('❌ [SSE Client] Server error:', data.message)
        error.value = data.message || '伺服器錯誤'
        break
        
      default:
        console.log('❓ [SSE Client] Unknown SSE message type:', data.type)
        console.log('📄 [SSE Client] Full message data:', data)
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
    
    reconnectTimer = window.setTimeout(async () => {
      if (isAuthenticated.value) {
        await connect()
      }
    }, delay)
  }

  // 開始連接檢查
  const startConnectionCheck = () => {
    if (connectionCheckTimer) {
      clearInterval(connectionCheckTimer)
    }
    
    connectionCheckTimer = window.setInterval(async () => {
      if (eventSource && eventSource.readyState === globalThis.EventSource.CLOSED) {
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
  const reconnect = async () => {
    console.log('🔄 Manual reconnect requested')
    disconnect()
    error.value = null
    retryCount.value = 0
    
    if (isAuthenticated.value) {
      await connect()
    }
  }

  // 手動刷新活動
  const refreshActivities = async () => {
    try {
      // 發送一個請求到後端強制刷新
      // 或者重新連接來獲取最新數據
      await reconnect()
    } catch (err) {
      console.error('❌ Failed to refresh activities:', err)
    }
  }

  // 生命週期管理
  onMounted(async () => {
    console.log('🎯 useActivityStream mounted')
    if (isAuthenticated.value) {
      await connect()
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