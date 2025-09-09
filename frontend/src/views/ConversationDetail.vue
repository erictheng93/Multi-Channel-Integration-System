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
      <!-- Header -->
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
          <!-- 高級指派控制 -->
          <AdvancedAssignActions
            v-if="conversation"
            :conversation="conversation"
            @assigned="handleConversationAssigned"
            @unassigned="handleConversationUnassigned"
            @error="handleAssignError"
          />

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

      <!-- Message Search -->
      <div class="message-search-container">
        <MessageSearch
          ref="messageSearchRef"
          :messages="messages"
          @search-results="handleSearchResults"
          @search-clear="handleSearchClear"
        />
      </div>

      <!-- High Performance Virtual Message List -->
      <div class="messages-container-wrapper">
        <!-- Initial Loading State -->
        <HamsterLoader
          v-if="loadingMessages && messages.length === 0"
          message="載入對話中..."
        />

        <!-- Empty State -->
        <div
          v-else-if="displayedMessages.length === 0"
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

        <!-- Virtual Message List for Performance -->
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
          @message-copy="handleMessageCopy"
          @message-reply="handleMessageReply"
          @message-forward="handleMessageForward"
          @message-recall="handleMessageRecall"
          @message-select="handleMessageSelect"
          @search-clear="handleSearchClear"
          @load-more="loadMoreMessages"
          @scroll="handleVirtualScroll"
        />
      </div>

      <!-- 玻璃擬態化新消息提醒 (移到外層) -->
      <div
        v-if="showNewMessageModal"
        class="glassmorphism-notification"
        @click="viewNewMessages"
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

    <!-- 鍵盤快捷鍵幫助 -->
    <KeyboardShortcuts ref="keyboardShortcutsRef" />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, onUnmounted, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessages } from '@/composables'
import { useSmoothLoading } from '@/composables/useSmoothLoading'
import { useConversationsStore } from '@/stores/conversations'
import { useConfirm } from '@/composables/useConfirm'
import type { Message, Conversation } from '@/types'
import AppLayout from '@/components/ui/AppLayout.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import VirtualMessageList from '@/components/conversation/VirtualMessageList.vue'
import MessageInput from '@/components/conversation/MessageInput.vue'
import MessageIndicator from '@/components/conversation/MessageIndicator.vue'
import PlatformBadge from '@/components/ui/PlatformBadge.vue'

// Lazy load non-critical components for better performance
const MessageSearch = defineAsyncComponent(() => import('@/components/conversation/MessageSearch.vue'))
const KeyboardShortcuts = defineAsyncComponent(() => import('@/components/ui/KeyboardShortcuts.vue'))
const AdvancedAssignActions = defineAsyncComponent(() => import('@/components/conversation/AdvancedAssignActions.vue'))

import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  ArrowLeftIcon,
  XCircleIcon,
  RefreshIcon,
  MessageCircleIcon
} from '@/components/icons'

const route = useRoute()
const router = useRouter()
// useAuth removed - not used in this component
const conversationsStore = useConversationsStore()
const { 
  messages: rawMessages, 
  oldestMessage,
  latestMessage,
  loading: loadingMessages,
  hasMore,
  loadingHistory,
  totalMessages,
  fetchMessages,
  refreshMessages,
  loadMoreMessages,
  setConversationId
} = useMessages(undefined, {
  enablePagination: true,
  pageSize: 7 // 改為7條消息
})

// 平滑載入系統
const {
  messages: smoothMessages,
  isUpdating,
  updateMessages,
  setMessagesImmediate,
  getAnimationClasses
} = useSmoothLoading({
  animationDuration: 300,
  debounceDelay: 16
})

// State
const conversation = computed(() => conversationsStore.currentConversation)

const closing = ref(false)
const isTyping = ref(false)
const virtualMessageListRef = ref()
const messageInputRef = ref()
const keyboardShortcutsRef = ref()
const messageSearchRef = ref()

// Performance optimization refs
const animationClasses = computed(() => getAnimationClasses || {})

// Scroll position tracking for virtual list
const virtualScrollPosition = ref({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 })
const isInitialLoad = ref(true)

// 🔒 防重入機制：確保不會重複載入相同對話
const loadingConversationId = ref<string | null>(null)
const conversationLoadPromise = ref<Promise<void> | null>(null)

// 新消息提醒跳窗狀態
const showNewMessageModal = ref(false)
const newMessageCount = ref(0)
const userScrolledUp = ref(false)
const modalDismissedRecently = ref(false)

// 追蹤客服是否剛發送消息（用於排除自己的消息觸發通知）
const agentJustSentMessage = ref(false)

// Computed properties for future enhancement

// 搜索狀態
const searchResults = ref<Message[]>([])
const isSearchActive = ref(false)

// 调试模式状态
const debugMode = ref(false)

// Quick replies
const quickReplies = ref([
  { id: '1', text: '感謝您的來信，我們會盡快回覆' },
  { id: '2', text: '請問還有其他需要協助的嗎？' },
  { id: '3', text: '謝謝您的耐心等待' },
  { id: '4', text: '問題已為您解決，如有其他疑問請隨時聯繫' }
])

// Computed
const conversationId = computed(() => route.params.id as string)

const customerInitials = computed(() => {
  const name = conversation.value?.customer?.name || 'U'
  return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
})

const displayedMessages = computed(() => {
  // 使用搜索結果或平滑載入的消息
  return isSearchActive.value ? searchResults.value : smoothMessages.value
})

// 實際的消息數據（用於平滑載入系統）
const messages = computed(() => smoothMessages.value)

// Group messages by date (future feature, currently unused)
// const groupedMessages = computed(() => {
//   if (messages.value.length === 0) {return []}
//   
//   const groups: Array<{ date: string; messages: Message[] }> = []
//   let currentGroup: { date: string; messages: Message[] } | null = null
//   
//   messages.value.forEach(message => {
//     const messageDate = getMessageDate(message)
//     const dateKey = formatDateKey(messageDate)
//     
//     if (!currentGroup || currentGroup.date !== dateKey) {
//       currentGroup = {
//         date: dateKey,
//         messages: []
//       }
//       groups.push(currentGroup)
//     }
//     
//     currentGroup.messages.push(message)
//   })
//   
//   return groups
// })

// Helper functions for date grouping (future feature, currently unused)
// function getMessageDate(message: Message): Date {
//   const timestamp = message.timestamp || message.createdAt || new Date()
//   return typeof timestamp === 'number' ? new Date(timestamp) : 
//          typeof timestamp === 'string' ? new Date(timestamp) : timestamp
// }

// function formatDateKey(date: Date): string {
//   return date.toDateString() // Returns format like "Mon Jan 15 2024"
// }

// Message handlers
const handleMessageSent = async () => {
  console.log('💬 [Message Sent] 客服發送了新消息，準備更新UI...')
  
  // 🎯 標記客服剛發送消息，防止觸發新消息通知
  agentJustSentMessage.value = true
  
  // 🎯 追蹤用戶發送消息活動
  updateActivityState('interaction')
  
  // Refresh messages to get the latest
  await loadMessages()
  
  // Update conversation's last message
  if (conversation.value) {
    // 使用簡化的最新消息邏輯
    if (latestMessage.value) {
      conversation.value.lastMessage = latestMessage.value
    }
  }

  // 🎯 客服發送消息後，強制滾動到底部查看最新消息
  await nextTick()
  scrollToBottom(true) // force = true，確保顯示剛發送的消息
  
  // 重置標記（延遲重置確保 loadMessages 處理完成）
  setTimeout(() => {
    agentJustSentMessage.value = false
    console.log('🔄 [Message Sent] Agent message flag reset')
  }, 1000)
  
  console.log('✅ [Message Sent] 消息發送完成，已滾動到最新位置')
}

const handleAttachmentUpload = (attachment: unknown) => {
  // Handle attachment upload event if needed
  console.log('Attachment uploaded:', attachment)
}

// 🎯 智能輪詢系統：根據用戶活動動態調整頻率
const pollingInterval = ref<NodeJS.Timeout | null>(null)
const typingTimeout = ref<NodeJS.Timeout | null>(null)
const lastMessageCount = ref(0)
const lastTotalMessageCount = ref(0) // 追蹤總消息數變化
const isPageVisible = ref(true)
const hasPermissionError = ref(false)

// 🧠 智能頻率配置系統
const pollingConfig = ref({
  baseDelay: 15000,        // 15秒基礎間隔（符合行業標準）
  activeDelay: 8000,       // 8秒活躍間隔（有新消息或用戶活動）
  inactiveDelay: 45000,    // 45秒非活躍間隔（長時間無活動）
  backgroundDelay: 120000, // 2分鐘背景間隔（頁面隱藏）
  currentDelay: 15000      // 當前使用的延遲
})

// 🎯 活動狀態追蹤系統
const activityState = ref({
  lastUserActivity: Date.now(),    // 最後用戶活動時間
  lastMessageReceived: Date.now(), // 最後收到消息時間
  recentActivity: false,           // 最近是否有活動
  conversationActive: false,       // 對話是否活躍
  userInteracting: false           // 用戶是否正在互動
})



// 🧠 智能頻率計算函數
function calculateSmartDelay(): number {
  const now = Date.now()
  const timeSinceUserActivity = now - activityState.value.lastUserActivity
  const timeSinceMessage = now - activityState.value.lastMessageReceived
  
  console.log(`🎯 [Smart Polling] Activity analysis:`, {
    timeSinceUserActivity: `${Math.round(timeSinceUserActivity / 1000)}s`,
    timeSinceMessage: `${Math.round(timeSinceMessage / 1000)}s`,
    isPageVisible: isPageVisible.value,
    conversationActive: activityState.value.conversationActive,
    userInteracting: activityState.value.userInteracting
  })
  
  // 🎯 頁面隱藏時使用最長間隔
  if (!isPageVisible.value) {
    console.log(`🎯 [Smart Polling] Page hidden, using background delay: ${pollingConfig.value.backgroundDelay}ms`)
    return pollingConfig.value.backgroundDelay
  }
  
  // 🎯 用戶正在互動時使用最短間隔
  if (activityState.value.userInteracting || timeSinceUserActivity < 30000) { // 30秒內有用戶活動
    console.log(`🎯 [Smart Polling] User active, using active delay: ${pollingConfig.value.activeDelay}ms`)
    activityState.value.recentActivity = true
    return pollingConfig.value.activeDelay
  }
  
  // 🎯 最近有新消息時使用中等間隔
  if (activityState.value.conversationActive || timeSinceMessage < 120000) { // 2分鐘內有新消息
    console.log(`🎯 [Smart Polling] Conversation active, using base delay: ${pollingConfig.value.baseDelay}ms`)
    return pollingConfig.value.baseDelay
  }
  
  // 🎯 長時間無活動時使用較長間隔
  console.log(`🎯 [Smart Polling] Long inactive, using inactive delay: ${pollingConfig.value.inactiveDelay}ms`)
  activityState.value.recentActivity = false
  return pollingConfig.value.inactiveDelay
}

// 🎯 更新活動狀態追蹤
function updateActivityState(type: 'user' | 'message' | 'interaction') {
  const now = Date.now()
  
  switch (type) {
    case 'user':
      activityState.value.lastUserActivity = now
      activityState.value.recentActivity = true
      console.log(`🎯 [Activity] User activity detected`)
      break
      
    case 'message':
      activityState.value.lastMessageReceived = now
      activityState.value.conversationActive = true
      console.log(`🎯 [Activity] New message received`)
      break
      
    case 'interaction':
      activityState.value.userInteracting = true
      activityState.value.lastUserActivity = now
      console.log(`🎯 [Activity] User interaction detected`)
      
      // 3秒後重置互動狀態
      setTimeout(() => {
        activityState.value.userInteracting = false
        console.log(`🎯 [Activity] User interaction reset`)
      }, 3000)
      break
  }
  
  // 重新計算並更新當前延遲
  const newDelay = calculateSmartDelay()
  if (newDelay !== pollingConfig.value.currentDelay) {
    pollingConfig.value.currentDelay = newDelay
    console.log(`🎯 [Smart Polling] Delay updated: ${newDelay}ms`)
    
    // 重新啟動輪詢以應用新的延遲
    if (pollingInterval.value) {
      startPolling()
    }
  }
}

// Methods
async function loadConversation() {
  try {
    console.log('🔄 [ConversationDetail] Loading conversation:', conversationId.value)
    await conversationsStore.fetchConversation(conversationId.value)
    
    if (conversation.value) {
      console.log('✅ [ConversationDetail] Conversation loaded:', conversation.value.customer?.name || 'Unknown')
      // Mark as read if there are unread messages
      if (conversation.value.unreadCount && conversation.value.unreadCount > 0) {
        await markAsRead()
      }
    } else {
      console.warn('⚠️ [ConversationDetail] No conversation data received')
    }
  } catch (error) {
    console.error('❌ [ConversationDetail] Failed to load conversation:', error)
  }
}

// 檢查用戶是否在底部 - 優化版本適用於虛擬列表
function isUserAtBottom(): boolean {
  const { scrollTop, scrollHeight, clientHeight } = virtualScrollPosition.value
  
  if (scrollHeight === 0) {
    console.log('🔍 [NewMessageIndicator] No scroll info yet, assuming at bottom')
    return true
  }
  
  // 增加容忍度到100px（約1.5條消息的高度）
  // 這樣可以避免因為細微的滾動差異而誤判
  const tolerance = 100
  const atBottom = scrollTop + clientHeight >= scrollHeight - tolerance
  
  console.log(`🔍 [NewMessageIndicator] Virtual scroll position check:`, {
    scrollTop,
    scrollHeight,
    clientHeight,
    tolerance,
    atBottom,
    diff: scrollHeight - (scrollTop + clientHeight)
  })
  return atBottom
}

// 虛擬滾動事件處理 - 適用於 VirtualMessageList
function handleVirtualScroll(scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
  // 更新滾動位置資訊
  virtualScrollPosition.value = scrollInfo
  
  // 🎯 追蹤用戶滾動活動
  updateActivityState('user')
  
  const { scrollTop } = scrollInfo
  const atBottom = isUserAtBottom()
  userScrolledUp.value = !atBottom
  
  // 如果用戶滾動到底部，隱藏新消息跳窗
  if (atBottom) {
    console.log('📍 [NewMessageModal] User scrolled to bottom, hiding modal')
    showNewMessageModal.value = false
    newMessageCount.value = 0
    modalDismissedRecently.value = false
  } else {
    console.log('📍 [NewMessageModal] User not at bottom, keeping modal if exists')
  }
  
  // 🔄 無限滾動邏輯 - 防止初始載入時錯誤觸發
  const threshold = 150
  const nearTop = scrollTop < threshold
  
  // 只在非初始載入且用戶有意向上滾動時觸發
  if (nearTop && hasMore.value && !loadingHistory.value && !isInitialLoad.value && scrollTop > 0) {
    console.log('📜 [Infinite Scroll] 用戶向上滑動查看歷史，載入更多訊息...')
    console.log(`📊 [Infinite Scroll] 當前位置: scrollTop=${scrollTop}, 觸發閾值=${threshold}`)
    
    // 觸發載入更多歷史訊息
    loadMoreMessages()
  }
}

// 關閉新消息跳窗
function dismissNewMessageModal() {
  console.log('📍 [NewMessageModal] User dismissed modal')
  showNewMessageModal.value = false
  modalDismissedRecently.value = true
  
  // 10秒後重置dismissed狀態，允許再次顯示跳窗
  setTimeout(() => {
    modalDismissedRecently.value = false
    console.log('📍 [NewMessageModal] Reset dismissed state')
  }, 10000)
}

// 查看新消息
async function viewNewMessages() {
  console.log('📍 [NewMessageModal] User chose to view new messages')
  
  // 🎯 追蹤用戶查看新消息的互動
  updateActivityState('interaction')
  
  showNewMessageModal.value = false
  newMessageCount.value = 0
  modalDismissedRecently.value = false
  
  // 確保滾動到底部
  await nextTick()
  scrollToBottom()
  
  // 再次確認滾動到底部（以防 DOM 還在更新）
  setTimeout(() => {
    scrollToBottom()
  }, 100)
}

// Helper functions for message display (kept for potential future use)

// 🔒 統一且安全的對話載入函數：解決競態條件
async function safeLoadConversation(targetId: string): Promise<void> {
  console.log(`🔄 [SafeLoad] Request to load conversation: ${targetId}`)
  
  // 🚫 防重入檢查：如果正在載入相同對話，返回現有Promise
  if (loadingConversationId.value === targetId && conversationLoadPromise.value) {
    console.log(`🔒 [SafeLoad] Already loading conversation ${targetId}, returning existing promise`)
    return conversationLoadPromise.value
  }
  
  // 🚫 如果已經載入了相同對話且狀態正常，直接返回
  if (conversation.value?.id === targetId && smoothMessages.value.length > 0) {
    console.log(`✅ [SafeLoad] Conversation ${targetId} already loaded with ${smoothMessages.value.length} messages`)
    return Promise.resolve()
  }
  
  // 🔄 開始新的載入流程
  loadingConversationId.value = targetId
  
  const loadPromise = (async (): Promise<void> => {
    try {
      console.log(`🔄 [SafeLoad] Starting to load conversation: ${targetId}`)
      
      // 1. 重置UI狀態，準備載入新數據
      setMessagesImmediate([])
      
      // 2. 並行載入對話元數據和消息（提高效率）
      console.log(`📡 [SafeLoad] Loading conversation metadata and messages in parallel...`)
      
      await Promise.all([
        loadConversation(),
        loadMessagesWithSync(targetId)
      ])
      
      console.log(`✅ [SafeLoad] Successfully loaded conversation ${targetId} with ${smoothMessages.value.length} messages`)
      
    } catch (error) {
      console.error(`❌ [SafeLoad] Failed to load conversation ${targetId}:`, error)
      // 確保失敗時UI顯示正確的空狀態
      setMessagesImmediate([])
      throw error
    } finally {
      // 清理載入狀態
      if (loadingConversationId.value === targetId) {
        loadingConversationId.value = null
        conversationLoadPromise.value = null
      }
    }
  })()
  
  conversationLoadPromise.value = loadPromise
  return loadPromise
}

// 🔧 修復競態條件：統一的消息載入和同步函數
async function loadMessagesWithSync(targetId?: string): Promise<void> {
  const actualId = targetId || conversationId.value
  
  try {
    console.log(`🔄 [loadMessagesWithSync] Loading messages for conversation: ${actualId}`)
    
    // 1. 使用 setConversationId 來設置分頁狀態並載入數據
    await setConversationId(actualId)
    
    // 2. 確保 rawMessages 已經載入完成
    if (rawMessages.value.length > 0) {
      console.log(`📍 [loadMessagesWithSync] Raw messages loaded: ${rawMessages.value.length} items`)
      
      // 3. 立即同步到平滑載入系統（初始載入不使用動畫）
      setMessagesImmediate(rawMessages.value)
      
      console.log(`✅ [loadMessagesWithSync] Smooth messages synchronized: ${smoothMessages.value.length} items`)
    } else {
      console.log(`⚠️ [loadMessagesWithSync] No messages found for conversation: ${actualId}`)
      
      // 確保平滑載入系統也為空
      setMessagesImmediate([])
    }
  } catch (error) {
    console.error(`❌ [loadMessagesWithSync] Failed to load messages for ${actualId}:`, error)
    // 失敗時確保UI顯示空狀態
    setMessagesImmediate([])
    throw error
  }
}

async function loadMessages() {
  try {
    // 記錄載入前的狀態
    const previousMessageCount = smoothMessages.value.length
    const wasAtBottom = isInitialLoad.value || isUserAtBottom()
    
    console.log(`🔄 [ConversationDetail] Loading messages, isInitialLoad: ${isInitialLoad.value}`)
    
    // 獲取新數據
    await fetchMessages()
    
    // 使用平滑載入更新UI
    if (rawMessages.value.length > 0) {
      if (isInitialLoad.value) {
        // 初始載入：立即設置，不使用動畫
        setMessagesImmediate(rawMessages.value)
        console.log(`📍 [SmoothLoading] Initial load complete with ${rawMessages.value.length} messages`)
      } else {
        // 後續更新：使用平滑動畫
        const shouldAnimate = previousMessageCount > 0 && rawMessages.value.length > previousMessageCount
        updateMessages(rawMessages.value, shouldAnimate)
        console.log(`📍 [SmoothLoading] Updated messages with animation: ${shouldAnimate}`)
      }
    }
    
    // ✅ 使用改进的防抖滚动解决竞态条件
    if (isInitialLoad.value && rawMessages.value.length > 0) {
      console.log(`📍 [ConversationDetail] Initial load complete with ${rawMessages.value.length} raw messages`)
      
      // 使用新的防抖滚动函数
      await performInitialScrollWithDebounce()
      
      // 标记初始加载完成
      isInitialLoad.value = false
    }
    
    // Reset permission error flag on successful fetch
    hasPermissionError.value = false
    
    const currentMessageCount = smoothMessages.value.length
    const hasNewMessages = currentMessageCount > previousMessageCount
    lastMessageCount.value = currentMessageCount

    // 詳細調試新消息檢測
    console.log(`🔍 [DEBUG] Message count comparison:`, {
      previous: previousMessageCount,
      current: currentMessageCount,
      hasNewMessages,
      isInitialLoad: isInitialLoad.value
    })

    // 🔥 檢查總消息數的變化（針對分頁模式）
    const currentTotalMessages = totalMessages?.value || currentMessageCount
    const totalMessagesChanged = currentTotalMessages !== lastTotalMessageCount.value
    
    console.log(`🔍 [DEBUG] Total messages check:`, {
      lastTotal: lastTotalMessageCount.value,
      currentTotal: currentTotalMessages,
      totalChanged: totalMessagesChanged
    })
    
    lastTotalMessageCount.value = currentTotalMessages
    
    // 如果總數變化但當前頁沒變化，說明新消息在其他頁
    if (totalMessagesChanged && !hasNewMessages && !isInitialLoad.value) {
      console.log('🎯 [FOUND] New messages detected via total count change!')
      // 觸發新消息邏輯，假設有1條新消息
      await handleNewMessagesDetected(1)
      return
    }

    // 🎯 智能活動狀態更新和新消息通知處理
    if (hasNewMessages && !isInitialLoad.value) {
      // 🚫 如果是客服剛發送的消息，不觸發新消息通知
      if (agentJustSentMessage.value) {
        console.log(`📍 [NewMessageModal] Skipping notification - agent just sent message`)
        updateActivityState('message')
        return
      }
      
      // 更新消息接收活動狀態
      updateActivityState('message')
      
      const newMessagesCount = currentMessageCount - previousMessageCount
      console.log(`🔍 [NewMessageIndicator] New messages detected: ${newMessagesCount}, isInitialLoad: ${isInitialLoad.value}`)
      
      // 只統計來自客戶的新消息
      const newMessages = messages.value.slice(-newMessagesCount)
      console.log('🔍 [DEBUG] New messages details:', newMessages.map(msg => ({
        id: msg.id,
        content: `${msg.content?.substring(0, 50)}...`,
        senderType: msg.senderType,
        platform: msg.platform,
        createdAt: msg.createdAt
      })))
      
      const newCustomerMessagesCount = newMessages.filter(
        (msg) => msg.senderType === 'customer'
      ).length
      console.log(`🔍 [NewMessageIndicator] Customer messages in new batch: ${newCustomerMessagesCount}/${newMessagesCount}`)
      
      // 檢查所有senderType值
      const senderTypes = newMessages.map(msg => msg.senderType)
      console.log(`🔍 [DEBUG] All senderTypes in new messages:`, senderTypes)
      
      // 🎯 關鍵條件檢查：只有客戶消息且用戶不在底部才顯示通知
      if (newCustomerMessagesCount > 0) {
        console.log(`🔍 [NewMessageIndicator] wasAtBottom: ${wasAtBottom}`)
        console.log(`🔍 [DEBUG] Virtual scroll position details:`, virtualScrollPosition.value)
        
        // 檢查用戶是否不在底部（核心條件）
        const userNotAtBottom = !isUserAtBottom()
        console.log(`📍 [NewMessageModal] User position check: notAtBottom=${userNotAtBottom}`)
        
        if (userNotAtBottom && !modalDismissedRecently.value) {
          // 🎯 滿足兩個條件：1. 有客戶新消息 2. 用戶不在底部 3. 最近沒關閉跳窗
          newMessageCount.value += newCustomerMessagesCount
          showNewMessageModal.value = true
          console.log(`📍 [NewMessageModal] ✅ Showing modal with ${newMessageCount.value} unread customer messages (user not at bottom)`)
        } else if (!userNotAtBottom) {
          console.log(`📍 [NewMessageModal] ❌ User at bottom, clearing modal`)
          // 用戶在底部，清除新消息計數
          newMessageCount.value = 0
          showNewMessageModal.value = false
        } else {
          console.log(`📍 [NewMessageModal] ❌ Modal dismissed recently, not showing`)
        }
      } else {
        console.log(`📍 [NewMessageModal] ❌ No new customer messages, not showing modal`)
      }
    }

  } catch (error) {
    console.error('載入訊息失敗:', error)
    
    // Check if it's a permission error (403) and stop polling
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = (error as { message: string }).message
      if (errorMessage.includes('Permission denied') || errorMessage.includes('403')) {
        hasPermissionError.value = true
        console.warn('Permission error detected, stopping message polling')
        if (pollingInterval.value) {
          clearTimeout(pollingInterval.value)
          pollingInterval.value = null
        }
        return
      }
    }
    
    // 在錯誤情況下使用較長的輪詢間隔
    console.log('⚠️ [Smart Polling] Error detected, using inactive delay')
    pollingConfig.value.currentDelay = pollingConfig.value.inactiveDelay
  }
}

// 處理新消息檢測的統一函數
async function handleNewMessagesDetected(newMessagesCount: number) {
  console.log(`🔍 [NewMessageIndicator] Processing ${newMessagesCount} new messages`)
  
  // 🚫 如果是客服剛發送的消息，不觸發新消息通知
  if (agentJustSentMessage.value) {
    console.log(`📍 [NewMessageModal] Skipping notification - agent just sent message`)
    return
  }
  
  // 獲取最新的消息來檢查發送者類型
  // 由於分頁模式下新消息可能不在當前頁，我們需要特殊處理
  // 暫時假設新消息是客戶消息（可以通過 API 調用最新消息來確認）
  const assumeCustomerMessage = true // 暫時假設，之後可優化
  
  if (assumeCustomerMessage) {
    console.log(`🔍 [DEBUG] Assuming new message is from customer`)
    
    // 檢查用戶位置
    const userNotAtBottom = !isUserAtBottom()
    console.log(`📍 [NewMessageModal] User position check: notAtBottom=${userNotAtBottom}`)
    
    // 🎯 關鍵條件檢查：只有用戶不在底部且沒有最近關閉跳窗才顯示
    if (userNotAtBottom && !modalDismissedRecently.value) {
      newMessageCount.value += newMessagesCount
      showNewMessageModal.value = true
      console.log(`📍 [NewMessageModal] ✅ Showing modal with ${newMessageCount.value} unread customer messages (user not at bottom)`)
    } else if (!userNotAtBottom) {
      console.log(`📍 [NewMessageModal] ❌ User at bottom, clearing modal`)
      // 用戶在底部，清除新消息計數
      newMessageCount.value = 0
      showNewMessageModal.value = false
    } else {
      console.log(`📍 [NewMessageModal] ❌ Modal dismissed recently, not showing`)
    }
  } else {
    console.log(`📍 [NewMessageModal] ❌ No new customer messages, not showing modal`)
  }
}



// 指派事件處理函數
const handleConversationAssigned = (conversation: Conversation, assignedTo: string) => {
  console.log('✅ [ConversationDetail] Conversation assigned:', { conversationId: conversation.id, assignedTo })
  // 對話已在store中更新，這裡可以添加額外的UI反饋
}

const handleConversationUnassigned = (conversation: Conversation) => {
  console.log('🔄 [ConversationDetail] Conversation unassigned:', conversation.id)
  // 對話已在store中更新，這裡可以添加額外的UI反饋
}

const handleAssignError = (error: string) => {
  console.error('❌ [ConversationDetail] Assignment error:', error)
  // TODO: 可以添加Toast通知或其他錯誤提示
}

async function closeConversation() {
  if (closing.value) {return}

  const confirmed = await useConfirm().confirmWarning(
    '結束對話',
    '確定要結束這個對話嗎？結束後將無法再次開啟。',
    '結束對話'
  )
  if (!confirmed) {return}

  closing.value = true
  try {
    console.log('🔄 [ConversationDetail] Closing conversation:', conversationId.value)
    const success = await conversationsStore.closeConversation(conversationId.value)
    if (success) {
      console.log('✅ [ConversationDetail] Conversation closed successfully')
      router.push('/conversations')
    }
  } catch (error) {
    console.error('❌ [ConversationDetail] Failed to close conversation:', error)
  } finally {
    closing.value = false
  }
}

async function markAsRead() {
  try {
    console.log('🔄 [ConversationDetail] Marking conversation as read:', conversationId.value)
    await conversationsStore.markAsRead(conversationId.value)
    console.log('✅ [ConversationDetail] Conversation marked as read')
  } catch (error) {
    console.error('❌ [ConversationDetail] Failed to mark as read:', error)
  }
}

// 🎯 智能滾動到底部 - 適用於虛擬列表
function scrollToBottom(force = false) {
  if (!virtualMessageListRef.value) {
    console.log('📍 [Smart Scroll] Virtual message list ref not available')
    return
  }
  
  const { scrollTop, scrollHeight, clientHeight } = virtualScrollPosition.value
  const isNearBottom = (scrollHeight - scrollTop - clientHeight) < 200
  
  // 如果用戶在底部附近或強制滾動，就平滑滾動到底部
  if (isNearBottom || force) {
    // 調用虛擬列表的滾動方法
    if (typeof virtualMessageListRef.value.scrollToBottom === 'function') {
      virtualMessageListRef.value.scrollToBottom(true)
      console.log('📍 [Smart Scroll] 平滑滾動到最新消息 (Virtual)')
    }
  } else {
    console.log('📍 [Smart Scroll] 用戶不在底部，保持當前位置')
  }
}

// 🚀 改进的立即滚动到底部函数 - 适用于虚拟列表
function scrollToBottomInstantly(): boolean {
  if (!virtualMessageListRef.value) {
    console.warn('⚠️ [Scroll] Virtual message list ref not found')
    return false
  }
  
  // 使用虚拟列表的滚动方法
  if (typeof virtualMessageListRef.value.scrollToBottom === 'function') {
    virtualMessageListRef.value.scrollToBottom(false) // 立即滚动，不使用动画
    console.log('📍 [Scroll] Instant scroll to bottom executed (Virtual)')
    return true
  }
  
  return false
}

// 🎯 简化的初始滚动函数 - 适用于虚拟列表
async function performInitialScrollWithDebounce(): Promise<void> {
  console.log('🎯 [InitialScroll] Starting initial scroll for virtual list')
  
  // 等待 Vue 更新 DOM
  await nextTick()
  
  if (smoothMessages.value.length === 0) {
    console.warn('⚠️ [InitialScroll] No messages to scroll to')
    return
  }
  
  // 等待虚拟列表准备就绪
  setTimeout(() => {
    if (virtualMessageListRef.value) {
      scrollToBottomInstantly()
      console.log('🎯 [InitialScroll] Virtual list scroll completed')
    } else {
      console.warn('⚠️ [InitialScroll] Virtual list ref not ready')
    }
  }, 100)
}

// 📍 檢查用戶是否可以看到最新消息區域

function useQuickReply(text: string) {
  if (!messageInputRef.value || !text.trim()) {return}
  
  try {
    const success = messageInputRef.value.setMessageText(text)
    if (!success) {
      console.error('Failed to set quick reply text')
    }
  } catch (error) {
    console.error('Quick reply error:', error)
  }
}

// 搜索處理函數
const handleSearchResults = (results: Message[]) => {
  searchResults.value = results
  isSearchActive.value = results.length > 0
  
  // 滾動到第一個搜索結果
  if (results.length > 0) {
    nextTick(() => {
      scrollToBottom()
    })
  }
}

const handleSearchClear = () => {
  searchResults.value = []
  isSearchActive.value = false
}

// 消息操作處理函數
const handleMessageCopy = (message: Message) => {
  console.log('Message copied:', message.content)
  // 🎯 追蹤用戶複製消息的互動
  updateActivityState('interaction')
  // TODO: 可以添加成功提示
}

const handleMessageReply = (message: Message) => {
  console.log('Reply to message:', message.content)
  // 🎯 追蹤用戶回覆消息的互動
  updateActivityState('interaction')
  
  // 設置回覆引用到輸入框（不發送）
  if (messageInputRef.value) {
    const senderName = message.senderType === 'customer' ? '客戶' : '客服'
    messageInputRef.value.setReplyTo(message.content, senderName)
  }
}

const handleMessageForward = (message: Message) => {
  console.log('Forward message:', message.content)
  // 🎯 追蹤用戶轉發消息的互動
  updateActivityState('interaction')
  // TODO: 實現轉發功能 - 可能需要打開對話選擇器
}

const handleMessageRecall = async (message: Message) => {
  console.log('Recall message:', message.id)
  
  // 🎯 追蹤用戶撤回消息的互動
  updateActivityState('interaction')
  
  const confirmed = await useConfirm().confirmWarning(
    '撤回訊息',
    '確定要撤回這條訊息嗎？撤回後對方將無法看到。',
    '撤回'
  )
  
  if (!confirmed) {
    return
  }
  
  try {
    // TODO: 調用撤回 API
    // await messageApi.recallMessage(conversationId.value, { messageId: message.id })
    console.log('Message recalled successfully')
    await refreshMessages()
  } catch (error) {
    console.error('Recall message failed:', error)
  }
}

const handleMessageSelect = (message: Message) => {
  console.log('Select message:', message.id)
  // 🎯 追蹤用戶選擇消息的互動
  updateActivityState('interaction')
  // TODO: 實現多選功能
}

// formatDate function removed as it's no longer used

function goBack() {
  router.push('/conversations')
}


// 🎯 智能輪詢函數
function startPolling() {
  if (pollingInterval.value) {
    clearTimeout(pollingInterval.value)
  }

  const poll = () => {
    // 檢查是否應該執行輪詢
    const shouldPoll = isPageVisible.value && 
                      conversation.value?.status !== 'closed' && 
                      !hasPermissionError.value
    
    if (shouldPoll) {
      loadMessages()
    }
    
    // 如果沒有權限錯誤，繼續輪詢
    if (!hasPermissionError.value) {
      // 重新計算當前的智能延遲
      pollingConfig.value.currentDelay = calculateSmartDelay()
      
      console.log(`🎯 [Smart Polling] Next poll in ${pollingConfig.value.currentDelay}ms`)
      pollingInterval.value = setTimeout(poll, pollingConfig.value.currentDelay)
    } else {
      console.log('🛑 [Smart Polling] Stopped due to permission error')
    }
  }

  // 初始輪詢使用基礎延遲
  pollingConfig.value.currentDelay = calculateSmartDelay()
  console.log(`🎯 [Smart Polling] Starting with delay: ${pollingConfig.value.currentDelay}ms`)
  pollingInterval.value = setTimeout(poll, pollingConfig.value.currentDelay)
}

// 🎯 頁面可見性處理與智能頻率調整
function handleVisibilityChange() {
  const wasVisible = isPageVisible.value
  isPageVisible.value = !document.hidden
  
  console.log(`👁️ [Smart Polling] Page visibility changed: ${wasVisible} → ${isPageVisible.value}`)
  
  if (isPageVisible.value && conversation.value?.status !== 'closed' && !hasPermissionError.value) {
    // 頁面變為可見時，更新活動狀態並立即刷新
    updateActivityState('user')
    loadMessages()
    startPolling()
  } else if (pollingInterval.value) {
    clearTimeout(pollingInterval.value)
    pollingInterval.value = null
  }
}

// 全局鍵盤快捷鍵處理
function handleGlobalKeydown(event: KeyboardEvent) {
  // 🎯 追蹤鍵盤活動
  updateActivityState('interaction')
  
  // 忽略在輸入框內的快捷鍵
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
    return
  }

  switch (event.key) {
    case '/':
      // 焦點到輸入框
      event.preventDefault()
      messageInputRef.value?.focus()
      break
      
    case 'r':
      // 刷新消息
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        refreshMessages()
      }
      break
      
    case 'Escape':
      // 返回列表
      event.preventDefault()
      goBack()
      break
      
    case 'Home':
      // 滾動到頂部
      if (virtualMessageListRef.value && typeof virtualMessageListRef.value.scrollToTop === 'function') {
        event.preventDefault()
        virtualMessageListRef.value.scrollToTop()
      }
      break
      
    case 'End':
      // 滾動到底部
      if (virtualMessageListRef.value) {
        event.preventDefault()
        scrollToBottom()
      }
      break
      
    case '?':
      // 顯示快捷鍵幫助
      event.preventDefault()
      keyboardShortcutsRef.value?.showShortcuts()
      break
      
    case 'f':
      // 搜索消息
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        messageSearchRef.value?.focus()
      }
      break
      
    case 'd':
      // 切换调试模式
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        debugMode.value = !debugMode.value
        console.log(`🐛 Debug mode ${debugMode.value ? 'enabled' : 'disabled'}`)
      }
      break
      
  }
}

// 🎯 統一的初始化處理函數
const initializeConversation = async (targetId: string) => {
  console.log(`🚀 [Initialize] Starting conversation initialization: ${targetId}`)
  
  try {
    // 重置初始載入標記
    isInitialLoad.value = true
    
    // 使用安全載入函數（防重入、錯誤處理已內建）
    await safeLoadConversation(targetId)
    
    console.log(`✅ [Initialize] Conversation ${targetId} initialized successfully`)
    
  } catch (error) {
    console.error(`❌ [Initialize] Failed to initialize conversation ${targetId}:`, error)
    // 错误时确保状态被重置
    isInitialLoad.value = false
  }
}

// Lifecycle - 只處理副作用，不處理業務邏輯
onMounted(() => {
  console.log('🔧 [Lifecycle] Component mounted, setting up side effects...')
  
  // 只處理事件監聽等副作用
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('keydown', handleGlobalKeydown)
  
  // 啟動輪詢機制
  startPolling()
  
  console.log('✅ [Lifecycle] Side effects initialized')
})

onUnmounted(() => {
  // Proper cleanup of intervals
  if (pollingInterval.value) {
    clearTimeout(pollingInterval.value)
    pollingInterval.value = null
  }
  if (typingTimeout.value) {
    clearTimeout(typingTimeout.value)
    typingTimeout.value = null
  }
  
  // Remove event listeners
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('keydown', handleGlobalKeydown)
})

// 移除重複的 watch 滾動邏輯，統一由 loadMessages 處理
// 這個 watch 已經不需要，因為滾動邏輯已經在 loadMessages 中使用 MutationObserver 處理

// 🛠️ TypeScript声明
declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    scrollDebug?: {
      forceScroll: () => void
      getScrollInfo: () => Record<string, unknown> | null
      performScroll: () => Promise<void>
    }
  }
}

// 🛠️ 开发环境调试工具
if (import.meta.env.DEV) {
  // 强制滚动到底部（调试用）
  const forceScrollToBottom = () => {
    console.log('🔧 [ForceScroll] Forcing scroll to bottom (Virtual)')
    
    if (!virtualMessageListRef.value) {
      console.error('Virtual message list ref not found')
      return
    }
    
    if (typeof virtualMessageListRef.value.scrollToBottom === 'function') {
      virtualMessageListRef.value.scrollToBottom(false)
      console.log('🔧 [ForceScroll] Virtual scroll executed')
    } else {
      console.error('scrollToBottom method not available')
    }
  }

  // 挂载到 window 供调试使用
  window.scrollDebug = {
    forceScroll: forceScrollToBottom,
    getScrollInfo: () => {
      return {
        virtualScrollPosition: virtualScrollPosition.value,
        isAtBottom: isUserAtBottom(),
        messages: smoothMessages.value.length,
        isInitialLoad: isInitialLoad.value,
        agentJustSentMessage: agentJustSentMessage.value,
        showNewMessageModal: showNewMessageModal.value,
        newMessageCount: newMessageCount.value
      }
    },
    performScroll: () => performInitialScrollWithDebounce()
  }
}

// 🎯 事件驅動的路由處理：所有數據載入的統一入口
watch(
  () => route.params.id,
  async (newId, oldId) => {
    // 確保有有效的對話ID
    if (!newId || typeof newId !== 'string') {
      console.warn('⚠️ [RouteWatch] Invalid conversation ID:', newId)
      return
    }
    
    console.log(`🔄 [RouteWatch] Route change detected: ${oldId || 'none'} → ${newId}`)
    
    try {
      // 如果是同一個對話，不需要重新載入
      if (newId === oldId) {
        console.log(`🔄 [RouteWatch] Same conversation, skipping reload: ${newId}`)
        return
      }
      
      // 清理舊的輪詢定時器（避免干擾）
      if (pollingInterval.value) {
        clearTimeout(pollingInterval.value)
        pollingInterval.value = null
        console.log('🛑 [RouteWatch] Cleared old polling interval')
      }
      
      // 🎯 重置智能輪詢狀態
      pollingConfig.value.currentDelay = pollingConfig.value.baseDelay
      activityState.value = {
        lastUserActivity: Date.now(),
        lastMessageReceived: Date.now(), 
        recentActivity: false,
        conversationActive: false,
        userInteracting: false
      }
      lastMessageCount.value = 0
      
      // ✨ 統一初始化：防重入、錯誤處理、狀態同步全部內建
      await initializeConversation(newId)
      
      // 重新啟動輪詢（針對新對話）
      startPolling()
      console.log('🔄 [RouteWatch] Polling restarted for new conversation')
      
    } catch (error) {
      console.error(`❌ [RouteWatch] Route change failed for conversation ${newId}:`, error)
      
      // 失敗時確保UI狀態正確
      setMessagesImmediate([])
      isInitialLoad.value = false
    }
  },
  { 
    immediate: true,  // 🚀 關鍵：組件掛載時也會觸發，無需onMounted處理業務邏輯
    flush: 'post'     // 確保DOM更新後再執行
  }
)
</script>

<style scoped>
.conversation-detail {
  height: calc(100vh - 48px); /* 減去AppLayout的padding */
  display: flex;
  flex-direction: column;
  background-color: var(--gray-50);
  overflow: hidden;
  margin: -24px; /* 抵消AppLayout的padding */
}

.conversation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  background-color: white;
  border-bottom: 1px solid var(--gray-200);
  box-shadow: var(--shadow-sm);
  flex: 0 0 auto; /* 固定高度，不伸縮 */
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
  flex: 0 0 auto; /* 固定高度，不伸縮 */
  background-color: var(--gray-50);
  padding: 0 var(--space-6);
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* 頂部bar中的統計資訊樣式 */
.message-indicator-topbar {
  margin-right: var(--space-4);
}

.message-indicator-topbar :deep(.message-stats) {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-3);
  display: flex;
  gap: var(--space-4);
}

.message-indicator-topbar :deep(.stat-item) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.message-indicator-topbar :deep(.stat-label) {
  font-size: 0.75rem;
  color: var(--blue-600);
  font-weight: 500;
  line-height: 1;
}

.message-indicator-topbar :deep(.stat-value) {
  font-size: 0.875rem;
  color: var(--blue-700);
  font-weight: 600;
  line-height: 1;
}

.messages-container {
  flex: 1; /* 占據所有剩餘空間 */
  overflow-y: auto;
  padding: var(--space-4) var(--space-6);
  background: linear-gradient(to bottom, var(--gray-50), var(--gray-100));
  display: flex;
  flex-direction: column;
  min-height: 0; /* 重要：確保flex子項可以正確滾動 */
}

.loading-wrapper,
.empty-state-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

/* 📜 優化的歷史消息載入指示器 */
.history-loading-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-4) 0;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(99, 102, 241, 0.05));
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(99, 102, 241, 0.15);
  animation: historyLoadingPulse 2s infinite ease-in-out;
  position: sticky;
  top: 0;
  z-index: 5;
}

.history-loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.history-spinner {
  color: var(--blue-600);
}

.history-loading-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--blue-700);
  letter-spacing: 0.3px;
}

.loading-progress-bar {
  width: 60px;
  height: 2px;
  background: rgba(99, 102, 241, 0.2);
  border-radius: 1px;
  overflow: hidden;
  position: relative;
}

.loading-progress-bar::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, var(--blue-600), transparent);
  animation: progressSlide 1.5s infinite;
}

@keyframes historyLoadingPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.02);
    opacity: 0.9;
  }
}

@keyframes progressSlide {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}


.messages {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  min-height: min-content;
  flex-shrink: 0;
}

.date-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: var(--space-6) 0;
}

.date-text {
  background-color: var(--gray-200);
  color: var(--gray-600);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  font-weight: 500;
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  max-width: 200px;
  padding: var(--space-3) var(--space-4);
  background-color: white;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--gray-200);
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  background-color: var(--gray-400);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

.typing-text {
  font-size: 0.75rem;
  color: var(--gray-500);
  font-style: italic;
}

@keyframes typing {

  0%,
  80%,
  100% {
    transform: scale(0.8);
    opacity: 0.5;
  }

  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.input-section {
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.8), rgba(255, 255, 255, 0.95));
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(226, 232, 240, 0.6);
  padding: 24px;
  flex: 0 0 auto; /* 固定高度，不伸縮 */
  max-height: 200px;
  overflow-y: auto;
}

.input-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.1), transparent);
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
  letter-spacing: 0.2px;
}

.quick-reply-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(59, 130, 246, 0.05));
  border-radius: 28px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.quick-reply-btn:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.25);
  color: #6366f1;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.15);
}

.quick-reply-btn:hover::before {
  opacity: 1;
}

.quick-reply-btn:active {
  transform: translateY(0) scale(0.98);
  transition: transform 0.1s ease;
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

.animate-spin {
  animation: spin 1s linear infinite;
}

.search-results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--blue-50);
  border: 1px solid var(--blue-200);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  font-size: 0.875rem;
  color: var(--blue-700);
}

.clear-search-btn {
  padding: var(--space-1) var(--space-2);
  background: var(--blue-100);
  border: 1px solid var(--blue-300);
  border-radius: var(--radius-sm);
  color: var(--blue-600);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.clear-search-btn:hover {
  background: var(--blue-200);
  border-color: var(--blue-400);
}

/* Responsive Design */
@media (max-width: 1024px) {
  .conversation-detail {
    margin: -24px; /* AppLayout padding is same on tablet */
  }

  .conversation-header {
    padding: var(--space-4) var(--space-3);
  }
  
  .message-search-container {
    padding: 0 var(--space-3);
  }

  .messages-container {
    padding: var(--space-3);
  }

  .input-section {
    padding: var(--space-4) var(--space-3);
    max-height: 160px;
  }
}

@media (max-width: 768px) {
  .conversation-detail {
    margin: -24px; /* Keep consistent margin */
  }

  .conversation-header {
    padding: var(--space-3) var(--space-2);
    flex-wrap: wrap;
  }

  /* 手機版頂部統計資訊樣式調整 */
  .message-indicator-topbar :deep(.message-stats) {
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
  }
  
  .message-indicator-topbar :deep(.stat-label) {
    font-size: 0.6875rem;
  }
  
  .message-indicator-topbar :deep(.stat-value) {
    font-size: 0.8125rem;
  }

  .header-left {
    gap: var(--space-3);
    flex: 1;
    min-width: 0;
  }

  .back-button {
    padding: var(--space-2);
    font-size: 0.875rem;
  }

  .customer-name {
    font-size: 1.125rem;
    line-height: 1.3;
  }

  .customer-avatar {
    width: 36px;
    height: 36px;
    font-size: 0.875rem;
  }

  .header-actions {
    flex-direction: row;
    gap: var(--space-2);
    flex-wrap: wrap;
    width: 100%;
    justify-content: flex-end;
  }

  .header-actions .btn {
    font-size: 0.75rem;
    padding: var(--space-2) var(--space-3);
    white-space: nowrap;
  }

  .message-search-container {
    padding: 0 var(--space-2);
  }

  .messages-container {
    padding: var(--space-2);
  }

  .messages {
    max-width: none;
  }

  .input-section {
    padding: 18px 16px;
    max-height: 140px;
  }

  .quick-replies {
    margin-top: 16px;
    gap: 8px;
    padding: 0 2px;
  }

  .quick-reply-btn {
    font-size: 13px;
    padding: 10px 16px;
    border-radius: 24px;
    letter-spacing: 0.1px;
  }

  /* 改善消息容器滾動 */
  .messages-container {
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }
  
}

@media (max-width: 640px) {
  .customer-details {
    gap: var(--space-3);
  }

  .customer-badges {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }

  .header-actions .btn {
    font-size: 0.75rem;
    padding: var(--space-2) var(--space-3);
  }

}

/* Clean Modern Minimalist 新消息提醒 */
.glassmorphism-notification {
  position: fixed;
  bottom: 200px; /* 固定距離底部的間距 */
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
  
  /* Clean Modern Glassmorphism */
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  
  /* Minimalist Transitions */
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

.notification-pulse svg {
  width: 18px;
  height: 18px;
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
  letter-spacing: 0;
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

.glass-dismiss:active {
  transform: scale(0.95);
}

.glass-dismiss svg {
  width: 14px;
  height: 14px;
}

/* Clean Modern Animations */
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

/* Responsive Design */
@media (max-width: 768px) {
  .glassmorphism-notification {
    bottom: 180px; /* 手機版固定間距 */
  }
  
  .glass-content {
    padding: 12px 16px;
    gap: 12px;
  }
  
  .notification-pulse {
    width: 28px;
    height: 28px;
  }
  
  .notification-pulse svg {
    width: 16px;
    height: 16px;
  }
  
  .message-count {
    font-size: 0.9375rem;
  }
  
  .message-label {
    font-size: 0.8125rem;
  }
  
  .glass-dismiss {
    width: 22px;
    height: 22px;
  }
  
  .glass-dismiss svg {
    width: 12px;
    height: 12px;
  }
}

/* 平滑載入動畫 */
.message-enter {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.message-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.message-fade-in {
  animation: messageFadeIn 0.4s ease-out forwards;
}

.message-leave {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.message-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.message-fade-out {
  animation: messageFadeOut 0.3s ease-in forwards;
}

@keyframes messageFadeIn {
  0% {
    opacity: 0;
    transform: translateY(15px) scale(0.98);
  }
  50% {
    opacity: 0.7;
    transform: translateY(5px) scale(0.99);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes messageFadeOut {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
}

/* 平滑更新過渡 */
.messages-container.updating {
  position: relative;
}

.messages-container.updating::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    180deg, 
    rgba(248, 250, 252, 0.3) 0%, 
    transparent 20%, 
    transparent 80%, 
    rgba(248, 250, 252, 0.3) 100%
  );
  pointer-events: none;
  z-index: 1;
  opacity: 0;
  animation: updateGlow 0.6s ease-in-out;
}

@keyframes updateGlow {
  0%, 100% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
}

/* Modern Minimalist Close Button */
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

.close-conversation-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.1), transparent);
  transition: left 0.5s;
}

.close-conversation-btn:hover::before {
  left: 100%;
}

.close-conversation-btn:hover {
  color: var(--danger-600);
  border-color: var(--danger-200);
  background-color: var(--danger-50);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
}

.close-conversation-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.1);
}

.close-conversation-btn:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
}

.close-conversation-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.close-conversation-btn:disabled:hover {
  color: var(--gray-700);
  border-color: var(--gray-200);
  background-color: transparent;
  transform: none;
  box-shadow: none;
}

.close-conversation-btn svg {
  width: 18px;
  height: 18px;
  transition: transform var(--transition-fast);
}

.close-conversation-btn:hover svg {
  transform: rotate(90deg);
}

.close-conversation-btn span {
  transition: opacity var(--transition-fast);
}

/* Loading state animation */
.close-conversation-btn:disabled span {
  opacity: 0.7;
}

@media (max-width: 768px) {
  .close-conversation-btn {
    padding: var(--space-2) var(--space-3);
    font-size: 0.8125rem;
  }
  
  .close-conversation-btn svg {
    width: 16px;
    height: 16px;
  }
}
</style>