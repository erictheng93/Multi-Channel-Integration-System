<template>
  <div id="app">
    <router-view :key="routeKey" />
    
    <!-- 賬戶停權警示模態框 -->
    <AccountDisabledModal 
      v-if="showDisabledModal" 
      :auto-logout-delay="10"
    />
  </div>
</template>

<script setup lang="ts">
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('App')
import { computed, onMounted, watch, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useActivityTracker } from '@/composables/useActivityTracker'
import { useTokenRefresh } from '@/composables/useTokenRefresh'
import { useAccountStatusMonitor } from '@/composables/useAccountStatusMonitor'
import AccountDisabledModal from '@/components/ui/AccountDisabledModal.vue'
import { preloadService } from '@/services/preloadService'
import { tagCacheService } from '@/services/tagCacheService'

const route = useRoute()
const authStore = useAuthStore()
const { startTracking } = useActivityTracker()
const { startTokenRefreshCheck } = useTokenRefresh()
const { showDisabledModal } = useAccountStatusMonitor()

// 添加一個計數器來強制重新渲染
const routeChangeCounter = ref(0)

// 創建一個強化的路由鍵，確保組件重新渲染
const routeKey = computed(() => {
  // 結合路由路徑、查詢參數和強制計數器
  return `${route.path}-${JSON.stringify(route.query)}-${routeChangeCounter.value}`
})

// 監聽路由變化並記錄
watch(() => route.path, (newPath, oldPath) => {
  frontendLogger.debug(' App.vue detected route change:', oldPath, '->', newPath)
  
  // 強制增加計數器來確保組件重新渲染
  routeChangeCounter.value++
  
  frontendLogger.debug(' Route key updated:', routeKey.value)
}, { immediate: true })

onMounted(() => {
  frontendLogger.debug(' App.vue mounted')

  // 優化：智能初始化認證狀態
  if (authStore.validateSession()) {
    // 使用統一的會話初始化邏輯，避免重複 API 請求
    authStore.initializeSession()
  }

  // LCP 優化：非阻塞式預加載關鍵數據（團隊、標籤等）
  // 修復：移除 await 阻塞，讓 UI 先渲染，數據後台載入
  if (authStore.isAuthenticated) {
    frontendLogger.debug('[App.vue] Starting non-blocking preload services...')
    const preloadStart = performance.now()

    // 使用 requestIdleCallback 在瀏覽器空閒時執行，避免阻塞 LCP
    const schedulePreload = () => {
      Promise.allSettled([
        preloadService.init(),
        tagCacheService.init()
      ]).then(results => {
        const duration = performance.now() - preloadStart
        const successCount = results.filter(r => r.status === 'fulfilled').length
        frontendLogger.debug(`[App.vue] Preload completed: ${successCount}/2 services in ${duration.toFixed(2)}ms`)

        results.forEach((result, index) => {
          const serviceName = index === 0 ? 'preloadService' : 'tagCacheService'
          if (result.status === 'rejected') {
            console.error(`[App.vue] ${serviceName} initialization failed:`, result.reason)
          }
        })
      })
    }

    // 優先使用 requestIdleCallback，否則使用 setTimeout 延遲執行
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(schedulePreload, { timeout: 2000 })
    } else {
      // Fallback: 延遲 100ms 讓 LCP 先完成
      setTimeout(schedulePreload, 100)
    }
  } else {
    frontendLogger.debug('  [App.vue] Skipping preload (not authenticated)')
  }

  // 設置定期清理過期緩存（每5分鐘）
  setInterval(() => {
    frontendLogger.debug('[App.vue] Running periodic cache cleanup...')
    preloadService.cleanup()
    tagCacheService.cleanup()
  }, 5 * 60 * 1000)

  // Start activity tracking for session extension
  if (authStore.isAuthenticated) {
    startTracking()
    startTokenRefreshCheck()
  }
})
</script>

<style>
#app {
  height: 100vh;
  overflow: hidden;
  background-color: #f9fafb !important; /* 固定背景顏色，不受主題影響 */
}
</style>
