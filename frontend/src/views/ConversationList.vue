<template>
  <AppLayout>
    <div class="conversation-list">
      <!-- Header with Filters -->
      <div class="list-header">
        <div class="header-content">
          <div class="header-info">
            <h1 class="page-title">
              對話管理
            </h1>
            <p class="page-subtitle">
              管理所有客戶對話，快速回應客戶需求
            </p>
          </div>
          
          <div class="header-actions">
            <!-- 智能快取狀態指示器 -->
            <div
              v-if="cacheManager.cacheHitRate.value > 0"
              class="cache-status-indicator"
              :title="`快取命中率: ${cacheManager.cacheHitRate.value.toFixed(1)}%`"
            >
              <div class="cache-icon">
                ⚡
              </div>
              <span class="cache-text">{{ cacheManager.cacheHitRate.value.toFixed(0) }}%</span>
            </div>
            
            <!-- 混合同步狀態指示器 -->
            <div
              v-if="syncStatus !== 'disconnected'"
              class="sync-status-indicator"
              :class="`status-${syncStatus}`"
            >
              <div
                class="sync-dot"
                :class="{ 'syncing': isAutoRefreshing }"
              />
              <span class="sync-text">
                <template v-if="syncStatus === 'connected'">SSE連線</template>
                <template v-else-if="syncStatus === 'polling'">輪詢模式</template>
                <template v-else-if="syncStatus === 'connecting'">連線中</template>
                <template v-else-if="isAutoRefreshing">更新中</template>
                <template v-else>{{ syncStatus }}</template>
              </span>
            </div>
            
            <button
              class="btn btn-secondary"
              :disabled="isLoading"
              @click="refreshConversations"
            >
              <RefreshIcon :spinning="isLoading || isAutoRefreshing" />
              重新整理
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="filters-section">
          <div class="filters">
            <div class="filter-group">
              <label class="filter-label">狀態篩選</label>
              <select
                v-model="filters.status"
                class="form-select"
                @change="loadConversations"
              >
                <option value="">
                  所有狀態
                </option>
                <option value="open">
                  待處理
                </option>
                <option value="assigned">
                  已指派
                </option>
                <option value="closed">
                  已關閉
                </option>
              </select>
            </div>
            
            <div class="filter-group">
              <label class="filter-label">平台篩選</label>
              <select
                v-model="filters.platform"
                class="form-select"
                @change="loadConversations"
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
            </div>
            
            <div class="filter-group">
              <label class="filter-label">指派狀態</label>
              <select
                v-model="filters.assignedTo"
                class="form-select"
                @change="loadConversations"
              >
                <option value="">
                  全部
                </option>
                <option value="me">
                  指派給我
                </option>
                <option value="unassigned">
                  未指派
                </option>
              </select>
            </div>
          </div>
          
          <!-- Stats -->
          <div class="quick-stats">
            <div class="stat-item">
              <span class="stat-number">{{ totalConversations }}</span>
              <span class="stat-label">總對話</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">{{ unreadCount }}</span>
              <span class="stat-label">未讀</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="list-content">
        <!-- Skeleton Loading for initial load -->
        <SkeletonLoader
          v-if="showSkeleton"
          :count="8"
          class="skeleton-fade-in"
        />
        
        <!-- Empty state when no conversations found -->
        <EmptyState 
          v-else-if="conversations.length === 0 && !isLoading"
          title="沒有找到對話"
          description="目前沒有符合篩選條件的對話，請調整篩選條件或等待新對話"
        >
          <template #icon>
            <ChatIcon />
          </template>
          <template #actions>
            <button
              class="btn btn-primary"
              @click="clearFilters"
            >
              清除篩選
            </button>
            <button
              class="btn btn-secondary"
              @click="refreshConversations"
            >
              重新整理
            </button>
          </template>
        </EmptyState>
        
        <!-- Conversations list with virtual scrolling -->
        <div
          v-else
          class="conversations-container"
          :class="{ 'updating': showShimmer }"
        >
          <!-- Background refresh indicator -->
          <div
            v-if="showShimmer"
            class="refresh-indicator"
          >
            <div class="refresh-bar" />
            <span class="refresh-text">更新中...</span>
          </div>
          
          <!-- Enhanced Smart Virtual scrolling list for performance -->
          <SmartVirtualScrollList
            :items="conversations"
            :item-height="120"
            :container-height="600"
            :overscan="3"
            :loading-more="loadingMore"
            :reached-end="reachedEnd"
            :preload-pages="2"
            :enable-smart-preload="true"
            :predictive-load-threshold="0.8"
            :intersection-threshold="0.5"
            :root-margin="'200px'"
            :get-item-key="(item) => (item as Conversation).id"
            class="smart-virtual-conversations"
            @reach-bottom="handleLoadMore"
            @visible-range-change="handleVisibleRangeChange"
            @predictive-load="handlePredictiveLoad"
          >
            <template #default="{ item }">
              <div 
                class="virtual-conversation-wrapper"
                :class="{ 'shimmer-effect': showShimmer }"
              >
                <ConversationCard
                  :conversation="item as Conversation"
                  :selected="selectedConversationId === (item as Conversation).id"
                  @select="selectConversation"
                />
              </div>
            </template>
            
            <template #loading>
              <div class="virtual-loading">
                <LoadingSpinner size="sm" />
                <span>智能載入更多對話中...</span>
              </div>
            </template>
            
            <template #end>
              <div class="virtual-end">
                <div class="end-stats">
                  <span>✨ 已顯示全部 {{ totalConversations }} 個對話</span>
                </div>
              </div>
            </template>
          </SmartVirtualScrollList>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="pagination"
      >
        <button 
          :disabled="currentPage === 1"
          class="btn btn-secondary"
          @click="changePage(currentPage - 1)"
        >
          <ChevronLeftIcon />
          上一頁
        </button>
        
        <div class="page-info">
          <span class="page-text">第 {{ currentPage }} / {{ totalPages }} 頁</span>
          <span class="total-text">共 {{ totalConversations }} 個對話</span>
        </div>
        
        <button 
          :disabled="currentPage === totalPages"
          class="btn btn-secondary"
          @click="changePage(currentPage + 1)"
        >
          下一頁
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth, useConversations } from '@/composables'
import type { Conversation, ConversationFilters } from '@/types'
import { useConversationsStore } from '@/stores/conversations'
import { conversationSync } from '@/services/conversationSync'
import { cacheManager } from '@/services/cacheManager'
import { updateConversationsWithAnimation } from '@/services/incrementalUpdateManager'
import { webWorkerManager } from '@/services/webWorkerManager'
import { predictiveLoader } from '@/services/predictiveLoader'
import { idleTimeProcessor, TaskPriority } from '@/services/idleTimeProcessor'
import AppLayout from '@/components/ui/AppLayout.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import SmartVirtualScrollList from '@/components/ui/SmartVirtualScrollList.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConversationCard from '@/components/conversation/ConversationCard.vue'

import { RefreshIcon, ChatIcon } from '@/components/icons'

// Chevron icons (small, can stay inline)
const ChevronLeftIcon = {
  template: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>`
}

const ChevronRightIcon = {
  template: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`
}

const router = useRouter()
const { currentAgent } = useAuth()
const { conversations } = useConversations()
const conversationsStore = useConversationsStore()

// Use enhanced loading states from store
const {
  showSkeleton,
  showShimmer, 
  isLoading,
  loadingMore,
  refreshConversations: storeRefresh,
  loadWithCache,
  preloadNextPage
} = conversationsStore

// State
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const selectedConversationId = ref<string | null>(null)
const filters = ref<ConversationFilters>({
  status: '', // 設定為空字串以顯示「所有狀態」
  platform: '', // 設定為空字串以顯示「所有平台」
  assignedTo: undefined
})

// 虛擬滾動狀態
const reachedEnd = ref(false)
const visibleRange = ref({ startIndex: 0, endIndex: 0 })
const isPreloading = ref(false)

// Computed
const totalPages = computed(() => Math.ceil(total.value / pageSize.value))
const totalConversations = computed(() => total.value)
const unreadCount = computed(() => 
  conversations.value.filter((c: Conversation) => c.unreadCount && c.unreadCount > 0).length
)

// Methods - Using smart cache loading with all optimizations
async function loadConversations() {
  console.log('🚀 [ConversationList] Loading conversations with advanced optimizations')
  
  try {
    // 準備篩選條件
    const apiFilters: Record<string, unknown> = { ...filters.value }
    if (apiFilters.assignedTo === 'me') {
      apiFilters.assignedTo = currentAgent.value?.id
    } else if (apiFilters.assignedTo === 'unassigned') {
      apiFilters.assignedTo = undefined
    } else {
      delete apiFilters.assignedTo
    }

    // 記錄篩選行為用於預測
    predictiveLoader.recordFilterChange(apiFilters as ConversationFilters)

    // 首先檢查預測性預載入的數據
    const preloadedData = predictiveLoader.getPreloadedData(apiFilters as ConversationFilters)
    
    if (preloadedData && preloadedData.length > 0) {
      console.log('🎯 [ConversationList] Using preloaded data!')
      
      // 使用預載入的數據進行增量更新動畫
      await updateConversationsWithAnimation(preloadedData)
      conversationsStore.setConversations(preloadedData)
      total.value = preloadedData.length
      
      // 背景驗證數據是否最新
      idleTimeProcessor.scheduleTask(async () => {
        const result = await loadWithCache(apiFilters as ConversationFilters, currentPage.value)
        if (result && 'count' in result && result.fresh) {
          // 獲取最新的對話數據進行比較
          const latestData = conversations.value
          if (JSON.stringify(latestData) !== JSON.stringify(preloadedData)) {
            // 如果數據不同，進行平滑更新
            await updateConversationsWithAnimation(latestData)
          }
        }
      }, TaskPriority.LOW)
      
    } else {
      // 使用智能快取載入 - 先顯示快取，再背景更新
      const result = await loadWithCache(apiFilters as ConversationFilters, currentPage.value)
      
      if (result && result.fresh) {
        // 使用增量更新動畫更新對話列表
        await updateConversationsWithAnimation(conversations.value)
        total.value = conversationsStore.pagination.total
      }
      
      // 預載入下一頁
      if (result?.fresh && !result?.error) {
        idleTimeProcessor.scheduleTask(() => {
          preloadNextPage()
        }, TaskPriority.LOW)
      }
      
      if (result?.fromCache && result?.fresh) {
        console.log('✨ [ConversationList] Zero-wait experience achieved!')
      }
    }

    // 在空閒時間進行預測性預載入
    idleTimeProcessor.scheduleTask(() => {
      predictiveLoader.predictAndPreload()
    }, TaskPriority.LOW)
    
  } catch (error) {
    console.error('載入對話失敗:', error)
  }
}

function selectConversation(conversation: Conversation) {
  selectedConversationId.value = conversation.id
  router.push(`/conversations/${conversation.id}`)
}

function changePage(page: number) {
  if (page < 1 || page > totalPages.value) {return}
  currentPage.value = page
  loadConversations()
}


function clearFilters() {
  filters.value = {
    status: '',
    platform: '',
    assignedTo: undefined
  }
  currentPage.value = 1
  loadConversations()
}

// 混合同步相關狀態
const syncStatus = ref<'disconnected' | 'connecting' | 'connected' | 'polling' | 'error'>('disconnected')
const isAutoRefreshing = ref(false)
// Sync error and last update are handled by the sync service itself

// 設置同步服務回調
conversationSync.onData((data: Conversation[]) => {
  console.log('📥 [ConversationList] Received data from sync service:', data.length)
  // Note: conversations is readonly from useConversations, so we refresh the store instead
  conversationsStore.setConversations(data)
  total.value = data.length
  isAutoRefreshing.value = false
})

conversationSync.onStatus((status) => {
  console.log('📊 [ConversationList] Sync status changed:', status)
  syncStatus.value = status
  
  // 更新刷新狀態指示器
  if (status === 'connecting') {
    isAutoRefreshing.value = true
  } else if (status === 'connected' || status === 'polling') {
    isAutoRefreshing.value = false
  }
})

// 手動刷新 - 使用新的store方法
async function refreshConversations() {
  console.log('🔄 [ConversationList] Manual refresh triggered')
  currentPage.value = 1
  isAutoRefreshing.value = true
  
  try {
    // 優先使用store的refresh方法（更平滑）
    await storeRefresh()
    // 同時刷新sync service
    await conversationSync.refresh()
  } catch (error) {
    console.error('Manual refresh failed:', error)
    // 回退到原始方法
    await loadConversations()
  } finally {
    isAutoRefreshing.value = false
  }
}

// 新增：載入更多對話
async function loadMoreConversations() {
  if (!conversationsStore.canLoadMore) {return}
  
  console.log('📄 [ConversationList] Loading more conversations')
  await conversationsStore.loadMore()
  total.value = conversationsStore.pagination.total
}

// 虛擬滾動事件處理
async function handleLoadMore() {
  if (loadingMore || reachedEnd.value) {return}
  
  console.log('🔄 [ConversationList] Virtual scroll reached bottom, loading more')
  
  try {
    const currentLength = conversations.value.length
    await loadMoreConversations()
    
    // 檢查是否真的載入了更多數據
    if (conversations.value.length === currentLength) {
      reachedEnd.value = true
      console.log('🏁 [ConversationList] No more conversations to load')
    }
  } catch (error) {
    console.error('❌ [ConversationList] Failed to load more conversations:', error)
  }
}

// 預測性載入事件處理
function handlePredictiveLoad(direction: 'up' | 'down', estimatedDistance: number) {
  console.log(`🔮 [ConversationList] Predictive load triggered: ${direction}, distance: ${estimatedDistance}`)
  
  // 記錄滾動行為用於預測
  predictiveLoader.recordBehavior({
    type: 'scroll',
    timestamp: Date.now(),
    data: { direction, estimatedDistance }
  })
  
  // 在空閒時間執行預測性載入
  idleTimeProcessor.scheduleTask(() => {
    predictiveLoader.predictAndPreload()
  }, TaskPriority.LOW)
  
  // 如果用戶接近數據底部，提前載入更多
  if (direction === 'down' && estimatedDistance < 5 && conversationsStore.canLoadMore) {
    handleLoadMore()
  }
}

function handleVisibleRangeChange(startIndex: number, endIndex: number) {
  visibleRange.value = { startIndex, endIndex }
  
  // 智能預載入：當接近數據末尾時，預載入下一頁
  const loadThreshold = Math.max(10, Math.floor(conversations.value.length * 0.8))
  
  if (endIndex >= loadThreshold && !isPreloading.value && !reachedEnd.value && conversationsStore.canLoadMore) {
    isPreloading.value = true
    
    console.log(`🔮 [ConversationList] Smart preloading triggered at index ${endIndex}`)
    
    preloadNextPage().then(() => {
      isPreloading.value = false
    }).catch((error) => {
      console.warn('⚠️ [ConversationList] Preloading failed:', error)
      isPreloading.value = false
    })
  }
  
  if (import.meta.env.DEV) {
    console.log(`👀 [ConversationList] Visible range: ${startIndex}-${endIndex} of ${conversations.value.length}`)
  }
}

// Watch for filter changes
watch(filters, () => {
  currentPage.value = 1
}, { deep: true })

// Lifecycle
onMounted(async () => {
  console.log('🚀 [ConversationList] Component mounted, initializing advanced loading system')
  
  // 初始化 Web Worker
  await new Promise((resolve) => {
    const checkWorkerReady = () => {
      if (webWorkerManager.isReady.value) {
        console.log('✅ [ConversationList] Web Worker ready')
        resolve(true)
      } else {
        setTimeout(checkWorkerReady, 100)
      }
    }
    checkWorkerReady()
  })
  
  // 啟用預測性載入系統
  predictiveLoader.setEnabled(true)
  
  // 優化的初始加載：不會有突兀的loading狀態
  await loadConversations()
  
  // 啟動混合同步服務（背景運行）
  await conversationSync.start()
  
  // 在空閒時間進行初始預測分析
  idleTimeProcessor.scheduleTask(() => {
    predictiveLoader.predictAndPreload()
  }, TaskPriority.LOW)
  
  // 監聽滾動事件實現無限滾動
  const handleScroll = () => {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement
    const threshold = 200 // 200px from bottom
    
    if (scrollTop + clientHeight >= scrollHeight - threshold && conversationsStore.canLoadMore) {
      loadMoreConversations()
    }
  }
  
  document.addEventListener('scroll', handleScroll)
  
  // 清理事件監聽器
  onUnmounted(() => {
    document.removeEventListener('scroll', handleScroll)
  })
})

onUnmounted(() => {
  console.log('🛑 [ConversationList] Component unmounted, cleaning up services')
  
  // 停止所有服務
  conversationSync.stop()
  predictiveLoader.setEnabled(false)
  idleTimeProcessor.cancelAllTasks()
  
  console.log('✨ [ConversationList] All services cleaned up')
})
</script>

<style scoped>
.conversation-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.list-header {
  background-color: white;
  border-bottom: 1px solid var(--gray-200);
  padding: var(--space-6);
}

.header-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 var(--space-2) 0;
}

.page-subtitle {
  font-size: 1rem;
  color: var(--gray-600);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.sync-status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid;
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.sync-status-indicator.status-connected {
  background-color: var(--green-50);
  border-color: var(--green-200);
  color: var(--green-700);
}

.sync-status-indicator.status-polling {
  background-color: var(--yellow-50);
  border-color: var(--yellow-200);
  color: var(--yellow-700);
}

.sync-status-indicator.status-connecting {
  background-color: var(--blue-50);
  border-color: var(--blue-200);
  color: var(--blue-700);
}

.sync-status-indicator.status-error {
  background-color: var(--red-50);
  border-color: var(--red-200);
  color: var(--red-700);
}

/* Cache status indicator */
.cache-status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
  transition: all 0.3s ease;
}

.cache-status-indicator:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
}

.cache-icon {
  font-size: 0.875rem;
  animation: cache-pulse 2s ease-in-out infinite;
}

@keyframes cache-pulse {
  0%, 100% { 
    opacity: 1; 
    transform: scale(1);
  }
  50% { 
    opacity: 0.8; 
    transform: scale(1.1);
  }
}

.cache-text {
  font-weight: 700;
  letter-spacing: 0.025em;
}

.sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-connected .sync-dot {
  background-color: var(--green-500);
}

.status-polling .sync-dot {
  background-color: var(--yellow-500);
}

.status-connecting .sync-dot, .sync-dot.syncing {
  background-color: var(--blue-500);
  animation: pulse 1.5s ease-in-out infinite;
}

.status-error .sync-dot {
  background-color: var(--red-500);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.1);
  }
}

.filters-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
}

.filters {
  display: flex;
  gap: var(--space-4);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.filter-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--gray-700);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.quick-stats {
  display: flex;
  gap: var(--space-6);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-600);
  line-height: 1;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--gray-600);
  font-weight: 500;
  margin-top: var(--space-1);
}

.list-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.conversations-container {
  flex: 1;
  padding: var(--space-6);
  overflow: hidden;
}



.conversations-grid {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: var(--space-4);
  align-content: start;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  background-color: white;
  border-top: 1px solid var(--gray-200);
}

.page-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.page-text {
  font-weight: 600;
  color: var(--gray-900);
}

.total-text {
  font-size: 0.875rem;
  color: var(--gray-600);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .conversations-grid {
    grid-template-columns: 1fr;
    padding: var(--space-4);
  }
  
  .filters-section {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-4);
  }
  
  .quick-stats {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .header-actions {
    width: 100%;
  }
  
  .filters {
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .filter-group {
    width: 100%;
  }
  
  .pagination {
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .page-title {
    font-size: 1.5rem;
  }
  
  .list-header {
    padding: var(--space-4);
  }
}

@media (max-width: 640px) {
  .conversations-grid {
    padding: var(--space-3);
    gap: var(--space-3);
  }
  
  .quick-stats {
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .stat-item {
    flex-direction: row;
    justify-content: space-between;
    padding: var(--space-3);
    background-color: var(--gray-50);
    border-radius: var(--radius-lg);
  }
}

/* Enhanced loading and animation styles */
.skeleton-fade-in {
  animation: skeleton-appear 0.6s ease-out;
}

@keyframes skeleton-appear {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Background refresh indicator */
.refresh-indicator {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(59, 130, 246, 0.95);
  color: white;
  padding: var(--space-2) var(--space-4);
  text-align: center;
  z-index: 1000;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.refresh-bar {
  height: 2px;
  background: linear-gradient(90deg, transparent, white, transparent);
  border-radius: 1px;
  margin-bottom: var(--space-2);
  animation: refresh-progress 2s ease-in-out infinite;
}

@keyframes refresh-progress {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.refresh-text {
  font-size: 0.875rem;
  font-weight: 500;
}

/* Shimmer effect for existing conversations during updates */
.conversations-container.updating {
  position: relative;
}

.shimmer-effect {
  position: relative;
  overflow: hidden;
}

.shimmer-effect::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shimmer 2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes shimmer {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

/* Load more indicator */
.load-more-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-6);
  margin-top: var(--space-4);
}

/* Smooth transitions for conversation list */
.list-enter-active, .list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from, .list-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

/* Individual conversation card transitions */
.conversation-enter-active, .conversation-leave-active {
  transition: all 0.3s ease;
}

.conversation-enter-from, .conversation-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.conversation-move {
  transition: transform 0.3s ease;
}

/* Smooth fade for updating states */
.conversations-container {
  transition: opacity 0.2s ease;
}

.conversations-container.updating {
  opacity: 0.9;
}

/* Virtual scrolling styles */
.virtual-conversations {
  height: calc(100vh - 300px); /* 調整以適應頁面布局 */
  min-height: 400px;
}

.virtual-conversation-wrapper {
  padding: var(--space-2);
  transition: all 0.2s ease;
}

.virtual-conversation-wrapper:hover {
  transform: translateY(-1px);
}

.virtual-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  color: var(--gray-600);
  font-size: 0.875rem;
}

.virtual-end {
  display: flex;
  justify-content: center;
  padding: var(--space-6);
}

.end-stats {
  padding: var(--space-3) var(--space-6);
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
  color: var(--gray-700);
  border-radius: var(--radius-full);
  border: 1px solid var(--sky-200);
  font-size: 0.875rem;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* Performance optimizations */
.conversations-grid {
  contain: layout style paint;
}

/* 第五階段：GPU 加速基礎優化 */
.virtual-conversation-wrapper {
  padding: var(--space-2);
  transition: all 0.2s ease;
  /* GPU 加速 */
  transform: translateZ(0);
  will-change: transform;
  backface-visibility: hidden;
}

.virtual-conversation-wrapper:hover {
  transform: translateY(-1px) translateZ(0);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* Reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .skeleton-fade-in,
  .refresh-bar,
  .shimmer-effect::after,
  .list-enter-active,
  .list-leave-active,
  .conversation-enter-active,
  .conversation-leave-active {
    animation: none !important;
    transition: none !important;
  }
  
  .conversations-container.updating {
    opacity: 1;
  }
}
</style>