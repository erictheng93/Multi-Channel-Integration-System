<template>
  <div class="conversation-input-section">
    <!-- 快速回覆區域 -->
    <QuickReplies
      v-if="quickReplies.length > 0"
      :quick-replies="quickReplies"
      @select="handleQuickReplySelect"
    />

    <!-- 連線狀態欄 -->
    <ConnectionStatusBar
      :connection-state="connectionState"
      :connection-protocol="connectionProtocol"
      :connection-quality="connectionQuality"
      :show-protocol="showProtocol"
      :show-quality="showQuality"
      :auto-hide="autoHideStatus"
      @reconnect="$emit('reconnect')"
    />

    <!-- 訊息輸入框（使用現有的 MessageInput 組件） -->
    <div class="input-wrapper">
      <slot name="message-input">
        <!-- 預設插槽，允許父組件自訂輸入框 -->
        <div class="default-input-placeholder">
          <!-- MessageInput 組件應由父組件通過 slot 傳入 -->
        </div>
      </slot>
    </div>

    <!-- 輸入指示器（顯示對方正在輸入） -->
    <Transition name="fade">
      <div
        v-if="isTyping && (typingUsers?.length ?? 0) > 0"
        class="typing-indicator"
      >
        <div class="typing-dots">
          <span class="dot" />
          <span class="dot" />
          <span class="dot" />
        </div>
        <span class="typing-text">
          {{ typingText }}
        </span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
/**
 * ConversationInputSection - 對話輸入區域組件
 *
 * 這是一個容器組件，整合所有與輸入相關的 UI：
 * - QuickReplies: 快速回覆按鈕
 * - ConnectionStatusBar: WebSocket 連線狀態
 * - MessageInput: 訊息輸入框（通過 slot）
 * - TypingIndicator: 輸入指示器
 *
 * 使用示例：
 * <ConversationInputSection
 * :quick-replies="quickRepliesList"
 * :connection-state="connectionState"
 * :is-typing="isCustomerTyping"
 * :typing-users="['客戶A']"
 * @quick-reply-select="insertQuickReply"
 * @reconnect="reconnectWebSocket"
 * >
 * <template #message-input>
 * <MessageInput @send="handleSendMessage" />
 * </template>
 * </ConversationInputSection>
 */

import { computed } from 'vue'
import QuickReplies from './input/QuickReplies.vue'
import ConnectionStatusBar from './input/ConnectionStatusBar.vue'
import type { QuickReply } from './input/QuickReplies.vue'
import type {
  ConnectionState,
  ConnectionProtocol,
  ConnectionQuality
} from './input/ConnectionStatusBar.vue'

// ===== Props =====
const props = defineProps<{
  /** 快速回覆列表 */
  quickReplies?: QuickReply[]
  /** 連線狀態 */
  connectionState: ConnectionState
  /** 連線協定 */
  connectionProtocol?: ConnectionProtocol
  /** 連線質量 */
  connectionQuality?: ConnectionQuality
  /** 是否顯示協定標籤 */
  showProtocol?: boolean
  /** 是否顯示質量指示器 */
  showQuality?: boolean
  /** 自動隱藏狀態欄 */
  autoHideStatus?: boolean
  /** 是否有人正在輸入 */
  isTyping?: boolean
  /** 正在輸入的使用者列表 */
  typingUsers?: string[]
}>()

// ===== Emits =====
const emit = defineEmits<{
  /** 快速回覆被選擇 */
  'quick-reply-select': [reply: QuickReply]
  /** 重新連線 */
  reconnect: []
}>()

// ===== Computed =====

/**
 * 快速回覆列表（提供預設值）
 */
const quickReplies = computed(() => {
  return props.quickReplies || []
})

/**
 * 輸入指示器文字
 */
const typingText = computed(() => {
  if (!props.typingUsers || props.typingUsers.length === 0) {
    return '對方正在輸入...'
  }

  if (props.typingUsers.length === 1) {
    return `${props.typingUsers[0]} 正在輸入...`
  }

  if (props.typingUsers.length === 2) {
    return `${props.typingUsers[0]} 和 ${props.typingUsers[1]} 正在輸入...`
  }

  return `${props.typingUsers[0]} 和其他 ${props.typingUsers.length - 1} 人正在輸入...`
})

// ===== Methods =====

/**
 * 處理快速回覆選擇
 */
function handleQuickReplySelect(reply: QuickReply) {
  emit('quick-reply-select', reply)
}
</script>

<style scoped>
.conversation-input-section {
  display: flex;
  flex-direction: column;
  background: white;
  border-top: 1px solid #e5e7eb;
}

.input-wrapper {
  /* MessageInput 組件的容器 */
  position: relative;
}

.default-input-placeholder {
  /* 當沒有提供 MessageInput 時的佔位符 */
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 14px;
}

/* 輸入指示器 */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.dot {
  width: 6px;
  height: 6px;
  background: #9ca3af;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-4px);
  }
}

.typing-text {
  font-size: 13px;
  color: #6b7280;
  font-style: italic;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .typing-indicator {
    padding: 6px 12px;
  }

  .typing-text {
    font-size: 12px;
  }

  .dot {
    width: 5px;
    height: 5px;
  }
}
</style>
