<template>
  <Transition name="slide-fade">
    <div
      v-if="isVisible && count > 0"
      class="glassmorphism-notification"
      @click="handleClick"
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
          <span class="message-count">{{ count }}</span>
          <span class="message-label">{{ label }}</span>
          <span
            v-if="isRealtime"
            class="delivery-status"
          >{{ realtimeLabel }}</span>
        </div>

        <button
          class="glass-dismiss"
          :title="dismissTitle"
          @click.stop="handleDismiss"
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
  </Transition>
</template>

<script setup lang="ts">
/**
 * New Message Notification Component
 *
 * 浮动的新消息通知徽章，采用 glassmorphism 设计
 *
 * @component NewMessageNotification
 * @example
 * ```vue
 * <NewMessageNotification
 *   :is-visible="hasNewMessages"
 *   :count="newMessageCount"
 *   :is-realtime="isWebSocketConnected"
 *   @click="scrollToNewest"
 *   @dismiss="dismissNotification"
 * />
 * ```
 */

interface Props {
  /**
   * 是否显示通知
   */
  isVisible: boolean

  /**
   * 新消息数量
   */
  count: number

  /**
   * 是否为实时消息 (WebSocket)
   * @default false
   */
  isRealtime?: boolean

  /**
   * 消息标签文本
   * @default '新消息'
   */
  label?: string

  /**
   * 实时标签文本
   * @default '即時'
   */
  realtimeLabel?: string

  /**
   * 关闭按钮提示文本
   * @default '暫時忽略'
   */
  dismissTitle?: string
}

withDefaults(defineProps<Props>(), {
  isRealtime: false,
  label: '新消息',
  realtimeLabel: '即時',
  dismissTitle: '暫時忽略',
})

const emit = defineEmits<Emits>()

interface Emits {
  /**
   * 点击通知时触发 (通常用于滚动到最新消息)
   */
  (_e: 'click'): void

  /**
   * 点击关闭按钮时触发
   */
  (_e: 'dismiss'): void
}

const handleClick = () => {
  emit('click')
}

const handleDismiss = () => {
  emit('dismiss')
}
</script>

<style scoped>
/* ====== Glassmorphism Notification Styles ====== */
.glassmorphism-notification {
  position: fixed;
  bottom: 200px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
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

@keyframes gentlePulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.02);
    opacity: 0.9;
  }
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

.glass-dismiss:active {
  transform: scale(0.95);
}

/* Slide fade animation */
.slide-fade-enter-active {
  animation: slideInFade 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-fade-leave-active {
  animation: slideOutFade 0.3s cubic-bezier(0.4, 0, 0.6, 1);
}

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

@keyframes slideOutFade {
  from {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateX(-50%) translateY(16px) scale(0.95);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .glassmorphism-notification {
    bottom: 180px;
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
    font-size: 0.875rem;
  }

  .message-label {
    font-size: 0.8125rem;
  }

  .delivery-status {
    font-size: 0.6875rem;
    padding: 1px 5px;
  }
}
</style>
