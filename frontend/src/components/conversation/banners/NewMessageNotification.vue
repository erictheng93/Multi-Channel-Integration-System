<template>
  <Transition name="slide-up">
    <div
      v-if="newMessageCount > 0"
      class="new-message-notification"
      @click="$emit('click')"
    >
      <div class="notification-content">
        <div class="notification-icon">
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
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <span class="notification-text">
          {{ newMessageCount }} 則新訊息
        </span>
        <div class="notification-arrow">
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
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * NewMessageNotification - 新訊息通知浮動組件
 *
 * 當用戶向上滾動查看歷史訊息時，新訊息到達會顯示此通知。
 * 點擊後自動滾動到底部查看新訊息。
 *
 * 使用示例：
 * <NewMessageNotification
 *   :new-message-count="5"
 *   @click="scrollToBottom"
 * />
 */

// ===== Props =====
defineProps<{
  newMessageCount: number
}>()

// ===== Emits =====
defineEmits<{
  click: []
}>()
</script>

<style scoped>
.new-message-notification {
  position: fixed;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 24px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  cursor: pointer;
  z-index: 100;
  transition: all 0.2s;
  user-select: none;
}

.new-message-notification:hover {
  transform: translateX(-50%) translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5);
}

.new-message-notification:active {
  transform: translateX(-50%) translateY(0);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.notification-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notification-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  flex-shrink: 0;
}

.notification-text {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.notification-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  animation: bounce-arrow 1s infinite;
}

@keyframes bounce-arrow {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

/* Transition animations */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease-out;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .new-message-notification {
    bottom: 100px;
    padding: 10px 20px;
  }

  .notification-icon {
    width: 20px;
    height: 20px;
  }

  .notification-icon svg {
    width: 14px;
    height: 14px;
  }

  .notification-text {
    font-size: 13px;
  }

  .notification-arrow svg {
    width: 14px;
    height: 14px;
  }
}
</style>
