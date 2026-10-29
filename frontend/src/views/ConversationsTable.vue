<template>
  <AppLayout>
    <ErrorBoundary>
      <div class="ui-page conversations ui-rise">
        <UiPageHead
          title="對話"
          :subtitle="subtitle"
        >
          <template #actions>
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
          </template>
        </UiPageHead>

        <!-- 分頁籤：預設「處理中」，已結案的對話不佔據最顯眼的位置 -->
        <section class="ui-card filter-card">
          <div class="filter-top">
            <div
              class="ui-seg"
              role="tablist"
              aria-label="對話分類"
            >
              <button
                v-for="tab in visibleTabs"
                :key="tab.value"
                type="button"
                role="tab"
                class="scope-tab"
                :class="{ 'is-on': scope === tab.value, 'is-stale': tab.value === 'stale' }"
                :aria-selected="scope === tab.value"
                :title="tab.value === 'stale' ? `已含在處理中：客戶來訊後超過 ${WAITING_WINDOW_DAYS} 天仍未回覆，不計入待回覆` : undefined"
                :data-testid="`scope-tab-${tab.value}`"
                @click="selectView(tab.value)"
              >
                {{ tab.label }}
                <span
                  v-if="tabCount(tab.value) !== null"
                  class="ui-seg-n"
                >{{ tabCount(tab.value) }}</span>
              </button>
            </div>
            <p
              v-if="isSearching && scope !== 'stale'"
              class="scope-hint"
              role="status"
            >
              搜尋時會一併顯示已結案的對話
            </p>
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
        </section>

        <!-- 逾期待回覆：說明結案是可逆的 -->
        <p
          v-if="scope === 'stale'"
          class="ui-card stale-note"
          role="note"
          data-testid="stale-note"
        >
          這些對話的客戶已超過 {{ WAITING_WINDOW_DAYS }} 天沒有收到回覆，不計入待回覆。從未獲得回覆的排在最前面，其餘依等待時間由久到近。
          按「選取」勾選後可批量結案；結案不會刪除任何內容，客戶下次來訊時會自動重新開啟同一個對話。
        </p>

        <!-- SSE 更新指示器 -->
        <ConversationSyncIndicator :visible="isUpdating" />

        <div class="conversations-content">
          <div
            v-if="loading && displayedConversations.length === 0"
            class="ui-card loading-overlay"
          >
            <HamsterLoader message="載入對話列表中..." />
          </div>
          <div
            v-else-if="loadError && displayedConversations.length === 0"
            class="ui-card conversations-error"
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
          <UiEmptyState
            v-else-if="displayedConversations.length === 0"
            class="ui-card no-data"
            :title="emptyText"
          >
            <template #icon>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              ><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" /></svg>
            </template>
          </UiEmptyState>
          <div
            v-else
            class="ui-card conversations-table-container"
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

            <p class="list-foot">
              {{ LEGEND_TEXT }}
            </p>
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
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiPageHead from '@/components/ui/UiPageHead.vue'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('ConversationsTable')
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConversationsStore } from '@/stores/conversations'
import { useConversationFilters } from '@/composables/conversation/useConversationFilters'
import { useDebounce } from '@/composables/useDebounce'
import { useToast } from '@/composables/useToast'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { conversationApi } from '@/api/conversations'
import { useUnreadStore } from '@/stores/unread'
import { formatWaitText } from '@/composables/dashboard/useDashboardOverview'
import { LEGEND_TEXT } from '@/composables/conversation/useConversationRowMeta'
import { WAITING_WINDOW_DAYS, type ConversationStats } from '@shared/api-contracts'
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
const route = useRoute()
const unreadStore = useUnreadStore()

// ==================== Tab counts + subtitle (real stats) ====================
// 待回覆 (team-wide) comes from /conversations/waiting; 未讀 (personal) from the shared unread store.
const counts = ref<ConversationStats | null>(null)
const waitingTotal = ref(0)
const waitingSince = ref<string | null>(null)
const staleCount = ref(0)
const clock = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | null = null

async function loadCounts() {
  try {
    const [statsRes, waitingRes] = await Promise.all([conversationApi.getStats(), conversationApi.getWaiting(1)])
    if (statsRes.success && statsRes.data) { counts.value = statsRes.data }
    if (waitingRes.success && waitingRes.data) {
      waitingTotal.value = waitingRes.data.total
      waitingSince.value = waitingRes.data.items[0]?.waitingSince ?? null
      staleCount.value = waitingRes.data.stale?.count ?? 0
    }
  } catch (err) {
    console.warn('Failed to load conversation counts:', err)
  }
}

const oldestWaitText = computed(() =>
  waitingSince.value ? formatWaitText(Math.max(0, (clock.value - Date.parse(waitingSince.value)) / 1000)) : '')

// One line (<= 60 chars); the 未讀 / 待回覆 definitions live in the table header tooltip
const subtitle = computed(() => {
  if (!counts.value) { return '' }
  const parts = [`${counts.value.open} 件處理中`, `${waitingTotal.value} 件待回覆`]
  if (oldestWaitText.value) { parts.push(`最久等 ${oldestWaitText.value}`) }
  if (unreadStore.total > 0) { parts.push(`我的未讀 ${unreadStore.total}`) }
  return parts.join(' · ')
})

function tabCount(value: ListView): number | null {
  if (value === 'stale') { return staleCount.value }
  if (!counts.value) { return null }
  return value === 'open' ? counts.value.open : value === 'closed' ? counts.value.closed : counts.value.total
}
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

// 分頁籤（處理中 / 已結案 / 全部）。不放進 filterComposable：「清除篩選」不應該切換分頁
type ConversationScope = NonNullable<ConversationFiltersType['scope']>
// 'stale' (逾期待回覆) is a view over open conversations, sent to the API as awaiting=stale
type ListView = ConversationScope | 'stale'
const SCOPE_TABS: ReadonlyArray<{ value: ListView; label: string; empty: string }> = [
  { value: 'open', label: '處理中', empty: '沒有處理中的對話' },
  { value: 'closed', label: '已結案', empty: '沒有已結案的對話' },
  { value: 'all', label: '全部', empty: '暫無對話記錄' },
  // Its own scope, listed last: a review view over open conversations, not a status
  { value: 'stale', label: '逾期待回覆', empty: '沒有逾期未回覆的對話' }
]
// ?view=stale deep-links the review list (dashboard link)
const scope = ref<ListView>(route.query.view === 'stale' ? 'stale' : 'open')
// The 逾期 tab appears only when there is something to review (or while it is open)
const visibleTabs = computed(() => SCOPE_TABS.filter(t => t.value !== 'stale' || staleCount.value > 0 || scope.value === 'stale'))

function selectView(value: ListView) {
  scope.value = value
  const query = { ...route.query }
  if (value === 'stale') { query.view = 'stale' } else { delete query.view }
  void router.replace({ query })
}
watch(() => route.query.view, (view) => {
  const next: ListView = view === 'stale' ? 'stale' : (scope.value === 'stale' ? 'open' : scope.value)
  if (next !== scope.value) { scope.value = next }
})

// 有搜尋字時一律搜「全部」：找舊客戶不該因為對話已結案而查無結果（未結案仍排在前面）
// lastMessageSearch 只在前端篩選已載入的列，伺服器端無法涵蓋已結案，故不納入
const isSearching = computed(() => {
  const f = filterComposable.filters.value
  return Boolean(f.customerName?.trim() || f.search?.trim())
})
const effectiveScope = computed<ConversationScope>(() => {
  if (scope.value === 'stale') { return 'open' }
  return isSearching.value ? 'all' : scope.value
})
const emptyText = computed(() => isSearching.value && scope.value !== 'stale'
  ? '找不到符合的對話（已包含已結案）'
  : SCOPE_TABS.find(t => t.value === scope.value)?.empty ?? '暫無對話記錄')

// Debounced API filters — triggers store fetch on change
const apiFilters = computed(() => {
  const base: ConversationFiltersType = { ...filterComposable.getApiFilters(), scope: effectiveScope.value }
  // 後端把 status 與 scope 取交集：已結案分頁不能再帶 active/assigned/pending，否則永遠是空的
  if (base.scope === 'closed') { delete base.status }
  if (scope.value === 'stale') { base.awaiting = 'stale'; delete base.status }
  return base
})
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
// 分頁籤也在前端套用：結案 / 重新開啟後列即時滑出，不必等重新抓取
const scopedConversations = computed(() =>
  effectiveScope.value === 'open'
    ? conversations.value.filter(c => c.status !== 'closed')
    : effectiveScope.value === 'closed'
      ? conversations.value.filter(c => c.status === 'closed')
      : conversations.value
)

// 列因狀態轉換滑出分頁後，若伺服器還有更多，補抓一次填滿頁面
let refillTimer: ReturnType<typeof setTimeout> | null = null
watch(() => [effectiveScope.value, scopedConversations.value] as const, ([scope, list], [prevScope, prev]) => {
  // 換分頁不是狀態轉換：debounced 篩選 watcher 會負責抓取，這裡取消待補抓並跳過，避免重複請求
  if (scope !== prevScope) {
    if (refillTimer) { clearTimeout(refillTimer); refillTimer = null }
    return
  }
  if (scope === 'all' || conversationsStore.pagination.totalPages <= 1) { return }
  const kept = new Set(list.map(c => c.id))
  const loaded = new Set(conversations.value.map(c => c.id))
  // 只算「仍在列表、但已不屬於本分頁」的列；換分頁 / 重新抓取造成的消失不會觸發
  if (!prev.some(c => !kept.has(c.id) && loaded.has(c.id))) { return }
  if (refillTimer) { clearTimeout(refillTimer) }
  refillTimer = setTimeout(() => {
    refillTimer = null
    conversationsStore.fetchConversations(apiFilters.value as ConversationFiltersType)
  }, 500)
})

const displayedConversations = computed(() => {
  let result = scopedConversations.value
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
const { showConfirm } = useConfirmDialog()

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
  // 結案後未讀會歸零（對所有客服），批量時可能沒看過最後一句 → 有未讀就先確認
  if (closed) {
    const unreadCount = selectedConversations.value.filter(c => c.status !== 'closed' && c.unreadCount > 0).length
    if (unreadCount > 0) {
      const confirmed = await showConfirm({
        title: '仍要結案嗎？',
        message: `其中 ${unreadCount} 筆有未讀訊息，結案後所有客服都不會再看到未讀提示。`,
        type: 'warning',
        confirmText: '結案',
        cancelText: '取消'
      })
      if (!confirmed) { return }
    }
  }
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
    await conversationsStore.fetchConversations(apiFilters.value as ConversationFiltersType)

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
  void loadCounts()
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
  void loadCounts()
  clockTimer = setInterval(() => {
    clock.value = Date.now()
    if (document.visibilityState === 'visible') { void loadCounts() }
  }, 60_000)

  // FIX: 每次 mount 都刷新數據，確保返回列表時顯示最新狀態
  // 使用 loadWithCache 提供最佳 UX：
  // - 如果有緩存數據：立即顯示，背景靜默更新（只顯示更新指示器，非全屏載入）
  // - 如果無緩存數據：顯示載入狀態
  try {
    // 即時事件觸發的輪詢讀 activeFilters；先設好，避免首次輪詢不帶 scope 而抓回已結案
    conversationsStore.setActiveFilters(apiFilters.value as ConversationFiltersType)
    await conversationsStore.loadWithCache(apiFilters.value as ConversationFiltersType)
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
  if (refillTimer) { clearTimeout(refillTimer) }
  if (clockTimer) { clearInterval(clockTimer) }
  conversationsStore.cleanup()
})
</script>

<style scoped>
.conversations {
  position: relative;
}

.filter-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px 18px;
}

.filter-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
}

.filter-top > .ui-seg {
  max-width: 100%;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-top > .ui-seg::-webkit-scrollbar {
  display: none;
}

.scope-tab {
  flex: none;
  white-space: nowrap;
}

/* The review scope sits apart from the status tabs */
.scope-tab.is-stale {
  margin-left: 10px;
}

.scope-tab .ui-seg-n {
  margin-left: 2px;
}

.stale-note {
  margin: 0;
  padding: 14px 20px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--ui-muted);
}

.scope-hint {
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}

/* Loading / empty / error cards */
.loading-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
}

.no-data,
.conversations-error {
  text-align: center;
}

.conversations-error {
  padding: 48px 24px;
}

.conversations-error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  max-width: 400px;
  margin: 0 auto;
}

.conversations-error-title {
  font: 600 16px var(--ui-font-display);
  color: var(--ui-red-ink);
}

.conversations-error-text {
  margin-bottom: 6px;
  font-size: 13.5px;
  color: var(--ui-muted);
}

/* Table card */
.conversations-table-container {
  position: relative;
  overflow: hidden;
  transition: opacity var(--ui-dur) var(--ui-ease);
}

.conversations-table-container.updating {
  opacity: 0.82;
}

.list-foot {
  margin: 0;
  padding: 12px 22px 14px;
  font-size: 13px;
  color: var(--ui-muted);
  text-align: center;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

/* Selection toggle (layout only; button look comes from global .btn) */
.selection-toggle.is-active {
  background: var(--ui-accent);
  color: #fff;
}

/* Floating bulk action bar */
.bulk-action-bar {
  position: fixed;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100vw - 32px);
  padding: 8px 12px 8px 20px;
  border-radius: 999px;
  background: var(--ui-glass);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  backdrop-filter: saturate(180%) blur(24px);
  box-shadow: var(--ui-shadow-raised);
  transform: translateX(-50%);
}

.bulk-count {
  margin-right: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink);
  white-space: nowrap;
}

.bulk-limit {
  font-size: 13px;
  color: var(--ui-red-ink);
  white-space: nowrap;
}

.bulk-bar-enter-active,
.bulk-bar-leave-active {
  transition: opacity 0.25s var(--ui-ease), transform 0.25s var(--ui-ease);
}

.bulk-bar-enter-from,
.bulk-bar-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(16px);
}

@media (max-width: 768px) {
  .filter-card {
    padding: 14px;
  }

  /* Edge fade: the row scrolls sideways instead of wrapping onto a second line */
  .filter-top > .ui-seg {
    -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent);
    mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent);
  }

  .scope-tab {
    min-height: 44px;
  }
}

@media (max-width: 480px) {
  .bulk-action-bar {
    gap: 4px;
    padding: 6px 8px 6px 14px;
  }
}
</style>
