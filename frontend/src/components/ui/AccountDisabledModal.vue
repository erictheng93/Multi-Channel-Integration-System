<template>
  <div 
    v-if="showModal" 
    class="modal-overlay"
    @click="handleModalClick"
  >
    <div 
      class="modal disabled-account-modal"
      @click.stop
    >
      <div class="modal-icon">
        <div class="icon-container error">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="m15 9-6 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="m9 9 6 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </div>
      </div>
      
      <div class="modal-content">
        <h3 class="modal-title">
          帳戶已被停用
        </h3>
        <p class="modal-subtitle">
          您的帳戶已被系統管理員停用。如有疑問，請聯繫系統管理員。
        </p>
        <div class="warning-notice">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="m21 16-4 4-4-4"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M17 20V4"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="m3 8 4-4 4 4"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M7 4v16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>您將被自動登出系統</span>
        </div>
      </div>
      
      <div class="modal-actions">
        <button
          type="button"
          class="btn-modern btn-primary"
          @click="handleConfirm"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <polyline
              points="16,17 21,12 16,7"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <line
              x1="21"
              y1="12"
              x2="9"
              y2="12"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          確認登出
        </button>
      </div>
      
      <!-- 倒計時提示 -->
      <div class="countdown-notice">
        <span>{{ countdown }} 秒後自動登出</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuth } from '@/composables'

interface Props {
  autoLogoutDelay?: number
}

const props = withDefaults(defineProps<Props>(), {
  autoLogoutDelay: 10
})

const { logout } = useAuth()

const showModal = ref(true)
const countdown = ref(props.autoLogoutDelay)

let countdownTimer: NodeJS.Timeout | null = null

const startCountdown = () => {
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      handleConfirm()
    }
  }, 1000)
}

const handleConfirm = async () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  showModal.value = false
  await logout()
}

const handleModalClick = () => {
  // 防止點擊背景關閉模態框
}

onMounted(() => {
  startCountdown()
})

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: var(--space-4);
  backdrop-filter: blur(4px);
}

.disabled-account-modal {
  max-width: 480px;
  padding: 0;
  text-align: center;
  border: none;
  background: white;
  border-radius: var(--radius-3xl);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-icon {
  padding: var(--space-8) var(--space-8) var(--space-4);
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
}

.icon-container {
  width: 80px;
  height: 80px;
  margin: 0 auto;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 25px -8px rgba(239, 68, 68, 0.4);
}

.icon-container.error {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
}

.modal-content {
  padding: var(--space-4) var(--space-8) var(--space-6);
}

.modal-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 var(--space-3) 0;
  letter-spacing: -0.025em;
}

.modal-subtitle {
  font-size: 1.125rem;
  color: var(--gray-600);
  line-height: 1.6;
  margin: 0 0 var(--space-6) 0;
}

.warning-notice {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  color: #92400e;
  font-weight: 500;
  margin-bottom: var(--space-6);
}

.warning-notice svg {
  flex-shrink: 0;
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  padding: 0 var(--space-8);
  justify-content: center;
}

.btn-modern {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-8);
  border-radius: var(--radius-lg);
  font-size: 1rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 140px;
  justify-content: center;
}

.btn-primary {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
}

.countdown-notice {
  padding: var(--space-4) var(--space-8) var(--space-6);
  background: var(--gray-50);
  border-top: 1px solid var(--gray-200);
  font-size: 0.875rem;
  color: var(--gray-600);
  font-weight: 500;
}

/* 響應式設計 */
@media (max-width: 640px) {
  .disabled-account-modal {
    max-width: 350px;
    margin: var(--space-4);
  }

  .modal-icon {
    padding: var(--space-6) var(--space-6) var(--space-3);
  }

  .icon-container {
    width: 64px;
    height: 64px;
  }

  .modal-content {
    padding: var(--space-3) var(--space-6) var(--space-4);
  }

  .modal-title {
    font-size: 1.5rem;
  }

  .modal-subtitle {
    font-size: 1rem;
  }

  .modal-actions {
    padding: 0 var(--space-6);
  }

  .btn-modern {
    min-width: 100%;
    padding: var(--space-3) var(--space-6);
  }

  .countdown-notice {
    padding: var(--space-3) var(--space-6) var(--space-4);
  }
}
</style>