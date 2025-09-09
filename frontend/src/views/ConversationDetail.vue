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
            @click="refreshMessages"
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
  refreshMessages,
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

// Optimized polling with smart intervals
const pollingInterval = ref<NodeJS.Timeout | null>(null)
const pollingDelays = [15000, 30000, 60000, 120000] // 15s → 30s → 1min → 2min (更合理的間隔)
const currentPollingIndex = ref(0)
const maxPollingDelay = 300000 // Max 5 minutes (減少不必要的請求)
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
  
  // 只有真正的初始載入才顯示 HamsterLoader
  const isRealInitialLoad = !hasLoadedInitially.value && smoothMessages.value.length === 0
  if (isRealInitialLoad) {
    isInitialLoading.value = true
  }
  
  lastLoadTime.value = now
  
  try {
    return await measureMessageLoad(async () => {
      mark('message-fetch-start')
      await fetchMessages()
      
      if (rawMessages.value.length > 0) {
        mark('message-render-start')
        
        // Use animated update for subsequent loads, immediate for initial load
        if (animate && hasLoadedInitially.value) {
          // 後續更新使用動畫，不顯示載入器
          updateMessages(rawMessages.value, true)
        } else {
          // 初始載入使用立即更新
          setMessagesImmediate(rawMessages.value)
          
          // Auto-scroll to bottom for initial load only
          await nextTick()
          if (virtualMessageListRef.value && !hasLoadedInitially.value) {
            virtualMessageListRef.value.scrollToBottom()
          }
        }
        
        // 標記已完成初始載入
        if (!hasLoadedInitially.value) {
          hasLoadedInitially.value = true
        }
        
        measure('message-render', 'message-render-start')
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
    await refreshMessages()
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

// Smart polling with activity detection
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
      // 用戶活躍時載入消息，使用平滑動畫（無載入器）
      await loadMessages(false, true) // animate new messages during polling
    } else {
      console.log('⏸️ User inactive, skipping poll')
    }
    
    // 根據用戶活躍度調整延遲
    const baseDelay = pollingDelays[currentPollingIndex.value] || maxPollingDelay
    const delay = isUserActive ? baseDelay : Math.min(baseDelay * 2, maxPollingDelay)
    
    pollingInterval.value = setTimeout(poll, delay)
    
    // 只有在用戶不活躍時才增加延遲
    if (!isUserActive && currentPollingIndex.value < pollingDelays.length - 1) {
      currentPollingIndex.value++
    }
  }

  // Start with first delay
  pollingInterval.value = setTimeout(poll, pollingDelays[0])
}

// Reset polling delay on user activity
const resetPollingDelay = () => {
  currentPollingIndex.value = 0
  lastUserActivity.value = Date.now() // 更新最後活動時間
}

// 處理頁面可見性變化
const handleVisibilityChange = () => {
  isPageVisible.value = document.visibilityState === 'visible'
  console.log(`👁️ Page visibility changed: ${isPageVisible.value ? 'visible' : 'hidden'}`)
  
  if (isPageVisible.value) {
    // 頁面變為可見時，立即刷新一次（帶動畫，無載入器）
    loadMessages(true, true) // Force refresh with animation
    resetPollingDelay()
    startPolling()
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
        refreshMessages()
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

// Lifecycle with performance monitoring
onMounted(() => {
  console.log('🔧 ConversationDetail mounted')
  
  // Start performance monitoring
  mark('component-mount-start')
  startMonitoring()
  
  // Setup event listeners
  document.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('mousemove', trackUserActivity)
  document.addEventListener('click', trackUserActivity)
  
  // Start polling only if page is visible
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
  if (pollingInterval.value) {
    clearTimeout(pollingInterval.value)
    pollingInterval.value = null
  }
  
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

// Watch for route changes with performance monitoring
watch(
  () => route.params.id,
  async (newId) => {
    if (!newId || typeof newId !== 'string') {return}
    
    console.log(`🔄 Loading conversation: ${newId}`)
    mark('conversation-load-start')
    
    // 重置初始載入狀態（新對話就是初始載入）
    hasLoadedInitially.value = false
    isInitialLoading.value = true
    
    try {
      // Reset polling
      currentPollingIndex.value = 0
      
      // Load conversation and messages in parallel
      await Promise.all([
        loadConversation(),
        setConversationId(newId).then(() => loadMessages(true)) // 真正的初始載入
      ])
      
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
  max-height: 200px;
  overflow-y: auto;
}

.quick-replies {
  max-width: 800px;
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