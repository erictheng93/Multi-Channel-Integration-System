<template>
  <div
    class="login-page"
    :data-theme="isLightMode ? 'light' : 'dark'"
  >
    <div class="shell">
      <!-- Brand stage: the abrasive wheel with every channel converging on one hub -->
      <section class="stage">
        <svg
          class="motif"
          viewBox="0 0 640 640"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <radialGradient
              id="lg-band"
              cx="320"
              cy="320"
              r="262"
              gradientUnits="userSpaceOnUse"
            >
              <stop
                offset="0.42"
                stop-color="#1d5fd1"
                stop-opacity="0.95"
              />
              <stop
                offset="1"
                stop-color="#0b2f6b"
                stop-opacity="0.95"
              />
            </radialGradient>
            <linearGradient
              id="lg-hub"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop
                offset="0"
                stop-color="#ffffff"
              />
              <stop
                offset="1"
                stop-color="#c9dcf7"
              />
            </linearGradient>
          </defs>
          <g class="grit">
            <path
              :d="gritPath"
              class="grit-ticks"
            />
          </g>
          <circle
            class="wheel-body"
            cx="320"
            cy="320"
            r="262"
            fill="url(#lg-band)"
          />
          <circle
            class="wheel-edge"
            cx="320"
            cy="320"
            r="262"
          />
          <circle
            class="wheel-ring"
            cx="320"
            cy="320"
            r="226"
          />
          <circle
            class="wheel-ring"
            cx="320"
            cy="320"
            r="190"
          />
          <circle
            class="wheel-ring"
            cx="320"
            cy="320"
            r="154"
          />
          <g
            v-for="f in flows"
            :key="f.id"
          >
            <path
              :d="f.d"
              class="flow"
              :class="f.cls"
            />
            <circle
              :cx="f.x"
              :cy="f.y"
              r="7"
              class="node"
              :class="f.cls"
            />
          </g>
          <circle
            class="hub"
            cx="320"
            cy="320"
            r="116"
            fill="url(#lg-hub)"
          />
          <circle
            class="hub-ring"
            cx="320"
            cy="320"
            r="98"
          />
          <circle
            v-for="b in bolts"
            :key="b.id"
            class="bolt"
            :cx="b.x"
            :cy="b.y"
            r="7"
          />
          <circle
            class="arbor"
            cx="320"
            cy="320"
            r="52"
          />
          <path
            class="arbor-glyph"
            transform="translate(320 320) scale(1.9) translate(-12 -12)"
            d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z"
          />
        </svg>

        <div class="brand-top">
          <div class="brand-mark">
            <svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg>
          </div>
          <div class="brand-name">
            <b>多渠道客服</b>
            <span>Daiwan Abrasives</span>
          </div>
        </div>

        <div class="brand-copy">
          <h1>全通路客服<br>整合平台</h1>
          <p>LINE 官方帳號與 Messenger 的客戶對話，集中在同一個工作台回覆與追蹤。</p>
          <div class="channels">
            <span class="chan"><span class="ui-ch ui-ch-line"><svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg></span>LINE 官方帳號</span>
            <span class="chan"><span class="ui-ch ui-ch-fb"><svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg></span>Facebook Messenger</span>
          </div>
        </div>
      </section>

      <!-- Sign-in panel -->
      <section class="panel">
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
                  placeholder="輸入密碼"
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
              :disabled="loading"
            >
              <span class="btn-text">{{ submitLabel }}</span>
              <svg
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
        <p class="panel-foot">
          Daiwan Abrasives Corp
        </p>
      </section>
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
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from '@/composables/useI18n'
import { useModernForm } from '@/composables/useModernVue'
import { useLoginAttempts } from '@/composables/useLoginAttempts'
import ForcedPasswordChange from '@/components/auth/ForcedPasswordChange.vue'
import { ROLES } from '@/constants/roles'
import { validateLoginEmail, validateLoginPassword } from '@/utils/login-validation'

// ===== Brand motif geometry (static, computed once) =====
const polar = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180
  return [320 + r * Math.cos(a), 320 + r * Math.sin(a)]
}
const fx = (n: number) => n.toFixed(1)

// Grit ticks around the rim: 144 hairlines, every sixth one longer
const gritPath = Array.from({ length: 144 }, (_, i) => {
  const deg = i * 2.5
  const [x1, y1] = polar(270, deg)
  const [x2, y2] = polar(i % 6 === 0 ? 300 : 286, deg)
  return `M${fx(x1)} ${fx(y1)}L${fx(x2)} ${fx(y2)}`
}).join('')

// Twelve channels (LINE green, Messenger blue) run from the rim into the one hub
const flows = Array.from({ length: 12 }, (_, i) => {
  const deg = i * 30 + 8
  const [x0, y0] = polar(262, deg)
  const [cx, cy] = polar(200, deg + 26)
  const [x1, y1] = polar(116, deg + 46)
  return {
    id: i,
    x: x0,
    y: y0,
    cls: i % 2 === 0 ? 'is-line' : 'is-fb',
    d: `M${fx(x0)} ${fx(y0)}Q${fx(cx)} ${fx(cy)} ${fx(x1)} ${fx(y1)}`
  }
})

const bolts = Array.from({ length: 6 }, (_, i) => {
  const [x, y] = polar(78, i * 60 + 30)
  return { id: i, x, y }
})

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

// The button always reads 「登入」; what is still missing is explained under the field itself
const submitLabel = computed(() => {
  return loading.value ? '登入中' : '登入'
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

  // Validate form: the button stays enabled, the fields explain what is missing
  validateForm()
  if (!isValid.value) {
    const firstInvalid = errors.value.email ? 'email' : 'password'
    await nextTick()
    document.getElementById(firstInvalid)?.focus()
    return
  }

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
  display: grid;
  place-items: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 24px;
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

/* One object: the brand stage and the sign-in panel share a single rounded shell */
.shell {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr);
  width: min(1280px, 100%);
  height: clamp(640px, calc(100vh - 48px), 860px);
  height: clamp(640px, calc(100dvh - 48px), 860px);
  overflow: hidden;
  border-radius: 36px;
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-raised);
}

/* ---------- Brand stage (always deep blue: the one high-contrast block) ---------- */
.stage {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 48px 56px 52px;
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 78% 28%, #13408a 0%, rgba(19, 64, 138, 0) 62%),
    linear-gradient(165deg, #0c2a58 0%, #06173a 58%, #040d22 100%);
  color: #fff;
}

.motif {
  position: absolute;
  z-index: -1;
  top: 24px;
  right: -70px;
  width: 580px;
  height: 580px;
  pointer-events: none;
}

.grit {
  transform-box: view-box;
  transform-origin: 50% 50%;
  animation: grit-turn 240s linear infinite;
}

.grit-ticks {
  fill: none;
  stroke: #9cc2f7;
  stroke-width: 1.6;
  stroke-linecap: round;
}

.wheel-edge {
  fill: none;
  stroke: #fff;
  stroke-width: 2.5;
}

.wheel-ring {
  fill: none;
  stroke: #fff;
  stroke-opacity: 0.26;
  stroke-width: 1.2;
}

.flow {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
}

.flow.is-line {
  stroke: #3ddc84;
}

.flow.is-fb {
  stroke: #5eb0ff;
}

.node.is-line {
  fill: #3ddc84;
}

.node.is-fb {
  fill: #5eb0ff;
}

.hub {
  stroke: #fff;
  stroke-width: 3;
}

.hub-ring {
  fill: none;
  stroke: #0c2a58;
  stroke-opacity: 0.22;
  stroke-width: 1.5;
}

.bolt {
  fill: #0c2a58;
  fill-opacity: 0.85;
}

.arbor {
  fill: #0066cc;
  stroke: #0c2a58;
  stroke-width: 5;
}

.arbor-glyph {
  fill: #fff;
}

@keyframes grit-turn {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .grit {
    animation: none;
  }
}

.brand-top {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 15px;
  background: #0066cc;
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.85);
}

.brand-mark svg {
  width: 26px;
  height: 26px;
  fill: #fff;
}

.brand-name {
  display: grid;
  gap: 2px;
}

.brand-name b {
  font: 700 18px/1.2 var(--ui-font-display);
  letter-spacing: -0.01em;
}

.brand-name span {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: #c9dcf7;
}

.brand-copy h1 {
  font: 700 60px/1.1 var(--ui-font-display);
  letter-spacing: -0.04em;
}

.brand-copy p {
  max-width: 25em;
  margin-top: 18px;
  text-wrap: pretty;
  font-size: 17px;
  line-height: 1.6;
  color: #dbe8fb;
}

.channels {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;
}

.chan {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 16px 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.chan .ui-ch {
  width: 22px;
  height: 22px;
  border-radius: 7px;
}

.chan .ui-ch svg {
  width: 13px;
  height: 13px;
}

/* ---------- Sign-in panel ---------- */
.panel {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 48px 56px;
}

.theme-btn {
  position: absolute;
  top: 24px;
  right: 24px;
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

.auth {
  width: min(420px, 100%);
  margin: auto;
}

/* Sits on the same line as the channel chips on the stage */
.panel-foot {
  position: absolute;
  right: 0;
  bottom: 52px;
  left: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 38px;
  text-align: center;
  color: var(--ui-ink-2);
}

.auth h2 {
  font: 700 44px/1.15 var(--ui-font-display);
  letter-spacing: -0.035em;
}

.lede {
  margin-top: 10px;
  font-size: 16px;
  color: var(--ui-ink-2);
}

.auth :deep(.ui-field > label) {
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.auth .ui-input::placeholder {
  color: var(--ui-placeholder);
  opacity: 1;
}

.auth form {
  display: grid;
  gap: 18px;
  margin-top: 32px;
}

.auth .ui-input {
  height: 54px;
  border-radius: 14px;
  font-size: 16px;
}

.pw {
  position: relative;
}

.pw .ui-input {
  padding-right: 52px;
}

.pw-toggle {
  position: absolute;
  top: 50%;
  right: 6px;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
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

.auth .submit-btn {
  height: 54px;
  margin-top: 6px;
  border-radius: 14px;
  font-size: 16px;
}

.submit-btn .ico {
  transition: transform var(--ui-dur) var(--ui-ease);
}

.submit-btn:hover:not(:disabled) .ico {
  transform: translateX(3px);
}

/* While submitting the button keeps the brand blue so the loading state still reads as in progress. */
.submit-btn.is-loading:disabled {
  background: var(--ui-accent);
  color: #fff;
  opacity: 0.75;
}

/* Dark: white label on the lighter dark-mode blue misses 4.5:1, so the button keeps the light-mode blue */
.login-page[data-theme='dark'] .auth .submit-btn:not(.is-loading) {
  background: #0066cc;
}

.login-page[data-theme='dark'] .auth .submit-btn:hover:not(:disabled) {
  background: #0058b0;
}

.debug-info {
  font-size: 13px;
  color: var(--ui-muted);
}

/* ---------- Tablet and phone: the stage becomes a compact top band ---------- */
@media (max-width: 1024px) {
  .login-page {
    display: block;
    padding: 0;
  }

  .shell {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: auto;
    min-height: 100vh;
    min-height: 100dvh;
    border-radius: 0;
    box-shadow: none;
  }

  .stage {
    flex: none;
    gap: 36px;
    padding: 24px 24px 32px;
    border-radius: 0 0 32px 32px;
  }

  .motif {
    top: -46px;
    right: -140px;
    width: 340px;
    height: 340px;
  }

  .brand-mark {
    width: 44px;
    height: 44px;
    border-radius: 14px;
  }

  .brand-copy h1 {
    font-size: 32px;
    line-height: 1.15;
  }

  .brand-copy p {
    display: none;
  }

  .channels {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-top: 18px;
  }

  .chan {
    height: 34px;
  }

  .panel {
    flex: 1;
    padding: 32px 24px 40px;
  }

  .auth {
    margin: 0 auto;
  }

  .theme-btn {
    top: 28px;
    right: 24px;
  }

  .panel-foot {
    position: static;
    margin-top: auto;
    padding-top: 28px;
    line-height: 1.4;
  }

  .auth h2 {
    font-size: 32px;
  }
}

/* Tablet: a roomier band and the form centred in the remaining height */
@media (min-width: 641px) and (max-width: 1024px) {
  .stage {
    padding: 32px 40px 40px;
  }

  .motif {
    top: -70px;
    right: -90px;
    width: 460px;
    height: 460px;
  }

  .brand-copy h1 {
    font-size: 44px;
  }

  .panel {
    padding: 40px;
  }

  .auth {
    margin: auto;
  }

  .theme-btn {
    top: 20px;
    right: 24px;
  }
}
</style>
