<template>
  <Transition name="slide-down">
    <div
      v-if="isVisible"
      class="transferred-conversation-banner"
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
            <!-- Arrow right icon for transfer -->
            <line
              x1="5"
              y1="12"
              x2="19"
              y2="12"
            />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>

        <div class="banner-text">
          <strong>{{ title }}</strong>
          <span class="banner-hint">
            {{ message }}
            <template v-if="teamName">
              <strong class="team-name">{{ teamName }}</strong>
            </template>
          </span>
          <span
            v-if="transferredAt"
            class="transfer-time"
          >
            {{ formatTime(transferredAt) }}
          </span>
        </div>

        <button
          class="back-btn"
          @click="handleBack"
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
            <line
              x1="19"
              y1="12"
              x2="5"
              y2="12"
            />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>{{ backButtonText }}</span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * Transferred Conversation Banner Component
 *
 * Displays a warning banner when a conversation has been transferred
 * to another team, with option to navigate back to the conversation list.
 *
 * @component TransferredConversationBanner
 * @example
 * ```vue
 * <TransferredConversationBanner
 *   :is-visible="isTransferred"
 *   :team-name="transferredToTeam"
 *   :transferred-at="transferTime"
 *   @back="handleBackToList"
 * />
 * ```
 */

interface Props {
  /**
   * Whether the banner should be visible
   */
  isVisible: boolean

  /**
   * Name of the team the conversation was transferred to
   */
  teamName?: string

  /**
   * ISO timestamp of when the transfer occurred
   */
  transferredAt?: string

  /**
   * Banner title text
   * @default '此對話已轉移'
   */
  title?: string

  /**
   * Banner message text
   * @default '此對話已轉移至其他團隊：'
   */
  message?: string

  /**
   * Back button text
   * @default '返回對話列表'
   */
  backButtonText?: string
}

withDefaults(defineProps<Props>(), {
  teamName: undefined,
  transferredAt: undefined,
  title: '此對話已轉移',
  message: '此對話已轉移至其他團隊：',
  backButtonText: '返回對話列表',
})

const emit = defineEmits<Emits>()

interface Emits {
  /**
   * Emitted when user clicks the back button
   */
  (_e: 'back'): void
}

const handleBack = () => {
  emit('back')
}

/**
 * Format ISO timestamp to localized time string
 */
const formatTime = (isoTime: string): string => {
  try {
    const date = new Date(isoTime)
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoTime
  }
}
</script>

<style scoped>
/* ====== Transferred Conversation Banner Styles ====== */
.transferred-conversation-banner {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border-left: 4px solid #3b82f6;
  padding: 16px 24px;
  margin: 0;
  border-bottom: 1px solid #3b82f6;
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
  color: #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(59, 130, 246, 0.1);
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
  color: #1e40af;
}

.banner-hint {
  font-size: 14px;
  color: #1d4ed8;
}

.team-name {
  color: #1e3a8a;
  font-weight: 600;
}

.transfer-time {
  font-size: 12px;
  color: #60a5fa;
  margin-top: 2px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.back-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
}

.back-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
}

.back-btn svg {
  flex-shrink: 0;
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
  .transferred-conversation-banner {
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

  .transfer-time {
    font-size: 11px;
  }

  .back-btn {
    width: 100%;
    justify-content: center;
    padding: 8px 16px;
    font-size: 13px;
  }
}
</style>
