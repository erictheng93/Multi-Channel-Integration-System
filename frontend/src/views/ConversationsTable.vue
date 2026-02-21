<template>
  <AppLayout>
    <ErrorBoundary>
      <div class="conversations">
        <header class="conversations-header">
          <h1>對話管理</h1>
          <div class="filters">
            <select
              v-model="filters.status"
              @change="applyFilters"
            >
              <option value="">
                所有狀態
              </option>
              <option value="active">
                進行中
              </option>
              <option value="assigned">
                已指派
              </option>
              <option value="pending">
                待處理
              </option>
            </select>
            <select
              v-model="filters.platform"
              @change="applyFilters"
            >
              <option value="">
                所有平台
              </option>
              <option value="line">
                LINE
              </option>
              <option value="facebook">
                Facebook
              </option>
              <option value="instagram">
                Instagram
              </option>
              <option value="whatsapp">
                WhatsApp
              </option>
            </select>
            <RefreshButton
              :loading="loading || isUpdating"
              @refresh="refreshConversations"
            />
          </div>
        </header>

        <!-- SSE 更新指示器 -->
        <ConversationSyncIndicator :visible="isUpdating" />

        <div class="conversations-content">
          <div
            v-if="loading && displayedConversations.length === 0"
            class="loading-overlay"
          >
            <HamsterLoader message="載入對話列表中..." />
          </div>
          <div
            v-else-if="displayedConversations.length === 0"
            class="no-data"
          >
            <div class="no-data-content">
              <div class="no-data-icon">
                💬
              </div>
              <div class="no-data-text">
                暫無對話記錄
              </div>
            </div>
          </div>
          <div
            v-else
            class="conversations-table-container"
            :class="{ updating: isUpdating }"
          >
            <!-- Desktop Table View -->
            <ConversationDesktopTable
              :conversations="displayedConversations"
              @select="goToConversation"
            />

            <!-- Mobile Card View -->
            <ConversationMobileCards
              :conversations="displayedConversations"
              @select="goToConversation"
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useConversationsStore } from '@/stores/conversations'
// REMOVED: useActivityStream (SSE-based, replaced by WebSocket in Phase 1 cleanup)
// import { useActivityStream } from '@/composables/useActivityStream'
import type { ConversationFilters } from '@/types'
import AppLayout from '@/components/ui/AppLayout.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import ConversationSyncIndicator from '@/components/conversations/ConversationSyncIndicator.vue'
import ConversationDesktopTable from '@/components/conversations/ConversationDesktopTable.vue'
import ConversationMobileCards from '@/components/conversations/ConversationMobileCards.vue'

const router = useRouter()
const conversationsStore = useConversationsStore()

const filters = ref<ConversationFilters>({
  status: '', // 預設為空字串以顯示「所有狀態」
  platform: '' // 預設為空字串以顯示「所有平台」
})

// 平滑載入動畫系統
const isUpdating = ref(false)
const previousConversationIds = ref<string[]>([])
const animationDelay = ref(0)

// 直接使用 Store 數據，避免 useAsyncData 的複雜性
const loading = computed(() => conversationsStore.loading)
const conversations = computed(() => conversationsStore.conversations)

// 平滑載入系統：顯示的對話列表（含前端篩選防護）
const displayedConversations = computed(() => {
  let result = conversations.value
  if (filters.value.status) {
    result = result.filter(c => c.status === filters.value.status)
  }
  if (filters.value.platform) {
    result = result.filter(c => c.platform === filters.value.platform)
  }
  return result
})

// 監聽對話變化並處理動畫邏輯
watch(conversations, (currentConversations) => {
  // 檢測新對話的邏輯
  if (previousConversationIds.value.length > 0) {
    const currentIds = new Set(currentConversations.map(conv => conv.id))
    const previousIds = new Set(previousConversationIds.value)

    // 如果有新對話加入，觸發動畫
    const hasNewConversations = currentConversations.some(conv => !previousIds.has(conv.id))
    const hasRemovedConversations = previousConversationIds.value.some(id => !currentIds.has(id))

    if (hasNewConversations || hasRemovedConversations) {
      animationDelay.value = Date.now()
    }
  }

  // 更新前一個狀態
  previousConversationIds.value = currentConversations.map(conv => conv.id)
}, { deep: true })

console.log('🔍 [ConversationsTable] Initial state:', {
  loading: loading.value,
  conversationsLength: conversations.value.length,
  storeState: conversationsStore.$state
})

// 平滑更新函數
const performSmoothUpdate = async () => {
  if (isUpdating.value) {return} // 防止重複更新

  isUpdating.value = true
  console.log('📢 [ConversationsTable] Starting smooth update...')

  try {
    await conversationsStore.fetchConversations()

    // 短暫的視覺反饋
    await nextTick()
    setTimeout(() => {
      isUpdating.value = false
      console.log('✅ [ConversationsTable] Smooth update completed')
    }, 800) // 800ms 的更新指示器顯示時間

  } catch (error) {
    console.error('❌ [ConversationsTable] Update failed:', error)
    isUpdating.value = false
  }
}

// 刷新對話列表的函數
const refreshConversations = () => {
  console.log('🔄 [ConversationsTable] Manual refresh requested')
  performSmoothUpdate()
}

const goToConversation = (id: string) => {
  router.push(`/conversations/${id}`)
}

const applyFilters = () => {
  const activeFilters: ConversationFilters = {}
  if (filters.value.status) {activeFilters.status = filters.value.status}
  if (filters.value.platform) {activeFilters.platform = filters.value.platform}

  console.log('🔍 [ConversationsTable] Applying filters:', activeFilters)
  // 直接使用 store 的 fetchConversations 方法重新載入數據
  conversationsStore.fetchConversations(activeFilters)
}

onMounted(async () => {
  console.log('🚀 ConversationsTable mounted')

  // FIX: 每次 mount 都刷新數據，確保返回列表時顯示最新狀態
  // 使用 loadWithCache 提供最佳 UX：
  // - 如果有緩存數據：立即顯示，背景靜默更新（只顯示更新指示器，非全屏載入）
  // - 如果無緩存數據：顯示載入狀態
  try {
    await conversationsStore.loadWithCache(filters.value)
  } catch (error) {
    console.error('載入對話失敗:', error)
    // 即使載入失敗，也不要讓頁面白屏
    // conversationsStore 已經有自己的錯誤處理
  }

  // 方案 B 阶段 1: 启动实时同步
  // Store 层统一管理 WebSocket 连接，所有使用 store 的组件自动获得实时更新
  console.log('🔌 [ConversationsTable] Initializing real-time sync from Store...')
  conversationsStore.initializeRealtime()
})

// 清理实时同步资源
onUnmounted(() => {
  console.log('👋 [ConversationsTable] Component unmounting, cleaning up...')
  conversationsStore.cleanup()
})
</script>

<style scoped>
.conversations {
  background-color: #f8f9fa;
  min-height: calc(100vh - 120px);
  position: relative;
}

.conversations-header {
  background: white;
  padding: 1rem 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.conversations-header h1 {
  margin: 0;
  color: #333;
}

.filters {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.filters select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.filters select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.conversations-content {
  padding: 2rem;
  max-width: 100%;
  margin: 0 auto;
  position: relative;
}

/* Loading Overlay */
.loading-overlay {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  animation: fadeIn 0.3s ease-out;
}

/* Empty State */
.no-data {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 4rem 2rem;
  text-align: center;
  animation: fadeIn 0.4s ease-out;
}

.no-data-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  max-width: 400px;
  margin: 0 auto;
}

.no-data-icon {
  font-size: 3rem;
  opacity: 0.6;
  animation: float 3s ease-in-out infinite;
}

.no-data-text {
  font-size: 1.1rem;
  color: #666;
  font-weight: 500;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* Table Container */
.conversations-table-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
  position: relative;
  transition: all 0.3s ease;
}

.conversations-table-container.updating {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(248, 250, 252, 0.98) 50%,
    rgba(255, 255, 255, 0.95) 100%
  );
}

.conversations-table-container.updating::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(59, 130, 246, 0.1),
    transparent
  );
  animation: shimmer 1.5s infinite;
  pointer-events: none;
  z-index: 1;
}

@keyframes shimmer {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .no-data-icon {
    animation: none;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .conversations-header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .filters {
    justify-content: center;
    flex-wrap: wrap;
  }

  .conversations-content {
    padding: 1rem;
  }

  .conversations-table-container {
    box-shadow: none;
    border-radius: 0;
  }

  .no-data {
    padding: 3rem 1rem;
  }

  .no-data-icon {
    font-size: 2.5rem;
  }
}

@media (max-width: 480px) {
  .conversations-header {
    padding: 1rem;
  }

  .filters {
    flex-direction: column;
    width: 100%;
  }

  .filters select {
    width: 100%;
    max-width: 200px;
  }
}
</style>
