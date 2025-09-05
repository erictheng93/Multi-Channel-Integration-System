<template>
  <AppLayout>
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
          <button
            v-if="conversation?.status === 'open'"
            class="btn btn-primary"
            :disabled="assigning"
            @click="assignToMe"
          >
            <UserPlusIcon />
            {{ assigning ? '指派中...' : '指派給我' }}
          </button>

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
            :disabled="loadingMessages"
            @click="refreshMessages"
          >
            <RefreshIcon :spinning="loadingMessages" />
          </button>
        </div>
      </div>

      <!-- Message Search -->
      <MessageSearch
        ref="messageSearchRef"
        :messages="messages"
        @search-results="handleSearchResults"
        @search-clear="handleSearchClear"
      />

      <!-- Messages Container -->
      <div
        ref="messagesContainer"
        class="messages-container"
      >
        <LoadingSpinner
          v-if="loadingMessages && messages.length === 0"
          size="lg"
          text="載入訊息中..."
        />

        <EmptyState
          v-else-if="displayedMessages.length === 0"
          :title="isSearchActive ? '未找到匹配的訊息' : '暫無訊息'"
          :description="isSearchActive ? '嘗試調整搜索條件' : '這個對話還沒有任何訊息'"
        >
          <template #icon>
            <MessageCircleIcon />
          </template>
        </EmptyState>

        <div
          v-else
          class="messages"
        >
          <!-- Search Results Header -->
          <div
            v-if="isSearchActive"
            class="search-results-header"
          >
            <span>搜索結果 ({{ displayedMessages.length }})</span>
            <button
              class="clear-search-btn"
              @click="handleSearchClear"
            >
              清除搜索
            </button>
          </div>

          <!-- Messages with Date Separators -->
          <template v-if="!isSearchActive">
            <template
              v-for="group in groupedMessages"
              :key="group.date"
            >
              <DateSeparator :date="group.date" />
              <MessageBubble
                v-for="message in group.messages"
                :key="message.id"
                :message="message"
                :delivered="true"
                @copy="handleMessageCopy"
                @reply="handleMessageReply"
                @forward="handleMessageForward"
                @recall="handleMessageRecall"
                @select="handleMessageSelect"
              />
            </template>
          </template>

          <!-- Search Results (no date grouping) -->
          <template v-else>
            <MessageBubble
              v-for="message in displayedMessages"
              :key="message.id"
              :message="message"
              :delivered="true"
              @copy="handleMessageCopy"
              @reply="handleMessageReply"
              @forward="handleMessageForward"
              @recall="handleMessageRecall"
              @select="handleMessageSelect"
            />
          </template>

          <!-- Typing Indicator -->
          <div
            v-if="isTyping"
            class="typing-indicator"
          >
            <div class="typing-dots">
              <span />
              <span />
              <span />
            </div>
            <span class="typing-text">對方正在輸入...</span>
          </div>
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
import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth, useMessages } from '@/composables'
import { useConversationsStore } from '@/stores/conversations'
import { useConfirm } from '@/composables/useConfirm'
import type { Message } from '@/types'
import AppLayout from '@/components/ui/AppLayout.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MessageBubble from '@/components/conversation/MessageBubble.vue'
import MessageInput from '@/components/conversation/MessageInput.vue'
import MessageSearch from '@/components/conversation/MessageSearch.vue'
import DateSeparator from '@/components/conversation/DateSeparator.vue'
import PlatformBadge from '@/components/ui/PlatformBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import KeyboardShortcuts from '@/components/ui/KeyboardShortcuts.vue'
import {
  ArrowLeftIcon,
  UserPlusIcon,
  XCircleIcon,
  RefreshIcon,
  MessageCircleIcon
} from '@/components/icons'

const route = useRoute()
const router = useRouter()
const { currentAgent } = useAuth()
const conversationsStore = useConversationsStore()
const { 
  messages, 
  loading: loadingMessages,
  fetchMessages,
  refreshMessages,
  setConversationId
} = useMessages()

// State
const conversation = computed(() => conversationsStore.currentConversation)
const assigning = ref(false)

const closing = ref(false)
const isTyping = ref(false)
const messagesContainer = ref<HTMLElement>()
const messageInputRef = ref()
const keyboardShortcutsRef = ref()
const messageSearchRef = ref()

// 搜索狀態
const searchResults = ref<Message[]>([])
const isSearchActive = ref(false)

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
  return isSearchActive.value ? searchResults.value : messages.value
})

// Group messages by date
const groupedMessages = computed(() => {
  if (messages.value.length === 0) return []
  
  const groups: Array<{ date: string; messages: Message[] }> = []
  let currentGroup: { date: string; messages: Message[] } | null = null
  
  messages.value.forEach(message => {
    const messageDate = getMessageDate(message)
    const dateKey = formatDateKey(messageDate)
    
    if (!currentGroup || currentGroup.date !== dateKey) {
      currentGroup = {
        date: dateKey,
        messages: []
      }
      groups.push(currentGroup)
    }
    
    currentGroup.messages.push(message)
  })
  
  return groups
})

// Helper functions for date grouping
function getMessageDate(message: Message): Date {
  const timestamp = message.timestamp || message.createdAt || new Date()
  return typeof timestamp === 'number' ? new Date(timestamp) : 
         typeof timestamp === 'string' ? new Date(timestamp) : timestamp
}

function formatDateKey(date: Date): string {
  return date.toDateString() // Returns format like "Mon Jan 15 2024"
}

// Message handlers
const handleMessageSent = async (_data: { content: string; attachments: unknown[] }) => {
  // Refresh messages to get the latest
  await loadMessages()
  
  // Update conversation's last message
  if (conversation.value) {
    const lastMessage = messages.value[messages.value.length - 1]
    if (lastMessage) {
      conversation.value.lastMessage = lastMessage
    }
  }

  // Scroll to bottom
  await nextTick()
  scrollToBottom()
}

const handleAttachmentUpload = (attachment: unknown) => {
  // Handle attachment upload event if needed
  console.log('Attachment uploaded:', attachment)
}

// Optimized polling with exponential backoff - using ref for proper cleanup
const pollingInterval = ref<NodeJS.Timeout | null>(null)
const typingTimeout = ref<NodeJS.Timeout | null>(null)
const pollingDelay = ref(3000) // Start with 3 seconds
const lastMessageCount = ref(0)
const isPageVisible = ref(true)
const hasPermissionError = ref(false)

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

async function loadMessages() {
  try {
    const previousMessageCount = messages.value.length
    await fetchMessages()
    
    // Reset permission error flag on successful fetch
    hasPermissionError.value = false
    
    const newMessageCount = messages.value.length
    const hasNewMessages = newMessageCount > previousMessageCount
    lastMessageCount.value = newMessageCount

    // Adjust polling frequency based on activity
    if (hasNewMessages) {
      pollingDelay.value = Math.max(2000, pollingDelay.value * 0.8) // Speed up if active
    } else {
      pollingDelay.value = Math.min(10000, pollingDelay.value * 1.2) // Slow down if inactive
    }

    await nextTick()
    if (hasNewMessages) {
      scrollToBottom()
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
    
    // Slow down polling on other errors
    pollingDelay.value = Math.min(15000, pollingDelay.value * 1.5)
  }
}



async function assignToMe() {
  if (!currentAgent.value || assigning.value) {return}

  assigning.value = true
  try {
    console.log('🔄 [ConversationDetail] Assigning conversation to me:', currentAgent.value.id)
    await conversationsStore.assignConversation(conversationId.value, currentAgent.value.id)
    console.log('✅ [ConversationDetail] Conversation assigned successfully')
  } catch (error) {
    console.error('❌ [ConversationDetail] Assignment failed:', error)
  } finally {
    assigning.value = false
  }
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

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

async function useQuickReply(text: string) {
  if (!messageInputRef.value || !text.trim()) {return}
  
  try {
    const success = await messageInputRef.value.sendQuickMessage(text)
    if (!success) {
      console.error('Failed to send quick reply')
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
  // TODO: 可以添加成功提示
}

const handleMessageReply = (message: Message) => {
  console.log('Reply to message:', message.content)
  // 設置回覆的訊息內容到輸入框
  if (messageInputRef.value) {
    const replyText = `回覆: ${message.content}\n\n`
    messageInputRef.value.sendQuickMessage(replyText)
  }
}

const handleMessageForward = (message: Message) => {
  console.log('Forward message:', message.content)
  // TODO: 實現轉發功能 - 可能需要打開對話選擇器
}

const handleMessageRecall = async (message: Message) => {
  console.log('Recall message:', message.id)
  
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
  // TODO: 實現多選功能
}

// formatDate function removed as it's no longer used

function goBack() {
  router.push('/conversations')
}

// Optimized polling function
function startPolling() {
  if (pollingInterval.value) {
    clearTimeout(pollingInterval.value)
  }

  const poll = () => {
    if (isPageVisible.value && conversation.value?.status !== 'closed' && !hasPermissionError.value) {
      loadMessages()
    }
    if (!hasPermissionError.value) {
      pollingInterval.value = setTimeout(poll, pollingDelay.value)
    }
  }

  pollingInterval.value = setTimeout(poll, pollingDelay.value)
}

// Page visibility handling for better performance
function handleVisibilityChange() {
  isPageVisible.value = !document.hidden
  if (isPageVisible.value && conversation.value?.status !== 'closed' && !hasPermissionError.value) {
    // Refresh immediately when page becomes visible
    loadMessages()
    startPolling()
  } else if (pollingInterval.value) {
    clearTimeout(pollingInterval.value)
    pollingInterval.value = null
  }
}

// 全局鍵盤快捷鍵處理
function handleGlobalKeydown(event: KeyboardEvent) {
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
      if (messagesContainer.value) {
        event.preventDefault()
        messagesContainer.value.scrollTop = 0
      }
      break
      
    case 'End':
      // 滾動到底部
      if (messagesContainer.value) {
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
  }
}

// Lifecycle
onMounted(async () => {
  // Set conversation ID first
  await setConversationId(conversationId.value)
  await loadConversation()
  await loadMessages()

  // Start optimized polling
  startPolling()

  // Listen for page visibility changes and global keyboard shortcuts
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('keydown', handleGlobalKeydown)
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

// Watch route changes
watch(() => route.params.id, async (newId, oldId) => {
  if (newId && newId !== oldId) {
    // Clear old polling interval
    if (pollingInterval.value) {
      clearTimeout(pollingInterval.value)
      pollingInterval.value = null
    }

    // Reset polling state
    pollingDelay.value = 3000
    lastMessageCount.value = 0

    // Set new conversation ID and reload data
    await setConversationId(newId as string)
    await loadConversation()
    await loadMessages()

    // Input reset will be handled by MessageInput component

    // Setup new optimized polling
    startPolling()
  }
})
</script>

<style scoped>
.conversation-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--gray-50);
}

.conversation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-6);
  background-color: white;
  border-bottom: 1px solid var(--gray-200);
  box-shadow: var(--shadow-sm);
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

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  background: linear-gradient(to bottom, var(--gray-50), var(--gray-100));
}

.messages {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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
  background-color: white;
  border-top: 1px solid var(--gray-200);
  padding: var(--space-6);
}


.quick-replies {
  max-width: 800px;
  margin: var(--space-4) auto 0;
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.quick-reply-btn {
  padding: var(--space-2) var(--space-3);
  background-color: var(--gray-100);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  color: var(--gray-700);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.quick-reply-btn:hover {
  background-color: var(--primary-50);
  border-color: var(--primary-300);
  color: var(--primary-700);
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
  .conversation-header {
    padding: var(--space-4) var(--space-3);
  }

  .messages-container {
    padding: var(--space-4) var(--space-3);
  }

  .input-section {
    padding: var(--space-4) var(--space-3);
  }
}

@media (max-width: 768px) {
  .conversation-header {
    padding: var(--space-3) var(--space-2);
    flex-wrap: wrap;
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

  .messages-container {
    padding: var(--space-3) var(--space-2);
  }

  .messages {
    max-width: none;
  }

  .input-section {
    padding: var(--space-3) var(--space-2);
  }

  .quick-replies {
    margin-top: var(--space-3);
    gap: var(--space-1);
  }

  .quick-reply-btn {
    font-size: 0.75rem;
    padding: var(--space-1) var(--space-2);
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