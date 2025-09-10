<template>
  <AppLayout>
    <!-- 統計資訊放到頂部bar -->
    <template #top-bar-stats>
      <MessageIndicator
        v-if="messages.length > 0"
        :oldest-message="oldestMessage"
        :latest-message="latestMessage"
        :total-messages="totalMessages || messages.length"
        class="message-indicator-topbar"
      />
    </template>

    <div class="conversation-detail">
      <!-- Simplified Header -->
      <div class="conversation-header">
        <div class="header-left">
          <button
            class="back-button"
            @click="goBack"
          >
            <ArrowLeftIcon />
            返回列表
          </button>

          <div class="conversation-info">
            <div class="customer-details">
              <div class="customer-avatar">
                {{ customerInitials }}
              </div>
              <div class="customer-meta">
                <h1 class="customer-name">
                  {{ conversation?.customer?.name || '載入中...' }}
                </h1>
                <div class="customer-badges">
                  <PlatformBadge
                    v-if="conversation"
                    :platform="conversation.platform || 'unknown'"
                    show-icon
                  />
                  <StatusBadge
                    v-if="conversation"
                    :status="conversation.status"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="header-actions">
          <!-- Lazy loaded components -->
          <Suspense>
            <AdvancedAssignActions
              v-if="conversation"
              :conversation="conversation"
              @assigned="handleConversationAssigned"
              @unassigned="handleConversationUnassigned"
              @error="handleAssignError"
            />
          </Suspense>

          <button
            v-if="conversation?.status !== 'closed'"
            class="close-conversation-btn"
            :disabled="closing"
            @click="closeConversation"
          >
            <XCircleIcon />
            <span>{{ closing ? '結束中...' : '結束對話' }}</span>
          </button>

          <button
            class="btn btn-secondary"
            :disabled="loadingMessages || loadingHistory"
            @click="handleRefreshMessages"
          >
            <RefreshIcon :spinning="loadingMessages || loadingHistory" />
          </button>
        </div>
      </div>

      <!-- Lazy loaded search -->
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

      <!-- High Performance Virtual Message List -->
      <div class="messages-container-wrapper">
        <!-- Loading States: 只有真正的初始載入才顯示載入器 -->
        <HamsterLoader
          v-if="isInitialLoading && !hasLoadedInitially"
          message="載入對話中..."
        />

        <!-- Empty State: 只有在完成初始載入且無訊息時才顯示 -->
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

        <!-- Virtual Message List for Maximum Performance -->
        <VirtualMessageList
          v-else
          ref="virtualMessageListRef"
          :messages="messages"
          :displayed-messages="displayedMessages"
          :is-search-active="isSearchActive"
          :loading-history="loadingHistory"
          :is-updating="isUpdating"
          :is-typing="isTyping"
          :animation-classes="animationClasses"
          :enable-animations="true"
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

      <!-- 新消息提醒 -->
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

      <!-- Enhanced Message Input -->
      <div
        v-if="conversation?.status !== 'closed'"
        class="input-section"
      >
        <MessageInput
          ref="messageInputRef"
          :conversation-id="conversationId"
          :disabled="false"
          @message-sent="handleMessageSent"
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
import { ref, computed, onMounted, nextTick, watch, onUnmounted, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessages } from '@/composables'
import { useSmoothLoading } from '@/composables/useSmoothLoading'
import { useConversationsStore } from '@/stores/conversations'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import { usePerformanceMonitor, performanceUtils } from '@/composables/usePerformanceMonitor'
import type { Message, Conversation } from '@/types'

// Core components
import AppLayout from '@/components/ui/AppLayout.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import VirtualMessageList from '@/components/conversation/VirtualMessageList.vue'
import MessageInput from '@/components/conversation/MessageInput.vue'
import MessageIndicator from '@/components/conversation/MessageIndicator.vue'
import PlatformBadge from '@/components/ui/PlatformBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  ArrowLeftIcon,
  XCircleIcon,
  RefreshIcon,
  MessageCircleIcon
} from '@/components/icons'

// Lazy load non-critical components for better performance
const MessageSearch = defineAsyncComponent(() => import('@/components/conversation/MessageSearch.vue'))
const KeyboardShortcuts = defineAsyncComponent(() => import('@/components/ui/KeyboardShortcuts.vue'))
const AdvancedAssignActions = defineAsyncComponent(() => import('@/components/conversation/AdvancedAssignActions.vue'))

// Routes
const route = useRoute()
const router = useRouter()
const conversationsStore = useConversationsStore()
const authStore = useAuthStore()

// Performance monitoring
const {
  startMonitoring,
  stopMonitoring,
  mark,
  measure,
  measureMessageLoad,
  getPerformanceReport,
  logPerformanceSummary
} = usePerformanceMonitor()

// High performance message management
const {
  messages: rawMessages,
  oldestMessage,
  latestMessage,
  loading: loadingMessages,
  loadingHistory,
  totalMessages,
  fetchMessages,
  loadMoreMessages,
  setConversationId
} = useMessages(undefined, {
  enablePagination: true,
  pageSize: 10 // Reduced page size for better initial performance
})

// Smooth loading with optimized animations
const {
  messages: smoothMessages,
  isUpdating,
  setMessagesImmediate,
  updateMessages,
  sortMessagesByTime,
  getAnimationClasses
} = useSmoothLoading({
  animationDuration: 400, // Smooth but not too slow
  enableAnimations: true, // Enable smooth animations
  debounceDelay: 50
})

// Core state - using shallowRef for better performance
const conversation = computed(() => conversationsStore.currentConversation)
const closing = ref(false)
const isTyping = ref(false)
const isInitialLoading = ref(true) // 真正的初始載入（只有第一次）
const hasLoadedInitially = ref(false) // 標記是否已經完成初始載入
const virtualMessageListRef = ref()
const messageInputRef = ref()
const keyboardShortcutsRef = ref()
const messageSearchRef = ref()

// Search state
const searchResults = ref<Message[]>([])
const isSearchActive = ref(false)

// New message notification
const showNewMessageModal = ref(false)
const newMessageCount = ref(0)

// SSE real-time messaging
const messageEventSource = ref<EventSource | null>(null)
const sseConnected = ref(false)
const sseError = ref<string | null>(null)
const sseReconnectAttempts = ref(0)
const maxSSEReconnectAttempts = 3
let sseReconnectTimer: NodeJS.Timeout | null = null

// Performance optimized computed properties
const conversationId = computed(() => route.params.id as string)

const customerInitials = computed(() => {
  const name = conversation.value?.customer?.name || 'U'
  return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
})

const displayedMessages = computed(() => {
  return isSearchActive.value ? searchResults.value : smoothMessages.value
})

const messages = computed(() => smoothMessages.value)

// Animation classes for smooth message transitions
const animationClasses = computed(() => {
  const result: Record<string, string> = {}
  
  if (typeof getAnimationClasses === 'function' && smoothMessages.value.length > 0) {
    smoothMessages.value.forEach(message => {
      const classes = getAnimationClasses(message.id)
      if (classes && classes['message-fade-in']) {
        result[message.id] = 'message-fade-in'
      }
    })
  }
  
  return result
})

// Quick replies
const quickReplies = ref([
  { id: '1', text: '感謝您的來信，我們會盡快回覆' },
  { id: '2', text: '請問還有其他需要協助的嗎？' },
  { id: '3', text: '謝謝您的耐心等待' },
  { id: '4', text: '問題已為您解決，如有其他疑問請隨時聯繫' }
])

// Optimized polling as backup for SSE with longer intervals
const pollingInterval = ref<NodeJS.Timeout | null>(null)
const pollingDelays = [30000, 60000, 120000, 300000] // 30s → 1min → 2min → 5min (SSE 備份間隔)
const sseBackupPollingDelays = [60000, 180000, 300000] // SSE 連接時的備份輪詢：1min → 3min → 5min
const currentPollingIndex = ref(0)
const maxPollingDelay = 600000 // Max 10 minutes for backup polling
const isPageVisible = ref(true) // 頁面可見性狀態
const lastUserActivity = ref(Date.now()) // 最後用戶活動時間
const USER_INACTIVE_THRESHOLD = 60000 // 用戶非活躍閾值：1分鐘
const lastLoadTime = ref(0) // 最後載入時間，用於防抖
const MIN_LOAD_INTERVAL = 2000 // 最小載入間隔：2秒

// Performance optimized message handlers with smooth animation
const handleMessageSent = async () => {
  console.log('💬 Message sent, refreshing...')
  trackUserActivity() // 發送消息是用戶活動
  await loadMessages(true, true) // Force refresh with animation (no loader)
  scrollToNewest()
  resetPollingDelay() // 重置輪詢延遲
}

// 修復：手動刷新使用平滑動畫而不是 HamsterLoader
const handleRefreshMessages = async () => {
  console.log('🔄 Manual refresh triggered with smooth animation')
  trackUserActivity() // 手動刷新是用戶活動
  await loadMessages(true, true) // Force refresh with animation (no loader)
  resetPollingDelay() // 重置輪詢延遲
}

// SSE 實時消息連接管理
const connectSSE = async () => {
  if (!authStore.token || !conversationId.value) {
    console.warn('❌ [Message SSE] Cannot connect: missing token or conversation ID')
    return
  }

  // 關閉現有連接
  disconnectSSE()

  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin
    const sseUrl = `${baseUrl}/api/realtime/sse?conversationId=${conversationId.value}&token=${encodeURIComponent(authStore.token)}`
    
    console.log('🚀 [Message SSE] Connecting for conversation:', conversationId.value)
    
    messageEventSource.value = new EventSource(sseUrl, {
      withCredentials: false
    })

    messageEventSource.value.onopen = () => {
      console.log('✅ [Message SSE] Connected successfully')
      sseConnected.value = true
      sseError.value = null
      sseReconnectAttempts.value = 0
    }

    messageEventSource.value.onmessage = (event) => {
      handleSSEMessage(event)
    }

    messageEventSource.value.onerror = (error) => {
      console.error('❌ [Message SSE] Connection error:', error)
      sseConnected.value = false
      sseError.value = 'SSE 連接中斷'
      handleSSEReconnect()
    }

  } catch (error) {
    console.error('❌ [Message SSE] Failed to establish connection:', error)
    sseError.value = '無法建立 SSE 連接'
  }
}

// 處理 SSE 消息
const handleSSEMessage = async (event: MessageEvent) => {
  try {
    const data = JSON.parse(event.data)
    console.log('📥 [Message SSE] Received:', data.type)

    switch (data.type) {
      case 'connection':
        console.log('🔗 [Message SSE] Connection confirmed')
        break

      case 'heartbeat':
        // SSE 心跳，保持連接活躍
        break

      case 'new_message':
        // 優化：直接添加新消息，無需重新載入整個對話
        if (data.data && data.data.conversationId == conversationId.value) {
          console.log('💬 [Message SSE] New message received directly:', data.data.content?.substring(0, 50))
          trackUserActivity() // SSE 消息是用戶活動指示
          
          // 檢查是否為重複消息（避免重複顯示）
          const existingMessage = smoothMessages.value.find(msg => msg.id === data.data.id)
          if (!existingMessage) {
            // 優化：將新消息插入正確位置並排序，確保時間順序正確
            const currentMessages = [...smoothMessages.value, data.data]
            const sortedMessages = sortMessagesByTime(currentMessages)
            updateMessages(sortedMessages, true)
            
            // 如果用戶在底部，自動滾動到新消息
            await nextTick()
            if (virtualMessageListRef.value) {
              virtualMessageListRef.value.scrollToBottom()
            }
          } else {
            console.log('⚠️ [Message SSE] Duplicate message ignored:', data.data.id)
          }
        }
        break

      case 'notification':
        // 處理通知（備份機制，主要依賴 new_message）
        if (data.data && data.data.type === 'new_message') {
          console.log('💬 [Message SSE] Fallback: New message notification received')
          trackUserActivity() // SSE 消息是用戶活動指示
          // 只有在沒有直接收到消息時才重新載入
          const recentMessages = smoothMessages.value.filter(msg => 
            new Date(msg.createdAt).getTime() > Date.now() - 5000 // 最近5秒的消息
          )
          if (recentMessages.length === 0) {
            await loadMessages(false, true) // 使用平滑動畫載入新消息
          }
        }
        break

      case 'conversation_updated':
        // 處理對話狀態更新
        if (data.data && data.data.conversationId == conversationId.value) {
          console.log('🔄 [Message SSE] Conversation updated')
          await loadMessages(false, true) // 使用平滑動畫重新載入
        }
        break

      default:
        console.log('❓ [Message SSE] Unknown message type:', data.type)
    }
  } catch (error) {
    console.error('❌ [Message SSE] Failed to parse message:', error)
  }
}

// SSE 重連機制
const handleSSEReconnect = () => {
  if (sseReconnectAttempts.value >= maxSSEReconnectAttempts) {
    console.warn('⚠️ [Message SSE] Max reconnection attempts reached, falling back to polling')
    return
  }

  sseReconnectAttempts.value++
  const delay = Math.min(1000 * Math.pow(2, sseReconnectAttempts.value - 1), 10000) // 指數退避，最多10秒

  console.log(`🔄 [Message SSE] Reconnecting attempt ${sseReconnectAttempts.value}/${maxSSEReconnectAttempts} in ${delay}ms`)

  sseReconnectTimer = setTimeout(() => {
    if (authStore.token && conversationId.value) {
      connectSSE()
    }
  }, delay)
}

// 斷開 SSE 連接
const disconnectSSE = () => {
  if (messageEventSource.value) {
    messageEventSource.value.close()
    messageEventSource.value = null
  }

  if (sseReconnectTimer) {
    clearTimeout(sseReconnectTimer)
    sseReconnectTimer = null
  }

  sseConnected.value = false
  sseReconnectAttempts.value = 0
  console.log('🔌 [Message SSE] Disconnected')
}

const handleAttachmentUpload = (attachment: unknown) => {
  console.log('Attachment uploaded:', attachment)
}

// Simplified conversation loading
const loadConversation = async () => {
  try {
    await conversationsStore.fetchConversation(conversationId.value)
    if (conversation.value?.unreadCount) {
      await markAsRead()
    }
  } catch (error) {
    console.error('Failed to load conversation:', error)
  }
}

// Performance optimized message loading with smart loading states
const loadMessages = async (force = false, animate = false) => {
  // 防抖機制：避免短時間內重複請求
  const now = Date.now()
  if (!force && now - lastLoadTime.value < MIN_LOAD_INTERVAL) {
    console.log('⏱️ Debounced: Too soon since last load')
    return
  }
  
  // 修復：只有真正的初始載入才顯示 HamsterLoader
  // hasLoadedInitially 現在會在首次載入後立即設為 true，避免重複載入器
  const isRealInitialLoad = !hasLoadedInitially.value
  if (isRealInitialLoad) {
    isInitialLoading.value = true
  }
  
  lastLoadTime.value = now
  
  try {
    return await measureMessageLoad(async () => {
      mark('message-fetch-start')
      await fetchMessages()
      
      // 標記已完成初始載入（無論是否有消息）
      const wasInitialLoad = !hasLoadedInitially.value
      if (wasInitialLoad) {
        hasLoadedInitially.value = true
      }
      
      if (rawMessages.value.length > 0) {
        mark('message-render-start')
        
        // Use animated update for subsequent loads, immediate for initial load
        if (animate && !wasInitialLoad) {
          // 後續更新使用動畫，不顯示載入器
          updateMessages(rawMessages.value, true)
        } else {
          // 初始載入使用立即更新
          setMessagesImmediate(rawMessages.value)
          
          // Auto-scroll to bottom for initial load only
          await nextTick()
          if (virtualMessageListRef.value && wasInitialLoad) {
            virtualMessageListRef.value.scrollToBottom()
          }
        }
        
        measure('message-render', 'message-render-start')
      } else if (animate && !wasInitialLoad) {
        // 即使沒有新消息，也要觸發平滑更新以保持一致性
        updateMessages([], true)
      }
      measure('message-fetch', 'message-fetch-start')
    })
  } finally {
    // 只有真正的初始載入才重置載入狀態
    if (isRealInitialLoad) {
      isInitialLoading.value = false
    }
  }
}

// Simplified message actions
const handleMessageCopy = (message: Message) => {
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
  const confirmed = await useConfirm().confirmWarning(
    '撤回訊息',
    '確定要撤回這條訊息嗎？撤回後對方將無法看到。',
    '撤回'
  )
  
  if (confirmed) {
    console.log('Message recalled:', message.id)
    await loadMessages(true, true) // Force refresh with animation after message recall
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

// Assignment handlers
const handleConversationAssigned = (conversation: Conversation, assignedTo: string) => {
  console.log('Conversation assigned:', { conversationId: conversation.id, assignedTo })
}

const handleConversationUnassigned = (conversation: Conversation) => {
  console.log('Conversation unassigned:', conversation.id)
}

const handleAssignError = (error: string) => {
  console.error('Assignment error:', error)
}

// Simplified close conversation
const closeConversation = async () => {
  if (closing.value) {return}

  const confirmed = await useConfirm().confirmWarning(
    '結束對話',
    '確定要結束這個對話嗎？結束後將無法再次開啟。',
    '結束對話'
  )
  
  if (!confirmed) {return}

  closing.value = true
  try {
    const success = await conversationsStore.closeConversation(conversationId.value)
    if (success) {
      router.push('/conversations')
    }
  } catch (error) {
    console.error('Failed to close conversation:', error)
  } finally {
    closing.value = false
  }
}

const markAsRead = async () => {
  try {
    await conversationsStore.markAsRead(conversationId.value)
  } catch (error) {
    console.error('Failed to mark as read:', error)
  }
}

// Quick reply handler
const useQuickReply = (text: string) => {
  if (messageInputRef.value && text.trim()) {
    try {
      messageInputRef.value.setMessageText(text)
    } catch (error) {
      console.error('Quick reply error:', error)
    }
  }
}

// Virtual scroll handler with performance optimization
// Handle scroll events from virtual list
const handleVirtualScroll = performanceUtils.throttle((scrollInfo: unknown) => {
  // Type guard for scroll info
  const info = scrollInfo as { scrollTop: number; scrollHeight: number; clientHeight: number } | undefined
  if (!info) {return}
  
  // Check if user is at bottom
  const threshold = 100 // pixels from bottom
  const isAtBottom = info.scrollHeight - info.scrollTop - info.clientHeight < threshold
  
  // Show new message modal if new messages arrive while scrolled up
  if (!isAtBottom && newMessageCount.value > 0 && !showNewMessageModal.value) {
    showNewMessageModal.value = true
  }
  
  // Reset polling delay on scroll (user activity)
  resetPollingDelay()
}, 16) // 60fps throttling

// Handle new messages while scrolled
const handleNewMessageWhileScrolled = () => {
  newMessageCount.value++
  showNewMessageModal.value = true
}

// New message modal
const scrollToNewest = () => {
  if (virtualMessageListRef.value) {
    virtualMessageListRef.value.scrollToBottom()
  }
  showNewMessageModal.value = false
  newMessageCount.value = 0
}

const dismissNewMessageModal = () => {
  showNewMessageModal.value = false
}

// Navigation
const goBack = () => {
  router.push('/conversations')
}

// Smart polling as backup for SSE with activity detection
const startPolling = () => {
  if (pollingInterval.value) {
    clearTimeout(pollingInterval.value)
  }

  const poll = async () => {
    // 只在頁面可見且對話未關閉時輪詢
    if (!isPageVisible.value || conversation.value?.status === 'closed') {
      console.log('⏸️ Polling paused:', !isPageVisible.value ? 'page hidden' : 'conversation closed')
      // 延遲後重新檢查
      pollingInterval.value = setTimeout(poll, 30000)
      return
    }
    
    // 檢查用戶是否活躍
    const isUserActive = Date.now() - lastUserActivity.value < USER_INACTIVE_THRESHOLD
    
    if (isUserActive) {
      // 根據 SSE 狀態決定輪詢行為
      if (sseConnected.value && !sseError.value) {
        // SSE 連接正常，執行備份輪詢（較長間隔）
        console.log('🔄 [Polling backup] Loading messages with smooth animation')
        await loadMessages(false, true) // animate new messages during backup polling
      } else {
        // SSE 未連接或有錯誤，執行主要輪詢（較短間隔）
        console.log('🔄 [Polling fallback] Loading messages with smooth animation')
        await loadMessages(false, true) // animate new messages during fallback polling
      }
    } else {
      console.log('⏸️ User inactive, skipping poll')
    }
    
    // 根據 SSE 狀態和用戶活躍度選擇延遲間隔
    const delayArray = sseConnected.value && !sseError.value 
      ? sseBackupPollingDelays // SSE 連接時使用較長的備份間隔
      : pollingDelays // SSE 未連接時使用正常間隔
    
    const baseDelay = delayArray[currentPollingIndex.value] || maxPollingDelay
    const delay = isUserActive ? baseDelay : Math.min(baseDelay * 2, maxPollingDelay)
    
    pollingInterval.value = setTimeout(poll, delay)
    
    // 根據情況調整輪詢索引
    const maxIndex = delayArray.length - 1
    if (!isUserActive && currentPollingIndex.value < maxIndex) {
      currentPollingIndex.value++
    }
  }

  // 根據 SSE 狀態選擇初始延遲
  const initialDelay = sseConnected.value && !sseError.value 
    ? sseBackupPollingDelays[0] 
    : pollingDelays[0]
  
  console.log(`🚀 [Polling] Starting with ${sseConnected.value ? 'backup' : 'fallback'} mode, delay: ${initialDelay}ms`)
  pollingInterval.value = setTimeout(poll, initialDelay)
}

// Reset polling delay on user activity
const resetPollingDelay = () => {
  currentPollingIndex.value = 0
  lastUserActivity.value = Date.now() // 更新最後活動時間
}

// 處理頁面可見性變化
const handleVisibilityChange = async () => {
  isPageVisible.value = document.visibilityState === 'visible'
  console.log(`👁️ Page visibility changed: ${isPageVisible.value ? 'visible' : 'hidden'}`)
  
  if (isPageVisible.value) {
    // 頁面變為可見時，重新建立 SSE 連接
    if (conversationId.value) {
      await connectSSE()
    }
    
    // 立即刷新一次（帶動畫，無載入器）
    loadMessages(true, true) // Force refresh with animation
    resetPollingDelay()
    startPolling()
  } else {
    // 頁面隱藏時斷開 SSE 以節省資源
    disconnectSSE()
  }
}

// 追蹤用戶活動
const trackUserActivity = () => {
  lastUserActivity.value = Date.now()
  
  // 如果之前是不活躍狀態，重置輪詢延遲
  if (currentPollingIndex.value > 0) {
    console.log('🎯 User active again, resetting polling delay')
    resetPollingDelay()
  }
}

// Keyboard shortcuts
const handleGlobalKeydown = (event: KeyboardEvent) => {
  trackUserActivity() // 鍵盤輸入是用戶活動
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
        handleRefreshMessages() // Use smooth animation for keyboard refresh
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

// Lifecycle with performance monitoring and SSE
onMounted(async () => {
  console.log('🔧 ConversationDetail mounted')
  
  // Start performance monitoring
  mark('component-mount-start')
  startMonitoring()
  
  // Setup event listeners
  document.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('mousemove', trackUserActivity)
  document.addEventListener('click', trackUserActivity)
  
  // Start SSE connection for real-time messaging (priority)
  if (document.visibilityState === 'visible' && conversationId.value) {
    await connectSSE()
  }
  
  // Start polling as backup (will adjust interval based on SSE status)
  if (document.visibilityState === 'visible') {
    startPolling()
  }
  
  measure('component-mount', 'component-mount-start')
  
  // Log performance summary in development
  if (import.meta.env.DEV) {
    setTimeout(() => {
      logPerformanceSummary()
    }, 5000) // After 5 seconds
  }
})

onUnmounted(() => {
  // Clean up polling
  if (pollingInterval.value) {
    clearTimeout(pollingInterval.value)
    pollingInterval.value = null
  }
  
  // Clean up SSE connection
  disconnectSSE()
  
  // Remove all event listeners
  document.removeEventListener('keydown', handleGlobalKeydown)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('mousemove', trackUserActivity)
  document.removeEventListener('click', trackUserActivity)
  
  // Stop performance monitoring
  stopMonitoring()
  
  // Final performance report in development
  if (import.meta.env.DEV) {
    console.log('📊 [Final Performance Report]', getPerformanceReport())
  }
})

// Watch for route changes with performance monitoring and SSE reconnection
watch(
  () => route.params.id,
  async (newId) => {
    if (!newId || typeof newId !== 'string') {return}
    
    console.log(`🔄 Loading conversation: ${newId}`)
    mark('conversation-load-start')
    
    // 重置初始載入狀態（新對話就是初始載入）
    hasLoadedInitially.value = false
    isInitialLoading.value = true
    
    // 斷開舊的 SSE 連接
    disconnectSSE()
    
    try {
      // Reset polling
      currentPollingIndex.value = 0
      
      // Load conversation and messages in parallel
      await Promise.all([
        loadConversation(),
        setConversationId(newId).then(() => loadMessages(true)) // 真正的初始載入
      ])
      
      // 建立新的 SSE 連接到新對話
      if (document.visibilityState === 'visible') {
        await connectSSE()
      }
      
      measure('conversation-load', 'conversation-load-start')
      
    } catch (error) {
      console.error(`Failed to load conversation ${newId}:`, error)
      measure('conversation-load-error', 'conversation-load-start')
    }
    // 注意：不在這裡重置 isInitialLoading，讓 loadMessages 自己管理
  },
  { 
    immediate: true,
    flush: 'post'
  }
)
</script>

<style scoped>
/* 使用與原文件相同的樣式，但添加性能優化 */
.conversation-detail {
  height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  background-color: var(--gray-50);
  overflow: hidden;
  margin: -24px;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.message-search-container {
  flex: 0 0 auto;
  background-color: var(--gray-50);
  padding: 0 var(--space-6);
  border-bottom: 1px solid var(--gray-200);
}

/* Performance optimized message container */
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

/* New message notification */
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

/* Close button styles */
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
}
</style>