// 用戶活動追蹤 Composable
import { onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useActivityTracker')

const TRACKED_ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']

let sharedActivityTimer: number | null = null
let sharedSessionExtensionTimer: number | null = null
let sharedLastActivityTime = 0
let trackingConsumers = 0
let activeActivityHandler: ((_event: Event) => void) | null = null

export function useActivityTracker() {
  const authStore = useAuthStore()
  let startedByInstance = false
  
  // 防抖間隔：5分鐘內不重複觸發會話延長
  const SESSION_EXTENSION_DEBOUNCE = 5 * 60 * 1000 // 5分鐘
  // 30分鐘無活動後的超時處理
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30分鐘

  const resetActivityTimer = () => {
    if (sharedActivityTimer) {
      clearTimeout(sharedActivityTimer)
    }
    
    // 30 分鐘無活動後延長會話
    sharedActivityTimer = window.setTimeout(() => {
      if (authStore.isAuthenticated) {
        authStore.autoExtendSession()
        authStore.proactiveTokenRefresh()
      }
    }, INACTIVITY_TIMEOUT)
  }

  const handleUserActivity = () => {
    if (!authStore.isAuthenticated) {return}
    
    const now = Date.now()
    const timeSinceLastActivity = now - sharedLastActivityTime
    
    // 防抖：如果距離上次會話延長不足5分鐘，則跳過
    if (timeSinceLastActivity < SESSION_EXTENSION_DEBOUNCE) {
      resetActivityTimer() // 仍然重置計時器
      return
    }
    
    sharedLastActivityTime = now
    
    if (import.meta.env.DEV) {
      frontendLogger.debug(' User activity detected - extending session (debounced)')
    }
    
    // 清除之前的會話延長計時器
    if (sharedSessionExtensionTimer) {
      clearTimeout(sharedSessionExtensionTimer)
    }
    
    // 立即延長會話，但延遲token刷新以避免循環
    authStore.autoExtendSession()
    
    // 延遲執行 token 刷新，避免與當前操作衝突
    sharedSessionExtensionTimer = window.setTimeout(() => {
      if (authStore.isAuthenticated) {
        authStore.proactiveTokenRefresh()
      }
    }, 2000) // 延遲2秒，避免與用戶操作衝突
    
    resetActivityTimer()
  }

  const startTracking = () => {
    if (startedByInstance) {
      return
    }

    startedByInstance = true
    trackingConsumers += 1

    if (activeActivityHandler !== null) {
      return
    }

    activeActivityHandler = handleUserActivity
    
    TRACKED_ACTIVITY_EVENTS.forEach(event => {
      if (activeActivityHandler) {
        document.addEventListener(event, activeActivityHandler, { passive: true })
      }
    })
    
    if (import.meta.env.DEV) {
      frontendLogger.debug(' Activity tracking started - monitoring user interactions')
    }
    resetActivityTimer()
  }

  const stopTracking = () => {
    if (!startedByInstance) {
      return
    }

    startedByInstance = false

    if (trackingConsumers > 0) {
      trackingConsumers -= 1
    }

    if (trackingConsumers > 0) {
      return
    }
    
    TRACKED_ACTIVITY_EVENTS.forEach(event => {
      if (activeActivityHandler) {
        document.removeEventListener(event, activeActivityHandler)
      }
    })

    activeActivityHandler = null
    
    // 清理所有計時器
    if (sharedActivityTimer) {
      clearTimeout(sharedActivityTimer)
      sharedActivityTimer = null
    }
    
    if (sharedSessionExtensionTimer) {
      clearTimeout(sharedSessionExtensionTimer)
      sharedSessionExtensionTimer = null
    }
  }

  onMounted(() => {
    if (authStore.isAuthenticated) {
      startTracking()
    }
  })

  onUnmounted(() => {
    stopTracking()
  })

  return {
    startTracking,
    stopTracking,
    handleUserActivity
  }
}
