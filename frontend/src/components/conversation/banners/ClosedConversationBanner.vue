<template>
  <div class="closed-conversation-banner">
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
        @click="handleReopen"
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
</template>

<script setup lang="ts">
/**
 * ClosedConversationBanner - 已關閉對話橫幅組件
 *
 * 當對話處於關閉狀態時顯示的橫幅，提供重新打開對話的功能。
 *
 * 使用示例：
 * <ClosedConversationBanner @reopen="handleReopenConversation" />
 */

// ===== Emits =====
const emit = defineEmits<{
  reopen: []
}>()

// ===== Methods =====
function handleReopen() {
  emit('reopen')
}
</script>

<style scoped>
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

/* Mobile responsive */
@media (max-width: 768px) {
  .closed-conversation-banner {
    padding: 12px 16px;
  }

  .banner-content {
    gap: 12px;
  }

  .banner-icon {
    width: 32px;
    height: 32px;
  }

  .banner-text strong {
    font-size: 14px;
  }

  .banner-hint {
    font-size: 12px;
  }

  .reopen-btn {
    padding: 8px 16px;
    font-size: 13px;
  }
}
</style>
