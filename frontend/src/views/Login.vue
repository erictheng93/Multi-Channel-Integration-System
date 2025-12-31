<template>
  <div
    class="login-page"
    :class="{ 'light-mode': isLightMode }"
  >
    <!-- Theme Toggle -->
    <button
      type="button"
      class="theme-toggle"
      :aria-label="isLightMode ? '切換至深色模式' : '切換至淺色模式'"
      @click="toggleTheme"
    >
      <span class="toggle-icon sun-icon">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <circle
            cx="12"
            cy="12"
            r="5"
          />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </span>
      <span class="toggle-icon moon-icon">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </span>
    </button>

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
        <div class="field-group">
          <div
            class="field-wrapper"
            :class="{
              'is-focused': emailFocused,
              'has-value': formData.email,
              'has-error': showEmailError
            }"
          >
            <input
              id="email"
              v-model="formData.email"
              type="email"
              class="field-input"
              placeholder=" "
              autocomplete="email"
              required
              :disabled="loading"
              @focus="emailFocused = true"
              @blur="emailFocused = false; emailTouched = true"
            >
            <label
              for="email"
              class="field-label"
            >電子郵件</label>
            <div class="field-line" />
          </div>
          <Transition name="error-reveal">
            <span
              v-if="showEmailError"
              class="field-error"
            >{{ errors.email }}</span>
          </Transition>
        </div>

        <!-- Password Field -->
        <div class="field-group">
          <div
            class="field-wrapper"
            :class="{
              'is-focused': passwordFocused,
              'has-value': formData.password,
              'has-error': showPasswordError
            }"
          >
            <input
              id="password"
              v-model="formData.password"
              :type="showPassword ? 'text' : 'password'"
              class="field-input"
              placeholder=" "
              autocomplete="current-password"
              required
              :disabled="loading"
              @focus="passwordFocused = true"
              @blur="passwordFocused = false; passwordTouched = true"
            >
            <label
              for="password"
              class="field-label"
            >密碼</label>
            <button
              type="button"
              class="visibility-toggle"
              :disabled="loading"
              @click="showPassword = !showPassword"
            >
              <svg
                v-if="!showPassword"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                />
              </svg>
              <svg
                v-else
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <line
                  x1="2"
                  x2="22"
                  y1="2"
                  y2="22"
                />
              </svg>
            </button>
            <div class="field-line" />
          </div>
          <Transition name="error-reveal">
            <span
              v-if="showPasswordError"
              class="field-error"
            >{{ errors.password }}</span>
          </Transition>
        </div>

        <!-- Remember Me - Hidden until feature is fully implemented -->
        <!-- TODO: Implement rememberMe logic in useAuth.ts and auth store -->
        <!-- <div class="options-row">
          <label class="remember-toggle">
            <input
              v-model="formData.rememberMe"
              type="checkbox"
              class="toggle-input"
            >
            <span class="toggle-track">
              <span class="toggle-thumb" />
            </span>
            <span class="toggle-label">保持登入狀態</span>
          </label>
        </div> -->

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

        <!-- Debug -->
        <div
          v-if="$route.query.debug === '1'"
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
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from '@/composables/useI18n'
import { useModernForm } from '@/composables/useModernVue'
import ForcedPasswordChange from '@/components/auth/ForcedPasswordChange.vue'
import { ROLES } from '@/constants/roles'

const { login, loading, error, clearError } = useAuth()
useI18n() // Reserved for future i18n support
const router = useRouter()

const { formData, errors, isValid, setValidator, validateForm } = useModernForm({
  email: '',
  password: '',
  rememberMe: false
})

// Theme state - 預設為淺色模式
const isLightMode = ref(true)

// Initialize theme from localStorage (default to light mode)
onMounted(() => {
  const savedTheme = localStorage.getItem('login-theme')
  if (savedTheme) {
    isLightMode.value = savedTheme === 'light'
  }
  // 如果沒有儲存的偏好，保持預設的淺色模式
  validateForm()
})

// Toggle theme
const toggleTheme = () => {
  isLightMode.value = !isLightMode.value
  localStorage.setItem('login-theme', isLightMode.value ? 'light' : 'dark')
}

// Focus states
const emailFocused = ref(false)
const passwordFocused = ref(false)

// Track if fields have been touched (interacted with)
const emailTouched = ref(false)
const passwordTouched = ref(false)
const formSubmitted = ref(false)

// Computed: should show error only after interaction
const showEmailError = computed(() =>
  (emailTouched.value || formSubmitted.value) && errors.value.email
)
const showPasswordError = computed(() =>
  (passwordTouched.value || formSubmitted.value) && errors.value.password
)

// Validators
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
  } else if (value.length < 6) {
    return '密碼至少需要 6 個字元'
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
    role: ROLES.AGENT as typeof ROLES.ADMIN | typeof ROLES.TEAM | typeof ROLES.AGENT
  }
})

const onPasswordChangeSuccess = () => {
  showForcedPasswordChange.value = false
}

const handleLogin = async (event?: Event) => {
  if (event) {event.preventDefault()}
  if (loading.value) {return}

  // Mark form as submitted to show all validation errors
  formSubmitted.value = true

  // If form is invalid, don't proceed
  if (!isValid.value) {return}

  clearError()

  try {
    const result = await login({
      email: formData.value.email,
      password: formData.value.password
    })

    if (result.success) {
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
    }
  } catch (err) {
    console.error('Login error:', err)
  }
}
</script>

<style scoped>
/* ==========================================================================
   APPLE DESIGN SYSTEM - CSS CUSTOM PROPERTIES
   ========================================================================== */
.login-page {
  /* ===== DARK MODE (Default) ===== */
  --bg-primary: #000000;
  --bg-secondary: #1d1d1f;
  --bg-tertiary: #2d2d2d;

  --text-primary: #f5f5f7;
  --text-secondary: #86868b;
  --text-tertiary: #6e6e73;
  --text-muted: #424245;

  --glass-bg: rgba(255, 255, 255, 0.05);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-hover: rgba(255, 255, 255, 0.08);

  /* 柔和淺灰調 - 中性邀請感 */
  --input-bg: rgba(160, 160, 165, 0.08);
  --input-bg-hover: rgba(160, 160, 165, 0.12);
  --input-bg-focus: rgba(180, 180, 185, 0.16);

  --btn-bg: #f5f5f7;
  --btn-bg-hover: #ffffff;
  --btn-text: #000000;

  --accent-green: #34c759;
  --accent-error: #ff453a;
  --accent-error-bg: rgba(255, 69, 58, 0.1);
  --accent-error-border: rgba(255, 69, 58, 0.2);

  --orb-1: radial-gradient(circle, #1a1a2e 0%, transparent 70%);
  --orb-2: radial-gradient(circle, #16213e 0%, transparent 70%);
  --orb-3: radial-gradient(circle, #1f1f3d 0%, transparent 70%);

  --toggle-track-bg: #424245;
  --noise-opacity: 0.03;

  /* Typography - 優雅中文字體支援 */
  --font-display: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
                  'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei',
                  'Helvetica Neue', sans-serif;
  --font-text: -apple-system, BlinkMacSystemFont, 'SF Pro Text',
               'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei',
               'Helvetica Neue', sans-serif;

  /* Spacing */
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;

  /* Border Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-xl: 28px;

  /* Transitions */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 200ms;
  --duration-normal: 400ms;
  --duration-slow: 600ms;
}

/* ===== LIGHT MODE ===== */
.login-page.light-mode {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f7;
  --bg-tertiary: #e8e8ed;

  --text-primary: #1d1d1f;
  --text-secondary: #6e6e73;
  --text-tertiary: #86868b;
  --text-muted: #a1a1a6;

  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(0, 0, 0, 0.08);
  --glass-hover: rgba(255, 255, 255, 0.9);

  /* 柔和淺灰調 - 溫暖中性 */
  --input-bg: rgba(120, 115, 110, 0.05);
  --input-bg-hover: rgba(120, 115, 110, 0.08);
  --input-bg-focus: rgba(100, 95, 90, 0.12);

  --btn-bg: #1d1d1f;
  --btn-bg-hover: #000000;
  --btn-text: #ffffff;

  --accent-green: #34c759;
  --accent-error: #ff3b30;
  --accent-error-bg: rgba(255, 59, 48, 0.08);
  --accent-error-border: rgba(255, 59, 48, 0.15);

  --orb-1: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
  --orb-2: radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, transparent 70%);
  --orb-3: radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, transparent 70%);

  --toggle-track-bg: #d1d1d6;
  --noise-opacity: 0.015;
}

/* ==========================================================================
   BASE RESET
   ========================================================================== */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ==========================================================================
   PAGE LAYOUT
   ========================================================================== */
.login-page {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  font-family: var(--font-text);
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition:
    background-color var(--duration-normal) ease,
    color var(--duration-normal) ease;
}

/* ==========================================================================
   THEME TOGGLE
   ========================================================================== */
.theme-toggle {
  position: fixed;
  top: var(--space-lg);
  right: var(--space-lg);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: 50%;
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  overflow: hidden;
}

.theme-toggle:hover {
  background: var(--glass-hover);
  transform: scale(1.05);
}

.theme-toggle:active {
  transform: scale(0.95);
}

.toggle-icon {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all var(--duration-normal) var(--ease-out-expo);
}

/* Dark mode: show moon, hide sun */
.sun-icon {
  opacity: 0;
  transform: rotate(-90deg) scale(0.5);
}

.moon-icon {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}

/* Light mode: show sun, hide moon */
.light-mode .sun-icon {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}

.light-mode .moon-icon {
  opacity: 0;
  transform: rotate(90deg) scale(0.5);
}

/* ==========================================================================
   AMBIENT BACKGROUND
   ========================================================================== */
.ambient-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  transition: opacity var(--duration-slow) ease;
}

.ambient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.4;
  animation: float 25s ease-in-out infinite;
  transition: background var(--duration-slow) ease;
}

.orb-1 {
  width: 800px;
  height: 800px;
  background: var(--orb-1);
  top: -300px;
  left: -200px;
  animation-delay: 0s;
}

.orb-2 {
  width: 600px;
  height: 600px;
  background: var(--orb-2);
  bottom: -200px;
  right: -150px;
  animation-delay: -8s;
}

.orb-3 {
  width: 400px;
  height: 400px;
  background: var(--orb-3);
  top: 50%;
  left: 60%;
  animation-delay: -16s;
}

.light-mode .ambient-orb {
  opacity: 0.6;
  filter: blur(100px);
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(20px, -30px) scale(1.02);
  }
  50% {
    transform: translate(-10px, 20px) scale(0.98);
  }
  75% {
    transform: translate(30px, 10px) scale(1.01);
  }
}

.noise-overlay {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: var(--noise-opacity);
  mix-blend-mode: overlay;
  transition: opacity var(--duration-slow) ease;
}

/* ==========================================================================
   GLASS CARD
   ========================================================================== */
.glass-card {
  position: relative;
  width: 100%;
  max-width: 440px;
  padding: 56px var(--space-xl) 48px;
  background: var(--glass-bg);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  animation: card-reveal 0.8s var(--ease-out-expo) backwards;
  transition:
    background-color var(--duration-normal) ease,
    border-color var(--duration-normal) ease,
    box-shadow var(--duration-normal) ease;
}

.light-mode .glass-card {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.03),
    0 2px 4px rgba(0, 0, 0, 0.02),
    0 12px 24px rgba(0, 0, 0, 0.06);
}

@keyframes card-reveal {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.96);
  }
}

/* ==========================================================================
   HEADER
   ========================================================================== */
.card-header {
  text-align: center;
  margin-bottom: 36px;
  /* Override global .card-header styles */
  display: block;
  padding: 0;
  border-bottom: none;
  justify-content: initial;
  align-items: initial;
}

.headline {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.3;
  color: var(--text-primary);
  margin: 0;
  text-align: center;
  animation: text-reveal 0.6s var(--ease-out-expo) 0.2s backwards;
  transition: color var(--duration-normal) ease;
}

.dot {
  color: var(--text-muted);
  transition: color var(--duration-normal) ease;
}

.subheadline {
  font-size: 17px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--text-secondary);
  margin: 0;
  animation: text-reveal 0.6s var(--ease-out-expo) 0.3s backwards;
  transition: color var(--duration-normal) ease;
}

@keyframes text-reveal {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

/* ==========================================================================
   FORM
   ========================================================================== */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.field-group {
  position: relative;
}

.field-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  height: 56px;
  background: transparent;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.field-input {
  width: 100%;
  height: 100%;
  padding: 24px 16px 8px;
  font-family: var(--font-text);
  font-size: 17px;
  font-weight: 400;
  color: var(--text-primary);
  background: var(--input-bg);
  border: none;
  border-radius: var(--radius-md);
  outline: none;
  transition:
    background-color var(--duration-fast) ease,
    color var(--duration-fast) ease;
}

.field-input::placeholder {
  color: transparent;
}

.field-input:hover {
  background: var(--input-bg-hover);
}

.field-input:focus {
  background: var(--input-bg-focus);
}

.field-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.field-label {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 17px;
  font-weight: 400;
  color: var(--text-secondary);
  pointer-events: none;
  transition: all var(--duration-fast) var(--ease-out-expo);
}

.field-wrapper.is-focused .field-label,
.field-wrapper.has-value .field-label {
  top: 14px;
  transform: translateY(0);
  font-size: 12px;
  color: var(--text-tertiary);
}

.field-line {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--text-primary);
  transform: scaleX(0);
  transform-origin: center;
  transition:
    transform var(--duration-normal) var(--ease-out-expo),
    background-color var(--duration-normal) ease;
}

.field-wrapper.is-focused .field-line {
  transform: scaleX(1);
}

.field-wrapper.has-error .field-input {
  background: var(--accent-error-bg);
}

.field-wrapper.has-error .field-line {
  background: var(--accent-error);
  transform: scaleX(1);
}

/* Visibility Toggle */
.visibility-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.visibility-toggle:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--input-bg);
}

.visibility-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Field Error */
.field-error {
  display: block;
  padding: var(--space-xs) 0 0 var(--space-md);
  font-size: 13px;
  color: var(--accent-error);
}

.error-reveal-enter-active,
.error-reveal-leave-active {
  transition: all var(--duration-fast) ease;
}

.error-reveal-enter-from,
.error-reveal-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ==========================================================================
   OPTIONS ROW
   ========================================================================== */
.options-row {
  padding: var(--space-xs) 0;
}

.remember-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
  user-select: none;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-track {
  position: relative;
  width: 44px;
  height: 26px;
  background: var(--toggle-track-bg);
  border-radius: 13px;
  transition: background var(--duration-fast) ease;
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 22px;
  height: 22px;
  background: #ffffff;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: transform var(--duration-fast) var(--ease-out-expo);
}

.toggle-input:checked + .toggle-track {
  background: var(--accent-green);
}

.toggle-input:checked + .toggle-track .toggle-thumb {
  transform: translateX(18px);
}

.toggle-input:focus + .toggle-track {
  box-shadow: 0 0 0 3px rgba(52, 199, 89, 0.3);
}

.toggle-label {
  font-size: 15px;
  color: var(--text-tertiary);
  transition: color var(--duration-normal) ease;
}

/* ==========================================================================
   SUBMIT BUTTON
   ========================================================================== */
.submit-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  width: 100%;
  height: 56px;
  margin-top: var(--space-md);
  font-family: var(--font-text);
  font-size: 17px;
  font-weight: 500;
  color: var(--btn-text);
  background: var(--btn-bg);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  overflow: hidden;
  transition: all var(--duration-fast) ease;
}

.submit-btn:hover:not(:disabled) {
  background: var(--btn-bg-hover);
  transform: scale(1.01);
}

.submit-btn:active:not(:disabled) {
  transform: scale(0.99);
}

.submit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.submit-btn.is-loading .btn-text,
.submit-btn.is-loading .btn-icon {
  opacity: 0;
}

.btn-icon {
  transition: transform var(--duration-fast) ease;
}

.submit-btn:hover:not(:disabled) .btn-icon {
  transform: translateX(4px);
}

.btn-loader {
  position: absolute;
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-top-color: var(--btn-text);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ==========================================================================
   ERROR BANNER
   ========================================================================== */
.error-banner {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--accent-error-bg);
  border: 1px solid var(--accent-error-border);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--accent-error);
  transition: all var(--duration-normal) ease;
}

.error-banner svg {
  flex-shrink: 0;
}

.alert-reveal-enter-active,
.alert-reveal-leave-active {
  transition: all var(--duration-normal) var(--ease-out-expo);
}

.alert-reveal-enter-from,
.alert-reveal-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ==========================================================================
   DEBUG
   ========================================================================== */
.debug-info {
  padding: var(--space-sm);
  background: var(--input-bg);
  border-radius: var(--radius-sm);
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 11px;
  color: var(--text-secondary);
  transition: all var(--duration-normal) ease;
}

/* ==========================================================================
   FOOTER
   ========================================================================== */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  margin-top: 32px;
}

.footer-link {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-tertiary);
  text-decoration: none;
  transition: color var(--duration-fast) ease;
}

.footer-link:hover {
  color: var(--text-primary);
}

.footer-divider {
  width: 4px;
  height: 4px;
  background: var(--text-muted);
  border-radius: 50%;
  transition: background-color var(--duration-normal) ease;
}

/* ==========================================================================
   SOCIAL SECTION
   ========================================================================== */
.social-section {
  margin-top: 28px;
}

.section-divider {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.divider-line {
  flex: 1;
  height: 1px;
  background: var(--glass-border);
  transition: background-color var(--duration-normal) ease;
}

.divider-text {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-muted);
  text-transform: lowercase;
  transition: color var(--duration-normal) ease;
}

.social-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  width: 100%;
  height: 50px;
  font-family: var(--font-text);
  font-size: 15px;
  font-weight: 400;
  color: var(--text-tertiary);
  background: transparent;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: not-allowed;
  opacity: 0.5;
  transition: all var(--duration-fast) ease;
}

.social-btn:not(:disabled):hover {
  background: var(--glass-hover);
  border-color: var(--glass-border);
  color: var(--text-primary);
}

/* ==========================================================================
   BRAND MARK
   ========================================================================== */
.brand-mark {
  position: fixed;
  bottom: var(--space-xl);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.02em;
  transition: color var(--duration-normal) ease;
}

.brand-mark svg {
  opacity: 0.6;
}

/* ==========================================================================
   RESPONSIVE
   ========================================================================== */
@media (max-width: 480px) {
  .login-page {
    padding: var(--space-md);
    align-items: flex-start;
    padding-top: 80px;
  }

  .theme-toggle {
    top: var(--space-md);
    right: var(--space-md);
    width: 44px;
    height: 44px;
  }

  .glass-card {
    padding: var(--space-xl) var(--space-lg);
    border-radius: var(--radius-lg);
  }

  .headline {
    font-size: 40px;
  }

  .subheadline {
    font-size: 15px;
  }

  .brand-mark {
    position: relative;
    bottom: auto;
    left: auto;
    transform: none;
    margin-top: var(--space-xl);
    justify-content: center;
  }

  .ambient-orb {
    filter: blur(80px);
  }

  .orb-1 {
    width: 400px;
    height: 400px;
  }

  .orb-2 {
    width: 300px;
    height: 300px;
  }

  .orb-3 {
    display: none;
  }
}

/* High contrast */
@media (prefers-contrast: high) {
  .field-input {
    border: 1px solid var(--text-muted);
  }

  .submit-btn {
    border: 2px solid var(--btn-text);
  }

  .theme-toggle {
    border-width: 2px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .ambient-orb {
    animation: none;
  }

  .glass-card {
    animation: none;
  }

  .headline,
  .subheadline {
    animation: none;
  }

  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
  }
}
</style>
