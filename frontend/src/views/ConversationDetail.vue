<template>
  <AppLayout>
    <div class="conversation-detail">
      <!-- Simplified Header Component -->
      <ConversationHeader
        :conversation="conversation"
        :loading="loading"
        :closing="closing"
        @back="goBack"
        @close="closeConversation"
        @refresh="handleRefreshMessages"
      />

      <!-- Enhanced Search -->
      <div class="message-search-container">
        <Suspense>
          <MessageSearch
            ref="messageSearchRef"
            :messages="messages"
            @search-results="handleSearchResults"
            @search-clear="handleSearchClear"
          />
        </Suspense>
      </div>

      <!-- High Performance Virtual Message List with WebSocket -->
      <div class="messages-container-wrapper">
        <!-- Loading States -->
        <HamsterLoader
          v-if="isInitialLoading && !hasLoadedInitially"
          message="載入對話中..."
        />

        <!-- Empty State -->
        <div
          v-else-if="hasLoadedInitially && displayedMessages.length === 0"
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
          @message-copy="handleMessageCopy"
          @message-reply="handleMessageReply"
          @message-forward="handleMessageForward"
          @message-recall="handleMessageRecall"
          @message-select="handleMessageSelect"
          @search-clear="handleSearchClear"
          @load-more="loadMoreMessages"
          @scroll="handleVirtualScroll"
          @new-message-while-scrolled="handleNewMessageWhileScrolled"
        />
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

        <!-- 🌐 Connection Status Bar (Phase 1: SSE-Primary) -->
        <div
          v-if="unifiedIsConnected || unifiedConnectionState === 'error' || isWebSocketEnabled"
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
import { useMessages } from '@/composables/useMessages' // HTTP API fallback
import { useWebSocketMigration } from '@/composables/useWebSocketMigration'
import { useWebSocketStatus } from '@/composables/useWebSocketStatus'
import { usePerformanceMonitor, performanceUtils } from '@/composables/usePerformanceMonitor'
import { useSmoothLoading } from '@/composables/useSmoothLoading'
import { useConfirm } from '@/composables/useConfirm'
import { useConnectionState } from '@/composables/useConnectionState'
import { useLoadingState } from '@/composables/useLoadingState'
import { useEventHandler, type AnyFunction } from '@/composables/useEventHandler'
import { usePerformanceOptimization } from '@/composables/usePerformanceOptimization'
import { useErrorHandler, ErrorType } from '@/composables/useErrorHandler'
import type { Message } from '@/types'
// 🚀 Phase 2.1: Unified Connection Manager
import { createRealtimeConnection, type RealtimeConnection, type ConnectionType, type ConnectionState } from '@/services/realtimeConnectionManager'

// Core components
import AppLayout from '@/components/ui/AppLayout.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
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



// 🛡️ Final Fallback: HTTP API System
const httpMessages = useMessages(conversationId.value, {
  enablePagination: true,
  pageSize: 10 // 🎯 初始加載10條消息，優化首屏加載速度
})

// 🚀 Unified Connection Manager (Primary Real-time System)
const unifiedConnection = ref<RealtimeConnection | null>(null)
const unifiedConnectionType = ref<ConnectionType>('websocket')
const unifiedConnectionState = ref<ConnectionState>('disconnected')
const unifiedIsConnected = ref(false)

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
  updateMessages,
  getAnimationClasses
} = useSmoothLoading({
  animationDuration: 400,
  enableAnimations: true,
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
    // Reset flag after a delay to allow updates to complete
    setTimeout(() => {
      isUpdatingMessages = false
    }, 100)
  }
}) as AnyFunction, 50)

// CRITICAL FIX: Watch messages but prevent infinite recursion
// The key is that updateMessages in useSmoothLoading does NOT trigger messages computed
// because it only updates smoothMessages, which is separate from messages
watch(
  () => messages.value,
  (newMessages) => {
    if (newMessages && newMessages.length >= 0) {
      debouncedUpdateMessages(newMessages)
    }
  },
  { immediate: true, flush: 'post' }
)

// Core state with null safety
const conversation = computed(() => conversationsStore.currentConversation || undefined)
const closing = ref(false)
const isTyping = ref(false)

// Use new composable state management
const { hasLoadedInitially, isInitialLoading, loadingHistory } = loadingState

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

// Memoized animation class generation for better performance
const memoizedAnimationClasses = performanceOptimizer.memoize(
  (messages: Message[], getClassesFn: Function | undefined) => {
    const result: Record<string, string> = {}

    if (typeof getClassesFn === 'function' && messages.length > 0) {
      messages.forEach(message => {
        const classes = getClassesFn(message.id)
        if (classes && classes['message-fade-in']) {
          result[message.id] = 'message-fade-in'
        }
      })
    }

    return result
  },
  (messages, getClassesFn) => `${messages.length}-${typeof getClassesFn}`
)

// Animation classes for smooth message transitions
const animationClasses = performanceOptimizer.cachedComputed(() => {
  return memoizedAnimationClasses(smoothMessages.value, getAnimationClasses)
}, 'animation-classes', { timeout: 1000 })

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

// Enhanced message handlers with WebSocket support and error handling
// 📤 Enhanced Message Sending with SSE Support
const handleMessageSent = async (data: { content: string; attachments: unknown[] }) => {
  console.log('📤 [Message] Sending via:', currentProtocol.value)
  trackUserActivity()

  // Stop typing indicators
  stopTyping()

  if (!data.content?.trim()) {
    console.warn('Empty message content, skipping send')
    return
  }

  try {
    // Priority 1: Send via HTTP API (SSE doesn't send messages, only receives)
    // Messages will appear in SSE stream after successful HTTP send
    const success = await httpMessages.sendMessage(data.content)

    if (success) {
      console.log('✅ [Message] Sent successfully via HTTP API')
      scrollToNewest()
      migration.reportMetric('message_sent_http', { content: data.content.substring(0, 50) })

      // SSE will automatically receive the new message from the server
      // No need to manually add to SSE messages
      return
    }


    errorHandler.handleError(
      '所有訊息發送方式都失敗了',
      { operation: 'send_message', content: data.content.substring(0, 50) },
      ErrorType._NETWORK
    )

  } catch (error) {
    errorHandler.handleError(
      error as Error,
      { operation: 'send_message_exception' },
      ErrorType._CLIENT
    )
  }

  // Reset polling and scroll regardless
  resetPollingDelay()
  scrollToNewest()
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

// Close conversation with enhanced error handling
const closeConversation = async () => {
  if (closing.value) {return}

  try {
    const confirmed = await useConfirm().confirmWarning(
      '結束對話',
      '確定要結束這個對話嗎？結束後將無法再次開啟。',
      '結束對話'
    )

    if (!confirmed) {return}

    closing.value = true
    const success = await conversationsStore.closeConversation(conversationId.value)
    if (success) {
      router.push('/conversations')
    } else {
      console.error('Failed to close conversation: Server returned failure')
    }
  } catch (error) {
    console.error('Failed to close conversation:', error)
    // Show user-friendly error message
  } finally {
    closing.value = false
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
  showNewMessageModal.value = true
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
  if (hasNew) {
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
    console.log(`[Phase 2.1] Initializing unified connection for conversation: ${conversationId.value}`)

    // Create connection (automatically selects WebSocket or SSE based on rolloutPercentage)
    const conn = await createRealtimeConnection(conversationId.value)
    unifiedConnection.value = conn

    // Store connection type for display
    unifiedConnectionType.value = conn.type

    // Setup event handlers
    conn.onMessage(handleUnifiedMessage)
    conn.onStateChange(handleUnifiedStateChange)
    conn.onError(handleUnifiedError)

    // Connect
    await conn.connect()

    console.log(`✅ [Phase 2.1] Unified connection established: ${unifiedConnectionType.value}`)
  } catch (error) {
    console.error('[Phase 2.1] Failed to initialize unified connection:', error)
    unifiedConnectionState.value = 'error'
  }
}

function handleUnifiedStateChange(newState: ConnectionState) {
  console.log(`[Phase 2.1] Unified connection state changed: ${newState}`)
  unifiedConnectionState.value = newState
  unifiedIsConnected.value = newState === 'connected'
}

function handleUnifiedMessage(message: unknown) {
  const msg = message as { type?: string }
  console.log('[Phase 2.1] Unified connection received message:', msg.type, message)

  // 🔧 CRITICAL FIX: Force reactivity update when messages arrive
  // The SSE connection internally updates its messages ref, but Vue's computed
  // may not detect the change. We need to ensure the messages computed re-runs.
  const conn = unifiedConnection.value
  if (conn && conn.messages) {
    const currentMsgCount = ((conn.messages as unknown) as Ref<Message[]>).value?.length || 0
    console.log(`📊 [handleUnifiedMessage] Current unified messages count: ${currentMsgCount}`)
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
/* Enhanced styles with WebSocket features */
.conversation-detail {
  height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  background-color: var(--gray-50);
  overflow: hidden;
  margin: -24px;
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

.message-search-container {
  flex: 0 0 auto;
  background-color: var(--gray-50);
  padding: 0 var(--space-6);
  border-bottom: 1px solid var(--gray-200);
}

.messages-container-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
  contain: layout style paint;
  will-change: scroll-position;
}

.empty-state-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.input-section {
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.8), rgba(255, 255, 255, 0.95));
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(226, 232, 240, 0.6);
  padding: 24px;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quick-replies {
  max-width: 1500px;
  margin: 20px auto 0;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding: 0 4px;
}

.quick-reply-btn {
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 28px;
  font-size: 14px;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.quick-reply-btn:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.25);
  color: #6366f1;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.15);
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

.close-conversation-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
  color: var(--gray-700);
  background-color: transparent;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  user-select: none;
  position: relative;
  overflow: hidden;
}

.close-conversation-btn:hover {
  color: var(--danger-600);
  border-color: var(--danger-200);
  background-color: var(--danger-50);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
}

.close-conversation-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
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
}
</style>