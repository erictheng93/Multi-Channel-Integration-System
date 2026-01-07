<template>
  <AppLayout>
    <div
      class="conversation-detail"
      @dragenter="dragDrop.onDragEnter"
      @dragleave="dragDrop.onDragLeave"
      @dragover="dragDrop.onDragOver"
      @drop="dragDrop.onDrop"
    >
      <!-- 📎 Drag-and-Drop Overlay Component -->
      <DragDropOverlay
        :is-visible="dragDrop.isDragging.value && conversation?.status !== CONVERSATION_STATUS.CLOSED"
      />

      <!-- Simplified Header Component -->
      <ConversationHeader
        :conversation="conversation"
        :loading="loading"
        :closing="conversationActions.isClosing.value"
        @back="goBack"
        @close="conversationActions.close"
        @refresh="handleRefreshMessages"
        @search="searchPanel.toggle"
      />

      <!-- 🆕 Closed Conversation Banner Component -->
      <ClosedConversationBanner
        :is-visible="conversation?.status === CONVERSATION_STATUS.CLOSED"
        :loading="conversationActions.isClosing.value"
        @reopen="conversationActions.reopen"
      />

      <!-- Enhanced Search Panel (toggleable from header) -->
      <Transition name="search-slide">
        <div
          v-if="searchPanel.isOpen.value"
          class="message-search-panel"
        >
          <Suspense>
            <MessageSearch
              ref="searchPanel.searchRef.value"
              :messages="messages"
              :auto-expand="true"
              @search-results="searchPanel.handleSearchResults"
              @search-clear="searchPanel.handleSearchClear"
            />
          </Suspense>
        </div>
      </Transition>

      <!-- High Performance Virtual Message List with WebSocket -->
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
          @search-clear="searchPanel.handleSearchClear"
          @load-more="loadMoreMessages"
          @scroll="handleVirtualScroll"
          @new-message-while-scrolled="notification.show"
          @retry="retryFailedMessage"
        />
      </div>

      <!-- 新消息提醒 Component with WebSocket enhancements -->
      <NewMessageNotification
        :is-visible="notification.isVisible.value"
        :count="newMessageCount ?? 0"
        :is-realtime="currentProtocol === 'websocket'"
        @click="notification.scrollToNewest"
        @dismiss="notification.dismiss"
      />

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

        <!-- Quick Replies Component -->
        <QuickReplies
          :replies="quickRepliesComposable.filteredReplies.value"
          @select="handleQuickReplySelect"
        />

        <!-- 🌐 Connection Status Bar Component - 僅在調試模式下顯示 -->
        <ConnectionStatusBar
          :is-visible="isDevDebugMode && (unifiedIsConnected || unifiedConnectionState === 'error' || isWebSocketEnabled)"
          :status-text="connectionStatusText"
          :status-class="statusBarClass"
          :reconnect-attempts="0"
          :typing-users="presence.typingUsers.length"
        />
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
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import type { Message } from '@/types'
import { CONVERSATION_STATUS } from '@/constants/conversation-status'

// Component instance types
interface VirtualMessageListInstance {
  scrollToBottom?: () => void
}

interface MessageInputInstance {
  setMessageText?: (_text: string) => void
  setReplyTo?: (_message: Message) => void
  handleFilesDropped?: (_files: File[]) => void
  focus?: () => void
}

// 🚀 Refactored Composables
import { useConversationController } from '@/composables/conversation'
import { useSearchPanel } from '@/composables/useSearchPanel'
import { useConversationActions } from '@/composables/useConversationActions'
import { useNewMessageNotification } from '@/composables/useNewMessageNotification'
import { useDragAndDrop } from '@/composables/useDragAndDrop'
import { useQuickReplies } from '@/composables/useQuickReplies'
import type { QuickReply } from '@/composables/useQuickReplies'

// Core components
import AppLayout from '@/components/ui/AppLayout.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MessageListSkeleton from '@/components/conversation/MessageListSkeleton.vue'
import VirtualMessageList from '@/components/conversation/VirtualMessageList.vue'
import MessageInput from '@/components/conversation/MessageInput.vue'
import ConversationHeader from '@/components/conversation/ConversationHeader.vue'
import { MessageCircleIcon, XCircleIcon } from '@/components/icons'

// Extracted sub-components
import {
  DragDropOverlay,
  ClosedConversationBanner,
  NewMessageNotification,
  QuickReplies,
  ConnectionStatusBar,
} from '@/components/conversation'

const MessageSearch = defineAsyncComponent(() => import('@/components/conversation/MessageSearch.vue'))
const KeyboardShortcuts = defineAsyncComponent(() => import('@/components/ui/KeyboardShortcuts.vue'))

const route = useRoute()
const router = useRouter()
const { showSuccess, showError } = useToast()
const { showConfirm } = useConfirm()
const conversationId = computed(() => route.params.id as string)

// Debug mode
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

// Controller
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

// Extract httpMessages from controller internals
const httpMessages = _internals.state.httpMessages

// Component refs
const virtualMessageListRef = ref<VirtualMessageListInstance | null>(null)
const messageInputRef = ref<MessageInputInstance | null>(null)
const keyboardShortcutsRef = ref(null)
const animationClasses = computed(() => ({}))

// 🎯 Composable integrations
const searchPanel = useSearchPanel({
  onSearchResults: (results: Message[]) => setSearchResults(results),
  onSearchClear: () => {
    clearSearch()
  },
  autoFocus: true,
})

const conversationActions = useConversationActions(controller, {
  confirmBeforeClose: true,
  toastMessages: {
    closeSuccess: '對話已關閉',
    closeError: '關閉失敗',
    reopenSuccess: '對話已重新打開',
    reopenError: '重新打開失敗',
  },
})

const notification = useNewMessageNotification({
  scrollToBottom,
  newMessageCount: computed(() => newMessageCount.value),
  autoHide: true,
  autoHideDelay: 300,
})

const dragDrop = useDragAndDrop({
  onFilesDropped: (files: File[]) => {
    if (messageInputRef.value) {
      messageInputRef.value.handleFilesDropped?.(files)
    }
  },
  maxFiles: 10,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  onError: (message: string) => {
    showError(message)
  },
})

const quickRepliesComposable = useQuickReplies({
  initialReplies: [
    { id: '1', text: '感謝您的來信，我們會盡快回覆' },
    { id: '2', text: '請問還有其他需要協助的嗎？' },
    { id: '3', text: '謝謝您的耐心等待' },
    { id: '4', text: '問題已為您解決，如有其他疑問請隨時聯繫' },
  ],
})

// Additional computed properties for template
const unifiedIsConnected = isConnected
const unifiedConnectionState = connectionState
const currentProtocol = connectionProtocol
const connectionStatusText = connectionText
const skeletonLoadingText = loadingText
const presence = computed(() => ({ typingUsers: typingUsers.value }))

// Map controller status class to ConnectionStatusBar expected type
const statusBarClass = computed((): 'connected' | 'connecting' | 'disconnected' | 'error' => {
  const status = connectionStatusClass.value
  if (status.includes('status-connected')) {return 'connected'}
  if (status.includes('status-connecting')) {return 'connecting'}
  if (status.includes('status-error')) {return 'error'}
  return 'disconnected'
})

// Lifecycle
onMounted(async () => {
  try {
    await controller.initialize()
    if (virtualMessageListRef.value) {
      setScrollTarget({
        scrollToBottom: () => virtualMessageListRef.value?.scrollToBottom?.()
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

async function handleRefreshMessages() {
  try {
    await controller.refreshMessages()
    showSuccess('訊息已刷新')
  } catch (_e) {
    showError('刷新失敗')
  }
}

function handleQuickReplySelect(reply: QuickReply) {
  messageInputRef.value?.setMessageText?.(reply.text)
  messageInputRef.value?.focus?.()
}

function handleVirtualScroll(scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
  const result = controller.onScroll(scrollInfo)
  if (result.isAtBottom) {
    notification.hide()
  }
}

// Event handlers - these receive Message objects from VirtualMessageList
function handleMessageCopy(message: Message) {
  if (message) {
    navigator.clipboard.writeText(message.content)
    showSuccess('訊息已複製')
  }
}

function handleMessageReply(message: Message) {
  if (message && messageInputRef.value) {
    messageInputRef.value.setReplyTo?.(message)
    messageInputRef.value.focus?.()
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
</script>

<style scoped>
/* ====== Minimal, Spacious Design System ====== */
.conversation-detail {
  position: relative;
  height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: -24px;
}

/* 🆕 Closed Conversation Banner Styles */
.top-bar-stats-container {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.websocket-status-topbar {
  font-size: 0.75rem;
}

/* Enhanced Search Panel */
.message-search-panel {
  position: relative;
  z-index: 10;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  overflow: hidden;
}

.search-slide-enter-active,
.search-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-slide-enter-from,
.search-slide-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

.search-slide-enter-to,
.search-slide-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* 🎨 Multi-Layer Messages Container with Progressive Loading */
.messages-container-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.skeleton-layer,
.empty-layer,
.messages-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.skeleton-layer {
  z-index: 30;
}

.empty-layer {
  z-index: 20;
}

.messages-layer {
  z-index: 10;
}

.empty-state-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* Input Section Styles */
.input-section {
  flex-shrink: 0;
  background: white;
  border-top: 1px solid #e5e7eb;
  padding: 12px;
}

/* Closed State */
.closed-state {
  flex-shrink: 0;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.closed-message {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
}

.closed-message svg {
  width: 20px;
  height: 20px;
  color: #ef4444;
}

/* Responsive */
@media (max-width: 768px) {
  .conversation-detail {
    margin: -16px;
  }

  .input-section {
    padding: 8px;
  }

  .closed-state {
    padding: 16px;
  }
}
</style>
