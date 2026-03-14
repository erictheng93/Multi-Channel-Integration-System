<template>
  <Transition name="slide-from-top">
    <div
      v-if="isVisible"
      class="connection-status-bar"
      :class="statusClass"
    >
      <div class="status-content">
        <!-- Status Indicator -->
        <div class="status-indicator">
          <div
            class="status-dot"
            :class="statusClass"
          />
          <span class="status-text">{{ statusText }}</span>
        </div>

        <!-- Connection Details -->
        <div class="connection-details">
          <!-- Reconnect Attempts -->
          <div
            v-if="reconnectAttempts > 0"
            class="detail-item"
          >
            <svg
              width="14"
              height="14"
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
            <span>重連次數: {{ reconnectAttempts }}</span>
          </div>

          <!-- Typing Users -->
          <div
            v-if="typingUsers > 0"
            class="detail-item"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>{{ typingUsers }} 人正在輸入</span>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * Connection Status Bar Component
 *
 * 显示 WebSocket 连接状态的调试信息栏
 *
 * @component ConnectionStatusBar
 * @example
 * ```vue
 * <ConnectionStatusBar
 * :is-visible="debugMode"
 * :status-text="wsStatus"
 * :status-class="wsStatusClass"
 * :reconnect-attempts="reconnectCount"
 * :typing-users="typingCount"
 * />
 * ```
 */

interface Props {
  /**
   * 是否显示状态栏
   */
  isVisible: boolean

  /**
   * 状态文本
   * @example '已連線' | '連線中...' | '已斷線' | '連線錯誤'
   */
  statusText: string

  /**
   * 状态样式类名
   * @example 'connected' | 'connecting' | 'disconnected' | 'error'
   */
  statusClass: 'connected' | 'connecting' | 'disconnected' | 'error'

  /**
   * 重连尝试次数
   * @default 0
   */
  reconnectAttempts?: number

  /**
   * 正在输入的用户数量
   * @default 0
   */
  typingUsers?: number
}

withDefaults(defineProps<Props>(), {
  reconnectAttempts: 0,
  typingUsers: 0,
})
</script>

<style scoped>
/* ====== Connection Status Bar Styles ====== */
.connection-status-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  font-size: 0.75rem;
}

.connection-status-bar.connected {
  background: rgba(220, 252, 231, 0.95);
  border-bottom-color: #10b981;
}

.connection-status-bar.connecting {
  background: rgba(254, 243, 199, 0.95);
  border-bottom-color: #f59e0b;
}

.connection-status-bar.disconnected,
.connection-status-bar.error {
  background: rgba(254, 226, 226, 0.95);
  border-bottom-color: #ef4444;
}

.status-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

/* Status Indicator */
.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.connected {
  background: #10b981;
  animation: pulse-green 2s infinite;
}

.status-dot.connecting {
  background: #f59e0b;
  animation: pulse-yellow 1.5s infinite;
}

.status-dot.disconnected,
.status-dot.error {
  background: #ef4444;
  animation: pulse-red 1s infinite;
}

@keyframes pulse-green {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0);
  }
}

@keyframes pulse-yellow {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0);
  }
}

@keyframes pulse-red {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0);
  }
}

.status-text {
  font-weight: 500;
  color: #374151;
}

/* Connection Details */
.connection-details {
  display: flex;
  align-items: center;
  gap: 16px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #6b7280;
  font-size: 0.6875rem;
}

.detail-item svg {
  flex-shrink: 0;
  opacity: 0.6;
}

/* Slide from top animation */
.slide-from-top-enter-active {
  animation: slideFromTop 0.3s ease-out;
}

.slide-from-top-leave-active {
  animation: slideToTop 0.2s ease-in;
}

@keyframes slideFromTop {
  from {
    opacity: 0;
    transform: translateY(-100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideToTop {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-100%);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .connection-status-bar {
    padding: 6px 12px;
    font-size: 0.6875rem;
  }

  .status-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .connection-details {
    gap: 12px;
  }

  .detail-item {
    font-size: 0.625rem;
  }

  .detail-item svg {
    width: 12px;
    height: 12px;
  }
}
</style>
