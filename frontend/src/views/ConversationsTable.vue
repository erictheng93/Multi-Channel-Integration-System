<template>
  <AppLayout>
    <ErrorBoundary>
      <div class="conversations">
        <header class="conversations-header">
          <div class="header-top">
            <h1>對話管理</h1>
            <div class="header-actions">
              <button
                type="button"
                class="btn btn-secondary btn-sm selection-toggle"
                :class="{ 'is-active': selectionMode }"
                :aria-pressed="selectionMode"
                :disabled="displayedConversations.length === 0 && !selectionMode"
                @click="toggleSelectionMode"
              >
                {{ selectionMode ? '完成' : '選取' }}
              </button>
              <RefreshButton
                :loading="loading || isUpdating"
                @refresh="refreshConversations"
              />
            </div>
          </div>
          <ConversationFilters
            :filters="filterComposable.filters.value"
            :available-tags="availableTags"
            :total-conversations="conversations.length"
            :unread-count="0"
            @update:filter="handleFilterUpdate"
            @toggle:tag="filterComposable.toggleTagFilter"
            @clear:tags="filterComposable.clearTagFilter"
            @clear:all="filterComposable.clearAllFilters"
          />
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
            v-else-if="loadError && conversations.length === 0"
            class="conversations-error"
            role="alert"
          >
            <div class="conversations-error-content">
              <div class="conversations-error-title">
                無法載入對話列表
              </div>
              <div class="conversations-error-text">
                {{ loadError }}
              </div>
              <button
                type="button"
                class="btn btn-primary"
                :disabled="isUpdating"
                @click="refreshConversations"
              >
                重試
              </button>
            </div>
          </div>
          <div
            v-else-if="displayedConversations.length === 0"
            class="no-data"
          >
            <div class="no-data-content">
              <div class="no-data-icon" />
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
              :selection-mode="selectionMode"
              :selected-ids="selectedIds"
              @select="goToConversation"
              @toggle-select="toggleSelect"
              @toggle-select-all="toggleSelectAll"
            />

            <!-- Mobile Card View -->
            <ConversationMobileCards
              :conversations="displayedConversations"
              :selection-mode="selectionMode"
              :selected-ids="selectedIds"
              @select="goToConversation"
              @toggle-select="toggleSelect"
            />
          </div>
        </div>

        <!-- 批量操作列 -->
        <Transition name="bulk-bar">
          <div
            v-if="selectionMode && selectedIds.size > 0"
            class="bulk-action-bar"
            role="toolbar"
            aria-label="批量操作"
          >
            <span class="bulk-count">已選 {{ selectedIds.size }} 筆</span>
            <span
              v-if="overLimit"
              class="bulk-limit"
              role="status"
            >最多 {{ BULK_LIMIT }} 筆</span>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="!canClose || overLimit || bulkBusy"
              @click="runBulk(true)"
            >
              結案
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              :disabled="!canReopen || overLimit || bulkBusy"
              @click="runBulk(false)"
            >
              重新開啟
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              :disabled="bulkBusy"
              @click="clearSelection"
            >
              取消
            </button>
          </div>
        </Transition>
      </div>
    </ErrorBoundary>
  </AppLayout>
</template>

<script setup lang="ts">
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('ConversationsTable')
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useConversationsStore } from '@/stores/conversations'
import { useConversationFilters } from '@/composables/conversation/useConversationFilters'
import { useDebounce } from '@/composables/useDebounce'
import { useToast } from '@/composables/useToast'
import { tagCacheService } from '@/services/tagCacheService'
import type { ConversationFilters as ConversationFiltersType } from '@/types'

import AppLayout from '@/components/ui/AppLayout.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import ConversationSyncIndicator from '@/components/conversations/ConversationSyncIndicator.vue'
import ConversationDesktopTable from '@/components/conversations/ConversationDesktopTable.vue'
import ConversationMobileCards from '@/components/conversations/ConversationMobileCards.vue'
import { ConversationFilters } from '@/components/conversation-list'

const router = useRouter()
const conversationsStore = useConversationsStore()
const filterComposable = useConversationFilters()

// Available tags for tag filter dropdown (reactive)
const availableTags = ref<{ id: number; name: string; color: string }[]>([])

async function loadAvailableTags() {
  try {
    const tags = await tagCacheService.ensureTagsLoaded()
    availableTags.value = tags.map(t => ({ id: t.id, name: t.name, color: t.color }))
  } catch (err) {
    console.warn('Failed to load tags for filter:', err)
  }
}

// Debounced API filters — triggers store fetch on change
const apiFilters = computed(() => filterComposable.getApiFilters())
const debouncedApiFilters = useDebounce(apiFilters, 300)

// 平滑載入動畫系統
const isUpdating = ref(false)
const previousConversationIds = ref<string[]>([])
const animationDelay = ref(0)

// 直接使用 Store 數據，避免 useAsyncData 的複雜性
const loading = computed(() => conversationsStore.loading)
const loadError = computed(() => conversationsStore.loadError)
const conversations = computed(() => conversationsStore.conversations)

// 平滑載入系統：顯示的對話列表（僅 lastMessageSearch 為 client-side 篩選）
const displayedConversations = computed(() => {
  let result = conversations.value
  const lastMsgSearch = filterComposable.filters.value.lastMessageSearch?.trim().toLowerCase()
  if (lastMsgSearch) {
    result = result.filter(c => {
      const content = (c.lastMessage?.content || '').toLowerCase()
      return content.includes(lastMsgSearch)
    })
  }
  return result
})

// ==================== 批量選取 ====================
const BULK_LIMIT = 100
const { showSuccess, showError } = useToast()

const selectionMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const bulkBusy = ref(false)

const selectedConversations = computed(() =>
  displayedConversations.value.filter(c => selectedIds.value.has(c.id))
)
const canClose = computed(() => selectedConversations.value.some(c => c.status !== 'closed'))
const canReopen = computed(() => selectedConversations.value.some(c => c.status === 'closed'))
const overLimit = computed(() => selectedIds.value.size > BULK_LIMIT)

function clearSelection() {
  selectedIds.value = new Set()
}

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) { clearSelection() }
}

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) { next.delete(id) } else { next.add(id) }
  selectedIds.value = next
}

function toggleSelectAll() {
  const pageIds = displayedConversations.value.map(c => c.id)
  const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.value.has(id))
  const next = new Set(selectedIds.value)
  for (const id of pageIds) {
    if (allSelected) { next.delete(id) } else { next.add(id) }
  }
  selectedIds.value = next
}

// 篩選 / 換頁後，移除已不在目前列表中的選取
watch(displayedConversations, (list) => {
  if (selectedIds.value.size === 0) { return }
  const visible = new Set(list.map(c => c.id))
  const kept = Array.from(selectedIds.value).filter(id => visible.has(id))
  if (kept.length !== selectedIds.value.size) {
    selectedIds.value = new Set(kept)
  }
})

async function runBulk(closed: boolean) {
  if (bulkBusy.value || overLimit.value || selectedIds.value.size === 0) { return }
  bulkBusy.value = true
  try {
    const count = await conversationsStore.bulkSetConversationsClosed(
      Array.from(selectedIds.value),
      closed
    )
    if (count === null) {
      showError(conversationsStore.error || (closed ? '批量結案失敗' : '批量重新開啟失敗'))
      return
    }
    showSuccess(closed ? `已結案 ${count} 筆對話` : `已重新開啟 ${count} 筆對話`)
    clearSelection()
  } finally {
    bulkBusy.value = false
  }
}

// Watch debounced API filters and fetch from API
watch(debouncedApiFilters, (newFilters) => {
  frontendLogger.debug('[ConversationsTable] API filters changed:', newFilters)
  conversationsStore.fetchConversations(newFilters as ConversationFiltersType)
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

frontendLogger.debug('[ConversationsTable] Initial state:', {
  loading: loading.value,
  conversationsLength: conversations.value.length,
  storeState: conversationsStore.$state
})

// 平滑更新函數
const performSmoothUpdate = async () => {
  if (isUpdating.value) {return} // 防止重複更新

  isUpdating.value = true
  frontendLogger.debug('[ConversationsTable] Starting smooth update...')

  try {
    await conversationsStore.fetchConversations(filterComposable.getApiFilters() as ConversationFiltersType)

    // 短暫的視覺反饋
    await nextTick()
    setTimeout(() => {
      isUpdating.value = false
      frontendLogger.debug('[ConversationsTable] Smooth update completed')
    }, 800) // 800ms 的更新指示器顯示時間

  } catch (error) {
    console.error('[ConversationsTable] Update failed:', error)
    isUpdating.value = false
  }
}

// 刷新對話列表的函數
const refreshConversations = () => {
  frontendLogger.debug('[ConversationsTable] Manual refresh requested')
  performSmoothUpdate()
}

const goToConversation = (id: string) => {
  router.push(`/conversations/${id}`)
}

// Event handlers for ConversationFilters component
function handleFilterUpdate(key: keyof ConversationFiltersType, value: string | number | undefined) {
  filterComposable.updateFilter(key, value as ConversationFiltersType[typeof key])
}

onMounted(async () => {
  frontendLogger.debug(' ConversationsTable mounted')

  // Load tags for filter dropdown (async, reactive)
  loadAvailableTags()

  // FIX: 每次 mount 都刷新數據，確保返回列表時顯示最新狀態
  // 使用 loadWithCache 提供最佳 UX：
  // - 如果有緩存數據：立即顯示，背景靜默更新（只顯示更新指示器，非全屏載入）
  // - 如果無緩存數據：顯示載入狀態
  try {
    await conversationsStore.loadWithCache(filterComposable.getApiFilters() as ConversationFiltersType)
  } catch (error) {
    console.error('載入對話失敗:', error)
    // 即使載入失敗，也不要讓頁面白屏
    // conversationsStore 已經有自己的錯誤處理
  }

  // 方案 B 阶段 1: 启动实时同步
  // Store 层统一管理 WebSocket 连接，所有使用 store 的组件自动获得实时更新
  frontendLogger.debug('[ConversationsTable] Initializing real-time sync from Store...')
  conversationsStore.initializeRealtime()
})

// 清理实时同步资源
onUnmounted(() => {
  frontendLogger.debug('[ConversationsTable] Component unmounting, cleaning up...')
  conversationsStore.cleanup()
})
</script>

<style scoped>
.conversations {
  background-color: #f8f9fa;
  min-height: calc(100vh - 120px);
  min-height: calc(100dvh - 120px);
  position: relative;
}

.conversations-header {
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #f0f0f0;
}

.header-top h1 {
  margin: 0;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
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

/* Load failure state */
.conversations-error {
  background: #FFFFFF;
  border-radius: 24px;
  box-shadow: 0 4px 16px rgb(0, 0, 0, 0.06);
  padding: 4rem 2rem;
  text-align: center;
  animation: fadeIn 0.4s ease-out;
}

.conversations-error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  max-width: 400px;
  margin: 0 auto;
}

.conversations-error-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #FF3B30;
}

.conversations-error-text {
  font-size: 0.95rem;
  color: #8E8E93;
  margin-bottom: 0.5rem;
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

/* Selection toggle (layout only; button look comes from global .btn) */
.selection-toggle.is-active {
  background: #007AFF;
  color: #FFFFFF;
}

/* Floating bulk action bar */
.bulk-action-bar {
  position: fixed;
  left: 50%;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: calc(100vw - 32px);
  padding: 8px 12px 8px 20px;
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.8);
  -webkit-backdrop-filter: blur(24px);
  backdrop-filter: blur(24px);
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.06);
}

.bulk-count {
  font-size: 14px;
  font-weight: 600;
  color: #1C1C1E;
  white-space: nowrap;
  margin-right: 0.25rem;
}

.bulk-limit {
  font-size: 12px;
  color: #FF3B30;
  white-space: nowrap;
}

.bulk-bar-enter-active,
.bulk-bar-leave-active {
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
}

.bulk-bar-enter-from,
.bulk-bar-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(16px);
}

@media (max-width: 480px) {
  .bulk-action-bar {
    gap: 0.25rem;
    padding: 6px 8px 6px 14px;
  }
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
  .header-top {
    padding: 0.75rem 1rem;
  }

  .conversations-content {
    padding: 1rem;
  }

  .conversations-table-container {
    box-shadow: none;
    border-radius: 0;
  }

  .no-data,
  .conversations-error {
    padding: 3rem 1rem;
  }

  .no-data-icon {
    font-size: 2.5rem;
  }
}

@media (max-width: 480px) {
  .header-top {
    padding: 0.75rem;
  }
}
</style>
