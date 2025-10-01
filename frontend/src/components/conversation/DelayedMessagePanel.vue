<template>
  <div class="delayed-message-panel">
    <!-- 待發送訊息列表 -->
    <TransitionGroup
      name="list"
      tag="div"
      class="pending-messages"
    >
      <div
        v-for="msg in pendingMessages"
        :key="msg.id"
        class="pending-message"
        :class="{ 'urgent': msg.timeRemaining <= 2 }"
      >
        <!-- 訊息內容 -->
        <div class="message-content">
          <div class="content-preview">
            {{ msg.content }}
          </div>
          <div class="meta-info">
            <span
              class="platform-badge"
              :class="`platform-${msg.platform}`"
            >
              {{ msg.platform === 'line' ? 'LINE' : 'Facebook' }}
            </span>
          </div>
        </div>

        <!-- 倒數計時區域 -->
        <div class="countdown-section">
          <div class="countdown-display">
            <span class="countdown-number">{{ msg.timeRemaining }}</span>
            <span class="countdown-label">秒後發送</span>
          </div>

          <!-- 進度條 -->
          <div class="progress-bar-container">
            <div
              class="progress-bar"
              :style="{ width: getProgressWidth(msg) + '%' }"
            />
          </div>
        </div>

        <!-- 撤銷按鈕 -->
        <button
          class="cancel-btn"
          :class="{ 'pulsing': msg.timeRemaining <= 2 }"
          :disabled="cancelling[msg.id]"
          @click="cancelMessage(msg.id)"
        >
          <span v-if="!cancelling[msg.id]">✕ 撤銷</span>
          <span
            v-else
            class="spinner"
          />
        </button>
      </div>
    </TransitionGroup>

    <!-- 空狀態 -->
    <div
      v-if="pendingMessages.length === 0"
      class="empty-state"
    >
      <div class="empty-icon">
        ⏰
      </div>
      <div class="empty-text">
        目前沒有待發送訊息
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import delayedMessagesApi from '@/api/delayedMessages';
import { useToast } from '@/composables/useToast';

/**
 * Props
 */
interface Props {
  conversationId: string;
}

const props = defineProps<Props>();

/**
 * Composables
 */
const { showSuccess, showError } = useToast();

/**
 * State
 */
interface PendingMessageState {
  id: string;
  content: string;
  messageType: string;
  platform: 'line' | 'facebook';
  scheduledAt: number;
  canCancelUntil: number;
  delaySeconds: number;
  timeRemaining: number; // 動態計算的剩餘秒數
}

const pendingMessages = ref<PendingMessageState[]>([]);
const cancelling = ref<Record<string, boolean>>({});
const intervals = ref<Record<string, number>>({});

/**
 * 添加待發送訊息
 */
const addPendingMessage = (message: {
  id: string;
  content: string;
  messageType?: string;
  platform: 'line' | 'facebook';
  scheduledAt: number;
  canCancelUntil: number;
  delaySeconds: number;
}) => {
  const now = Date.now();
  const timeRemaining = Math.max(0, Math.ceil((message.scheduledAt - now) / 1000));

  const pendingMsg: PendingMessageState = {
    id: message.id,
    content: message.content,
    messageType: message.messageType || 'text',
    platform: message.platform,
    scheduledAt: message.scheduledAt,
    canCancelUntil: message.canCancelUntil,
    delaySeconds: message.delaySeconds,
    timeRemaining
  };

  pendingMessages.value.push(pendingMsg);

  // 啟動倒數計時
  startCountdown(message.id);
};

/**
 * 啟動倒數計時
 */
const startCountdown = (messageId: string) => {
  // 100ms 更新一次，提供流暢的倒數體驗
  const interval = window.setInterval(async () => {
    const msg = pendingMessages.value.find(m => m.id === messageId);
    if (!msg) {
      clearInterval(interval);
      delete intervals.value[messageId];
      return;
    }

    // 更新倒數
    const now = Date.now();
    const timeRemaining = Math.max(0, Math.ceil((msg.scheduledAt - now) / 1000));
    msg.timeRemaining = timeRemaining;

    // 如果時間到了，查詢狀態確認是否已發送
    if (timeRemaining === 0) {
      try {
        const status = await delayedMessagesApi.getStatus(messageId, props.conversationId);

        if (status.status === 'sent' || !status.exists) {
          // 已發送或不存在，移除
          removePendingMessage(messageId);
          showSuccess('訊息已成功發送');
        }
      } catch (error) {
        console.error('Failed to check message status:', error);
        // 發生錯誤也移除，避免卡住
        removePendingMessage(messageId);
      }
    }
  }, 100);

  intervals.value[messageId] = interval;
};

/**
 * 移除待發送訊息
 */
const removePendingMessage = (messageId: string) => {
  const index = pendingMessages.value.findIndex(m => m.id === messageId);
  if (index !== -1) {
    pendingMessages.value.splice(index, 1);
  }

  // 清理倒數計時器
  if (intervals.value[messageId]) {
    clearInterval(intervals.value[messageId]);
    delete intervals.value[messageId];
  }
};

/**
 * 撤銷訊息
 */
const cancelMessage = async (messageId: string) => {
  cancelling.value[messageId] = true;

  try {
    await delayedMessagesApi.cancel({
      messageId,
      conversationId: props.conversationId,
      reason: 'User cancelled'
    });

    // 成功撤銷
    removePendingMessage(messageId);
    showSuccess('已成功撤銷訊息');

  } catch (error: unknown) {
    console.error('Failed to cancel message:', error);
    const errorMessage = error instanceof Error ? error.message : '撤銷失敗';
    showError(errorMessage);
  } finally {
    delete cancelling.value[messageId];
  }
};

/**
 * 計算進度條寬度
 */
const getProgressWidth = (msg: PendingMessageState): number => {
  const elapsed = msg.delaySeconds - msg.timeRemaining;
  return (elapsed / msg.delaySeconds) * 100;
};

/**
 * 清理
 */
onUnmounted(() => {
  // 清理所有倒數計時器
  Object.values(intervals.value).forEach(interval => clearInterval(interval));
  intervals.value = {};
});

/**
 * 暴露方法給父組件
 */
defineExpose({
  addPendingMessage,
  removePendingMessage
});
</script>

<style scoped lang="scss">
.delayed-message-panel {
  position: relative;
  width: 100%;
  max-height: 300px;
  overflow-y: auto;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.pending-messages {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pending-message {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;

  &.urgent {
    border-color: #f59e0b;
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
    animation: urgent-pulse 1s ease-in-out infinite;
  }

  &:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
}

@keyframes urgent-pulse {
  0%, 100% {
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.4);
  }
}

.message-content {
  flex: 1;
  min-width: 0;

  .content-preview {
    font-size: 14px;
    color: #374151;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 8px;
  }

  .meta-info {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .platform-badge {
    display: inline-block;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    text-transform: uppercase;

    &.platform-line {
      background: #06c755;
      color: white;
    }

    &.platform-facebook {
      background: #1877f2;
      color: white;
    }
  }
}

.countdown-section {
  flex-shrink: 0;
  width: 120px;

  .countdown-display {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-bottom: 8px;

    .countdown-number {
      font-size: 24px;
      font-weight: 700;
      color: #f59e0b;
    }

    .countdown-label {
      font-size: 12px;
      color: #6b7280;
    }
  }
}

.progress-bar-container {
  width: 100%;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #f59e0b);
    transition: width 0.1s linear;
  }
}

.cancel-btn {
  flex-shrink: 0;
  padding: 8px 16px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: #dc2626;
    transform: scale(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &.pulsing {
    animation: pulse 0.5s ease-in-out infinite;
  }

  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #9ca3af;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .empty-text {
    font-size: 14px;
  }
}

/* Transition animations */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.list-move {
  transition: transform 0.3s ease;
}
</style>