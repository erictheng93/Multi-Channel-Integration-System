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
          v-if="isDraggingFile && conversation?.status !== CONVERSATION_STATUS.CLOSED"
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
        v-if="conversation && conversation.status === CONVERSATION_STATUS.CLOSED"
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
      <!-- 🔧 FIX Phase 1: Removed Transition to eliminate FOUC (Flash of Unstyled Content) -->
      <!-- Using v-show instead of v-if to avoid transition animations that cause flickering -->
      <div class="messages-container-wrapper">
        <!-- 🎨 優化的加載狀態：動態骨架屏 with Progressive Loading -->
        <MessageListSkeleton
          v-show="isInitialLoading && !hasLoadedInitially"
          :count="skeletonCount"
          :loading-text="skeletonLoadingText"
          class="skeleton-layer"
        />

        <!-- Empty State -->
        <div
          v-show="hasLoadedInitially && displayedMessages.length === 0 && !isInitialLoading"
          class="empty-state-wrapper empty-layer"
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
          v-show="!isInitialLoading || hasLoadedInitially"
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
          class="messages-layer"
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
        v-if="conversation?.status !== CONVERSATION_STATUS.CLOSED"
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
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import type { Message } from '@/types'
import { CONVERSATION_STATUS } from '@/constants/conversation-status'

// 🚀 Refactored Composables
import { useConversationController } from '@/composables/conversation'

// Core components
import AppLayout from '@/components/ui/AppLayout.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MessageListSkeleton from '@/components/conversation/MessageListSkeleton.vue'
import VirtualMessageList from '@/components/conversation/VirtualMessageList.vue'
import MessageInput from '@/components/conversation/MessageInput.vue'
import ConversationHeader from '@/components/conversation/ConversationHeader.vue'
import { MessageCircleIcon, XCircleIcon } from '@/components/icons'

const MessageSearch = defineAsyncComponent(() => import('@/components/conversation/MessageSearch.vue'))
const KeyboardShortcuts = defineAsyncComponent(() => import('@/components/ui/KeyboardShortcuts.vue'))

const route = useRoute()
const router = useRouter()
const { showSuccess, showError } = useToast()
const { showConfirm } = useConfirm()
const conversationId = computed(() => route.params.id as string)

const isDevDebugMode = ref(false)
const initDebugMode = () => {
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('debug') === 'true') {
    isDevDebugMode.value = true
    return
  }
  try {
    isDevDebugMode.value = localStorage.getItem('devDebugMode') === 'true'
  } catch {
    isDevDebugMode.value = false
  }
}
initDebugMode()

const controller = useConversationController(conversationId.value, {
  enablePagination: true,
  pageSize: 30,
  enableProgressiveLoading: false
})

const {
  conversation, messages, displayedMessages, loading, skeletonCount, loadingText,
  isInitialLoading, hasLoadedInitially, loadingHistory, isUpdating, isSearchActive,
  setSearchResults, clearSearch, isWebSocketEnabled, isConnected, connectionState, connectionProtocol,
  connectionQuality, connectionText, connectionStatusClass, newMessageCount, isTyping, typingUsers,
  scrollToBottom, setScrollTarget,
  _internals
} = controller

// Extract httpMessages from controller internals for template usage
const httpMessages = _internals.state.httpMessages

const virtualMessageListRef = ref(null)
const messageInputRef = ref(null)
const messageSearchRef = ref(null)
const keyboardShortcutsRef = ref(null)
const showSearchPanel = ref(false)
const showNewMessageModal = ref(false)
const closing = ref(false)
const isDraggingFile = ref(false)
const dragCounter = ref(0)
const animationClasses = computed(() => ({}))
const quickReplies = ref([
  { id: '1', text: '感謝您的來信，我們會盡快回覆' },
  { id: '2', text: '請問還有其他需要協助的嗎？' },
  { id: '3', text: '謝謝您的耐心等待' },
  { id: '4', text: '問題已為您解決，如有其他疑問請隨時聯繫' }
])

onMounted(async () => {
  try {
    await controller.initialize()
    if (virtualMessageListRef.value) {
      const listRef = virtualMessageListRef.value as any
      setScrollTarget({
        scrollToBottom: () => listRef?.scrollToBottom?.()
      })
    }
  } catch (error) {
    console.error('Failed to initialize:', error)
    showError('無法載入對話，請重新整理頁面')
  }
})

onUnmounted(() => controller.cleanup())

function goBack() { router.push('/conversations') }

// Message event handlers (use controller methods directly)
const handleMessageSent = controller.onMessageSent
const handleMessagePending = controller.onMessagePending
const handleUploadProgress = controller.onUploadProgress
const handleMessageConfirmed = controller.onMessageConfirmed
const handleMessageFailed = controller.onMessageFailed
const handleTypingStart = controller.onTypingStart
const handleTypingStop = controller.onTypingStop

// Forward controller methods to match template bindings
const loadMoreMessages = controller.loadMoreMessages
const retryFailedMessage = controller.retryMessage

// Additional computed properties for template
const unifiedIsConnected = isConnected
const unifiedConnectionState = connectionState
const currentProtocol = connectionProtocol
const connectionStatusText = connectionText
const skeletonLoadingText = loadingText
const presence = computed(() => ({ typingUsers: typingUsers.value }))

// Close conversation with confirmation (matches template @close="closeConversation")
async function closeConversation() {
  const confirmed = await showConfirm({
    title: '確定要關閉這個對話嗎？',
    message: '關閉後將無法繼續發送訊息',
    confirmText: '關閉對話',
    cancelText: '取消'
  })
  if (!confirmed) {return}
  closing.value = true
  try {
    const success = await controller.closeConversation()
    success ? showSuccess('對話已關閉') : showError('關閉失敗')
  } finally {
    closing.value = false
  }
}

// Reopen conversation (matches template @click="reopenConversation")
async function reopenConversation() {
  const success = await controller.reopenConversation()
  success ? showSuccess('對話已重新打開') : showError('重新打開失敗')
}

async function handleRefreshMessages() {
  try {
    await controller.refreshMessages()
    showSuccess('訊息已刷新')
  } catch (_e) {
    showError('刷新失敗')
  }
}

function toggleSearch() {
  showSearchPanel.value = !showSearchPanel.value
  if (showSearchPanel.value) {
    nextTick(() => {
      const searchEl = messageSearchRef.value as any
      searchEl?.focus?.()
    })
  } else {
    handleSearchClear()
  }
}

function handleSearchResults(results: Message[]) { setSearchResults(results) }
function handleSearchClear() { clearSearch(); showSearchPanel.value = false }
function useQuickReply(text: string) {
  const inputEl = messageInputRef.value as any
  // 🔧 FIX: 使用正確的方法名 setMessageText (填充文本到輸入框)
  inputEl?.setMessageText?.(text)
  inputEl?.focus?.()
}
function handleVirtualScroll(scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
  const result = controller.onScroll(scrollInfo)
  if (result.isAtBottom) {showNewMessageModal.value = false}
}
function handleNewMessageWhileScrolled() { showNewMessageModal.value = true }
function scrollToNewest() { scrollToBottom(); showNewMessageModal.value = false }
function dismissNewMessageModal() { showNewMessageModal.value = false }

// Event handlers - these receive Message objects from VirtualMessageList
function handleMessageCopy(message: Message) {
  if (message) {
    navigator.clipboard.writeText(message.content)
    showSuccess('訊息已複製')
  }
}

function handleMessageReply(message: Message) {
  if (message && messageInputRef.value) {
    const inputEl = messageInputRef.value as any
    inputEl?.setReplyTo?.(message)
    inputEl?.focus?.()
  }
}

function handleMessageForward(message: Message) {
  console.log('Forward message:', message.id)
  showSuccess('轉發功能開發中')
}

async function handleMessageRecall(message: Message) {
  const confirmed = await showConfirm({
    title: '確定要撤回這則訊息嗎？',
    confirmText: '撤回',
    cancelText: '取消'
  })
  if (!confirmed) {return}
  const success = await controller.recallMessage(message.id)
  success ? showSuccess('訊息已撤回') : showError('撤回失敗')
}

function handleMessageSelect(message: Message) {
  console.log('Select message:', message.id)
}

function handleAttachmentUpload(attachment: unknown) {
  console.log('Attachment upload:', attachment)
}

function handleDragEnter(event: DragEvent) {
  event.preventDefault(); event.stopPropagation()
  if (event.dataTransfer?.types.includes('Files')) {
    dragCounter.value++
    isDraggingFile.value = true
  }
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault(); event.stopPropagation()
  dragCounter.value--
  if (dragCounter.value <= 0) {
    dragCounter.value = 0
    isDraggingFile.value = false
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault(); event.stopPropagation()
  if (event.dataTransfer) {event.dataTransfer.dropEffect = 'copy'}
}

function handleDrop(event: DragEvent) {
  event.preventDefault(); event.stopPropagation()
  isDraggingFile.value = false
  dragCounter.value = 0
  const files = Array.from(event.dataTransfer?.files || [])
  if (files.length > 0 && messageInputRef.value) {
    const inputEl = messageInputRef.value as any
    inputEl?.handleFilesDropped?.(files)
  }
}
</script>

<style scoped>
/* ====== Minimal, Spacious Design System ====== */
.conversation-detail {
  position: relative; /* 📎 Required for drag-drop overlay positioning */
  height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  /* 🎨 旧背景已移除 - 现在使用新的多层次背景系统 (conversation-background.css) */
  /* background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); */
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

/* 🔧 FIX Phase 1: Removed fade-content transition to eliminate flickering */
/* Old transition code removed - no more 150ms animation delay */

.messages-container-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
  contain: layout style paint;
  /* 🔧 FIX Phase 1: Removed will-change to reduce GPU overhead */
  padding: 0 1rem;
  /* 🔧 FIX Phase 1: All child layers use absolute positioning for instant switching */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 🔧 FIX Phase 1: Layer system for instant content switching (no transition) */
.messages-container-wrapper > .skeleton-layer,
.messages-container-wrapper > .empty-layer,
.messages-container-wrapper > .messages-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0 1rem;
  /* ✅ No transition - instant visibility toggle */
  transition: none;
}

/* Ensure layers take full space */
.messages-container-wrapper > .skeleton-layer,
.messages-container-wrapper > .messages-layer {
  display: flex;
  flex-direction: column;
}

.empty-state-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.input-section {
  /* 🎨 旧背景和效果已移除 - 现在使用新的高级毛玻璃效果 (conversation-background.css) */
  /* background: rgba(255, 255, 255, 0.95); */
  /* backdrop-filter: blur(20px); */
  /* border-top: none; */
  /* box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.03); */
  padding: 1rem 1.5rem 1.5rem;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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