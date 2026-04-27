// Token 自動刷新 Composable
import { onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useTokenRefresh')

let sharedRefreshInterval: number | null = null
let refreshConsumers = 0

export function useTokenRefresh() {
  const authStore = useAuthStore()
  let startedByInstance = false

  const startTokenRefreshCheck = () => {
    if (startedByInstance) {
      return
    }

    startedByInstance = true
    refreshConsumers += 1

    if (sharedRefreshInterval !== null) {
      return
    }

    // 每 5 分鐘檢查一次是否需要刷新 token
    sharedRefreshInterval = window.setInterval(() => {
      if (authStore.isAuthenticated && authStore.shouldRefreshToken()) {
        frontendLogger.debug(' Scheduled token refresh check...')
        authStore.proactiveTokenRefresh()
      } else if (authStore.isAuthenticated) {
        frontendLogger.debug(' Token is still valid, no refresh needed')
      }
    }, 5 * 60 * 1000) // 5 分鐘
    
    frontendLogger.debug(' Token refresh check started - will check every 5 minutes')
  }

  const stopTokenRefreshCheck = () => {
    if (!startedByInstance) {
      return
    }

    startedByInstance = false

    if (refreshConsumers > 0) {
      refreshConsumers -= 1
    }

    if (refreshConsumers === 0 && sharedRefreshInterval !== null) {
      clearInterval(sharedRefreshInterval)
      sharedRefreshInterval = null
    }
  }

  onMounted(() => {
    if (authStore.isAuthenticated) {
      startTokenRefreshCheck()
    }
  })

  onUnmounted(() => {
    stopTokenRefreshCheck()
  })

  return {
    startTokenRefreshCheck,
    stopTokenRefreshCheck
  }
}
