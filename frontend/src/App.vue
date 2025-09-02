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
import { computed, onMounted, watch, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useActivityTracker } from '@/composables/useActivityTracker'
import { useTokenRefresh } from '@/composables/useTokenRefresh'
import { useAccountStatusMonitor } from '@/composables/useAccountStatusMonitor'
import AccountDisabledModal from '@/components/ui/AccountDisabledModal.vue'

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
  console.log('🔄 App.vue detected route change:', oldPath, '->', newPath)
  
  // 強制增加計數器來確保組件重新渲染
  routeChangeCounter.value++
  
  console.log('🔄 Route key updated:', routeKey.value)
}, { immediate: true })

onMounted(() => {
  console.log('🚀 App.vue mounted')
  
  // ✅ 優化：智能初始化認證狀態
  if (authStore.token) {
    // 使用統一的會話初始化邏輯，避免重複 API 請求
    authStore.initializeSession()
  }
  
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