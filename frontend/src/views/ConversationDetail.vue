<template>
  <AppLayout>
    <div
      class="conversation-detail"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @dragover="handleDragOver"
      @drop="handleDrop"
    >
      <!-- 📎 Drag-and-Drop Overlay -->
      <Transition name="fade-overlay">
        <div
          v-if="isDraggingFile && conversation?.status !== 'closed'"
          class="drag-drop-overlay"
        >
          <div class="drag-drop-content">
            <div class="drag-drop-icon">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49" />
              </svg>
            </div>
            <div class="drag-drop-text">
              <span class="drag-drop-title">放開以上傳檔案</span>
              <span class="drag-drop-hint">支援圖片、PDF、Word 等格式（單檔最大 10MB）</span>
            </div>
          </div>
        </div>
      </Transition>
      <!-- Simplified Header Component -->
      <ConversationHeader
        :conversation="conversation"
        :loading="loading"
        :closing="closing"
        @back="goBack"
        @close="closeConversation"
        @refresh="handleRefreshMessages"
        @search="toggleSearch"
      />

      <!-- 🆕 Closed Conversation Banner -->
      <div
        v-if="conversation && conversation.status === 'closed'"
        class="closed-conversation-banner"
      >
        <div class="banner-content">
          <div class="banner-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
              />
              <line
                x1="12"
                y1="8"
                x2="12"
                y2="12"
              />
              <line
                x1="12"
                y1="16"
                x2="12.01"
                y2="16"
              />
            </svg>
          </div>
          <div class="banner-text">
            <strong>此對話已關閉</strong>
            <span class="banner-hint">對話已結束，無法發送訊息</span>
          </div>
          <button
            class="reopen-btn"
            @click="reopenConversation"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <span>重新打開對話</span>
          </button>
        </div>
      </div>

      <!-- Enhanced Search Panel (toggleable from header) -->
      <Transition name="search-slide">
        <div
          v-if="showSearchPanel"
          class="message-search-panel"
        >
          <Suspense>
            <MessageSearch
              ref="messageSearchRef"
              :messages="messages"
              :auto-expand="true"
              @search-results="handleSearchResults"
              @search-clear="handleSearchClear"
            />
          </Suspense>
        </div>
      </Transition>

      <!-- High Performance Virtual Message List with WebSocket -->
      <!-- 🔧 FIX: Added Transition wrapper to prevent flicker/shaking during navigation -->
      <div class="messages-container-wrapper">
        <Transition
          name="fade-content"
          mode="out-in"
        >
          <!-- 🎨 優化的加載狀態：動態骨架屏 with Progressive Loading -->
          <MessageListSkeleton
            v-if="isInitialLoading && !hasLoadedInitially"
            key="skeleton"
            :count="skeletonCount"
            :loading-text="skeletonLoadingText"
          />

          <!-- Empty State -->
          <div
            v-else-if="hasLoadedInitially && displayedMessages.length === 0"
            key="empty"
            class="empty-state-wrapper"
          >
            <EmptyState
              :title="isSearchActive ? '未找到匹配的訊息' : '暫無訊息'"
              :description="isSearchActive ? '嘗試調整搜索條件' : '這個對話還沒有任何訊息'"
            >
              <template #icon>
                <MessageCircleIcon />
              </template>
            </EmptyState>
          </div>

          <!-- Virtual Message List -->
          <VirtualMessageList
            v-else
            key="messages"
            ref="virtualMessageListRef"
            :messages="messages"
            :displayed-messages="displayedMessages"
            :is-search-active="isSearchActive"
            :loading="httpMessages.loading.value"
            :has-more="httpMessages.hasMore.value"
            :loading-history="loadingHistory"
            :is-updating="isUpdating"
            :is-typing="isTyping"
            :typing-users="typingUsers"
            :animation-classes="animationClasses"
            :enable-animations="true"
            :websocket-enabled="isWebSocketEnabled"
            :is-history-prepending="httpMessages.isHistoryPrepending?.value ?? false"
            :history-prepend-count="httpMessages.historyPrependCount?.value ?? 0"
            @message-copy="handleMessageCopy"
            @message-reply="handleMessageReply"
            @message-forward="handleMessageForward"
            @message-recall="handleMessageRecall"
            @message-select="handleMessageSelect"
            @search-clear="handleSearchClear"
            @load-more="loadMoreMessages"
            @scroll="handleVirtualScroll"
            @new-message-while-scrolled="handleNewMessageWhileScrolled"
            @retry="retryFailedMessage"
          />
        </Transition>
      </div>

      <!-- 新消息提醒 with WebSocket enhancements -->
      <div
        v-if="showNewMessageModal"
        class="glassmorphism-notification"
        @click="scrollToNewest"
      >
        <div class="glass-content">
          <div class="notification-pulse">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </div>
          <div class="glass-text">
            <span class="message-count">{{ newMessageCount }}</span>
            <span class="message-label">新消息</span>
            <span
              v-if="currentProtocol === 'websocket'"
              class="delivery-status"
            >即時</span>
          </div>
          <button
            class="glass-dismiss"
            title="暫時忽略"
            @click.stop="dismissNewMessageModal"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="m18 6-12 12" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Enhanced Message Input with WebSocket features -->
      <div
        v-if="conversation?.status !== 'closed'"
        class="input-section"
      >
        <MessageInput
          ref="messageInputRef"
          :conversation-id="conversationId"
          :disabled="false"
          :websocket-enabled="isWebSocketEnabled"
          :connection-quality="connectionQuality"
          @message-sent="handleMessageSent"
          @message-pending="handleMessagePending"
          @upload-progress="handleUploadProgress"
          @message-confirmed="handleMessageConfirmed"
          @message-failed="handleMessageFailed"
          @typing-start="handleTypingStart"
          @typing-stop="handleTypingStop"
          @attachment-upload="handleAttachmentUpload"
        />

        <!-- Quick Replies -->
        <div
          v-if="quickReplies.length > 0"
          class="quick-replies"
        >
          <button
            v-for="reply in quickReplies"
            :key="reply.id"
            class="quick-reply-btn"
            @click="useQuickReply(reply.text)"
          >
            {{ reply.text }}
          </button>
        </div>

        <!-- 🌐 Connection Status Bar - 僅在調試模式下顯示 (使用 ?debug=true 或 localStorage.devDebugMode=true) -->
        <div
          v-if="isDevDebugMode && (unifiedIsConnected || unifiedConnectionState === 'error' || isWebSocketEnabled)"
          class="connection-status-bar"
        >
          <div class="status-items">
            <span class="status-item">
              <span
                class="status-dot"
                :class="connectionStatusClass"
              />
              {{ connectionStatusText }}
            </span>
            <span
              v-if="0 > 0"
              class="status-item reconnect-info"
            >
              重連嘗試: {{ 0 }}/{{ true ? '5' : 'max' }}
            </span>
            <span
              v-if="presence.typingUsers.length > 0"
              class="status-item"
            >
              {{ presence.typingUsers.length }} 人正在輸入
            </span>
            <span
              v-if="unifiedConnectionState === 'error'"
              class="status-item error-info"
              title="Connection error"
            >
              ⚠️ Connection error
            </span>
          </div>
        </div>
      </div>

      <!-- Closed State -->
      <div
        v-else
        class="closed-state"
      >
        <div class="closed-message">
          <XCircleIcon />
          <span>此對話已結束</span>
        </div>
      </div>
    </div>

    <!-- Lazy loaded keyboard shortcuts -->
    <Suspense>
      <KeyboardShortcuts ref="keyboardShortcutsRef" />
    </Suspense>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted, defineAsyncComponent, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConversationsStore } from '@/stores/conversations'
// ✅ CUSTOMER API: 使用新的 Customer Conversation System
import { useCustomerMessages } from '@/composables/useCustomerMessages' // Customer HTTP API
import { conversationCache } from '@/utils/conversationCache' // 🚀 Conversation metadata cache
import { useWebSocketMigration } from '@/composables/useWebSocketMigration'
import { useWebSocketStatus } from '@/composables/useWebSocketStatus'
import { usePerformanceMonitor, performanceUtils } from '@/composables/usePerformanceMonitor'
import { useSmoothLoading } from '@/composables/useSmoothLoading'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useConnectionState } from '@/composables/useConnectionState'
import { useLoadingState } from '@/composables/useLoadingState'
import { useEventHandler, type AnyFunction } from '@/composables/useEventHandler'
import { usePerformanceOptimization } from '@/composables/usePerformanceOptimization'
import { useErrorHandler, ErrorType } from '@/composables/useErrorHandler'
// import { useMessageDebounce } from '@/composables/useMessageDebounce' // 🚫 Unused - handleMessageSent no longer uses it
import { useFileUpload } from '@/composables/useFileUpload' // ⚡ Phase 3C: For retry file uploads
// 🔧 FIX: messageApi 已不再使用 - 改用 httpMessages.sendMessageWithAttachments()
// import { messageApi } from '@/api/message' // ⚡ Phase 3C: For retry message send
import { useAuthStore } from '@/stores/auth' // ⚡ For optimistic message creation
import type { Message, FileAttachmentData } from '@/types'
// ✅ CUSTOMER API: Unified Connection Manager for Customer Conversations
import { createCustomerRealtimeConnection, type CustomerRealtimeConnection, type ConnectionState } from '@/services/customerWebSocketManager'
type RealtimeConnection = CustomerRealtimeConnection
type ConnectionType = 'websocket'

// Core components
import AppLayout from '@/components/ui/AppLayout.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
// import HamsterLoader from '@/components/ui/HamsterLoader.vue' // 替換為 MessageListSkeleton
import MessageListSkeleton from '@/components/conversation/MessageListSkeleton.vue'
import VirtualMessageList from '@/components/conversation/VirtualMessageList.vue'
import MessageInput from '@/components/conversation/MessageInput.vue'
import ConversationHeader from '@/components/conversation/ConversationHeader.vue'
import { MessageCircleIcon, XCircleIcon } from '@/components/icons'

// Lazy load non-critical components for better performance
const MessageSearch = defineAsyncComponent(() => import('@/components/conversation/MessageSearch.vue'))
const KeyboardShortcuts = defineAsyncComponent(() => import('@/components/ui/KeyboardShortcuts.vue'))
// Unused components - commented out to reduce bundle size
// const AdvancedAssignActions = defineAsyncComponent(() => import('@/components/conversation/AdvancedAssignActions.vue'))
// const WebSocketStatusIndicator = defineAsyncComponent(() => import('@/components/ui/WebSocketStatusIndicator.vue'))
// const TypingIndicator = defineAsyncComponent(() => import('@/components/conversation/TypingIndicator.vue'))
// const PresenceBadge = defineAsyncComponent(() => import('@/components/ui/PresenceBadge.vue'))

// Routes
const route = useRoute()
const router = useRouter()
const conversationsStore = useConversationsStore()

// 🔧 Developer Debug Mode - 用於顯示連接狀態等調試資訊
// 可以通過 URL 參數 ?debug=true 或 localStorage 設置 devDebugMode=true 啟用
const isDevDebugMode = ref(false)

// 初始化調試模式
const initDebugMode = () => {
  // 檢查 URL 參數
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('debug') === 'true') {
    isDevDebugMode.value = true
    return
  }
  // 檢查 localStorage
  try {
    isDevDebugMode.value = localStorage.getItem('devDebugMode') === 'true'
  } catch {
    isDevDebugMode.value = false
  }
}

// 立即初始化
initDebugMode()

// 🚀 WebSocket-Only Strategy (Backend 100% Support)
const migration = useWebSocketMigration({
  strategy: 'websocket_only', // 使用 100% WebSocket (后端已完全支持)
  fallbackToSSE: false,
  rolloutPercentage: 100 // 100% WebSocket rollout
})

// WebSocket Status Monitoring (保留供未來使用)
const websocketStatus = useWebSocketStatus()

// Performance monitoring
const {
  startMonitoring,
  stopMonitoring,
  mark,
  measure,
  getPerformanceReport,
  logPerformanceSummary
} = usePerformanceMonitor()

// Conversation ID
const conversationId = computed(() => route.params.id as string)



// ✅ CUSTOMER API: HTTP API System for Customer Conversations
// 🔧 FIX: Disabled progressive loading to prevent flicker/shaking during navigation
// Progressive loading (2-phase: 10 recent → 20 history) causes layout shifts
const httpMessages = useCustomerMessages(conversationId.value, {
  enablePagination: true,
  pageSize: 30,
  enableProgressiveLoading: false // 🔧 FIX: Disabled - causes flicker when message count changes 10→30
})

// 🚀 Unified Connection Manager (Primary Real-time System)
const unifiedConnection = ref<RealtimeConnection | null>(null)
const unifiedConnectionType = ref<ConnectionType>('websocket')
const unifiedConnectionState = ref<ConnectionState>('disconnected')
const unifiedIsConnected = ref(false)

// 📎 Drag-and-Drop File Upload State
const isDraggingFile = ref(false)
const dragCounter = ref(0) // 追蹤拖拽事件計數（處理子元素事件冒泡）

// 🔧 FIX: 追蹤本標籤發送的訊息 ID，用於跨瀏覽器同步時避免發送端重複
// 當 WebSocket 廣播先於 handleMessageConfirmed 到達時，使用此 Set 判斷是否應跳過
const sentMessageIds = new Set<string>()

// 🧩 Unified State Management with new composables
const connectionState = useConnectionState({
  sseIsConnected: unifiedIsConnected,
  sseIsConnecting: computed(() => unifiedConnectionState.value === 'connecting'),
  sseIsReconnecting: computed(() => unifiedConnectionState.value === 'reconnecting'),
  sseHasError: computed(() => unifiedConnectionState.value === 'error'),
  wsIsJoined: computed(() => false), // Not used anymore
  wsIsConnecting: computed(() => false),
  shouldUseWebSocket: computed(() => unifiedConnectionType.value === 'websocket')
})

const loadingState = useLoadingState({
  sseIsConnected: unifiedIsConnected,
  wsIsJoined: computed(() => false), // Not used anymore
  httpMessagesCount: computed(() => httpMessages.messages.value.length),
  shouldUseWebSocket: computed(() => unifiedConnectionType.value === 'websocket'),
  isLoading: computed(() => httpMessages.loading.value)
})

// 🎯 Unified Event Handler for better memory management
const eventHandler = useEventHandler()

// ⚡ Performance Optimization for computed values
const performanceOptimizer = usePerformanceOptimization({
  cacheTimeout: 2 * 60 * 1000, // 2分鐘快取
  maxCacheSize: 30,
  enableProfiling: import.meta.env.DEV // 只在開發環境啟用性能分析
})

// 🚨 Unified Error Handling
const errorHandler = useErrorHandler({
  maxErrors: 20,
  autoRetry: true,
  showToast: true,
  logToConsole: import.meta.env.DEV
})

// 🚫 Message Debounce - Prevent duplicate sending
// 🔧 NOTE: Currently unused since handleMessageSent no longer adds messages
// Keeping for potential future use - commented out to avoid TS6133 error
// const messageDebounce = useMessageDebounce({
//   delay: 500, // 500ms 防抖延迟
//   enabled: true // 启用防抖保护
// })

// 🧠 Unified Message Source Strategy (Unified Connection + HTTP)
// Unified Connection handles both WebSocket and SSE automatically
// CRITICAL FIX: Removed all console.log from computed to prevent infinite recursion
// Computed functions MUST be pure functions without side effects
const messages = computed((): Message[] => {
  // 🔧 DIAGNOSTIC: Check if we should force HTTP fallback
  // Set to false to use normal SSE/HTTP hybrid logic
  const FORCE_HTTP_FALLBACK = false  // Using normal flow

  // Priority 1: Unified Connection (WebSocket or SSE based on rollout)
  if (unifiedConnection.value && unifiedIsConnected.value && !FORCE_HTTP_FALLBACK) {
    // 🎯 混合策略：合併 Unified Connection 實時消息和 HTTP 歷史消息
    const conn = unifiedConnection.value
    const unifiedMessages = ((conn.messages as unknown) as Ref<Message[]>).value || []

    const unifiedMessageIds = new Set(unifiedMessages.map((m: Message) => m.id))

    // 過濾出不在 Unified Connection 消息中的 HTTP 歷史消息（避免重複）
    const httpHistoryMessages = httpMessages.messages.value.filter(
      m => !unifiedMessageIds.has(m.id)
    )

    // 合併消息並按時間排序（從舊到新）
    const mergedMessages = [...httpHistoryMessages, ...unifiedMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    return mergedMessages
  }

  // Priority 2: HTTP API Messages (fallback when no connection)
  return httpMessages.messages.value
})

// Extract connection and loading state
const loading = computed(() => {
  if (unifiedIsConnected.value) {return false}
  return httpMessages.loading.value
})

// Message statistics
const messageCount = computed(() => messages.value.length)
const hasNewMessages = computed(() => {
  const conn = unifiedConnection.value
  return conn ? (((conn.messageCount as unknown) as Ref<number>).value > 0) : false
})
const newMessagesCount = computed(() => {
  const conn = unifiedConnection.value
  return conn ? ((conn.messageCount as unknown) as Ref<number>).value : 0
})

// Typing and presence (disabled - will be re-enabled with WebSocket)
const presence = computed(() => ({ isOnline: false, typingUsers: [] }))
const typingUsers = computed(() => [])// 🎨 Smooth loading for SSE messages (simplified)
const {
  messages: smoothMessages,
  isUpdating,
  updateMessages
  // getAnimationClasses - 未使用，已註釋
} = useSmoothLoading({
  animationDuration: 400,
  enableAnimations: false, // 🔧 RECURSION FIX: Disable animations to test if they cause the loop
  debounceDelay: 50
})

// CRITICAL FIX: Add guard to prevent recursive watcher calls
let isUpdatingMessages = false
let lastMessagesLength = 0

// Optimized message source watcher with unified debouncing and recursion guard
const debouncedUpdateMessages = eventHandler.debounce(((newMessages: Message[]) => {
  // Prevent recursive calls
  if (isUpdatingMessages) {
    return
  }

  // Skip if messages array hasn't actually changed
  if (newMessages.length === lastMessagesLength && lastMessagesLength > 0) {
    return
  }

  isUpdatingMessages = true
  lastMessagesLength = newMessages.length

  try {
    updateMessages(newMessages, true)
  } finally {
    // 🔧 RECURSION FIX: Extended protection window to 300ms
    // This covers the full animation duration (200ms) + 100ms buffer
    // Previous 100ms was too short and allowed setTimeout cleanup to trigger unprotected
    setTimeout(() => {
      isUpdatingMessages = false
    }, 300)
  }
}) as AnyFunction, 50)

// CRITICAL FIX: Watch messages but prevent infinite recursion
// The key is that updateMessages in useSmoothLoading does NOT trigger messages computed
// because it only updates smoothMessages, which is separate from messages
// 🔧 RECURSION FIX: Removed immediate: true to prevent early triggering during mount
watch(
  () => messages.value,
  (newMessages) => {
    if (newMessages && newMessages.length >= 0) {
      debouncedUpdateMessages(newMessages)
    }
  },
  { flush: 'post' }
)

// Core state with null safety
const conversation = computed(() => conversationsStore.currentConversation || undefined)
const closing = ref(false)
const isTyping = ref(false)

// Use new composable state management
const { hasLoadedInitially, isInitialLoading, loadingHistory } = loadingState

// 🚀 Dynamic skeleton screen based on cached message count
const skeletonCount = computed(() =>
  conversationCache.getEstimatedMessageCount(conversationId.value)
)

// 🚀 Dynamic loading text based on progressive loading phase
const skeletonLoadingText = computed(() => {
  if (httpMessages.isLoadingInitial?.value) {
    return '正在載入最近消息...'
  }
  if (httpMessages.loadingHistory?.value) {
    return '載入對話歷史...'
  }
  return '載入對話歷史...'
})

// Component refs
const virtualMessageListRef = ref()
const messageInputRef = ref()
const keyboardShortcutsRef = ref()
const messageSearchRef = ref()

// 🌐 Use unified connection state from composable
const {
  currentProtocol,
  connectionQuality
} = connectionState

const isWebSocketEnabled = computed(() => migration.shouldUseWebSocket.value)

// Typing state (disabled in Phase 1)
const isLocalTyping = ref(false)

// Create debounced stop typing function
const debouncedStopTyping = eventHandler.debounce(() => {
  isTyping.value = false
  isLocalTyping.value = false

  // Send WebSocket typing stop if enabled
  if (isWebSocketEnabled.value && isWebSocketJoined.value) {
    try {
      stopWebSocketTyping()
    } catch (error) {
      console.error('Failed to stop typing indicator:', error)
    }
  }
}, 3000)

// Search state
const searchResults = ref<Message[]>([])
const isSearchActive = ref(false)
const showSearchPanel = ref(false)

// Toggle search panel from header button
const toggleSearch = () => {
  showSearchPanel.value = !showSearchPanel.value
}

// New message notification
const showNewMessageModal = ref(false)
const newMessageCount = computed(() => hasNewMessages.value ? newMessagesCount.value : 0)

// WebSocket connection state
const isWebSocketJoined = computed(() =>
  isWebSocketEnabled.value && false
)

// Performance optimized computed properties
// const customerInitials = computed(() => { // Unused - commented out
//   const name = conversation.value?.customer?.name || 'U'
//   return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
// })

// CRITICAL FIX: Direct computed without performance optimizer cache
// The cachedComputed was returning stale/empty values
const displayedMessages = computed(() => {
  return isSearchActive.value ? searchResults.value : smoothMessages.value
})

// 🌐 Performance optimized connection status with caching
const connectionStatusText = performanceOptimizer.cachedComputed(() => {
  // Priority 1: WebSocket Status
  if (unifiedIsConnected.value) {
    // Use messages.value.length to get total messages (including initial load)
    const conn = unifiedConnection.value
    const msgCount = conn ? (((conn.messages as unknown) as Ref<Message[]>).value?.length ?? 0) : 0
    return `🔌 WebSocket 已連接 (${msgCount} 條訊息)`
  }

  if (unifiedConnectionState.value === 'connecting') {
    return '🔌 WebSocket 連接中...'
  }

  if (unifiedConnectionState.value === 'reconnecting') {
    const attempts = 0
    return `🔌 WebSocket 重連中... (${attempts}/5)`
  }

  if (unifiedConnectionState.value === 'error') {
    return '❌ WebSocket 連接失敗'
  }

  // Priority 2: Fallback to HTTP polling if WebSocket fails
  if (currentProtocol.value === 'websocket') {
    return websocketStatus.statusIndicator.value.label
  }

  // Priority 3: HTTP Fallback
  if (currentProtocol.value === 'http') {
    return `🔄 HTTP 輪詢 (${messageCount.value} 條訊息)`
  }

  return '⚠️ 未連接'
}, 'connection-status', { timeout: 1000 }) // 1秒快取，快速更新狀態

const connectionStatusClass = computed(() => {
  // SSE Status Classes
  if (unifiedIsConnected.value) {
    return 'status-connected status-sse'
  }

  if (unifiedConnectionState.value === 'connecting' || unifiedConnectionState.value === 'reconnecting') {
    return 'status-connecting status-sse'
  }

  if (unifiedConnectionState.value === 'error') {
    return 'status-error status-sse'
  }

  // WebSocket Status Classes (legacy)
  if (currentProtocol.value === 'websocket') {
    const state = websocketStatus.connectionState.value
    return {
      'status-connected': state === 'connected',
      'status-connecting': state === 'connecting',
      'status-reconnecting': state === 'reconnecting',
      'status-error': state === 'error',
      'status-disconnected': state === 'disconnected',
      'status-websocket': true
    }
  }

  // HTTP Fallback
  return 'status-connected status-http'
})

// const connectionQualityClass = computed(() => { // Unused - commented out
//   const quality = websocketStatus.connectionHealth.value.quality
//   return {
//     'connection-excellent': quality === 'excellent',
//     'connection-good': quality === 'good',
//     'connection-fair': quality === 'fair',
//     'connection-poor': quality === 'poor',
//     'connection-offline': quality === 'offline'
//   }
// })

// Removed unused computed property: statusIndicatorClass

// 🔧 Memoized animation class generation - 暫時禁用以避免遞歸問題
// const memoizedAnimationClasses = performanceOptimizer.memoize(
//   (messages: Message[], getClassesFn: Function | undefined) => {
//     const result: Record<string, string> = {}
//
//     if (typeof getClassesFn === 'function' && messages.length > 0) {
//       messages.forEach(message => {
//         const classes = getClassesFn(message.id)
//         if (classes && classes['message-fade-in']) {
//           result[message.id] = 'message-fade-in'
//         }
//       })
//     }
//
//     return result
//   },
//   (messages, getClassesFn) => `${messages.length}-${typeof getClassesFn}`
// )

// Animation classes for smooth message transitions
// 🔧 RECURSION FIX: Temporarily disable to test if this causes the loop
const animationClasses = computed(() => {
  return {} // Return empty object - no animations
})

// Quick replies
const quickReplies = ref([
  { id: '1', text: '感謝您的來信，我們會盡快回覆' },
  { id: '2', text: '請問還有其他需要協助的嗎？' },
  { id: '3', text: '謝謝您的耐心等待' },
  { id: '4', text: '問題已為您解決，如有其他疑問請隨時聯繫' }
])

// Performance optimized polling as backup
const pollingInterval = ref<NodeJS.Timeout | null>(null)
// const pollingDelays = [30000, 60000, 120000, 300000] // Unused - commented out
const currentPollingIndex = ref(0)
const isPageVisible = ref(true)
const lastUserActivity = ref(Date.now())
// const USER_INACTIVE_THRESHOLD = 60000 // Unused - commented out

// ⚡ Enhanced message handlers with Optimistic UI Update
// 📤 Optimistic Message Sending - Instant UI feedback with background API sync
const handleMessageSent = async (data: { content: string; attachments: unknown[]; file_attachments?: FileAttachmentData[] }) => {
  console.log('📤 [Message] handleMessageSent called (backward compatibility event)')
  trackUserActivity()

  // 🔧 FIX: 這個事件只用於向後相容和日誌記錄
  // 訊息已經在 handleMessagePending 中添加到 UI
  // 不要再次添加訊息，避免重複！

  // Stop typing indicators
  stopTyping()

  if (!data.content?.trim() && (!data.file_attachments || data.file_attachments.length === 0)) {
    console.warn('Empty message content and no attachments, skipping')
    return
  }

  migration.reportMetric('message_sent_http', { content: data.content?.substring(0, 50) || '[file only]' })

  // Reset polling
  resetPollingDelay()

  console.log('✅ [Message] handleMessageSent completed - message already in UI via handleMessagePending')
}

// ⚡ Phase 3B: 處理訊息開始發送（樂觀更新）
interface MessagePendingData {
  tempId: string
  content: string
  attachments: Array<{
    name: string
    size: number
    blobUrl?: string
    isImage: boolean
    fileType: string
    typeColor: string
  }>
  status: 'uploading' | 'sending'
  uploadProgress?: number
}

const handleMessagePending = (data: MessagePendingData) => {
  console.log('⚡ [Phase 3B] Message pending - showing immediately:', data.tempId)
  trackUserActivity()

  const authStore = useAuthStore()

  // 創建樂觀訊息，立即顯示給用戶
  // 使用 'pending' 作為 deliveryStatus（符合 DeliveryStatus 類型）
  // 實際上傳狀態存儲在 metadata.uploadStatus 中
  const optimisticMessage: Message = {
    id: data.tempId,
    conversationId: conversationId.value,
    senderId: authStore.currentAgent?.id || 'unknown',
    senderType: 'agent' as const,
    content: data.content,
    messageType: data.attachments.length > 0 ? 'file' as const : 'text' as const,
    platform: conversation.value?.platform || 'line',
    timestamp: Date.now(),
    createdAt: Date.now(),
    status: 'pending' as const,  // 使用 pending，實際狀態在 metadata
    deliveryStatus: 'pending' as const,
    senderName: authStore.currentAgent?.displayName || authStore.currentAgent?.name || '我',
    // 保存附件資訊（包含 blobUrl）供顯示
    metadata: {
      uploadStatus: data.status, // 'uploading' | 'sending' - Phase 3B 專用
      uploadProgress: data.uploadProgress || 0,
      pendingAttachments: data.attachments.map(a => ({
        name: a.name,
        size: a.size,
        blobUrl: a.blobUrl,
        isImage: a.isImage,
        fileType: a.fileType,
        typeColor: a.typeColor
      }))
    } as Record<string, unknown>
  }

  // 立即添加到訊息列表
  httpMessages.addMessage(optimisticMessage)

  // 滾動到最新訊息
  setTimeout(() => scrollToNewest(), 50)
}

// ⚡ Phase 3B: 處理上傳進度更新
interface UploadProgressData {
  tempId: string
  progress: number
  status: 'uploading' | 'sending'
}

const handleUploadProgress = (data: UploadProgressData) => {
  console.log(`⚡ [Phase 3B] Upload progress: ${data.progress}% - ${data.status}`)

  const messageList = httpMessages.messages.value
  const message = messageList.find(m => m.id === data.tempId)

  if (message) {
    // 根據狀態設置有效的 DeliveryStatus
    // 'uploading' -> 保持 'pending'
    // 'sending' -> 使用 'sending' (有效的 DeliveryStatus)
    const deliveryStatus = data.status === 'sending' ? 'sending' as const : 'pending' as const
    message.status = deliveryStatus
    message.deliveryStatus = deliveryStatus

    // 在 metadata 中儲存實際上傳狀態，供 UI 顯示使用
    if (message.metadata && typeof message.metadata === 'object') {
      const meta = message.metadata as Record<string, unknown>
      meta.uploadProgress = data.progress
      meta.uploadStatus = data.status  // 'uploading' | 'sending'
    }
  }
}

// ⚡ Phase 3B: 處理訊息發送成功確認
interface MessageConfirmedData {
  tempId: string
  realId: string
  file_attachments?: FileAttachmentData[]
}

const handleMessageConfirmed = (data: MessageConfirmedData) => {
  console.log('✅ [Phase 3B] Message confirmed:', data.tempId, '->', data.realId)

  // 🔧 FIX: 立即將 realId 加入已發送集合
  // 這樣即使 WebSocket 廣播先到達，handleUnifiedMessage 也能正確跳過
  sentMessageIds.add(data.realId)
  console.log(`📝 [Phase 3B] Added to sentMessageIds: ${data.realId}`)

  // 定時清理（5分鐘後移除，避免記憶體洩漏）
  setTimeout(() => {
    sentMessageIds.delete(data.realId)
    console.log(`🧹 [Phase 3B] Cleaned up sentMessageIds: ${data.realId}`)
  }, 5 * 60 * 1000)

  const messageList = httpMessages.messages.value
  const message = messageList.find(m => m.id === data.tempId)

  if (message) {
    // 🔧 FIX: 更新訊息 ID 從 tempId 到 realId
    // 這樣當 WebSocket 廣播到達時，addMessage 的 ID 去重會正確跳過這個訊息
    // 同時其他瀏覽器標籤可以正確接收訊息（因為它們沒有這個 realId）
    message.id = data.realId
    console.log(`📝 [Phase 3B] Updated message ID: ${data.tempId} -> ${data.realId}`)

    // 更新訊息狀態為已發送
    message.status = 'sent' as const
    message.deliveryStatus = 'sent' as const

    // 如果有真實的檔案附件資料，更新它
    if (data.file_attachments && data.file_attachments.length > 0) {
      // eslint-disable-next-line camelcase
      message.file_attachments = data.file_attachments
    }

    // 清理臨時資料
    if (message.metadata && typeof message.metadata === 'object') {
      delete (message.metadata as Record<string, unknown>).uploadProgress
      delete (message.metadata as Record<string, unknown>).pendingAttachments
    }

    console.log('✅ [Phase 3B] Message status updated to sent with realId')
  }
}

// ⚡ Phase 3C: 附件介面定義（重試用）
interface RetryAttachment {
  name: string
  size: number
  file: globalThis.File  // 原始檔案物件
  blobUrl?: string
  isImage: boolean
  fileType: string
  typeColor: string
}

// ⚡ Phase 3C: 處理訊息發送失敗（含重試資料）
interface MessageFailedData {
  tempId: string
  error: string
  retryData?: {
    content: string
    attachments: RetryAttachment[]
  }
}

const handleMessageFailed = (data: MessageFailedData) => {
  console.error('❌ [Phase 3C] Message failed:', data.tempId, '-', data.error)

  const messageList = httpMessages.messages.value
  const message = messageList.find(m => m.id === data.tempId)

  if (message) {
    message.status = 'failed' as const
    message.deliveryStatus = 'failed' as const

    // Phase 3C: 儲存錯誤訊息和重試資料到 metadata
    if (message.metadata && typeof message.metadata === 'object') {
      const meta = message.metadata as Record<string, unknown>
      meta.error = data.error
      // 儲存重試資料（如果有）
      if (data.retryData) {
        meta.retryContent = data.retryData.content
        meta.retryAttachments = data.retryData.attachments
      }
    }

    console.log('❌ [Phase 3C] Failed message stored with retry data:', {
      tempId: data.tempId,
      hasRetryData: !!data.retryData,
      attachmentCount: data.retryData?.attachments?.length || 0
    })
  }
}

// ⚡ Helper function to update optimistic message status
const updateOptimisticMessageStatus = (messageId: string, newStatus: 'sending' | 'sent' | 'failed') => {
  const messageList = httpMessages.messages.value
  const message = messageList.find(m => m.id === messageId)

  if (message) {
    // ⚡ Update message properties directly (Vue will track changes)
    message.status = newStatus
    message.deliveryStatus = newStatus

    console.log(`⚡ [Optimistic] Updated message ${messageId} status to: ${newStatus}`)
  }
}

// 🔄 Phase 3C: Enhanced retry with attachment support
const retryFailedMessage = async (messageId: string) => {
  const messageList = httpMessages.messages.value
  const failedMessage = messageList.find(m => m.id === messageId && m.status === 'failed')

  if (!failedMessage) {
    console.warn('⚠️ [Retry] Failed message not found:', messageId)
    return
  }

  console.log('🔄 [Phase 3C] Retrying failed message:', messageId)

  // Phase 3C: 從 metadata 獲取重試資料
  const meta = failedMessage.metadata as Record<string, unknown> | undefined
  const retryContent = (meta?.retryContent as string) || failedMessage.content
  const retryAttachments = (meta?.retryAttachments as RetryAttachment[]) || []
  const hasAttachments = retryAttachments.length > 0

  console.log('🔄 [Phase 3C] Retry data:', {
    content: retryContent,
    attachmentCount: retryAttachments.length
  })

  // Update status to sending/uploading
  if (hasAttachments) {
    failedMessage.status = 'pending' as const
    failedMessage.deliveryStatus = 'pending' as const
    if (meta) {
      meta.uploadStatus = 'uploading'
      meta.uploadProgress = 0
    }
  } else {
    updateOptimisticMessageStatus(messageId, 'sending')
  }

  try {
    const { uploadSingleFile } = useFileUpload()
    const attachmentIds: string[] = []

    // Phase 3C: 如果有附件，重新上傳
    if (hasAttachments) {
      console.log('🔄 [Phase 3C] Re-uploading attachments...')
      const totalFiles = retryAttachments.length
      let completedFiles = 0

      for (const attachment of retryAttachments) {
        try {
          // 使用原始檔案物件重新上傳
          const result = await uploadSingleFile(attachment.file, {}, (progress) => {
            if (meta) {
              const overallProgress = Math.round(
                ((completedFiles + progress / 100) / totalFiles) * 100
              )
              meta.uploadProgress = overallProgress
            }
          })

          if (result.success && result.fileId) {
            attachmentIds.push(result.fileId)
            completedFiles++
            console.log(`✅ [Phase 3C] Attachment uploaded: ${attachment.name}`)
          } else {
            throw new Error(result.error || '上傳失敗')
          }
        } catch (uploadError) {
          console.error('❌ [Phase 3C] Attachment re-upload failed:', uploadError)
          updateOptimisticMessageStatus(messageId, 'failed')
          if (meta) {
            meta.error = `重試上傳失敗: ${attachment.name}`
          }
          const { showError } = useToast()
          showError(`檔案 ${attachment.name} 重試上傳失敗`)
          return
        }
      }

      // 上傳完成，更新狀態
      if (meta) {
        meta.uploadStatus = 'sending'
        meta.uploadProgress = 100
      }
    }

    // Phase 3C: 發送訊息
    updateOptimisticMessageStatus(messageId, 'sending')

    // 🔧 FIX: 統一使用 httpMessages（customer-conversations API）以支持 WebSocket 廣播
    // 之前使用 messageApi.send() 會走錯誤的端點，導致其他客服收不到即時更新
    let success: boolean
    if (attachmentIds.length > 0) {
      // 使用 httpMessages.sendMessageWithAttachments() 發送帶附件的訊息
      // 這會使用 /api/customer-conversations/ 端點，觸發 WebSocket 廣播給所有客服
      const response = await httpMessages.sendMessageWithAttachments(
        retryContent,
        attachmentIds,
        {
          messageType: 'file',
          platform: 'line'
        }
      )
      success = response.success
    } else {
      success = await httpMessages.sendMessage(retryContent)
    }

    if (success) {
      updateOptimisticMessageStatus(messageId, 'sent')
      // 清理重試資料
      if (meta) {
        delete meta.retryContent
        delete meta.retryAttachments
        delete meta.uploadStatus
        delete meta.uploadProgress
        delete meta.error
      }
      console.log('✅ [Phase 3C] Retry successful')
      const { showSuccess } = useToast()
      showSuccess('訊息重試發送成功')
    } else {
      updateOptimisticMessageStatus(messageId, 'failed')
      if (meta) {
        meta.error = '重試發送失敗'
      }
      console.error('❌ [Phase 3C] Retry send failed')
      const { showError } = useToast()
      showError('訊息重試發送失敗，請再試一次')
    }
  } catch (error) {
    updateOptimisticMessageStatus(messageId, 'failed')
    console.error('❌ [Phase 3C] Exception during retry:', error)
    const { showError } = useToast()
    showError('重試時發生錯誤，請稍後再試')
  }
}

// 🔄 Enhanced Message Refresh with SSE Support
const handleRefreshMessages = async () => {
  console.log('🔄 [Refresh] Manual refresh triggered via:', currentProtocol.value)
  trackUserActivity()

  try {
    // Priority 1: SSE reconnection (if connection lost)
    if (unifiedConnectionState.value === 'error' || unifiedConnectionState.value === 'disconnected') {
      console.log('🔄 [Refresh] Reconnecting SSE...')
      await unifiedConnection.value?.reconnect()
    }

    // Priority 2: HTTP refresh as fallback
    if (!unifiedIsConnected.value) {
      console.log('🔄 [Refresh] Using HTTP API refresh...')
      await httpMessages.refreshMessages()
    }


    resetPollingDelay()
    console.log('✅ [Refresh] Manual refresh completed')

  } catch (error) {
    console.error('❌ [Refresh] Failed to refresh messages:', error)
    // TODO: Show user notification for failed refresh
  }
}

// Typing handlers with WebSocket support
const handleTypingStart = () => {
  startTyping()
}

const handleTypingStop = () => {
  stopTyping()
}

const startTyping = () => {
  isTyping.value = true
  isLocalTyping.value = true

  // Send WebSocket typing indicator if enabled
  if (isWebSocketEnabled.value && isWebSocketJoined.value) {
    try {
      startWebSocketTyping()
    } catch (error) {
      console.error('Failed to send typing indicator:', error)
    }
  }

  // Auto-stop typing after delay using debounced function
  debouncedStopTyping()
}

const stopTyping = () => {
  isTyping.value = false
  isLocalTyping.value = false

  // Send WebSocket typing stop if enabled
  if (isWebSocketEnabled.value && isWebSocketJoined.value) {
    try {
      stopWebSocketTyping()
    } catch (error) {
      console.error('Failed to stop typing indicator:', error)
    }
  }
}

const handleAttachmentUpload = (attachment: unknown) => {
  console.log('Attachment uploaded:', attachment)
}

// 📎 Drag-and-Drop File Upload Handlers
const handleDragEnter = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()

  // 檢查是否為檔案拖拽
  if (event.dataTransfer?.types.includes('Files')) {
    dragCounter.value++
    isDraggingFile.value = true
  }
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()

  dragCounter.value--
  // 只有當計數器歸零時才隱藏覆蓋層（處理子元素事件）
  if (dragCounter.value <= 0) {
    dragCounter.value = 0
    isDraggingFile.value = false
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()

  // 設置拖放效果
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  event.stopPropagation()

  // 重置拖拽狀態
  isDraggingFile.value = false
  dragCounter.value = 0

  // 獲取拖放的檔案
  const files = event.dataTransfer?.files
  if (!files || files.length === 0) {
    console.log('📎 [Drag-Drop] No files detected')
    return
  }

  console.log(`📎 [Drag-Drop] ${files.length} file(s) dropped`)

  // 傳遞檔案給 MessageInput
  if (messageInputRef.value && messageInputRef.value.addFiles) {
    messageInputRef.value.addFiles(files)
  } else {
    console.warn('📎 [Drag-Drop] MessageInput ref not available')
  }
}

// Load more messages function
const loadMoreMessages = async () => {
  try {
    loadingState.setHistoryLoading(true)
    await httpMessages.loadMoreMessages()
  } catch (error) {
    errorHandler.handleError(
      error as Error,
      { operation: 'load_more_messages' },
      ErrorType._NETWORK
    )
  } finally {
    loadingState.setHistoryLoading(false)
  }
}

// WebSocket typing functions
const startWebSocketTyping = () => {
  // TODO: Implement WebSocket typing start when method is available
  console.debug('WebSocket typing start requested (not yet implemented)')
}

const stopWebSocketTyping = () => {
  // TODO: Implement WebSocket typing stop when method is available
  console.debug('WebSocket typing stop requested (not yet implemented)')
}

// Refresh messages function
const refreshMessages = async () => {
  await handleRefreshMessages()
}

// Simplified conversation loading with null safety
const loadConversation = async () => {
  try {
    await conversationsStore.fetchConversation(conversationId.value)
    const currentConversation = conversation.value
    if (currentConversation?.unreadCount) {
      await markAsRead()
    }

    // Load HTTP messages explicitly
    console.log('📥 [loadConversation] Loading HTTP messages...')
    await httpMessages.fetchMessages()
    console.log(`✅ [loadConversation] HTTP messages loaded: ${httpMessages.messages.value.length} messages`)
    console.log('✅ [loadConversation] Messages loaded, VirtualMessageList will auto-scroll')
  } catch (error) {
    console.error('Failed to load conversation:', error)
    // Handle conversation not found or network errors
    router.push('/conversations')
  }
}

const markAsRead = async () => {
  try {
    await conversationsStore.markAsRead(conversationId.value)
  } catch (error) {
    console.error('Failed to mark as read:', error)
  }
}

// Message actions
const handleMessageCopy = (message: Message) => {
  navigator.clipboard.writeText(message.content)
  console.log('Message copied:', message.content)
}

const handleMessageReply = (message: Message) => {
  if (messageInputRef.value) {
    const senderName = message.senderType === 'customer' ? '客戶' : '客服'
    messageInputRef.value.setReplyTo(message.content, senderName)
  }
}

const handleMessageForward = (message: Message) => {
  console.log('Forward message:', message.content)
}

const handleMessageRecall = async (message: Message) => {
  try {
    const confirmed = await useConfirm().confirmWarning(
      '撤回訊息',
      '確定要撤回這條訊息嗎？撤回後對方將無法看到。',
      '撤回'
    )

    if (confirmed) {
      console.log('Message recalled:', message.id)
      await refreshMessages()
    }
  } catch (error) {
    console.error('Failed to recall message:', error)
  }
}

const handleMessageSelect = (message: Message) => {
  console.log('Select message:', message.id)
}

// Search handlers
const handleSearchResults = (results: Message[]) => {
  searchResults.value = results
  isSearchActive.value = results.length > 0
}

const handleSearchClear = () => {
  searchResults.value = []
  isSearchActive.value = false
}

// Assignment handlers - Unused, commented out to reduce bundle size
// const handleConversationAssigned = (conversation: Conversation, assignedTo: string) => {
//   console.log('Conversation assigned:', { conversationId: conversation.id, assignedTo })
// }

// const handleConversationUnassigned = (conversation: Conversation) => {
//   console.log('Conversation unassigned:', conversation.id)
// }

// const handleAssignError = (error: string) => {
//   console.error('Assignment error:', error)
// }

// 🆕 Close conversation with permanent undo capability
const closeConversation = async () => {
  if (closing.value) {return}

  try {
    const confirmed = await useConfirm().confirmWarning(
      '結束對話',
      '確定要結束這個對話嗎？結束後仍可隨時重新打開。',
      '結束對話'
    )

    if (!confirmed) {return}

    closing.value = true
    const success = await conversationsStore.closeConversation(conversationId.value)

    if (success) {
      console.log('✅ [CloseConversation] Conversation closed successfully')

      // 🎯 显示简单的成功通知（不跳转）
      const { showSuccess } = useToast()
      showSuccess(
        '對話已結束',
        '您可以隨時重新打開此對話',
        { duration: 3000 }
      )

      // ✅ 停留在当前页面，显示"已关闭"横幅和"重新打开"按钮
      // UI会自动更新显示关闭状态（通过computed属性）
    } else {
      console.error('❌ [CloseConversation] Failed to close conversation: Server returned failure')
      const { showError } = useToast()
      showError('結束對話失敗', '無法結束對話，請稍後再試')
    }
  } catch (error) {
    console.error('❌ [CloseConversation] Exception when closing conversation:', error)
    const { showError } = useToast()
    showError('操作失敗', '發生錯誤，請稍後再試')
  } finally {
    closing.value = false
  }
}

// 🆕 Reopen closed conversation
const reopenConversation = async () => {
  try {
    const confirmed = await useConfirm().confirmInfo(
      '重新打開對話',
      '確定要重新打開這個對話嗎？',
      '重新打開'
    )

    if (!confirmed) {return}

    const success = await conversationsStore.reopenConversation(conversationId.value)

    if (success) {
      console.log('✅ [ReopenConversation] Conversation reopened successfully')
      const { showSuccess } = useToast()
      showSuccess('對話已重新打開', '您可以繼續使用此對話')
    } else {
      console.error('❌ [ReopenConversation] Failed to reopen conversation')
      const { showError } = useToast()
      showError('重新打開失敗', '無法重新打開對話，請稍後再試')
    }
  } catch (error) {
    console.error('❌ [ReopenConversation] Exception when reopening:', error)
    const { showError } = useToast()
    showError('操作失敗', '發生錯誤，請稍後再試')
  }
}

// Quick reply handler with enhanced validation
const useQuickReply = (text: string) => {
  if (!text?.trim()) {
    console.warn('Quick reply text is empty')
    return
  }

  if (messageInputRef.value) {
    try {
      messageInputRef.value.setMessageText(text)
      trackUserActivity()
    } catch (error) {
      console.error('Quick reply error:', error)
    }
  } else {
    console.warn('Message input reference not available')
  }
}

// Virtual scroll handler
const handleVirtualScroll = performanceUtils.throttle((scrollInfo: unknown) => {
  const info = scrollInfo as { scrollTop: number; scrollHeight: number; clientHeight: number } | undefined
  if (!info) {return}

  const threshold = 100
  const isAtBottom = info.scrollHeight - info.scrollTop - info.clientHeight < threshold

  if (!isAtBottom && newMessageCount.value > 0 && !showNewMessageModal.value) {
    showNewMessageModal.value = true
  }

  resetPollingDelay()
}, 16)

const handleNewMessageWhileScrolled = () => {
  // 🔧 FIX: 只有當新消息數量 > 0 時才顯示提示
  if (newMessageCount.value > 0) {
    showNewMessageModal.value = true
  }
}

// New message modal
const scrollToNewest = () => {
  if (virtualMessageListRef.value) {
    virtualMessageListRef.value.scrollToBottom()
  }
  showNewMessageModal.value = false
  // 🎯 清除新消息計數，用戶已查看消息
  // Unified connection handles this automatically
}

const dismissNewMessageModal = () => {
  showNewMessageModal.value = false
  // 🎯 清除新消息計數，用戶已關閉提醒
  // Unified connection handles this automatically
}

// Navigation
const goBack = () => {
  router.push('/conversations')
}

// Polling backup
const resetPollingDelay = () => {
  currentPollingIndex.value = 0
  lastUserActivity.value = Date.now()
}

const trackUserActivity = () => {
  lastUserActivity.value = Date.now()
  if (currentPollingIndex.value > 0) {
    resetPollingDelay()
  }
}

// Page visibility handling
const handleVisibilityChange = () => {
  isPageVisible.value = document.visibilityState === 'visible'
  console.log(`👁️ Page visibility changed: ${isPageVisible.value ? 'visible' : 'hidden'}`)

  if (isPageVisible.value) {
    trackUserActivity()
    resetPollingDelay()
  }
}

// Keyboard shortcuts
const handleGlobalKeydown = (event: KeyboardEvent) => {
  trackUserActivity()
  resetPollingDelay()

  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
    return
  }

  switch (event.key) {
    case '/':
      event.preventDefault()
      messageInputRef.value?.focus()
      break

    case 'r':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        handleRefreshMessages()
      }
      break

    case 'Escape':
      event.preventDefault()
      goBack()
      break

    case 'End':
      event.preventDefault()
      scrollToNewest()
      break

    case '?':
      event.preventDefault()
      keyboardShortcutsRef.value?.showShortcuts()
      break

    case 'f':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        messageSearchRef.value?.focus()
      }
      break
  }
}

// Watch for new messages from WebSocket
watch(() => hasNewMessages.value, (hasNew) => {
  // 🔧 FIX: 只有當新消息數量 > 0 時才顯示提示
  if (hasNew && newMessagesCount.value > 0) {
    showNewMessageModal.value = true
  }
})

// 🔧 CRITICAL FIX: Watch unified connection messages to ensure reactivity
// When SSE receives messages, the internal ref updates but Vue computed may not detect it
// This watch ensures that changes to unifiedConnection.messages trigger UI updates
watch(
  () => {
    const conn = unifiedConnection.value
    return conn ? (((conn.messages as unknown) as Ref<Message[]>).value?.length ?? 0) : 0
  },
  (newCount, oldCount) => {
    if (newCount !== undefined && newCount !== oldCount) {
      console.log(`📊 [Watch] Unified messages count changed: ${oldCount} → ${newCount}`)
      // The change in count will automatically trigger messages computed to re-run
    }
  }
)

// Note: Initial loading state is now managed by useLoadingState composable

// Performance monitoring interval (declare at top level for cleanup)
let performanceReportInterval: ReturnType<typeof setInterval> | null = null

// =================== 🚀 Phase 2.1: Unified Connection Management ===================

async function initializeUnifiedConnection() {
  try {
    console.log(`✅ [CUSTOMER API] Initializing Customer WebSocket for conversation: ${conversationId.value}`)

    // ✅ CUSTOMER API: Create Customer WebSocket connection
    const conn = await createCustomerRealtimeConnection(conversationId.value)
    unifiedConnection.value = conn

    // Store connection type for display
    unifiedConnectionType.value = conn.type

    // Setup event handlers
    conn.onMessage(handleUnifiedMessage)
    conn.onStateChange(handleUnifiedStateChange)
    conn.onError(handleUnifiedError)

    // Connect
    await conn.connect()

    console.log(`✅ [CUSTOMER API] Customer WebSocket connection established: ${unifiedConnectionType.value}`)
  } catch (error) {
    console.error('❌ [CUSTOMER API] Failed to initialize Customer WebSocket:', error)
    unifiedConnectionState.value = 'error'
  }
}

function handleUnifiedStateChange(newState: ConnectionState) {
  console.log(`[Phase 2.1] Unified connection state changed: ${newState}`)
  unifiedConnectionState.value = newState
  unifiedIsConnected.value = newState === 'connected'
}

function handleUnifiedMessage(message: unknown) {
  const msg = message as { type?: string; message?: Message }
  console.log('✅ [CUSTOMER API] Received message:', msg.type, message)

  // ✅ CUSTOMER API: Handle NEW_MESSAGE events
  if (msg.type === 'NEW_MESSAGE' && msg.message) {
    const messageId = msg.message.id

    // 🔧 FIX: 檢查是否是本標籤發送的訊息（解決競態條件導致的重複問題）
    // 當 WebSocket 廣播先於 handleMessageConfirmed 更新 message.id 時，
    // 使用 sentMessageIds 來判斷是否應跳過
    if (sentMessageIds.has(messageId)) {
      console.log(`⏭️ [CUSTOMER API] Skipping own message (sentMessageIds): ${messageId}`)
      return
    }

    // Add message to httpMessages using the addMessage method
    // addMessage 也有 ID 去重，這是雙重保護
    httpMessages.addMessage(msg.message)
    console.log('📨 [CUSTOMER API] New message added to conversation')
  }

  // Force reactivity update
  const conn = unifiedConnection.value
  if (conn && conn.messages) {
    const currentMsgCount = ((conn.messages as unknown) as Ref<Message[]>).value?.length || 0
    console.log(`📊 [CUSTOMER API] Current messages count: ${currentMsgCount}`)
  }
}

function handleUnifiedError(error: Error) {
  console.error('[Phase 2.1] Unified connection error:', error)
}

// =================== End Phase 2.1 Functions ===================

// Lifecycle with WebSocket and performance monitoring + error handling
onMounted(async () => {
  console.log('🔧 ConversationDetail mounted with WebSocket support')

  // Start performance monitoring
  mark('component-mount-start')
  startMonitoring()

  // Setup event listeners
  document.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('mousemove', trackUserActivity)
  document.addEventListener('click', trackUserActivity)

  // Log performance summary in development
  if (import.meta.env.DEV) {
    // Performance monitoring with cache stats and error reporting
    performanceReportInterval = setInterval(() => {
      logPerformanceSummary()

      // Cache performance stats
      const cacheStats = performanceOptimizer.getCacheStats()
      if (cacheStats.totalHits + cacheStats.totalMisses > 0) {
        console.log('🧠 [Cache Performance]', {
          hitRate: `${(cacheStats.hitRate * 100).toFixed(1)}%`,
          size: cacheStats.size,
          totalOperations: cacheStats.totalHits + cacheStats.totalMisses
        })
      }

      // Error handling stats
      const errorStats = errorHandler.getErrorStats()
      if (errorStats.total > 0) {
        console.log('🚨 [Error Statistics]', errorStats)
      }
    }, 10000) // 每10秒報告一次
  }

  // 🚀 Initialize unified connection (primary real-time system)
  await initializeUnifiedConnection()
  // CRITICAL FIX: Do NOT call loadConversation() here!
  // The route watcher with immediate: true (line 1185-1211) already handles initial load
  // Calling it twice causes race conditions and infinite reactive updates in AppLayout

  // Simply mark mount complete - the route watcher will handle loading
  measure('component-mount', 'component-mount-start')
  console.log('✅ ConversationDetail mounted, route watcher will load conversation')
})

onUnmounted(() => {
  // 🚀 Phase 2.1: Disconnect unified connection
  if (unifiedConnection.value) {
    console.log('[Phase 2.1] Disconnecting unified connection...')
    unifiedConnection.value.disconnect()
    unifiedConnection.value = null
  }

  // Clean up polling (still needed as it's not managed by eventHandler)
  if (pollingInterval.value) {
    clearTimeout(pollingInterval.value)
    pollingInterval.value = null
  }

  // Clean up performance monitoring interval
  if (performanceReportInterval) {
    clearInterval(performanceReportInterval)
    performanceReportInterval = null
  }

  // Note: Event listeners and timers are automatically cleaned up by useEventHandler

  // Stop performance monitoring
  stopMonitoring()

  // Final performance report in development
  if (import.meta.env.DEV) {
    console.log('📊 [Final Performance Report]', getPerformanceReport())
    console.log('🧠 [Cache Statistics]', performanceOptimizer.getCacheStats())
  }
})

// Watch for route changes
watch(
  () => route.params.id,
  async (newId) => {
    if (!newId || typeof newId !== 'string') {return}

    console.log(`🔄 Loading conversation: ${newId}`)
    mark('conversation-load-start')

    // Reset states using composable
    loadingState.resetLoadingState()

    try {
      // Reset polling
      currentPollingIndex.value = 0

      // Load conversation
      await loadConversation()

      // 🔧 RECURSION FIX: No need to manually trigger updateMessages
      // The watch on messages.value will automatically trigger when
      // httpMessages.messages.value changes after loadConversation()
      // Manual triggering causes double updates and infinite loops

      measure('conversation-load', 'conversation-load-start')

    } catch (error) {
      console.error(`Failed to load conversation ${newId}:`, error)
      measure('conversation-load-error', 'conversation-load-start')
    }
  },
  { immediate: true, flush: 'post' }
)

// 🔍 Phase 2.1: Connection Comparison Monitoring (DEV only)
if (import.meta.env.DEV) {
  watch(
    [
      () => unifiedIsConnected.value,
      () => unifiedConnectionType.value,
      () => unifiedIsConnected.value
    ],
    ([unifiedConnected, unifiedType, sseConnected]) => {
      console.log('[Phase 2.1 Monitor] Connection Status Comparison:', {
        unified: {
          connected: unifiedConnected,
          type: unifiedType,
          state: unifiedConnectionState.value
        },
        existing: {
          sse: { connected: sseConnected },
          protocol: currentProtocol.value
        }
      })
    }
  )
}
</script>

<style scoped>
/* ====== Minimal, Spacious Design System ====== */
.conversation-detail {
  position: relative; /* 📎 Required for drag-drop overlay positioning */
  height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  overflow: hidden;
  margin: -24px;
}

/* 🆕 Closed Conversation Banner Styles */
.closed-conversation-banner {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-left: 4px solid #f59e0b;
  padding: 16px 24px;
  margin: 0;
  border-bottom: 1px solid #f59e0b;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.banner-icon {
  flex-shrink: 0;
  color: #f59e0b;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 50%;
}

.banner-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.banner-text strong {
  font-size: 16px;
  font-weight: 600;
  color: #92400e;
}

.banner-hint {
  font-size: 14px;
  color: #b45309;
}

.reopen-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.reopen-btn:hover {
  background: #d97706;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(245, 158, 11, 0.3);
}

.reopen-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
}

.reopen-btn svg {
  flex-shrink: 0;
}

.top-bar-stats-container {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.websocket-status-topbar {
  font-size: 0.75rem;
}

.conversation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  background-color: white;
  border-bottom: 1px solid var(--gray-200);
  box-shadow: var(--shadow-sm);
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  flex: 1;
  min-width: 0;
}

.back-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: none;
  background: none;
  color: var(--gray-600);
  cursor: pointer;
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: all var(--transition-fast);
}

.back-button:hover {
  background-color: var(--gray-100);
  color: var(--gray-900);
}

.conversation-info {
  flex: 1;
  min-width: 0;
}

.customer-details {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.customer-avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
  flex-shrink: 0;
}

.customer-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 var(--space-2) 0;
}

.customer-badges {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.presence-badge {
  font-size: 0.75rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

/* Connection Status Badge */
.connection-status-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.connection-excellent {
  background-color: var(--green-100);
  color: var(--green-800);
  border: 1px solid var(--green-200);
}

.connection-good {
  background-color: var(--blue-100);
  color: var(--blue-800);
  border: 1px solid var(--blue-200);
}

.connection-fair {
  background-color: var(--yellow-100);
  color: var(--yellow-800);
  border: 1px solid var(--yellow-200);
}

.connection-poor {
  background-color: var(--orange-100);
  color: var(--orange-800);
  border: 1px solid var(--orange-200);
}

.connection-offline {
  background-color: var(--gray-100);
  color: var(--gray-800);
  border: 1px solid var(--gray-200);
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-connected {
  background-color: var(--green-500);
  animation: pulse-green 2s infinite;
}

.status-connecting {
  background-color: var(--yellow-500);
  animation: pulse-yellow 1s infinite;
}

.status-reconnecting {
  background-color: var(--orange-500);
  animation: pulse-orange 1s infinite;
}

.status-error {
  background-color: var(--red-500);
}

.status-disconnected {
  background-color: var(--gray-400);
}

/* 🚀 Phase 1: Enhanced SSE Status Styles */
.status-sse {
  border: 2px solid currentColor;
  border-radius: 50%;
  position: relative;
}

.status-connected.status-sse {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.3);
  animation: sse-connected 2s infinite;
}

.status-connecting.status-sse,
.status-reconnecting.status-sse {
  background: #3b82f6;
  animation: sse-pulse 1.5s ease-in-out infinite alternate;
}

.status-error.status-sse {
  background: #ef4444;
  animation: sse-error-flash 2s infinite;
}

.status-http {
  background: #8b5cf6;
  border-radius: 2px;
  animation: http-fade 3s infinite;
}

.status-websocket {
  background: #06b6d4;
  border-radius: 3px;
  transform: rotate(45deg);
}

/* SSE Animation Keyframes */
@keyframes sse-connected {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.3);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
  }
}

@keyframes sse-pulse {
  0% {
    opacity: 0.5;
    transform: scale(0.95);
  }
  100% {
    opacity: 1;
    transform: scale(1.05);
  }
}

@keyframes sse-error-flash {
  0%, 50%, 100% {
    opacity: 1;
    background: #ef4444;
  }
  25%, 75% {
    opacity: 0.6;
    background: #f87171;
  }
}

@keyframes http-fade {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

/* Status Item Enhancements */
.reconnect-info {
  color: #f59e0b !important;
  font-weight: 600;
  font-size: 0.7rem;
}

.error-info {
  color: #ef4444 !important;
  font-weight: 600;
  cursor: help;
  font-size: 0.7rem;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.protocol-badge {
  padding: 1px 4px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  font-size: 0.625rem;
  font-weight: 600;
}

.typing-indicator-header {
  font-size: 0.75rem;
  opacity: 0.8;
}

/* Search Panel Styles */
.message-search-panel {
  flex: 0 0 auto;
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 0.5rem 1rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

/* Search Panel Transition */
.search-slide-enter-active,
.search-slide-leave-active {
  transition: all 0.25s ease;
}

.search-slide-enter-from,
.search-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.search-slide-enter-to,
.search-slide-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 200px;
}

/* 🔧 FIX: Fade transition for content switching (prevents flicker) */
.fade-content-enter-active,
.fade-content-leave-active {
  transition: opacity 0.15s ease-out;
}

.fade-content-enter-from,
.fade-content-leave-to {
  opacity: 0;
}

.messages-container-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
  contain: layout style paint;
  will-change: contents; /* 🔧 FIX: Changed from scroll-position to contents */
  /* 🎨 Spacious feel with subtle background */
  background: linear-gradient(
    180deg,
    rgba(248, 250, 252, 0.5) 0%,
    rgba(241, 245, 249, 0.3) 50%,
    rgba(248, 250, 252, 0.5) 100%
  );
  padding: 0 1rem;
  /* 🔧 FIX: Prevent layout shift during transitions */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 🔧 FIX: Ensure skeleton and content have consistent sizing */
.messages-container-wrapper > .message-list-skeleton,
.messages-container-wrapper > .virtual-message-list,
.messages-container-wrapper > .empty-state-wrapper {
  flex: 1;
  min-height: 300px;
}

.empty-state-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px; /* 🔧 FIX: Increased from 200px for consistency */
}

.input-section {
  /* 🎨 Clean, floating input area design */
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-top: none;
  padding: 1rem 1.5rem 1.5rem;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  /* Subtle lift effect */
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.03);
}

.quick-replies {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.quick-reply-btn {
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-reply-btn:hover {
  background: #f8fafc;
  border-color: #6366f1;
  color: #6366f1;
  transform: translateY(-1px);
}

/* 🌐 Connection Status Bar (Phase 1: SSE-Primary) */
.connection-status-bar {
  padding: var(--space-2) 0;
  border-top: 1px solid rgba(226, 232, 240, 0.4);
  background: rgba(248, 250, 252, 0.8);
}

.status-items {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  font-size: 0.75rem;
  color: var(--gray-600);
}

.status-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.closed-state {
  background-color: white;
  border-top: 1px solid var(--gray-200);
  padding: var(--space-6);
  display: flex;
  justify-content: center;
}

.closed-message {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--gray-500);
  font-weight: 500;
}

/* Enhanced new message notification */
.glassmorphism-notification {
  position: fixed;
  bottom: 200px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  animation: slideInFade 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: pointer;
  user-select: none;
}

.glass-content {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;

  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);

  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.glassmorphism-notification:hover .glass-content {
  background: rgba(255, 255, 255, 0.98);
  transform: translateY(-1px);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.12),
    0 4px 16px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.notification-pulse {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  border-radius: 50%;
  color: white;
  animation: gentlePulse 2.5s infinite ease-in-out;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.glass-text {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.message-count {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  letter-spacing: -0.01em;
}

.message-label {
  font-size: 0.875rem;
  font-weight: 400;
  color: #6b7280;
}

.delivery-status {
  font-size: 0.75rem;
  font-weight: 500;
  color: #059669;
  background: rgba(5, 150, 105, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.glass-dismiss {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(107, 114, 128, 0.1);
  border: none;
  border-radius: 50%;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.glass-dismiss:hover {
  background: rgba(107, 114, 128, 0.2);
  color: #6b7280;
  transform: scale(1.05);
}

/* ====== 漸進式警示按鈕設計 (Progressive Alert Design) ====== */
/* Note: This style is duplicated from ConversationHeader.vue for consistency */
.close-conversation-btn {
  /* 佈局與間距 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  position: relative;
  overflow: hidden;

  /* 文字樣式 */
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25rem;
  white-space: nowrap;
  user-select: none;

  /* Level 1: 默認警告狀態 (Mint Green Warning) - 方案 D */
  color: #064e3b; /* green-900 */
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); /* green-100 to green-200 */
  border: 2px solid #10b981; /* green-500 */
  border-radius: 0.5rem;

  /* 陰影與過渡 */
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.1);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 圖標樣式 */
.close-conversation-btn .btn-icon {
  flex-shrink: 0;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 主文字 */
.close-conversation-btn .btn-text {
  transition: opacity 0.3s ease;
}

/* 警告文字 (默認隱藏) */
.close-conversation-btn .btn-warning {
  position: absolute;
  bottom: -1.5rem;
  left: 50%;
  transform: translateX(-50%);

  padding: 0.25rem 0.75rem;
  background: rgba(239, 68, 68, 0.95); /* red-500 with opacity */
  color: white;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 0.375rem;
  white-space: nowrap;

  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease, transform 0.3s ease;

  /* 小箭頭 */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.close-conversation-btn .btn-warning::before {
  content: '';
  position: absolute;
  top: -0.25rem;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 0.25rem solid transparent;
  border-right: 0.25rem solid transparent;
  border-bottom: 0.25rem solid rgba(239, 68, 68, 0.95);
}

/* Level 2: Hover 警示狀態 (Red Alert) */
.close-conversation-btn:hover:not(:disabled) {
  /* 顏色漸變到紅色 */
  color: #991b1b; /* red-900 */
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); /* red-100 to red-200 */
  border-color: #ef4444; /* red-500 */

  /* 增強陰影 */
  box-shadow:
    0 4px 12px rgba(239, 68, 68, 0.2),
    0 2px 4px rgba(239, 68, 68, 0.1);

  /* 輕微上浮 */
  transform: translateY(-2px);
}

/* Hover 時圖標震動效果 */
.close-conversation-btn:hover:not(:disabled) .btn-icon {
  animation: icon-shake 0.5s ease-in-out;
}

/* Hover 時顯示警告文字 */
.close-conversation-btn:hover:not(:disabled) .btn-warning {
  opacity: 1;
  transform: translateX(-50%) translateY(0.25rem);
}

/* Active 按下狀態 */
.close-conversation-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.15);
}

/* Disabled/Loading 狀態 */
.close-conversation-btn:disabled,
.close-conversation-btn.is-closing {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  background: #e5e7eb; /* gray-200 */
  border-color: #d1d5db; /* gray-300 */
  color: #6b7280; /* gray-500 */
  box-shadow: none;
}

.close-conversation-btn:disabled .btn-warning,
.close-conversation-btn.is-closing .btn-warning {
  display: none;
}

/* 圖標震動動畫 */
@keyframes icon-shake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-8deg); }
  50% { transform: rotate(8deg); }
  75% { transform: rotate(-8deg); }
}

/* Animations */
@keyframes slideInFade {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(16px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@keyframes gentlePulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.02);
    opacity: 0.9;
  }
}

@keyframes pulse-green {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes pulse-yellow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes pulse-orange {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Performance optimizations */
.message-indicator-topbar {
  contain: layout style;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .conversation-header {
    padding: var(--space-3) var(--space-2);
    flex-wrap: wrap;
  }

  .customer-name {
    font-size: 1.125rem;
  }

  .customer-avatar {
    width: 36px;
    height: 36px;
    font-size: 0.875rem;
  }

  .input-section {
    padding: 18px 16px;
    max-height: 140px;
  }

  .glassmorphism-notification {
    bottom: 180px;
  }

  .connection-status-badge {
    font-size: 0.625rem;
    padding: 2px 6px;
  }

  .status-items {
    font-size: 0.625rem;
    gap: var(--space-2);
  }

  /* 結束對話按鈕移動端優化 */
  .close-conversation-btn {
    padding: 0.625rem 1rem;
    font-size: 0.8125rem;
  }

  .close-conversation-btn .btn-warning {
    bottom: -1.25rem;
    font-size: 0.6875rem;
    padding: 0.2rem 0.625rem;
  }
}

/* ====== 📎 Drag-and-Drop Upload Overlay Styles ====== */
.drag-drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 1000;
  background: rgba(99, 102, 241, 0.08);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px dashed #6366f1;
  border-radius: 12px;
  margin: 8px;
  pointer-events: none; /* 允許拖放事件穿透到父元素 */
}

.drag-drop-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px;
  background: white;
  border-radius: 20px;
  box-shadow:
    0 20px 60px rgba(99, 102, 241, 0.15),
    0 8px 24px rgba(0, 0, 0, 0.08);
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow:
      0 20px 60px rgba(99, 102, 241, 0.15),
      0 8px 24px rgba(0, 0, 0, 0.08);
  }
  50% {
    box-shadow:
      0 20px 60px rgba(99, 102, 241, 0.25),
      0 8px 24px rgba(0, 0, 0, 0.12),
      0 0 0 4px rgba(99, 102, 241, 0.1);
  }
}

.drag-drop-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  border-radius: 50%;
  color: #6366f1;
  animation: bounce-gentle 1.5s ease-in-out infinite;
}

@keyframes bounce-gentle {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.drag-drop-icon svg {
  filter: drop-shadow(0 2px 4px rgba(99, 102, 241, 0.3));
}

.drag-drop-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.drag-drop-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e1b4b;
  letter-spacing: -0.02em;
}

.drag-drop-hint {
  font-size: 0.875rem;
  color: #64748b;
  max-width: 280px;
  line-height: 1.5;
}

/* Fade overlay transition */
.fade-overlay-enter-active,
.fade-overlay-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-overlay-enter-from,
.fade-overlay-leave-to {
  opacity: 0;
}

.fade-overlay-enter-from .drag-drop-content,
.fade-overlay-leave-to .drag-drop-content {
  transform: scale(0.9);
  opacity: 0;
}

/* Responsive adjustments for drag-drop overlay */
@media (max-width: 768px) {
  .drag-drop-content {
    padding: 24px;
    margin: 16px;
  }

  .drag-drop-icon {
    width: 72px;
    height: 72px;
  }

  .drag-drop-icon svg {
    width: 40px;
    height: 40px;
  }

  .drag-drop-title {
    font-size: 1.25rem;
  }

  .drag-drop-hint {
    font-size: 0.75rem;
  }
}
</style>