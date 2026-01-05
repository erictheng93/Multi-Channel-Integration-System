<template>
  <AppLayout>
    <div class="conversation-list">
      <!-- Header with Actions -->
      <ConversationHeader
        :cache-hit-rate="controller.cache.cacheHitRate.value"
        :sync-status="syncComposable.syncStatus.value"
        :is-syncing="syncComposable.isSyncing.value"
        :is-refreshing="controller.isRefreshing.value"
        @refresh="handleRefresh"
      />

      <!-- Filters Section -->
      <ConversationFilters
        :filters="controller.filters.filters.value"
        :available-tags="availableTags"
        :total-conversations="controller.totalConversations.value"
        :unread-count="controller.unreadCount.value"
        @update:filter="handleFilterUpdate"
        @toggle:tag="controller.filters.toggleTagFilter"
        @clear:tags="controller.filters.clearTagFilter"
      />

      <!-- Content -->
      <div class="list-content">
        <!-- Skeleton Loading -->
        <SkeletonLoader
          v-if="showSkeleton"
          :count="8"
          class="skeleton-fade-in"
        />

        <!-- Empty State -->
        <EmptyState
          v-else-if="controller.conversations.value.length === 0 && !controller.isLoading.value"
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
          class="conversations-container"
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
              <div class="virtual-loading">
                <HamsterLoader message="刷新中..." />
                <span>智能載入更多對話中...</span>
              </div>
            </template>

            <template #end>
              <div class="virtual-end">
                <div class="end-stats">
                  <span>✨ 已顯示全部 {{ controller.totalConversations.value }} 個對話</span>
                </div>
              </div>
            </template>
          </SmartVirtualScrollList>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="controller.totalPages.value > 1"
        class="pagination"
      >
        <button
          :disabled="controller.currentPage.value === 1"
          class="btn btn-secondary"
          @click="controller.changePage(controller.currentPage.value - 1)"
        >
          <ChevronLeftIcon />
          上一頁
        </button>

        <div class="page-info">
          <span class="page-text">第 {{ controller.currentPage.value }} / {{ controller.totalPages.value }} 頁</span>
          <span class="total-text">共 {{ controller.totalConversations.value }} 個對話</span>
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
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useConversationsStore } from '@/stores/conversations'
import {
  useConversationListController,
  useConversationSync,
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
import { ConversationHeader, ConversationFilters } from '@/components/conversation-list'
import { ChatIcon } from '@/components/icons'

// Chevron icons
const ChevronLeftIcon = {
  template: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>`
}

const ChevronRightIcon = {
  template: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`
}

// Initialize composables
const conversationsStore = useConversationsStore()
const controller = useConversationListController()
const syncComposable = useConversationSync()
const virtualScroll = useConversationVirtualScroll()

// Computed properties
const showSkeleton = computed(() => conversationsStore.showSkeleton)
const availableTags = computed(() => tagCacheService.getAllTags())

/**
 * 处理筛选更新
 */
function handleFilterUpdate(key: keyof ConversationFiltersType, value: string | undefined) {
  controller.filters.updateFilter(key, value)
}

/**
 * 处理刷新
 */
async function handleRefresh() {
  await controller.refresh()
  await syncComposable.refresh()
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
  console.log('🚀 [ConversationList] Component mounted (refactored)')

  // 初始化控制器
  await controller.initialize()

  // 启动同步服务
  await syncComposable.startSync((data: Conversation[]) => {
    console.log('📥 [ConversationList] Sync data received:', data.length)
    conversationsStore.setConversations(data)
  })

  console.log('✅ [ConversationList] Initialized successfully')
})

onUnmounted(() => {
  console.log('🛑 [ConversationList] Component unmounted')

  // 清理资源
  controller.cleanup()
  syncComposable.stopSync()
  virtualScroll.resetScroll()

  console.log('✨ [ConversationList] Cleanup completed')
})
</script>

<style scoped>
.conversation-list {
  height: 100%;
  display: flex;
  flex-direction: column;
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

/* Virtual scrolling styles */
.smart-virtual-conversations {
  height: calc(100vh - 300px);
  min-height: 400px;
}

.virtual-conversation-wrapper {
  padding: var(--space-2);
  transition: all 0.2s ease;
  transform: translateZ(0);
  will-change: transform;
  backface-visibility: hidden;
}

.virtual-conversation-wrapper:hover {
  transform: translateY(-1px) translateZ(0);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
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

/* Responsive Design */
@media (max-width: 768px) {
  .pagination {
    flex-direction: column;
    gap: var(--space-4);
  }
}

/* Reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .skeleton-fade-in,
  .virtual-conversation-wrapper {
    animation: none !important;
    transition: none !important;
  }
}
</style>
