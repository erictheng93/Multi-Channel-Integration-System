<template>
  <div
    class="login-page"
    :data-theme="isLightMode ? 'light' : 'dark'"
  >
    <button
      type="button"
      class="theme-btn"
      :aria-label="isLightMode ? '切換至深色模式' : '切換至淺色模式'"
      @click="toggleTheme"
    >
      <svg
        v-if="isLightMode"
        class="ico"
        viewBox="0 0 24 24"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
      <svg
        v-else
        class="ico"
        viewBox="0 0 24 24"
      >
        <circle
          cx="12"
          cy="12"
          r="4"
        />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>

    <div class="stage">
      <div class="wrap">
        <!-- Brand side (desktop only) -->
        <section class="brand-side">
          <div
            class="wheel-box"
            aria-hidden="true"
          >
            <DiscRing
              class="wheel"
              :spin-seconds="90"
              spin
            />
          </div>

          <div class="brand-top">
            <div class="brand-mark">
              <svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg>
            </div>
            <div class="brand-name">
              多渠道客服
            </div>
          </div>

          <div class="brand-copy">
            <h1>全通路客服整合平台</h1>
            <p>LINE 官方帳號與 Messenger 的客戶對話，集中在同一個工作台回覆與追蹤。</p>
            <div class="channels">
              <span class="ui-chip"><span class="ui-ch ui-ch-line"><svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg></span>LINE 官方帳號</span>
              <span class="ui-chip"><span class="ui-ch ui-ch-fb"><svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg></span>Facebook Messenger</span>
            </div>
          </div>

          <div class="brand-foot">
            Daiwan Abrasives Corp
          </div>
        </section>

        <!-- Form side -->
        <section class="form-side">
          <div class="m-brand">
            <DiscRing
              class="m-disc"
              aria-hidden="true"
              :size="340"
              :grain="false"
              fade="strong"
            />
            <div class="brand-mark">
              <svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg>
            </div>
            <b>全通路客服整合平台</b>
          </div>

          <div class="auth">
            <h2>登入</h2>
            <p class="lede">
              使用公司帳號繼續進入客服工作台。
            </p>

            <form
              novalidate
              @submit.prevent="handleLogin"
            >
              <div
                class="ui-field"
                :class="{ invalid: emailError }"
              >
                <label for="email">電子郵件</label>
                <input
                  id="email"
                  v-model="formData.email"
                  class="ui-input"
                  type="email"
                  autocomplete="email"
                  placeholder="name@dacit.net"
                  required
                  :disabled="loading"
                  :aria-invalid="!!emailError"
                  @focus="emailFocused = true"
                  @blur="emailFocused = false; emailTouched = true"
                >
                <span
                  v-if="emailError"
                  class="ui-hint field-error"
                >{{ emailError }}</span>
              </div>

              <div
                class="ui-field"
                :class="{ invalid: passwordError }"
              >
                <label for="password">密碼</label>
                <div class="pw">
                  <input
                    id="password"
                    v-model="formData.password"
                    class="ui-input"
                    :type="showPassword ? 'text' : 'password'"
                    autocomplete="current-password"
                    required
                    :disabled="loading"
                    :aria-invalid="!!passwordError"
                    @focus="passwordFocused = true"
                    @blur="passwordFocused = false; passwordTouched = true"
                  >
                  <button
                    type="button"
                    class="pw-toggle"
                    :aria-label="showPassword ? '隱藏密碼' : '顯示密碼'"
                    :disabled="loading"
                    @click="showPassword = !showPassword"
                  >
                    <svg
                      v-if="!showPassword"
                      class="ico"
                      viewBox="0 0 24 24"
                    >
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                      />
                    </svg>
                    <svg
                      v-else
                      class="ico"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6M3 3l18 18" />
                    </svg>
                  </button>
                </div>
                <span
                  v-if="passwordError"
                  class="ui-hint field-error"
                >{{ passwordError }}</span>
              </div>

              <Transition name="alert-reveal">
                <div
                  v-if="error && !loading"
                  class="alert"
                  role="alert"
                  aria-live="assertive"
                >
                  <svg
                    class="ico"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                    />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <span>{{ error }}</span>
                </div>
              </Transition>

              <button
                type="submit"
                class="btn btn-primary submit-btn"
                :class="{ 'is-loading': loading }"
                :disabled="loading || !isValid"
              >
                <span class="btn-text">{{ submitLabel }}</span>
                <svg
                  v-if="isValid"
                  class="ico"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>

              <div
                v-if="isDev && $route.query.debug === '1'"
                class="debug-info"
              >
                <code>Loading: {{ loading }} | Valid: {{ isValid }} | Theme: {{ isLightMode ? 'light' : 'dark' }}</code>
              </div>
            </form>
          </div>

          <div class="m-foot">
            Daiwan Abrasives Corp
          </div>
        </section>
      </div>
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
import { useAuthStore } from '@/stores/auth'
import { useI18n } from '@/composables/useI18n'
import { useModernForm } from '@/composables/useModernVue'
import { useLoginAttempts } from '@/composables/useLoginAttempts'
import ForcedPasswordChange from '@/components/auth/ForcedPasswordChange.vue'
import DiscRing from '@/components/ui/DiscRing.vue'
import { ROLES } from '@/constants/roles'
import { validateLoginEmail, validateLoginPassword } from '@/utils/login-validation'

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
const showPassword = ref(false)

// Errors show once the field was touched or the form was submitted
const emailError = computed(() => (emailTouched.value || formSubmitted.value) ? errors.value.email : null)
const passwordError = computed(() => (passwordTouched.value || formSubmitted.value) ? errors.value.password : null)

// Validation-driven label: tells the user what is still missing instead of a dead "繼續"
const submitLabel = computed(() => {
  if (loading.value) {return '登入中'}
  if (validateLoginEmail(formData.value.email)) {return '輸入電子郵件'}
  if (validateLoginPassword(formData.value.password)) {return '輸入密碼'}
  return '繼續'
})

// ===== Form Validators =====
setValidator('email', (value) => validateLoginEmail(value))

// Only "required": password composition rules apply when a password is created or changed,
// not when logging in with an existing one (see utils/login-validation.ts).
setValidator('password', (value) => validateLoginPassword(value))

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
.login-page {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--ui-canvas);
  color: var(--ui-ink);
  font-family: var(--ui-font-ui);
}

.ico {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.stage {
  display: grid;
  place-items: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 40px 24px;
  overflow: hidden;
}

.wrap {
  width: min(1080px, 100%);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 96px;
  align-items: center;
}

.theme-btn {
  position: fixed;
  top: 20px;
  right: 24px;
  z-index: 5;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-pill);
  color: var(--ui-ink-2);
  cursor: pointer;
  transition: box-shadow var(--ui-dur) var(--ui-ease);
}

.theme-btn:hover {
  box-shadow: var(--ui-shadow-raised);
}

/* Brand side */
.brand-side {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 520px;
  padding: 8px 0;
}

.brand-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--ui-accent);
}

.brand-mark svg {
  width: 18px;
  height: 18px;
  fill: #fff;
}

.brand-name {
  font: 600 15px var(--ui-font-display);
}

.brand-copy {
  position: relative;
  z-index: 1;
  max-width: 420px;
}

.brand-copy h1 {
  font: 700 40px/1.15 var(--ui-font-display);
  letter-spacing: -0.03em;
}

.brand-copy p {
  max-width: 34ch;
  margin-top: 14px;
  font-size: 16px;
  line-height: 1.6;
  color: var(--ui-muted);
}

.channels {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 26px;
}

.channels .ui-chip {
  height: 32px;
  padding: 0 12px 0 8px;
  cursor: default;
}

.brand-foot {
  position: relative;
  z-index: 1;
  margin-top: 40px;
  font-size: var(--ui-t-cap);
  font-weight: 500;
  color: var(--ui-muted);
}

/* Abrasive disc: bond rings plus fine grain at the rim, behind the brand column only */
/* Offset to the right so the text column clears it; the form card sits over its right half */
.wheel-box {
  position: absolute;
  left: calc(100% + 24px);
  top: 50%;
  z-index: 0;
  width: 600px;
  height: 600px;
  margin: -300px 0 0 -300px;
  color: var(--ui-accent);
  opacity: 0.6;
  pointer-events: none;
}

/* The disc itself is the shared <DiscRing> (it fades its own edge and honours reduced motion) */

/* Dark: the disc turns white for contrast on the black canvas */
.login-page[data-theme='dark'] .wheel-box .ui-disc {
  --ui-disc-weight: 1.8;
  color: #fff;
}

/* Form side */
.form-side {
  position: relative;
  z-index: 1;
}

.auth {
  width: 100%;
  padding: 34px 32px 28px;
  border-radius: 28px;
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-raised);
}

.auth h2 {
  font: 700 24px/1.2 var(--ui-font-display);
  letter-spacing: -0.02em;
}

.lede {
  margin-top: 6px;
  font-size: 14px;
  color: var(--ui-muted);
}

.auth form {
  display: grid;
  gap: 16px;
  margin-top: 24px;
}

.auth .ui-input {
  height: 46px;
  border-radius: 14px;
  font-size: 15px;
}

.pw {
  position: relative;
}

.pw .ui-input {
  padding-right: 48px;
}

.pw-toggle {
  position: absolute;
  top: 50%;
  right: 4px;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ui-muted);
  transform: translateY(-50%);
  cursor: pointer;
}

.pw-toggle:hover:not(:disabled) {
  color: var(--ui-ink-2);
  background: var(--ui-fill);
}

.ui-field.invalid .ui-input {
  box-shadow: inset 0 0 0 1px var(--ui-red), 0 0 0 4px var(--ui-red-soft);
}

.field-error {
  color: var(--ui-red-ink);
}

.alert {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
  font-size: 13px;
  line-height: 1.45;
}

.alert .ico {
  flex: none;
  width: 16px;
  height: 16px;
  margin-top: 2px;
}

.alert-reveal-enter-active,
.alert-reveal-leave-active {
  transition: opacity var(--ui-dur) var(--ui-ease), transform var(--ui-dur) var(--ui-ease);
}

.alert-reveal-enter-from,
.alert-reveal-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Disabled "繼續" reads as an iOS grey control until the form is valid */
.auth .submit-btn {
  height: 48px;
  margin-top: 4px;
  border-radius: 14px;
  font-size: 15.5px;
}

.submit-btn .ico {
  transition: transform var(--ui-dur) var(--ui-ease);
}

.submit-btn:hover:not(:disabled) .ico {
  transform: translateX(3px);
}

.submit-btn:disabled {
  opacity: 1;
  background: color-mix(in srgb, var(--ui-accent) 42%, var(--ui-surface));
  color: #fff;
}

.submit-btn.is-loading:disabled {
  background: var(--ui-accent);
}

.submit-btn.is-loading {
  opacity: 0.7;
}

.debug-info {
  font-size: 13px;
  color: var(--ui-muted);
}

.m-brand,
.m-foot {
  display: none;
}

.m-brand {
  position: relative;
  isolation: isolate;
}

/* Phone: a cropped ring behind the logo (decorative, never behind body text) */
.m-disc {
  position: absolute;
  left: 50%;
  top: 8px;
  z-index: -1;
  margin: -170px 0 0 -170px;
  color: var(--ui-accent);
  opacity: 0.55;
  pointer-events: none;
}

@media (max-width: 1024px) {
  .stage {
    align-content: center;
    padding: 72px 16px 32px;
  }

  .wrap {
    grid-template-columns: minmax(0, 420px);
    justify-content: center;
    gap: 0;
  }

  .brand-side {
    display: none;
  }

  .m-brand {
    display: block;
    margin-bottom: 24px;
    text-align: center;
  }

  .m-brand .brand-mark {
    width: 44px;
    height: 44px;
    margin: 0 auto 12px;
    border-radius: 14px;
  }

  .m-brand .brand-mark svg {
    width: 24px;
    height: 24px;
  }

  .m-brand b {
    display: block;
    font: 700 20px/1.2 var(--ui-font-display);
    letter-spacing: -0.02em;
  }

  .m-foot {
    display: flex;
    justify-content: center;
    margin-top: 24px;
    font-size: var(--ui-t-cap);
    font-weight: 500;
    color: var(--ui-muted);
  }

  .theme-btn {
    top: 14px;
    right: 14px;
  }
}

@media (max-width: 480px) {
  .auth {
    padding: 28px 22px 24px;
    border-radius: 24px;
  }
}
</style>
