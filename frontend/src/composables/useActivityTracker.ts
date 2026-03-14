// 用戶活動追蹤 Composable
import { onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

export function useActivityTracker() {
  const authStore = useAuthStore()
  let activityTimer: number | null = null
  const lastActivityTime = ref(0)
  let sessionExtensionTimer: number | null = null
  
  // 防抖間隔：5分鐘內不重複觸發會話延長
  const SESSION_EXTENSION_DEBOUNCE = 5 * 60 * 1000 // 5分鐘
  // 30分鐘無活動後的超時處理
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30分鐘

  const resetActivityTimer = () => {
    if (activityTimer) {
      clearTimeout(activityTimer)
    }
    
    // 30 分鐘無活動後延長會話
    activityTimer = window.setTimeout(() => {
      if (authStore.isAuthenticated) {
        authStore.autoExtendSession()
        authStore.proactiveTokenRefresh()
      }
    }, INACTIVITY_TIMEOUT)
  }

  const handleUserActivity = () => {
    if (!authStore.isAuthenticated) {return}
    
    const now = Date.now()
    const timeSinceLastActivity = now - lastActivityTime.value
    
    // 防抖：如果距離上次會話延長不足5分鐘，則跳過
    if (timeSinceLastActivity < SESSION_EXTENSION_DEBOUNCE) {
      resetActivityTimer() // 仍然重置計時器
      return
    }
    
    lastActivityTime.value = now
    
    if (import.meta.env.DEV) {
      console.log(' User activity detected - extending session (debounced)')
    }
    
    // 清除之前的會話延長計時器
    if (sessionExtensionTimer) {
      clearTimeout(sessionExtensionTimer)
    }
    
    // 立即延長會話，但延遲token刷新以避免循環
    authStore.autoExtendSession()
    
    // 延遲執行 token 刷新，避免與當前操作衝突
    sessionExtensionTimer = window.setTimeout(() => {
      if (authStore.isAuthenticated) {
        authStore.proactiveTokenRefresh()
      }
    }, 2000) // 延遲2秒，避免與用戶操作衝突
    
    resetActivityTimer()
  }

  const startTracking = () => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true })
    })
    
    if (import.meta.env.DEV) {
      console.log(' Activity tracking started - monitoring user interactions')
    }
    resetActivityTimer()
  }

  const stopTracking = () => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    events.forEach(event => {
      document.removeEventListener(event, handleUserActivity)
    })
    
    // 清理所有計時器
    if (activityTimer) {
      clearTimeout(activityTimer)
      activityTimer = null
    }
    
    if (sessionExtensionTimer) {
      clearTimeout(sessionExtensionTimer)
      sessionExtensionTimer = null
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