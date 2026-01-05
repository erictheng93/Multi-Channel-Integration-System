<template>
  <div
    class="login-page"
    :class="{ 'light-mode': isLightMode }"
  >
    <!-- Theme Toggle -->
    <ThemeToggle
      :is-light-mode="isLightMode"
      @toggle="toggleTheme"
    />

    <!-- Ambient Background -->
    <div class="ambient-bg">
      <div class="ambient-orb orb-1" />
      <div class="ambient-orb orb-2" />
      <div class="ambient-orb orb-3" />
      <div class="noise-overlay" />
    </div>

    <!-- Glass Card -->
    <div class="glass-card">
      <!-- Header -->
      <div class="card-header">
        <h1 class="headline">
          全通路客服整合平台
        </h1>
      </div>

      <!-- Form -->
      <form
        class="auth-form"
        @submit.prevent="handleLogin"
      >
        <!-- Email Field -->
        <FormField
          id="email"
          v-model="formData.email"
          type="email"
          label="電子郵件"
          autocomplete="email"
          :error="errors.email"
          :touched="emailTouched"
          :submitted="formSubmitted"
          :disabled="loading"
          required
          @focus="emailFocused = true"
          @blur="emailFocused = false; emailTouched = true"
        />

        <!-- Password Field -->
        <FormField
          id="password"
          v-model="formData.password"
          type="password"
          label="密碼"
          autocomplete="current-password"
          :error="errors.password"
          :touched="passwordTouched"
          :submitted="formSubmitted"
          :disabled="loading"
          required
          @focus="passwordFocused = true"
          @blur="passwordFocused = false; passwordTouched = true"
        />

        <!-- Submit Button -->
        <button
          type="submit"
          class="submit-btn"
          :class="{ 'is-loading': loading }"
          :disabled="loading || !isValid"
        >
          <span class="btn-text">繼續</span>
          <span class="btn-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
          <span
            v-if="loading"
            class="btn-loader"
          />
        </button>

        <!-- Error Alert -->
        <Transition name="alert-reveal">
          <div
            v-if="error && !loading"
            class="error-banner"
            role="alert"
            aria-live="assertive"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
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
            <span>{{ error }}</span>
          </div>
        </Transition>

        <!-- Debug (仅开发环境) -->
        <div
          v-if="isDev && $route.query.debug === '1'"
          class="debug-info"
        >
          <code>Loading: {{ loading }} | Valid: {{ isValid }} | Theme: {{ isLightMode ? 'light' : 'dark' }}</code>
        </div>
      </form>

      <!-- Footer Links -->
      <div class="card-footer">
        <router-link
          to="/register"
          class="footer-link"
        >
          建立帳號
        </router-link>
        <span class="footer-divider" />
        <router-link
          to="/forgot-password"
          class="footer-link"
        >
          忘記密碼
        </router-link>
      </div>

      <!-- Social Divider -->
      <div class="social-section">
        <div class="section-divider">
          <span class="divider-line" />
          <span class="divider-text">或</span>
          <span class="divider-line" />
        </div>

        <button
          type="button"
          class="social-btn"
          disabled
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span>使用 Google 登入</span>
        </button>
      </div>
    </div>

    <!-- Brand -->
    <div class="brand-mark">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span>Daiwan Abrasives Corp</span>
    </div>

    <!-- Forced Password Change Modal -->
    <ForcedPasswordChange
      v-if="showForcedPasswordChange"
      :temp-token="forcedPasswordChangeData.tempToken"
      :agent="forcedPasswordChangeData.agent"
      @success="onPasswordChangeSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from '@/composables/useI18n'
import { useModernForm } from '@/composables/useModernVue'
import { useLoginAttempts } from '@/composables/useLoginAttempts'
import ForcedPasswordChange from '@/components/auth/ForcedPasswordChange.vue'
import FormField from '@/components/auth/FormField.vue'
import ThemeToggle from '@/components/auth/ThemeToggle.vue'
import { ROLES } from '@/constants/roles'

// ===== Composables =====
const { login, loading, error, clearError } = useAuth()
const authStore = useAuthStore()
const router = useRouter()
const loginAttempts = useLoginAttempts()
useI18n() // Reserved for future i18n support

// ===== Development Check =====
const isDev = import.meta.env.DEV

// ===== Form State =====
const { formData, errors, isValid, setValidator, validateForm } = useModernForm({
  email: '',
  password: ''
})

// ===== Theme State =====
const isLightMode = ref(true)

onMounted(() => {
  const savedTheme = localStorage.getItem('login-theme')
  if (savedTheme) {
    isLightMode.value = savedTheme === 'light'
  }
  validateForm()
})

const toggleTheme = () => {
  isLightMode.value = !isLightMode.value
  localStorage.setItem('login-theme', isLightMode.value ? 'light' : 'dark')
}

// ===== Field Focus States =====
const emailFocused = ref(false)
const passwordFocused = ref(false)
const emailTouched = ref(false)
const passwordTouched = ref(false)
const formSubmitted = ref(false)

// ===== Form Validators =====
setValidator('email', (value) => {
  if (!value || value === '') {
    return '請輸入電子郵件'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return '請輸入有效的電子郵件格式'
  }
  return null
})

setValidator('password', (value) => {
  if (!value || value === '') {
    return '請輸入密碼'
  } else if (value.length < 8) {
    return '密碼至少需要 8 個字元'
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
    return '密碼必須包含大小寫字母和數字'
  }
  return null
})

// ===== Password Change Modal =====
const showForcedPasswordChange = ref(false)
const forcedPasswordChangeData = reactive({
  tempToken: '',
  agent: {
    id: '',
    email: '',
    name: '',
    role: ROLES.AGENT as typeof ROLES.ADMIN | typeof ROLES.AGENT
  }
})

const onPasswordChangeSuccess = () => {
  showForcedPasswordChange.value = false
}

// ===== Login Handler =====
const handleLogin = async (event?: Event) => {
  if (event) {event.preventDefault()}
  if (loading.value) {return}

  // Check if account is locked
  loginAttempts.checkAndClearLock()
  if (loginAttempts.isLocked.value) {
    authStore.error = loginAttempts.lockMessage.value || '帳號已鎖定'
    return
  }

  // Mark form as submitted
  formSubmitted.value = true

  // Validate form
  if (!isValid.value) {return}

  clearError()

  try {
    const result = await login({
      email: formData.value.email,
      password: formData.value.password
    })

    if (result.success) {
      // Reset login attempts on success
      loginAttempts.reset()

      try {
        await router.push('/dashboard')
      } catch (navError) {
        console.warn('Navigation after login failed:', navError)
      }
    } else if (result.mustChangePassword) {
      showForcedPasswordChange.value = true
      forcedPasswordChangeData.tempToken = result.tempToken || ''
      forcedPasswordChangeData.agent = result.agent || {
        id: '',
        email: formData.value.email,
        name: '',
        role: ROLES.AGENT
      }
    } else {
      // Record failed attempt
      const isLocked = loginAttempts.recordFailedAttempt()
      if (isLocked) {
        authStore.error = loginAttempts.lockMessage.value || '帳號已鎖定'
      }
    }
  } catch (err) {
    console.error('Login error:', err)

    // Record failed attempt
    const isLocked = loginAttempts.recordFailedAttempt()
    if (isLocked) {
      authStore.error = loginAttempts.lockMessage.value || '帳號已鎖定'
    } else if (err instanceof Error) {
      authStore.error = err.message
    } else {
      authStore.error = '登入失敗,請稍後重試'
    }
  }
}
</script>

<style scoped>
@import '@/assets/styles/login.css';
</style>
