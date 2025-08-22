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
                    :platform="conversation.platform"
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
            class="btn btn-danger"
            :disabled="closing"
            @click="closeConversation"
          >
            <XCircleIcon />
            {{ closing ? '結束中...' : '結束對話' }}
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
          v-else-if="messages.length === 0"
          title="暫無訊息"
          description="這個對話還沒有任何訊息"
        >
          <template #icon>
            <MessageCircleIcon />
          </template>
        </EmptyState>

        <div
          v-else
          class="messages"
        >
          <!-- Date Separator -->
          <div class="date-separator">
            <span class="date-text">{{ formatDate(new Date()) }}</span>
          </div>

          <!-- Messages -->
          <MessageBubble
            v-for="message in messages"
            :key="message.id"
            :message="message"
            :delivered="true"
          />

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
          :conversation-id="conversationId"
          :disabled="loading"
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
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth, useConversations, useMessages } from '@/composables'
import { conversationApi } from '@/api/conversations'
import { messageApi } from '@/api/message'
import { useConfirm } from '@/composables/useConfirm'
import AppLayout from '@/components/ui/AppLayout.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MessageBubble from '@/components/conversation/MessageBubble.vue'
import MessageInput from '@/components/conversation/MessageInput.vue'
import PlatformBadge from '@/components/ui/PlatformBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
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
const { getConversationById } = useConversations()
const { 
  messages, 
  loading: loadingMessages
} = useMessages()

// State
const conversation = computed(() => getConversationById(conversationId.value))
const loading = ref(false)
const assigning = ref(false)
const closing = ref(false)
const isTyping = ref(false)
const messagesContainer = ref<HTMLElement>()

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

// Methods
async function loadConversation() {
  try {
    const response = await conversationApi.get(conversationId.value)
    if (response.success && response.data) {
      // conversation.value = response.data // Read-only computed property
      // Mark as read if there are unread messages
      if (response.data.unreadCount && response.data.unreadCount > 0) {
        await markAsRead()
      }
    }
  } catch (error) {
    console.error('載入對話失敗:', error)
  }
}

async function loadMessages() {
  // loadingMessages.value = true // Read-only computed property
  try {
    const response = await messageApi.list(conversationId.value)
    if (response.success && response.data) {
      const newMessageCount = response.data.length
      const hasNewMessages = newMessageCount > lastMessageCount.value

      // messages.value = response.data // Will be handled by useMessages composable
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
    }
  } catch (error) {
    console.error('載入訊息失敗:', error)
    // Slow down polling on error
    pollingDelay.value = Math.min(15000, pollingDelay.value * 1.5)
  } finally {
    // loadingMessages.value = false // Read-only computed property
  }
}

async function refreshMessages() {
  await loadMessages()
}


async function assignToMe() {
  if (!currentAgent.value || assigning.value) {return}

  assigning.value = true
  try {
    await conversationApi.assign(conversationId.value, currentAgent.value.id)
    await loadConversation()
  } catch (error) {
    console.error('指派失敗:', error)
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
    await conversationApi.close(conversationId.value)
    router.push('/conversations')
  } catch (error) {
    console.error('關閉對話失敗:', error)
  } finally {
    closing.value = false
  }
}

async function markAsRead() {
  try {
    await conversationApi.markAsRead(conversationId.value)
    // conversation.value.unreadCount = 0 // Read-only computed property
  } catch (error) {
    console.error('標記已讀失敗:', error)
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function useQuickReply(text: string) {
  // Trigger message send through the MessageInput component
  // This would need to be implemented via a ref to MessageInput
  console.log('Quick reply:', text)
}

function formatDate(date: Date) {
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function goBack() {
  router.push('/conversations')
}

// Optimized polling function
function startPolling() {
  if (pollingInterval.value) {
    clearTimeout(pollingInterval.value)
  }

  const poll = () => {
    if (isPageVisible.value && conversation.value?.status !== 'closed') {
      loadMessages()
    }
    pollingInterval.value = setTimeout(poll, pollingDelay.value)
  }

  pollingInterval.value = setTimeout(poll, pollingDelay.value)
}

// Page visibility handling for better performance
function handleVisibilityChange() {
  isPageVisible.value = !document.hidden
  if (isPageVisible.value && conversation.value?.status !== 'closed') {
    // Refresh immediately when page becomes visible
    loadMessages()
    startPolling()
  } else if (pollingInterval.value) {
    clearTimeout(pollingInterval.value)
    pollingInterval.value = null
  }
}

// Lifecycle
onMounted(async () => {
  await loadConversation()
  await loadMessages()

  // Start optimized polling
  startPolling()

  // Listen for page visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange)
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
  document.removeEventListener('visibilitychange', handleVisibilityChange)
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

    // Reload data
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

/* Responsive Design */
@media (max-width: 768px) {
  .conversation-header {
    padding: var(--space-4);
  }

  .header-left {
    gap: var(--space-4);
  }

  .customer-name {
    font-size: 1.25rem;
  }

  .customer-avatar {
    width: 40px;
    height: 40px;
  }

  .header-actions {
    flex-direction: column;
    gap: var(--space-2);
  }

  .messages-container {
    padding: var(--space-4);
  }

  .input-section {
    padding: var(--space-4);
  }

  .quick-replies {
    margin-top: var(--space-3);
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
</style>