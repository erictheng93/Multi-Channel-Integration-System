<template>
  <Transition name="slide-down">
    <div
      v-if="isVisible"
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
          <strong>{{ title }}</strong>
          <span class="banner-hint">{{ message }}</span>
        </div>

        <button
          class="reopen-btn"
          :disabled="loading"
          @click="handleReopen"
        >
          <svg
            v-if="!loading"
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
          <span
            v-if="loading"
            class="loading-spinner"
          />
          <span>{{ loading ? reopenLoadingText : reopenButtonText }}</span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * Closed Conversation Banner Component
 *
 * 显示对话已关闭的警告横幅，包含重新打开按钮
 *
 * @component ClosedConversationBanner
 * @example
 * ```vue
 * <ClosedConversationBanner
 *   :is-visible="conversation?.status === 'closed'"
 *   :loading="isReopening"
 *   @reopen="handleReopen"
 * />
 * ```
 */

interface Props {
  /**
   * 是否显示横幅
   */
  isVisible: boolean

  /**
   * 重新打开按钮是否处于加载状态
   * @default false
   */
  loading?: boolean

  /**
   * 标题文本
   * @default '此對話已關閉'
   */
  title?: string

  /**
   * 消息文本
   * @default '對話已結束，無法發送訊息'
   */
  message?: string

  /**
   * 重新打开按钮文本
   * @default '重新打開對話'
   */
  reopenButtonText?: string

  /**
   * 重新打开加载中文本
   * @default '處理中...'
   */
  reopenLoadingText?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  title: '此對話已關閉',
  message: '對話已結束，無法發送訊息',
  reopenButtonText: '重新打開對話',
  reopenLoadingText: '處理中...',
})

const emit = defineEmits<Emits>()

interface Emits {
  /**
   * 点击重新打开按钮时触发
   */
  (_e: 'reopen'): void
}

const handleReopen = () => {
  if (!props.loading) {
    emit('reopen')
  }
}
</script>

<style scoped>
/* ====== Closed Conversation Banner Styles ====== */
.closed-conversation-banner {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-left: 4px solid #f59e0b;
  padding: 16px 24px;
  margin: 0;
  border-bottom: 1px solid #f59e0b;
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

.reopen-btn:hover:not(:disabled) {
  background: #d97706;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(245, 158, 11, 0.3);
}

.reopen-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
}

.reopen-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.reopen-btn svg {
  flex-shrink: 0;
}

/* Loading spinner */
.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Slide down animation */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease-out;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Responsive */
@media (max-width: 768px) {
  .closed-conversation-banner {
    padding: 12px 16px;
  }

  .banner-content {
    flex-wrap: wrap;
    gap: 12px;
  }

  .banner-icon {
    width: 32px;
    height: 32px;
  }

  .banner-icon svg {
    width: 16px;
    height: 16px;
  }

  .banner-text strong {
    font-size: 14px;
  }

  .banner-hint {
    font-size: 12px;
  }

  .reopen-btn {
    width: 100%;
    justify-content: center;
    padding: 8px 16px;
    font-size: 13px;
  }
}
</style>
