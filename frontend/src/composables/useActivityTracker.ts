// 用戶活動追蹤 Composable
import { onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

export function useActivityTracker() {
  const authStore = useAuthStore()
  let activityTimer: number | null = null

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
    }, 30 * 60 * 1000) // 30 分鐘
  }

  const handleUserActivity = () => {
    if (authStore.isAuthenticated) {
      console.log('👆 User activity detected - extending session and checking token')
      authStore.autoExtendSession()
      
      // 延遲執行 token 刷新，避免干擾導航
      setTimeout(() => {
        if (authStore.isAuthenticated) {
          authStore.proactiveTokenRefresh()
        }
      }, 100)
      
      resetActivityTimer()
    }
  }

  const startTracking = () => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true })
    })
    
    console.log('👀 Activity tracking started - monitoring user interactions')
    resetActivityTimer()
  }

  const stopTracking = () => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    events.forEach(event => {
      document.removeEventListener(event, handleUserActivity)
    })
    
    if (activityTimer) {
      clearTimeout(activityTimer)
      activityTimer = null
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