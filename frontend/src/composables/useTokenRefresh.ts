// Token 自動刷新 Composable
import { onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

export function useTokenRefresh() {
  const authStore = useAuthStore()
  let refreshInterval: number | null = null

  const startTokenRefreshCheck = () => {
    // 每 5 分鐘檢查一次是否需要刷新 token
    refreshInterval = window.setInterval(() => {
      if (authStore.isAuthenticated && authStore.shouldRefreshToken()) {
        console.log('🔄 Scheduled token refresh check...')
        authStore.proactiveTokenRefresh()
      } else if (authStore.isAuthenticated) {
        console.log('✅ Token is still valid, no refresh needed')
      }
    }, 5 * 60 * 1000) // 5 分鐘
    
    console.log('🔄 Token refresh check started - will check every 5 minutes')
  }

  const stopTokenRefreshCheck = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
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