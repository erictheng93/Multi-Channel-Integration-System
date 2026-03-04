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
        :is-visible="dragDrop.isDragging.value"
      />

      <!-- Simplified Header Component -->
      <ConversationHeader
        :conversation="conversation"
        :loading="loading"
        @back="goBack"
        @refresh="handleRefreshMessages"
        @search="searchPanel.toggle"
        @export="showExportDialog = true"
      />

      <!-- 🆕 Transferred Conversation Banner Component -->
      <TransferredConversationBanner
        :is-visible="isCurrentConversationTransferred"
        :team-name="transferredConversation?.toTeamName"
        :transferred-at="transferredConversation?.transferredAt"
        @back="handleTransferredBack"
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
        <!-- 🔧 FIX: 骨架屏保持顯示直到滾動完成，確保平滑過渡 -->
        <MessageListSkeleton
          v-show="!isScrollReady"
          :count="skeletonCount"
          :loading-text="skeletonLoadingText"
          class="skeleton-layer"
        />

        <!-- Empty State -->
        <!-- 🔧 FIX: 增加 isEmptyStateConfirmed 條件，避免訊息同步期間閃爍 -->
        <div
          v-show="hasLoadedInitially && displayedMessages.length === 0 && !isInitialLoading && isEmptyStateConfirmed"
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
        <!-- 🔧 FIX Phase 2: 使用 CSS visibility 而非 v-show -->
        <!-- v-show 會導致 display:none，使 scrollHeight=0，滾動失敗 -->
        <!-- visibility:hidden 保留佈局，scrollHeight 正常，滾動可以正確執行 -->
        <VirtualMessageList
          ref="virtualMessageListRef"
          :class="{ 'invisible-until-ready': !isScrollReady }"
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
          @initial-scroll-complete="handleInitialScrollComplete"
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
      <!-- 🆕 UX: Hide input when conversation is transferred to non-member team -->
      <div
        v-if="!isCurrentConversationTransferred"
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

      <!-- Transferred State - Show when conversation is transferred -->


      <!-- 🆕 Transferred State - Input disabled with informative message -->
      <div
        v-else-if="isCurrentConversationTransferred"
        class="transferred-state"
      >
        <div class="transferred-input-message">
          <svg
            class="transferred-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line
              x1="5"
              y1="12"
              x2="19"
              y2="12"
            />
            <polyline points="12 5 19 12 12 19" />
          </svg>
          <span>此對話已轉移至其他團隊，您無法再發送訊息</span>
        </div>
      </div>
    </div>

    <!-- Lazy loaded keyboard shortcuts -->
    <Suspense>
      <KeyboardShortcuts ref="keyboardShortcutsRef" />
    </Suspense>

    <!-- 匯出對話記錄對話框 -->
    <ExportDialog
      :show="showExportDialog"
      :conversation-id="conversationId"
      :conversation-title="conversation?.customer?.name || '對話記錄'"
      @close="showExportDialog = false"
      @update:show="showExportDialog = $event"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useToast } from '@/composables/useToast'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import type { Message } from '@/types'


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
import ExportDialog from '@/components/conversation/ExportDialog.vue'
import { MessageCircleIcon } from '@/components/icons'

// Extracted sub-components
import {
  DragDropOverlay,
  TransferredConversationBanner,
  NewMessageNotification,
  QuickReplies,
  ConnectionStatusBar,
} from '@/components/conversation'

// Store for transferred conversation state
import { useConversationsStore } from '@/stores/conversations'

const MessageSearch = defineAsyncComponent(() => import('@/components/conversation/MessageSearch.vue'))
const KeyboardShortcuts = defineAsyncComponent(() => import('@/components/ui/KeyboardShortcuts.vue'))

const route = useRoute()
const router = useRouter()
const { showSuccess, showError } = useToast()
const { showConfirm } = useConfirmDialog()
const conversationId = computed(() => route.params.id as string)

// Export dialog state
const showExportDialog = ref(false)

// 🆕 Transferred conversation state from store
// 🔧 FIX: 使用 storeToRefs 保持 ref 的響應性，避免解構後失去追蹤
const conversationsStore = useConversationsStore()
const { transferredConversation } = storeToRefs(conversationsStore)
const { clearTransferredState, initializeRealtime } = conversationsStore

// Check if current conversation is transferred
// 🔧 FIX: 現在 transferredConversation 是響應式的 ref，需要使用 .value
const isCurrentConversationTransferred = computed(() => {
  return transferredConversation.value?.conversationId === conversationId.value
})

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

// 🔧 FIX: 滾動就緒狀態 - 解決 Race Condition 導致的畫面跳動問題
// 只有在初始滾動完成後才顯示訊息列表，避免用戶看到從頂部跳到底部的過程
const isScrollReady = ref(false)

// 🎯 Composable integrations
const searchPanel = useSearchPanel({
  onSearchResults: (results: Message[]) => setSearchResults(results),
  onSearchClear: () => {
    clearSearch()
  },
  autoFocus: true,
})

// Note: Close/reopen conversation actions removed - status cleanup

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

// 🔧 FIX: 延遲確認空狀態，避免閃爍
// 問題：訊息同步期間，displayedMessages 暫時為空會導致閃爍顯示「暫無訊息」
// 解決：延遲 200ms 確認空狀態，給訊息同步時間
const isEmptyStateConfirmed = ref(false)
let emptyStateTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => ({ length: displayedMessages.value.length, loaded: hasLoadedInitially.value }),
  ({ length, loaded }) => {
    if (emptyStateTimer) {
      clearTimeout(emptyStateTimer)
      emptyStateTimer = null
    }

    if (length === 0 && loaded) {
      // 延遲 200ms 確認空狀態，給訊息同步時間
      emptyStateTimer = setTimeout(() => {
        isEmptyStateConfirmed.value = true
        // 🔧 FIX: 空狀態確認後也需要設置 isScrollReady，讓空狀態顯示出來
        isScrollReady.value = true
        console.log('✅ [ConversationDetail] Empty state confirmed, setting isScrollReady=true')
      }, 200)
    } else {
      isEmptyStateConfirmed.value = false
    }
  },
  { immediate: true }
)

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
    // 🆕 FIX: 初始化 ConversationsStore 的實時同步
    // 確保在對話詳情頁也能接收到轉移事件並更新 currentConversation
    await initializeRealtime()

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

onUnmounted(() => {
  controller.cleanup()
  // 🔧 FIX: 清理空狀態計時器
  if (emptyStateTimer) {
    clearTimeout(emptyStateTimer)
    emptyStateTimer = null
  }
  // 🔧 FIX: 重置滾動就緒狀態
  isScrollReady.value = false
  // 🆕 清理轉移狀態
  clearTransferredState()
})

function goBack() { router.push('/conversations') }

// 🆕 Handler for transferred conversation - clear state and navigate back
function handleTransferredBack() {
  clearTransferredState()
  goBack()
}

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

/**
 * 🔧 FIX: 處理初始滾動完成事件
 * 當 VirtualMessageList 完成初始滾動到底部後，設置 isScrollReady = true
 * 這確保用戶看到的是已經滾動到底部的訊息列表，而不是從頂部跳到底部
 */
function handleInitialScrollComplete() {
  console.log('✅ [ConversationDetail] Initial scroll complete, showing message list')
  isScrollReady.value = true
}

function handleAttachmentUpload(attachment: unknown) {
  console.log('Attachment upload:', attachment)
}

// Template refs (exposed to satisfy TypeScript noUnusedLocals)
defineExpose({
  keyboardShortcutsRef
})
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

/* 骨架屏淡出過渡 */
.skeleton-layer {
  z-index: 30;
  transition: opacity 200ms ease-out;
}

/* 空狀態層過渡 */
.empty-layer {
  z-index: 20;
  transition: opacity 200ms ease-out;
}

/* 內容層淡入過渡 (延遲等待骨架屏淡出) */
.messages-layer {
  z-index: 10;
  transition: opacity 280ms ease-in 100ms;
}

/* 🔧 FIX Phase 2: 使用 visibility:hidden 而非 v-show 的 display:none */
/* visibility:hidden 保留元素佈局，scrollHeight 可正確計算 */
/* 這解決了 v-show 導致 scrollHeight=0 的問題 */
.invisible-until-ready {
  visibility: hidden;
  opacity: 0;
  pointer-events: none; /* 防止隱藏時的意外點擊 */
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
  /* 🔧 Fix: Ensure input section creates a stacking context above messages */
  position: relative;
  z-index: 50;
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
}

/* 🆕 Transferred State Styles */
.transferred-state {
  flex-shrink: 0;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-top: 1px solid #f59e0b;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.transferred-input-message {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #92400e;
  font-size: 14px;
  font-weight: 500;
}

.transferred-icon {
  flex-shrink: 0;
  color: #d97706;
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

  .transferred-state {
    padding: 16px;
  }

  .transferred-input-message {
    font-size: 13px;
    gap: 8px;
  }
}
</style>
