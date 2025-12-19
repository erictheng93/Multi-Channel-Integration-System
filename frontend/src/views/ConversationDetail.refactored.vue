<template>
  <AppLayout>
    <div class="conversation-detail">
      <!-- 對話標題欄 -->
      <ConversationHeader
        :conversation="controller.conversation.value"
        :loading="controller.loading.value"
        :closing="closing"
        @back="goBack"
        @close="handleCloseConversation"
        @refresh="controller.refreshMessages"
        @search="toggleSearch"
      />

      <!-- 狀態橫幅組件（已關閉/拖放/新消息通知） -->
      <ConversationStatusBanner
        :is-closed="controller.conversation.value?.status === 'closed'"
        :is-dragging="isDragging"
        :new-message-count="controller.newMessageCount.value"
        @reopen-conversation="handleReopenConversation"
        @file-drop="handleFileDrop"
        @scroll-to-bottom="controller.scrollToBottom"
        @drag-state-change="isDragging = $event"
      />

      <!-- 搜索面板 -->
      <Transition name="search-slide">
        <div
          v-if="showSearchPanel"
          class="message-search-panel"
        >
          <Suspense>
            <MessageSearch
              :messages="controller.messages.value"
              @search-results="controller.setSearchResults"
              @search-clear="handleSearchClear"
            />
          </Suspense>
        </div>
      </Transition>

      <!-- 消息列表區域 -->
      <ConversationMessagesSection
        ref="messagesSectionRef"
        :messages="controller.messages.value"
        :displayed-messages="controller.displayedMessages.value"
        :loading="controller.loading.value"
        :has-more="controller.hasMore.value"
        :is-updating="controller.isUpdating.value"
        :skeleton-count="controller.skeletonCount.value"
        :show-date-separators="true"
        :enable-search="false"
        @message-copy="handleMessageCopy"
        @message-reply="handleMessageReply"
        @message-forward="handleMessageForward"
        @message-recall="handleMessageRecall"
        @retry-message="controller.retryMessage"
        @load-more="controller.loadMoreMessages"
        @scroll="handleScroll"
        @new-message-while-scrolled="handleNewMessageNotification"
      />

      <!-- 輸入區域組件 -->
      <ConversationInputSection
        v-if="controller.conversation.value && controller.conversation.value.status !== 'closed'"
        :quick-replies="quickReplies"
        :connection-state="controller.connectionState.value"
        :connection-protocol="controller.connectionProtocol.value as any"
        :connection-quality="controller.connectionQuality.value as any"
        :show-protocol="isDevDebugMode"
        :show-quality="isDevDebugMode"
        :auto-hide-status="true"
        :is-typing="controller.isTyping.value"
        :typing-users="controller.typingUsers.value"
        @quick-reply-select="handleQuickReplySelect"
        @reconnect="reconnectWebSocket"
      >
        <template #message-input>
          <MessageInput
            :conversation-id="conversationId"
            :disabled="false"
            @message-sent="handleMessageSent"
            @typing-start="controller.onTypingStart"
            @typing-stop="controller.onTypingStop"
          />
        </template>
      </ConversationInputSection>

      <!-- 已關閉狀態提示 -->
      <div
        v-else
        class="closed-state"
      >
        <div class="closed-message">
          <XCircleIcon />
          <span>此對話已結束</span>
        </div>
      </div>

      <!-- 鍵盤快捷鍵 -->
      <Suspense>
        <KeyboardShortcuts ref="keyboardShortcutsRef" />
      </Suspense>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
/**
 * ConversationDetail - 對話詳情頁面（重構版）
 *
 * 使用新的組件拆分架構：
 * - useConversationController 統一業務邏輯
 * - ConversationStatusBanner 狀態橫幅
 * - ConversationMessagesSection 消息列表
 * - ConversationInputSection 輸入區域
 *
 * 重構目標：
 * - 從 2890 行 → ~300 行 (減少 90%)
 * - 從 54 個事件處理器 → ~15 個
 * - 提升可維護性和可測試性
 */

import { ref, computed, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'

// 使用新的 Conversation Controller
import { useConversationController } from '@/composables/conversation'
import type { QuickReply } from '@/components/conversation/input/QuickReplies.vue'
import type { Message } from '@/types'

// 核心組件
import AppLayout from '@/components/ui/AppLayout.vue'
import ConversationHeader from '@/components/conversation/ConversationHeader.vue'
import ConversationStatusBanner from '@/components/conversation/ConversationStatusBanner.vue'
import ConversationMessagesSection from '@/components/conversation/ConversationMessagesSection.vue'
import ConversationInputSection from '@/components/conversation/ConversationInputSection.vue'
import MessageInput from '@/components/conversation/MessageInput.vue'
import { XCircleIcon } from '@/components/icons'

// 懶加載非關鍵組件
const MessageSearch = defineAsyncComponent(() => import('@/components/conversation/MessageSearch.vue'))
const KeyboardShortcuts = defineAsyncComponent(() => import('@/components/ui/KeyboardShortcuts.vue'))

// ===== 路由和 Stores =====
const route = useRoute()
const router = useRouter()
const { showSuccess, showError, showInfo } = useToast()
const { showConfirm } = useConfirm()

// ===== Conversation Controller（核心業務邏輯） =====
const conversationId = computed(() => route.params.id as string)
const controller = useConversationController(conversationId.value, {
  enablePagination: true,
  pageSize: 30,
  enableProgressiveLoading: false
})

// ===== 本地狀態 =====
const closing = ref(false)
const isDragging = ref(false)
const showSearchPanel = ref(false)
const isDevDebugMode = ref(false)
const messagesSectionRef = ref<InstanceType<typeof ConversationMessagesSection> | null>(null)
const keyboardShortcutsRef = ref<any>(null)

// ===== 快速回覆配置 =====
const quickReplies = ref<QuickReply[]>([
  { text: '您好，有什麼可以幫助您的？', shortcut: 'Ctrl+1' },
  { text: '感謝您的來信，我們會盡快處理', shortcut: 'Ctrl+2' },
  { text: '您的問題已經記錄，我們會在 24 小時內回覆', shortcut: 'Ctrl+3' }
])

// ===== 初始化調試模式 =====
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

// ===== 事件處理器 =====

/**
 * 處理消息發送（MessageInput 組件的事件）
 */
function handleMessageSent(data: any) {
  // MessageInput 已經處理了文件上傳和消息發送
  // 這裡只需要通過 controller 發送
  controller.onMessageSent(data)
}

/**
 * 處理文件拖放
 */
function handleFileDrop(files: File[]) {
  if (files.length > 0) {
    // TODO: 實現拖放文件處理
    console.log('Files dropped:', files)
  }
}

/**
 * 處理關閉對話
 */
async function handleCloseConversation() {
  const confirmed = await showConfirm({
    title: '關閉對話',
    message: '確定要關閉這個對話嗎？',
    type: 'warning'
  })

  if (!confirmed) {return}

  closing.value = true
  try {
    const success = await controller.closeConversation()
    if (success) {
      showSuccess('對話已關閉')
    } else {
      showError('關閉對話失敗')
    }
  } catch (error: any) {
    showError(`關閉失敗: ${error.message}`)
  } finally {
    closing.value = false
  }
}

/**
 * 處理重新打開對話
 */
async function handleReopenConversation() {
  try {
    const success = await controller.reopenConversation()
    if (success) {
      showSuccess('對話已重新打開')
    } else {
      showError('重新打開對話失敗')
    }
  } catch (error: any) {
    showError(`操作失敗: ${error.message}`)
  }
}

/**
 * 處理快速回覆選擇
 */
function handleQuickReplySelect(reply: QuickReply) {
  // TODO: 實現快速回覆選擇
  console.log('Quick reply selected:', reply)
}

/**
 * 處理消息複製
 */
function handleMessageCopy(message: Message) {
  navigator.clipboard.writeText(message.content)
  showSuccess('已複製到剪貼板')
}

/**
 * 處理消息回覆
 */
function handleMessageReply(message: Message) {
  // TODO: 實現消息回覆功能
  console.log('Reply to message:', message)
}

/**
 * 處理消息轉發
 */
function handleMessageForward(message: Message) {
  // TODO: 實現消息轉發功能
  console.log('Forward message:', message)
}

/**
 * 處理消息撤回
 */
async function handleMessageRecall(message: Message) {
  const confirmed = await showConfirm({
    title: '撤回消息',
    message: '確定要撤回這條消息嗎？',
    type: 'warning'
  })

  if (!confirmed) {return}

  try {
    await controller.recallMessage(message.id)
    showSuccess('消息已撤回')
  } catch (error: any) {
    showError(`撤回失敗: ${error.message}`)
  }
}

/**
 * 切換搜索面板
 */
function toggleSearch() {
  showSearchPanel.value = !showSearchPanel.value
}

/**
 * 處理搜索清除
 */
function handleSearchClear() {
  controller.clearSearch()
  showSearchPanel.value = false
}

/**
 * 處理滾動事件
 */
function handleScroll(scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }) {
  controller.onScroll(scrollInfo)
}

/**
 * 處理新消息通知
 */
function handleNewMessageNotification() {
  showInfo('有新消息', '', {
    duration: 3000,
    onAction: () => controller.scrollToBottom()
  })
}

/**
 * 重新連接 WebSocket
 */
function reconnectWebSocket() {
  // Controller 內部會自動處理重連
  showInfo('正在重新連接...')
}

/**
 * 返回上一頁
 */
function goBack() {
  router.push({ name: 'conversations' })
}

// ===== 生命週期 =====

onMounted(async () => {
  initDebugMode()

  try {
    // 初始化 Controller（會自動初始化所有子模塊）
    await controller.initialize()

    // 滾動到底部
    setTimeout(() => {
      controller.scrollToBottom()
    }, 300)
  } catch (error) {
    console.error('Failed to initialize conversation:', error)
    showError('加載對話失敗')
  }
})

onUnmounted(() => {
  // 清理 Controller（會自動清理所有子模塊）
  controller.cleanup()
})

// ===== 監聽路由變化 =====
watch(conversationId, async (newId, oldId) => {
  if (newId !== oldId && newId) {
    // 清理舊的 controller
    controller.cleanup()

    // 重新初始化新的 conversation
    await controller.initialize()
  }
})
</script>

<style scoped>
.conversation-detail {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f9fafb;
}

/* 搜索面板過渡動畫 */
.search-slide-enter-active,
.search-slide-leave-active {
  transition: all 0.3s ease-out;
}

.search-slide-enter-from,
.search-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.message-search-panel {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 16px;
}

/* 已關閉狀態 */
.closed-state {
  padding: 24px;
  background: #fef2f2;
  border-top: 1px solid #fecaca;
}

.closed-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #991b1b;
  font-size: 14px;
  font-weight: 500;
}

.closed-message svg {
  width: 20px;
  height: 20px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .message-search-panel {
    padding: 12px;
  }

  .closed-state {
    padding: 16px;
  }

  .closed-message {
    font-size: 13px;
  }
}
</style>
