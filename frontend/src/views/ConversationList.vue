<template>
  <AppLayout>
    <div class="conversation-list h-full flex flex-col">
      <!-- Header with Actions -->
      <div class="list-header">
        <ConversationHeader
          :cache-hit-rate="controller.cache.cacheHitRate.value"
          :sync-status="conversationsStore.syncStatus"
          :is-syncing="isSyncing"
          :is-refreshing="controller.isRefreshing.value"
          @refresh="handleRefresh"
          @export="showExportDialog = true"
        />
      </div>

      <!-- Search Bar -->
      <div class="search-section">
        <div class="search-bar">
          <SearchIcon class="search-icon" />
          <input
            v-model="searchQuery"
            class="search-input"
            type="text"
            placeholder="搜尋對話 (客戶名稱、訊息內容)..."
            @keydown.escape="clearSearch"
          >
          <button
            v-if="searchQuery"
            class="search-clear"
            @click="clearSearch"
          >
            
          </button>
          <span
            v-if="isSearching"
            class="search-stats"
          >
            找到 {{ controller.totalConversations.value }} 個
          </span>
        </div>
      </div>

      <!-- Filters Section -->
      <div class="filters filters-section">
        <ConversationFilters
          :filters="controller.filters.filters.value"
          :available-tags="availableTags"
          :total-conversations="controller.totalConversations.value"
          :unread-count="controller.unreadCount.value"
          @update:filter="handleFilterUpdate"
          @toggle:tag="controller.filters.toggleTagFilter"
          @clear:tags="controller.filters.clearTagFilter"
          @clear:all="controller.filters.clearAllFilters"
        />
      </div>

      <!-- Content -->
      <div class="list-content flex-1 overflow-hidden flex flex-col">
        <Transition
          name="content-fade"
          mode="out-in"
        >
          <!-- Skeleton Loading -->
          <SkeletonLoader
            v-if="showSkeleton"
            key="skeleton"
            :count="8"
            class="animate-fade-in-up"
          />

          <!-- Empty State -->
          <EmptyState
            v-else-if="controller.conversations.value.length === 0 && !controller.isLoading.value"
            key="empty"
            title="沒有找到對話"
            description="目前沒有符合篩選條件的對話，請調整篩選條件或等待新對話"
          >
            <template #icon>
              <ChatIcon />
            </template>
            <template #actions>
              <button
                class="btn btn-primary"
                @click="controller.filters.clearAllFilters"
              >
                清除篩選
              </button>
              <button
                class="btn btn-secondary"
                @click="handleRefresh"
              >
                重新整理
              </button>
            </template>
          </EmptyState>

          <!-- Conversations List with Virtual Scrolling -->
          <div
            v-else
            key="content"
            class="flex-1 p-6 overflow-hidden"
          >
            <SmartVirtualScrollList
              :items="controller.conversations.value"
              :item-height="virtualScroll.scrollConfig.itemHeight"
              :container-height="virtualScroll.scrollConfig.containerHeight"
              :overscan="virtualScroll.scrollConfig.overscan"
              :loading-more="controller.loadingMore.value"
              :reached-end="virtualScroll.reachedEnd.value"
              :preload-pages="virtualScroll.scrollConfig.preloadPages"
              :enable-smart-preload="virtualScroll.scrollConfig.enableSmartPreload"
              :predictive-load-threshold="virtualScroll.scrollConfig.predictiveLoadThreshold"
              :intersection-threshold="virtualScroll.scrollConfig.intersectionThreshold"
              :root-margin="virtualScroll.scrollConfig.rootMargin"
              :get-item-key="(item) => (item as Conversation).id"
              class="smart-virtual-conversations"
              @reach-bottom="handleLoadMore"
              @visible-range-change="handleVisibleRangeChange"
              @predictive-load="handlePredictiveLoad"
            >
              <template #default="{ item }">
                <div class="virtual-conversation-wrapper">
                  <ConversationCard
                    :conversation="item as Conversation"
                    :selected="controller.selectedConversationId.value === (item as Conversation).id"
                    @select="controller.selectConversation"
                  />
                </div>
              </template>

              <template #loading>
                <div class="flex items-center justify-center gap-2 p-6 text-gray-600 text-sm">
                  <HamsterLoader message="刷新中..." />
                  <span>智能載入更多對話中...</span>
                </div>
              </template>

              <template #end>
                <div class="flex justify-center p-6">
                  <div class="end-stats">
                    <span> 已顯示全部 {{ controller.totalConversations.value }} 個對話</span>
                  </div>
                </div>
              </template>
            </SmartVirtualScrollList>
          </div>
        </Transition>
      </div>

      <!-- Pagination -->
      <div
        v-if="controller.totalPages.value > 1"
        class="pagination flex items-center justify-between p-6 bg-white border-t border-gray-200 md:flex-col md:gap-4"
      >
        <button
          :disabled="controller.currentPage.value === 1"
          class="btn btn-secondary"
          @click="controller.changePage(controller.currentPage.value - 1)"
        >
          <ChevronLeftIcon />
          上一頁
        </button>

        <div class="flex flex-col items-center gap-1">
          <span class="font-semibold text-gray-900">第 {{ controller.currentPage.value }} / {{ controller.totalPages.value }} 頁</span>
          <span class="text-sm text-gray-600">共 {{ controller.totalConversations.value }} 個對話</span>
        </div>

        <button
          :disabled="controller.currentPage.value === controller.totalPages.value"
          class="btn btn-secondary"
          @click="controller.changePage(controller.currentPage.value + 1)"
        >
          下一頁
          <ChevronRightIcon />
        </button>
      </div>
    </div>
    <!-- 匯出對話記錄對話框 -->
    <ExportDialog
      :show="showExportDialog"
      @close="showExportDialog = false"
      @update:show="showExportDialog = $event"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useConversationsStore } from '@/stores/conversations'
import {
  useConversationListController,
  // useConversationSync, // DEPRECATED - Phase B4: 使用 store.initializeRealtime()
  useConversationVirtualScroll
} from '@/composables/conversation'
import type { Conversation, ConversationFilters as ConversationFiltersType } from '@/types'
import { tagCacheService } from '@/services/tagCacheService'

// UI Components
import AppLayout from '@/components/ui/AppLayout.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import SmartVirtualScrollList from '@/components/ui/SmartVirtualScrollList.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConversationCard from '@/components/conversation/ConversationCard.vue'
import ExportDialog from '@/components/conversation/ExportDialog.vue'
import { ConversationHeader, ConversationFilters } from '@/components/conversation-list'
import { ChatIcon, SearchIcon } from '@/components/icons'
import { useDebounce } from '@/composables/useDebounce'

// Chevron icons
const ChevronLeftIcon = {
  template: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>`
}

const ChevronRightIcon = {
  template: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`
}

// Export dialog state
const showExportDialog = ref(false)

// Initialize composables
const conversationsStore = useConversationsStore()
const controller = useConversationListController()
// useConversationSync 已廢棄，改用 store 的 initializeRealtime (Phase B4)
// const syncComposable = useConversationSync() // DEPRECATED
const virtualScroll = useConversationVirtualScroll()

// Search
const searchQuery = ref('')
const debouncedSearch = useDebounce(searchQuery, 300)
const isSearching = computed(() => debouncedSearch.value.trim().length > 0)

function clearSearch() {
  searchQuery.value = ''
}

// Sync debounced search to controller filters → triggers API reload
watch(debouncedSearch, (newVal) => {
  controller.filters.updateFilter('search', newVal.trim())
})

// Computed properties
const showSkeleton = computed(() => conversationsStore.showSkeleton)
const availableTags = computed(() => tagCacheService.getAllTags())
// Phase B4: 從 store 獲取同步狀態
const isSyncing = computed(() => conversationsStore.syncStatus === 'connecting' || conversationsStore.syncStatus === 'polling')

/**
 * 处理筛选更新
 */
function handleFilterUpdate(key: keyof ConversationFiltersType, value: string | number | undefined) {
  // Type assertion needed because child component emits simplified types
  controller.filters.updateFilter(key, value as ConversationFiltersType[typeof key])
}

/**
 * 处理刷新
 */
async function handleRefresh() {
  await controller.refresh()
  // Phase B4: 使用 store 的輪詢作為備份刷新機制
  // await syncComposable.refresh() // DEPRECATED
}

/**
 * 处理加载更多
 */
async function handleLoadMore() {
  await virtualScroll.handleReachBottom(() => controller.loadMore())
}

/**
 * 处理可见范围变化
 */
async function handleVisibleRangeChange(startIndex: number, endIndex: number) {
  await virtualScroll.handleVisibleRangeChange(startIndex, endIndex, () => controller.loadMore())
}

/**
 * 处理预测性加载
 */
function handlePredictiveLoad(direction: 'up' | 'down', estimatedDistance: number) {
  virtualScroll.handlePredictiveLoad(direction, estimatedDistance, () => controller.loadMore())
}

// Lifecycle
onMounted(async () => {
  console.log('[ConversationList] Component mounted (Phase B4 - Direct Real-time Updates)')

  // 初始化控制器
  await controller.initialize()

  // Phase B4: 使用 Store 的 initializeRealtime 啟動 WebSocket 實時更新
  // 這會訂閱 'conversations' channel 並直接更新對話列表
  await conversationsStore.initializeRealtime()

  console.log('[ConversationList] Initialized with real-time updates')
})

onUnmounted(() => {
  console.log('[ConversationList] Component unmounted')

  // 清理资源
  controller.cleanup()
  // Phase B4: 使用 Store 的 cleanup 清理 WebSocket 訂閱
  conversationsStore.cleanup()
  virtualScroll.resetScroll()

  console.log('[ConversationList] Cleanup completed')
})
</script>

<style scoped>
/* ============================================
   Search Bar
   ============================================ */

.search-section {
  @apply px-6 pt-4;
  background: white;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  transition: border-color 0.2s, background 0.2s;
}

.search-bar:focus-within {
  border-color: #3b82f6;
  background: white;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-icon {
  width: 18px;
  height: 18px;
  color: #9ca3af;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.9375rem;
  color: #1f2937;
  outline: none;
}

.search-input::placeholder {
  color: #9ca3af;
}

.search-clear {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0.25rem;
  line-height: 1;
  border-radius: 4px;
  transition: all 0.15s;
}

.search-clear:hover {
  color: #4b5563;
  background: #e5e7eb;
}

.search-stats {
  font-size: 0.75rem;
  color: #3b82f6;
  font-weight: 600;
  white-space: nowrap;
  padding: 0.25rem 0.5rem;
  background: #eff6ff;
  border-radius: 4px;
}

/* ============================================
   Complex CSS (Cannot use Tailwind)
   ============================================ */

/* Virtual scrolling - exact height calculation */
.smart-virtual-conversations {
  height: calc(100vh - 300px);
  min-height: 400px;
}

/* Virtual conversation wrapper - Performance optimizations */
.virtual-conversation-wrapper {
  @apply p-2 transition-all duration-200;
  transform: translateZ(0);
  will-change: transform;
  backface-visibility: hidden;
}

.virtual-conversation-wrapper:hover {
  transform: translateY(-1px) translateZ(0);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* End stats - Gradient background */
.end-stats {
  @apply py-3 px-6 text-gray-700 rounded-full border border-sky-200 text-sm font-medium;
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* ============================================
   Accessibility
   ============================================ */

/* Reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .virtual-conversation-wrapper {
    animation: none !important;
    transition: none !important;
  }
}
</style>
