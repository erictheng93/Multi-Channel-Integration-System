<template>
  <div class="login-page">
    <div class="login-container">
      <!-- Logo Section -->
      <div class="logo-section">
        <div class="logo-icon">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <h1 class="logo-text">
          {{ t('login.title') }}
        </h1>
      </div>

      <!-- Login Form -->
      <div class="form-section">
        <div class="form-header">
          <h2>{{ t('login.subtitle') }}</h2>
          <p>請登入您的帳戶</p>
        </div>

        <form
          class="login-form"
          @submit.prevent="handleLogin"
        >
          <div class="input-group">
            <input
              id="email"
              v-model="formData.email"
              type="email"
              class="form-input"
              :class="{ 'error': errors.email }"
              :placeholder="t('login.emailPlaceholder')"
              autocomplete="email"
              required
              :disabled="loading"
            >
            <div
              v-if="errors.email"
              class="error-message"
            >
              {{ errors.email }}
            </div>
          </div>

          <div class="input-group">
            <div class="password-wrapper">
              <input
                id="password"
                v-model="formData.password"
                :type="showPassword ? 'text' : 'password'"
                class="form-input"
                :class="{ 'error': errors.password }"
                :placeholder="t('login.passwordPlaceholder')"
                autocomplete="current-password"
                required
                :disabled="loading"
              >
              <button
                type="button"
                class="password-toggle"
                :disabled="loading"
                @click="showPassword = !showPassword"
              >
                <svg
                  v-if="!showPassword"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                </svg>
                <svg
                  v-else
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <line
                    x1="1"
                    y1="1"
                    x2="23"
                    y2="23"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                </svg>
              </button>
            </div>
            <div
              v-if="errors.password"
              class="error-message"
            >
              {{ errors.password }}
            </div>
          </div>

          <div class="form-options">
            <label class="remember-me">
              <input
                id="rememberMe"
                v-model="formData.rememberMe"
                type="checkbox"
                class="checkbox"
                name="rememberMe"
              >
              <span>記住我</span>
            </label>
          </div>

          <button
            type="submit"
            class="submit-btn"
            :disabled="loading || !isValid"
          >
            <span
              v-if="loading"
              class="loading-spinner"
            />
            <span v-else>{{ t('login.loginButton') }}</span>
          </button>

          <!-- 調試信息 - 只在需要時顯示 -->
          <div
            v-if="$route.query.debug === '1'"
            class="debug-info"
            style="margin-top: 10px; padding: 10px; background: #f0f0f0; font-size: 12px; border: 1px solid #ccc;"
          >
            <div><strong>Debug Info:</strong></div>
            <div>Loading: {{ loading }}</div>
            <div>IsValid: {{ isValid }}</div>
            <div>Disabled condition: {{ loading || !isValid }}</div>
            <div>Email: '{{ formData.email }}'</div>
            <div>Password length: {{ formData.password ? formData.password.length : 0 }}</div>
            <div>Errors: {{ JSON.stringify(errors) }}</div>
            <div>Validators count: {{ Object.keys(validators || {}).length }}</div>
          </div>
        </form>

        <!-- Error Alert - Improved version -->
        <div
          v-if="error && !loading"
          class="error-alert"
        >
          <svg
            width="20"
            height="20"
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
            <line
              x1="12"
              y1="8"
              x2="12"
              y2="12"
              stroke="currentColor"
              stroke-width="2"
            />
            <line
              x1="12"
              y1="16"
              x2="12.01"
              y2="16"
              stroke="currentColor"
              stroke-width="2"
            />
          </svg>
          <span>{{ error }}</span>
        </div>

        <!-- Social Login Section -->
        <div class="divider">
          <span>或使用其他方式登入</span>
        </div>

        <div class="social-login">
          <button
            type="button"
            class="social-btn"
            disabled
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                fill="currentColor"
              />
            </svg>
            <span>Google</span>
          </button>
        </div>

        <!-- Footer Links -->
        <div class="form-footer">
          <router-link
            to="/forgot-password"
            class="footer-link"
          >
            忘記密碼？
          </router-link>
          <span class="separator">•</span>
          <router-link
            to="/register"
            class="footer-link"
          >
            註冊新帳號
          </router-link>
        </div>
      </div>
    </div>

    <!-- 強制密碼更改模態框 -->
    <ForcedPasswordChange
      v-if="showForcedPasswordChange"
      :temp-token="forcedPasswordChangeData.tempToken"
      :agent="forcedPasswordChangeData.agent"
      @success="onPasswordChangeSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from '@/composables/useI18n'
import { useModernForm } from '@/composables/useModernVue'
import ForcedPasswordChange from '@/components/auth/ForcedPasswordChange.vue'

const { login, loading, error, clearError } = useAuth()
const { t } = useI18n()
const router = useRouter()

const { formData, errors, isValid, validators, setValidator, validateForm } = useModernForm({
  email: '',
  password: '',
  rememberMe: false
})

// 立即設置驗證器 - 不要等到 onMounted
setValidator('email', (value) => {
  if (!value || value === '') {
    return '請輸入郵箱地址'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return '請輸入有效的郵箱地址'
  }
  return null
})

setValidator('password', (value) => {
  if (!value || value === '') {
    return '請輸入密碼'
  } else if (value.length < 6) {
    return '密碼長度至少為 6 位'
  }
  return null
})

const showPassword = ref(false)
const showForcedPasswordChange = ref(false)
const forcedPasswordChangeData = reactive({
  tempToken: '',
  agent: {
    id: '',
    email: '',
    name: '',
    role: 'agent' as 'admin' | 'team' | 'agent'
  }
})

// 監控認證狀態，當用戶已認證時自動導航到 dashboard
const authStore = useAuthStore()
watch(() => authStore.isAuthenticated, (isAuthenticated) => {
  if (isAuthenticated && router.currentRoute.value.path === '/login') {
    router.push('/dashboard').catch(() => {
      window.location.href = '/dashboard';
    });
  }
}, { immediate: true })

// 初始驗證
onMounted(() => {
  validateForm()
})

// 密碼強制更改成功處理
const onPasswordChangeSuccess = () => {
  showForcedPasswordChange.value = false
  // 不需要額外處理，ForcedPasswordChange組件會自動處理重新登入
}

// 登入處理函數
const handleLogin = async (event?: Event) => {
  // 防止表單默認提交
  if (event) {
    event.preventDefault()
  }

  // 防止重複提交
  if (loading.value) {
    return
  }

  // 清除之前的錯誤
  clearError()

  try {
    // 調用登入 API
    const result = await login({
      email: formData.value.email,
      password: formData.value.password
    })

    if (result.success) {
      // 登入成功，router 會自動導航
      // authStore 的 watch 會處理導航邏輯
    } else if (result.mustChangePassword) {
      // 需要強制更改密碼
      showForcedPasswordChange.value = true
      forcedPasswordChangeData.tempToken = result.tempToken || ''
      forcedPasswordChangeData.agent = result.agent || {
        id: '',
        email: formData.value.email,
        name: '',
        role: 'agent'
      }
    }
  } catch (err) {
    console.error('Login error:', err)
    const authStore = useAuthStore()
    authStore.error = '登入過程中發生錯誤，請稍後再試'
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1rem;
}

.login-container {
  width: 100%;
  max-width: 420px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  padding: 2.5rem;
}

.logo-section {
  text-align: center;
  margin-bottom: 2rem;
}

.logo-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  margin-bottom: 1rem;
  color: white;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0;
}

.form-section {
  width: 100%;
}

.form-header {
  text-align: center;
  margin-bottom: 2rem;
}

.form-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 0.5rem 0;
}

.form-header p {
  color: #718096;
  font-size: 0.875rem;
}

.login-form {
  width: 100%;
}

.input-group {
  margin-bottom: 1.25rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  transition: all 0.2s;
  outline: none;
}

.form-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input.error {
  border-color: #fc8181;
}

.form-input:disabled {
  background-color: #f7fafc;
  cursor: not-allowed;
}

.password-wrapper {
  position: relative;
}

.password-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #718096;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.password-toggle:hover:not(:disabled) {
  color: #4a5568;
}

.error-message {
  color: #fc8181;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.form-options {
  margin-bottom: 1.5rem;
}

.remember-me {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.checkbox {
  margin-right: 0.5rem;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.remember-me span {
  color: #4a5568;
  font-size: 0.875rem;
}

.submit-btn {
  width: 100%;
  padding: 0.875rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-alert {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 8px;
  color: #c53030;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.divider {
  text-align: center;
  margin: 1.5rem 0;
  position: relative;
  color: #a0aec0;
  font-size: 0.875rem;
}

.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: calc(50% - 60px);
  height: 1px;
  background: #e2e8f0;
}

.divider::before {
  left: 0;
}

.divider::after {
  right: 0;
}

.social-login {
  margin-bottom: 1.5rem;
}

.social-btn {
  width: 100%;
  padding: 0.75rem;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  color: #4a5568;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: not-allowed;
  opacity: 0.5;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.form-footer {
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.footer-link {
  color: #667eea;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: color 0.2s;
}

.footer-link:hover {
  color: #764ba2;
  text-decoration: underline;
}

.separator {
  color: #cbd5e0;
}

/* Responsive Design */
@media (max-width: 480px) {
  .login-container {
    padding: 1.5rem;
    border-radius: 0;
    box-shadow: none;
    height: 100vh;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .login-page {
    padding: 0;
  }
}
</style>