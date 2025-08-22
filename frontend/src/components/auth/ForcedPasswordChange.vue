<template>
  <div class="forced-password-overlay">
    <div class="forced-password-modal">
      <button 
        type="button" 
        class="close-button"
        title="取消"
        @click="handleCancel"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path 
            d="M18 6L6 18M6 6l12 12" 
            stroke="currentColor" 
            stroke-width="2" 
            stroke-linecap="round" 
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <div class="modal-icon">
        <div class="icon-container">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
          >
            <rect
              x="3"
              y="11"
              width="18"
              height="10"
              rx="2"
              ry="2"
              stroke="white"
              stroke-width="2"
              fill="none"
            />
            <circle
              cx="12"
              cy="16"
              r="1"
              fill="white"
            />
            <path
              d="m7 11V7a5 5 0 0 1 10 0v4"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </div>
      
      <form 
        class="modal-content" 
        @submit.prevent="submitPasswordChange"
      >
        <h3 class="modal-title">
          必須更改密碼
        </h3>
        <p class="modal-subtitle">
          系統管理員要求您在首次登入時更改密碼。請設定一個新的安全密碼。
        </p>
        

        <div class="form-group">
          <label for="newPassword">新密碼 *</label>
          <input
            id="newPassword"
            v-model="form.newPassword"
            type="password"
            required
            placeholder="請輸入新密碼"
            minlength="6"
            class="password-input"
          >
          <small class="form-hint">密碼至少需要 6 個字符</small>
        </div>

        <div class="form-group">
          <label for="confirmPassword">確認新密碼 *</label>
          <input
            id="confirmPassword"
            v-model="form.confirmPassword"
            type="password"
            required
            placeholder="請再次輸入新密碼"
            class="password-input"
          >
          <div 
            v-if="passwordMismatch" 
            class="error-message"
          >
            密碼不一致
          </div>
        </div>

        <div 
          v-if="errorMessage" 
          class="error-alert"
        >
          {{ errorMessage }}
        </div>
      </form>
      
      <div class="modal-actions">
        <button
          type="button"
          class="btn-modern btn-primary"
          :disabled="!isFormValid || loading"
          @click="submitPasswordChange"
        >
          <svg
            v-if="loading"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            class="animate-spin"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
              fill="none"
              opacity="0.25"
            />
            <path
              fill="currentColor"
              d="M12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2z"
            />
          </svg>
          <svg
            v-else
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M20 6L9 17l-5-5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {{ loading ? '設定中...' : '設定新密碼' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

interface Props {
  tempToken: string
  agent: {
    id: string
    email: string
    name: string
    role: 'admin' | 'team' | 'agent'
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  success: []
  cancel: []
}>()

const authStore = useAuthStore()

const loading = ref(false)
const errorMessage = ref('')

const form = reactive({
  newPassword: '',
  confirmPassword: ''
})

const passwordMismatch = computed(() => {
  return form.newPassword && 
         form.confirmPassword && 
         form.newPassword !== form.confirmPassword
})

const isFormValid = computed(() => {
  return form.newPassword.length >= 6 && 
         form.confirmPassword && 
         !passwordMismatch.value
})

const submitPasswordChange = async () => {
  if (!isFormValid.value) {return}
  
  loading.value = true
  errorMessage.value = ''
  
  try {
    const response = await authApi.changePassword({
      newPassword: form.newPassword
    }, props.tempToken)
    
    if (response.success) {
      // 密碼更改成功，重新登入
      const loginResponse = await authApi.login({
        email: props.agent.email,
        password: form.newPassword
      })
      
      if (loginResponse.success && loginResponse.data) {
        // 手動設置認證狀態（模仿 authStore.login 的邏輯）
        authStore.token = loginResponse.data.token
        authStore.refreshToken = loginResponse.data.refreshToken || null
        authStore.currentAgent = loginResponse.data.agent
        
        // 設定會話過期時間
        const expiry = Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 天
        authStore.sessionExpiry = expiry
        
        // 儲存到 localStorage
        localStorage.setItem('token', loginResponse.data.token)
        if (loginResponse.data.refreshToken) {
          localStorage.setItem('refreshToken', loginResponse.data.refreshToken)
        }
        localStorage.setItem('sessionExpiry', expiry.toString())
        
        // 設定 API 認證標頭
        authApi.setAuthHeader(loginResponse.data.token, loginResponse.data.refreshToken)
        
        // 設定會話狀態
        authStore.setSessionStatus('authenticated')
        
        emit('success')
        // 讓路由守衛自動導航到 dashboard
        window.location.href = '/dashboard'
      } else {
        errorMessage.value = '密碼更改成功，但重新登入失敗，請手動登入'
      }
    } else {
      errorMessage.value = '密碼更改失敗，請檢查您的輸入'
    }
  } catch (error: unknown) {
    console.error('Password change error:', error)
    errorMessage.value = error instanceof Error ? error.message : '密碼更改失敗，請稍後重試'
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.forced-password-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: var(--space-4);
}

.forced-password-modal {
  max-width: 520px;
  width: 100%;
  padding: 0;
  text-align: left;
  border: none;
  background: white;
  border-radius: var(--radius-3xl);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
  overflow: visible;
  position: relative;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.modal-icon {
  padding: var(--space-8) var(--space-8) var(--space-4);
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: var(--radius-3xl) var(--radius-3xl) 0 0;
}

.icon-container {
  width: 64px;
  height: 64px;
  margin: 0 auto;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 25px -8px rgba(239, 68, 68, 0.4);
}

.icon-container svg {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.icon-container svg path,
.icon-container svg rect,
.icon-container svg circle {
  stroke: white;
  fill: white;
}

.modal-content {
  padding: var(--space-4) var(--space-8) var(--space-6);
  flex: 1;
  overflow-y: auto;
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 var(--space-3) 0;
  letter-spacing: -0.025em;
  text-align: center;
}

.modal-subtitle {
  font-size: 1rem;
  color: var(--gray-600);
  line-height: 1.6;
  margin: 0 0 var(--space-6) 0;
  text-align: center;
}

.form-group {
  margin-bottom: var(--space-5);
}

.form-group label {
  display: block;
  margin-bottom: var(--space-2);
  color: var(--gray-700);
  font-size: 0.875rem;
  font-weight: 500;
}

.password-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-family: monospace;
  letter-spacing: 0.5px;
  transition: all var(--transition-fast);
}

.password-input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
}

.form-hint {
  display: block;
  margin-top: var(--space-1);
  font-size: 0.75rem;
  color: var(--gray-500);
}

.error-message {
  display: block;
  margin-top: var(--space-1);
  font-size: 0.75rem;
  color: #ef4444;
  font-weight: 500;
}

.error-alert {
  padding: var(--space-3) var(--space-4);
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  color: #dc2626;
  font-weight: 500;
  margin-top: var(--space-4);
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-8) var(--space-8);
  justify-content: center;
  flex-shrink: 0;
  border-top: 1px solid var(--gray-100);
  background: var(--gray-25);
  border-radius: 0 0 var(--radius-3xl) var(--radius-3xl);
}

.btn-modern {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 180px;
  justify-content: center;
}

.btn-primary {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.close-button {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  width: 36px;
  height: 36px;
  border: none;
  background: rgba(255, 255, 255, 0.9);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--gray-600);
  z-index: 10;
}

.close-button:hover {
  background: white;
  color: var(--gray-900);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.close-button:active {
  transform: scale(0.95);
}

/* Responsive Design */
@media (max-width: 640px) {
  .forced-password-modal {
    max-width: 400px;
    margin: var(--space-4);
    max-height: 85vh;
  }

  .modal-icon {
    padding: var(--space-6) var(--space-6) var(--space-3);
  }

  .icon-container {
    width: 56px;
    height: 56px;
  }

  .modal-content {
    padding: var(--space-3) var(--space-6) var(--space-4);
  }

  .modal-title {
    font-size: 1.25rem;
  }

  .modal-actions {
    padding: var(--space-4) var(--space-6) var(--space-6);
  }

  .btn-modern {
    min-width: 100%;
  }
}
</style>