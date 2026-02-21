<template>
  <div
    v-if="visible"
    class="updating-indicator"
  >
    <div class="updating-content">
      <div class="updating-spinner" />
      <!-- Glassmorphism Loading Indicator -->
      <div
        class="sync-message-container"
        role="status"
        aria-live="polite"
        aria-label="正在同步最新對話"
      >
        <div class="sync-icon-wrapper">
          <div
            class="sync-icon"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              class="sync-svg"
              aria-hidden="true"
            >
              <path
                d="M12,4V2C6.48,2 2,6.48 2,12H4C4,7.58 7.58,4 12,4Z"
                class="sync-path"
              />
            </svg>
          </div>
        </div>
        <div class="sync-text-content">
          <div class="sync-primary-text">
            正在同步最新對話
          </div>
          <div class="sync-secondary-text">
            獲取最新消息中...
          </div>
        </div>
        <div
          class="sync-progress-dots"
          aria-hidden="true"
        >
          <div class="dot dot-1" />
          <div class="dot dot-2" />
          <div class="dot dot-3" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
}>()
</script>

<style scoped>
/* Glassmorphism Updating Indicator */
.updating-indicator {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(244, 129, 32, 0.2);
  padding: 1rem 2rem;
  text-align: center;
  box-shadow:
    0 8px 32px rgba(244, 129, 32, 0.1),
    0 2px 16px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  animation: slideInFromTop 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.updating-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  max-width: 500px;
  margin: 0 auto;
}

.updating-spinner {
  display: none; /* Hide old spinner */
}

/* Glassmorphism Sync Message Container */
.sync-message-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background: rgba(244, 129, 32, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 16px;
  border: 1px solid rgba(244, 129, 32, 0.15);
  box-shadow:
    0 4px 20px rgba(244, 129, 32, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
  animation: syncContainerPulse 2s ease-in-out infinite;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sync-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sync-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(244, 129, 32, 0.12);
  border-radius: 50%;
  animation: syncIconRotate 2s linear infinite;
  box-shadow:
    0 2px 8px rgba(244, 129, 32, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.sync-svg {
  width: 16px;
  height: 16px;
  fill: #F48120;
  filter: drop-shadow(0 1px 2px rgba(244, 129, 32, 0.3));
}

.sync-path {
  animation: syncPathDraw 1.5s ease-in-out infinite;
}

.sync-text-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  flex: 1;
}

.sync-primary-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1a1a1a;
  letter-spacing: 0.2px;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

.sync-secondary-text {
  font-size: 0.8rem;
  font-weight: 400;
  color: #666;
  opacity: 0.85;
  animation: syncTextFade 2s ease-in-out infinite;
}

.sync-progress-dots {
  display: flex;
  gap: 0.375rem;
  align-items: center;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, #F48120, #e8741d);
  box-shadow:
    0 1px 3px rgba(244, 129, 32, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  animation: dotPulse 1.4s ease-in-out infinite;
}

.dot-1 {
  animation-delay: 0s;
}

.dot-2 {
  animation-delay: 0.2s;
}

.dot-3 {
  animation-delay: 0.4s;
}

@keyframes slideInFromTop {
  from {
    opacity: 0;
    transform: translateY(-100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes syncContainerPulse {
  0%, 100% {
    box-shadow:
      0 4px 20px rgba(244, 129, 32, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.4);
    background: rgba(244, 129, 32, 0.08);
  }
  50% {
    box-shadow:
      0 6px 28px rgba(244, 129, 32, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.5);
    background: rgba(244, 129, 32, 0.12);
  }
}

@keyframes syncIconRotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes syncPathDraw {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

@keyframes syncTextFade {
  0%, 100% {
    opacity: 0.85;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes dotPulse {
  0%, 70%, 100% {
    transform: scale(1);
    opacity: 0.7;
  }
  35% {
    transform: scale(1.3);
    opacity: 1;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .sync-message-container {
    animation: none;
  }

  .sync-icon {
    animation: none;
  }

  .sync-path {
    animation: none;
  }

  .sync-secondary-text {
    animation: none;
    opacity: 0.85;
  }

  .dot {
    animation: none;
    opacity: 0.7;
    transform: scale(1);
  }

  .updating-spinner {
    animation: none;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .updating-indicator {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
  }

  .updating-spinner {
    width: 16px;
    height: 16px;
  }

  .sync-message-container {
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    border-radius: 12px;
  }

  .sync-icon {
    width: 24px;
    height: 24px;
  }

  .sync-svg {
    width: 14px;
    height: 14px;
  }

  .sync-primary-text {
    font-size: 0.875rem;
  }

  .sync-secondary-text {
    font-size: 0.75rem;
  }

  .dot {
    width: 5px;
    height: 5px;
  }

  .sync-progress-dots {
    gap: 0.25rem;
  }
}

@media (max-width: 480px) {
  .updating-indicator {
    padding: 0.5rem 0.75rem;
  }

  .sync-message-container {
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 10px;
    flex-direction: column;
    text-align: center;
  }

  .sync-text-content {
    align-items: center;
  }

  .sync-primary-text {
    font-size: 0.8rem;
  }

  .sync-secondary-text {
    font-size: 0.7rem;
  }

  .sync-progress-dots {
    justify-content: center;
    gap: 0.2rem;
  }

  .dot {
    width: 4px;
    height: 4px;
  }
}
</style>
