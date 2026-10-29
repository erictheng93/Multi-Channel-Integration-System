<!--
  ProfileView.vue
  個人設定頁面 — 客服自助修改 displayName 與密碼（Email/角色由管理員管理）
  遵循 Apple-Native Soft Minimalism (docs/UIUX-Design-System.md)
  Composition (Service Rings direction): one elevated identity lead, then iOS-Settings style inset groups.
-->

<template>
  <AppLayout>
    <div class="ui-page profile-page ui-rise">
      <!-- Page Header -->
      <UiPageHead
        title="個人設定"
        subtitle="修改顯示名稱與密碼，其餘由管理員管理"
      />

      <!-- Lead: who you are -->
      <article
        class="ui-lead identity-lead"
        aria-label="帳號身分"
      >
        <div class="identity">
          <div class="avatar">
            {{ initial }}
          </div>
          <div class="identity-text">
            <div class="identity-name">
              {{ profile.displayName || '—' }}
            </div>
            <div class="identity-chips">
              <span class="ui-pill ui-pill-blue">{{ roleLabel }}</span>
              <span
                v-for="team in teams"
                :key="team.id"
                class="ui-tag ui-tag-sky"
              >{{ team.name }}</span>
            </div>
            <div
              class="identity-presence"
              :class="`presence--${connection.tone}`"
            >
              <span
                class="presence-dot"
                aria-hidden="true"
              />
              {{ identitySub }}
            </div>
          </div>
        </div>

        <div
          class="admin-line"
          data-testid="admin-managed"
        >
          <div class="admin-head">
            <svg
              class="ico"
              viewBox="0 0 24 24"
              aria-hidden="true"
            ><rect
              x="4"
              y="11"
              width="16"
              height="9"
              rx="2"
            /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            由管理員管理
          </div>
          <dl class="admin-list">
            <div
              v-for="item in adminItems"
              :key="item.label"
              class="admin-item"
            >
              <dt class="admin-label">
                {{ item.label }}
              </dt>
              <dd class="admin-value">
                {{ item.value }}
              </dd>
            </div>
          </dl>
        </div>
      </article>

      <div class="profile-cols">
        <div class="profile-col">
          <!-- 基本資料 -->
          <section
            id="basic"
            aria-labelledby="basic-title"
          >
            <h2
              id="basic-title"
              class="ui-group-label"
            >
              基本資料
            </h2>
            <form
              class="ui-group"
              @submit.prevent="onSaveProfile"
            >
              <div class="ui-row form-row">
                <label
                  class="row-label"
                  for="display-name"
                >顯示名稱</label>
                <div class="row-control">
                  <input
                    id="display-name"
                    v-model.trim="profile.displayName"
                    type="text"
                    maxlength="50"
                    class="ui-input"
                    :class="{ 'is-invalid': profileErrors.displayName }"
                    autocomplete="name"
                    aria-required="true"
                    :disabled="profileSaving"
                  >
                  <span
                    v-if="profileErrors.displayName"
                    class="form-error"
                  >
                    {{ profileErrors.displayName }}
                  </span>
                </div>
              </div>
              <div
                v-if="profileChanged || profileSaving"
                class="ui-row form-actions"
              >
                <button
                  type="button"
                  class="btn btn-ghost"
                  :disabled="profileSaving"
                  @click="resetProfile"
                >
                  重設
                </button>
                <button
                  type="submit"
                  class="btn btn-primary"
                  :disabled="profileSaving"
                >
                  {{ profileSaving ? '儲存中…' : '儲存變更' }}
                </button>
              </div>
            </form>
            <p class="ui-group-foot">
              顯示名稱會出現在你送出的訊息署名 · {{ profile.displayName.length }} / 50
            </p>
          </section>

          <!-- 通知偏好 — the settings already live on the notifications page -->
          <section
            id="notification-prefs"
            aria-labelledby="prefs-title"
          >
            <h2
              id="prefs-title"
              class="ui-group-label"
            >
              通知偏好
            </h2>
            <div class="ui-group">
              <div
                class="ui-row"
                :class="`device-${devicePerm.tone}`"
                data-testid="device-notify"
              >
                <span
                  class="device-dot"
                  aria-hidden="true"
                />
                <div class="ui-row-main row-label-strong">
                  這台裝置
                </div>
                <div class="ui-row-value">
                  {{ devicePerm.label }}
                </div>
              </div>
              <RouterLink
                class="ui-row is-nav row-link"
                :to="{ path: '/notifications', query: { settings: '1' } }"
              >
                <div class="ui-row-main row-label-strong">
                  開啟通知設定
                </div>
              </RouterLink>
            </div>
            <p class="ui-group-foot">
              {{ devicePerm.hint }}
            </p>
          </section>
        </div>

        <div class="profile-col">
          <!-- 安全性 -->
          <section
            id="security"
            aria-labelledby="security-title"
          >
            <h2
              id="security-title"
              class="ui-group-label"
            >
              修改密碼
            </h2>
            <form
              class="ui-group"
              @submit.prevent="onChangePassword"
            >
              <div class="ui-row form-row">
                <label
                  class="row-label"
                  for="current-password"
                >目前密碼</label>
                <div class="row-control">
                  <div class="pw">
                    <input
                      id="current-password"
                      v-model="passwordForm.currentPassword"
                      :type="show.current ? 'text' : 'password'"
                      class="ui-input"
                      :class="{ 'is-invalid': passwordErrors.currentPassword }"
                      placeholder="用來確認是你本人操作"
                      autocomplete="current-password"
                      aria-required="true"
                      :disabled="passwordSaving"
                    >
                    <button
                      type="button"
                      class="pw-toggle"
                      :aria-label="show.current ? '隱藏密碼' : '顯示密碼'"
                      @click="show.current = !show.current"
                    >
                      <svg
                        class="ico"
                        viewBox="0 0 24 24"
                      ><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle
                        cx="12"
                        cy="12"
                        r="3"
                      /></svg>
                    </button>
                  </div>
                  <span
                    v-if="passwordErrors.currentPassword"
                    class="form-error"
                  >
                    {{ passwordErrors.currentPassword }}
                  </span>
                </div>
              </div>

              <div class="ui-row form-row">
                <label
                  class="row-label"
                  for="new-password"
                >新密碼</label>
                <div class="row-control">
                  <div class="pw">
                    <input
                      id="new-password"
                      v-model="passwordForm.newPassword"
                      :type="show.next ? 'text' : 'password'"
                      class="ui-input"
                      :class="{ 'is-invalid': passwordErrors.newPassword }"
                      placeholder="至少 8 個字元"
                      autocomplete="new-password"
                      aria-required="true"
                      :disabled="passwordSaving"
                    >
                    <button
                      type="button"
                      class="pw-toggle"
                      :aria-label="show.next ? '隱藏密碼' : '顯示密碼'"
                      @click="show.next = !show.next"
                    >
                      <svg
                        class="ico"
                        viewBox="0 0 24 24"
                      ><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle
                        cx="12"
                        cy="12"
                        r="3"
                      /></svg>
                    </button>
                  </div>
                  <div
                    v-if="passwordForm.newPassword"
                    class="strength-bar"
                  >
                    <div class="strength-track">
                      <div
                        class="strength-fill"
                        :class="`strength-${passwordStrength.level}`"
                        :style="{ width: `${passwordStrength.percent}%` }"
                      />
                    </div>
                    <span class="strength-label">{{ passwordStrength.label }}</span>
                  </div>
                  <span
                    v-if="passwordErrors.newPassword"
                    class="form-error"
                  >
                    {{ passwordErrors.newPassword }}
                  </span>
                </div>
              </div>

              <div class="ui-row form-row">
                <label
                  class="row-label"
                  for="confirm-password"
                >確認新密碼</label>
                <div class="row-control">
                  <div class="pw">
                    <input
                      id="confirm-password"
                      v-model="passwordForm.confirmPassword"
                      :type="show.confirm ? 'text' : 'password'"
                      class="ui-input"
                      :class="{ 'is-invalid': passwordErrors.confirmPassword }"
                      placeholder="再輸入一次新密碼"
                      autocomplete="new-password"
                      aria-required="true"
                      :disabled="passwordSaving"
                    >
                    <button
                      type="button"
                      class="pw-toggle"
                      :aria-label="show.confirm ? '隱藏密碼' : '顯示密碼'"
                      @click="show.confirm = !show.confirm"
                    >
                      <svg
                        class="ico"
                        viewBox="0 0 24 24"
                      ><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle
                        cx="12"
                        cy="12"
                        r="3"
                      /></svg>
                    </button>
                  </div>
                  <span
                    v-if="passwordErrors.confirmPassword"
                    class="form-error"
                  >
                    {{ passwordErrors.confirmPassword }}
                  </span>
                </div>
              </div>

              <div class="ui-row form-actions">
                <button
                  type="submit"
                  class="btn btn-primary"
                  :disabled="passwordSaving"
                >
                  {{ passwordSaving ? '修改中…' : '修改密碼' }}
                </button>
              </div>
            </form>
            <p class="ui-group-foot">
              修改後會自動登出，需用新密碼重新登入。
            </p>
          </section>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import UiPageHead from '@/components/ui/UiPageHead.vue'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/ui/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useWebSocketStore } from '@/stores/websocket'
import { useConnectionStatus } from '@/composables/useConnectionStatus'
import { useToast } from '@/composables/useToast'
import { apiClient } from '@/api/base'
import { authApi } from '@/api/auth'
import { createLogger } from '@/utils/logger'
import { setStoredAuthItem } from '@/utils/authStorage'
import type { Agent } from '@/types'

const logger = createLogger('ProfileView')
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { showSuccess, showError } = useToast()

// ============== 基本資料 ==============
// Presence = own websocket state; teams from /auth/me teams[]
const connection = useConnectionStatus(useWebSocketStore())
const teams = computed(() => authStore.currentAgent?.teams ?? [])
const initial = computed(() => (profile.displayName.trim().charAt(0) || '?').toUpperCase())
// Avatar caption = presence only; the team lives in the one admin-managed summary line
const identitySub = computed(() => connection.value.label)

// Email, role and teams are admin-managed: one read-only line instead of three locked fields
const adminItems = computed(() => {
  const parts = [
    { label: '電子郵件', value: profile.email || '—' },
    { label: '角色', value: roleLabel.value },
  ]
  if (teams.value.length > 0) { parts.push({ label: '團隊', value: teams.value.map((t) => t.name).join('、') }) }
  return parts
})

// 這台裝置的桌面通知權限（瀏覽器 Notification.permission，只讀）
const devicePerm = computed(() => {
  const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  const shared = '桌面通知只套用於這台裝置，其餘跟著你的帳號。'
  if (perm === 'granted') { return { label: '桌面通知已開啟', tone: 'on', hint: shared } }
  if (perm === 'denied') {
    return { label: '桌面通知已被瀏覽器封鎖', tone: 'off', hint: '要接收桌面通知，請點網址列左側的圖示，把「通知」改為允許後重新整理頁面。' }
  }
  if (perm === 'unsupported') { return { label: '瀏覽器不支援桌面通知', tone: 'off', hint: shared } }
  return { label: '桌面通知尚未開啟', tone: 'off', hint: shared }
})

// 密碼顯示/隱藏（僅本地 UI 狀態）
const show = reactive({ current: false, next: false, confirm: false })

// Email 與角色由管理員管理，客服僅能修改 displayName
const profile = reactive({
  displayName: '',
  email: '',
})
const originalProfile = reactive({
  displayName: '',
})
const profileSaving = ref(false)
const profileErrors = reactive<{ displayName?: string }>({})

const roleLabel = computed(() => {
  const role = authStore.currentAgent?.role
  if (role === 'admin') {return '管理員'}
  if (role === 'agent') {return '客服'}
  return role ?? '—'
})

const profileChanged = computed(() => {
  return profile.displayName !== originalProfile.displayName
})

function loadProfileFromStore(): void {
  const agent = authStore.currentAgent
  if (!agent) {return}
  profile.displayName = agent.displayName ?? agent.name ?? ''
  profile.email = agent.email ?? ''
  originalProfile.displayName = profile.displayName
}

function resetProfile(): void {
  profile.displayName = originalProfile.displayName
  profileErrors.displayName = undefined
}

function validateProfile(): boolean {
  profileErrors.displayName = undefined

  if (!profile.displayName || profile.displayName.length < 1) {
    profileErrors.displayName = '請輸入顯示名稱'
  } else if (profile.displayName.length > 50) {
    profileErrors.displayName = '顯示名稱不可超過 50 字'
  }

  return !profileErrors.displayName
}

async function onSaveProfile(): Promise<void> {
  if (!validateProfile()) {return}
  if (!profileChanged.value) {return}

  profileSaving.value = true
  try {
    // 只送 displayName — Email 與角色由管理員管理
    const payload: { displayName: string } = {
      displayName: profile.displayName,
    }

    const body = await apiClient.put<Agent & { name?: string }>('/auth/me', payload)

    if (!body?.success || !body.data) {
      throw new Error(body?.error ?? '儲存失敗')
    }

    // 同步更新 authStore.currentAgent (session-scoped auth storage 也同步)
    if (authStore.currentAgent) {
      authStore.currentAgent.displayName = body.data.displayName
      authStore.currentAgent.name = body.data.displayName
      try {
        if (typeof window !== 'undefined') {
          setStoredAuthItem('currentAgent', JSON.stringify(authStore.currentAgent))
        }
      } catch (err) {
        logger.warn('Failed to persist currentAgent to localStorage', { error: err })
      }
    }

    originalProfile.displayName = profile.displayName
    showSuccess('已儲存', '個人資料已更新')
  } catch (error: unknown) {
    const message = extractErrorMessage(error)
    showError('儲存失敗', message)
    logger.error('Profile update failed', { error: message })
  } finally {
    profileSaving.value = false
  }
}

// ============== 密碼修改 ==============
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const passwordSaving = ref(false)
const passwordErrors = reactive<{
  currentPassword?: string
  newPassword?: string
  confirmPassword?: string
}>({})

interface StrengthInfo {
  level: 'weak' | 'fair' | 'good' | 'strong'
  percent: number
  label: string
}

const passwordStrength = computed<StrengthInfo>(() => {
  const pwd = passwordForm.newPassword
  if (!pwd) {return { level: 'weak', percent: 0, label: '' }}

  let score = 0
  if (pwd.length >= 8) {score++}
  if (pwd.length >= 12) {score++}
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) {score++}
  if (/\d/.test(pwd)) {score++}
  if (/[^\w\s]/.test(pwd)) {score++}

  if (score <= 1) {return { level: 'weak', percent: 25, label: '弱' }}
  if (score === 2) {return { level: 'fair', percent: 50, label: '一般' }}
  if (score === 3) {return { level: 'good', percent: 75, label: '良好' }}
  return { level: 'strong', percent: 100, label: '強' }
})

function validatePassword(): boolean {
  passwordErrors.currentPassword = undefined
  passwordErrors.newPassword = undefined
  passwordErrors.confirmPassword = undefined

  if (!passwordForm.currentPassword) {
    passwordErrors.currentPassword = '請輸入目前密碼'
  }
  if (!passwordForm.newPassword) {
    passwordErrors.newPassword = '請輸入新密碼'
  } else if (passwordForm.newPassword.length < 8) {
    passwordErrors.newPassword = '新密碼至少 8 個字元'
  } else if (passwordForm.newPassword === passwordForm.currentPassword) {
    passwordErrors.newPassword = '新密碼不能與目前密碼相同'
  }
  if (!passwordForm.confirmPassword) {
    passwordErrors.confirmPassword = '請再次輸入新密碼'
  } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordErrors.confirmPassword = '兩次輸入的新密碼不一致'
  }

  return (
    !passwordErrors.currentPassword &&
    !passwordErrors.newPassword &&
    !passwordErrors.confirmPassword
  )
}

async function onChangePassword(): Promise<void> {
  // The button stays enabled: pressing it explains what is missing and jumps to the first problem
  if (!validatePassword()) {
    const first = passwordErrors.currentPassword ? 'current-password' : passwordErrors.newPassword ? 'new-password' : 'confirm-password'
    await nextTick()
    document.getElementById(first)?.focus()
    return
  }

  passwordSaving.value = true
  try {
    const res = await authApi.changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    })

    if (!res?.success) {
      throw new Error(res?.error ?? '修改密碼失敗')
    }

    showSuccess('密碼已修改', '請使用新密碼重新登入')

    // 1.5 秒後登出 + 導向登入頁
    setTimeout(async () => {
      try {
        await authStore.logout()
      } catch (err) {
        logger.warn('Logout after password change failed (continuing anyway)', { error: err })
      }
      router.push('/login')
    }, 1500)
  } catch (error: unknown) {
    const message = extractErrorMessage(error)
    if (/current password/i.test(message) || /incorrect/i.test(message)) {
      passwordErrors.currentPassword = '目前密碼不正確'
      showError('密碼錯誤', '目前密碼不正確')
    } else {
      showError('修改失敗', message)
    }
    logger.error('Password change failed', { error: message })
  } finally {
    passwordSaving.value = false
  }
}

// ============== Utilities ==============
function extractErrorMessage(error: unknown): string {
  if (!error) {return '未知錯誤'}
  if (error instanceof Error) {return error.message}
  if (typeof error === 'object' && error !== null) {
    const errObj = error as { message?: string; error?: string; response?: { data?: { error?: string } } }
    return errObj.response?.data?.error ?? errObj.error ?? errObj.message ?? '請求失敗'
  }
  return String(error)
}

// ============== Lifecycle ==============
onMounted(() => {
  loadProfileFromStore()

  // 支援 /profile#security 自動捲動到安全性卡片
  if (route.hash === '#security') {
    nextTick(() => {
      const el = document.getElementById('security')
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
})

// 若 authStore.currentAgent 後續才載入完成 (例如 sessionRestore)，同步更新
watch(
  () => authStore.currentAgent?.id,
  (newId) => {
    if (newId && !originalProfile.displayName) {
      loadProfileFromStore()
    }
  },
)
</script>


<style scoped>
.ico {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.profile-cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 16px;
  align-items: start;
}

.profile-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

/* ---- lead: identity ---- */
.identity-lead {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px 40px;
  align-items: center;
  padding: 44px 40px;
}

.identity {
  display: flex;
  gap: 24px;
  align-items: center;
  min-width: 0;
}

.avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  background: linear-gradient(160deg, #5aa8ff, #1d6fe0);
  color: #fff;
  font: 600 46px var(--ui-font-display);
}

.identity-text {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.identity-name {
  overflow: hidden;
  font: 700 34px / 1.15 var(--ui-font-display);
  letter-spacing: -0.03em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.identity-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.identity-presence {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
  color: var(--ui-muted);
}

.presence-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--ui-faint);
}

.presence--online .presence-dot,
.presence--success .presence-dot,
.presence--good .presence-dot {
  background: var(--ui-green);
}

.presence--warning .presence-dot,
.presence--connecting .presence-dot {
  background: var(--ui-orange);
}

/* admin-managed facts: a quiet definition list with its own hairline */
.admin-line {
  position: relative;
  display: grid;
  gap: 14px;
  margin: 0;
  padding-left: 40px;
}

.admin-list {
  display: grid;
  gap: 16px;
  margin: 0;
}

.admin-line::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.admin-head {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}

.admin-item {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 12px;
  align-items: baseline;
}

.admin-label {
  font-size: 13px;
  color: var(--ui-muted);
}

.admin-value {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 15px;
  font-weight: 500;
  color: var(--ui-ink);
}

/* ---- grouped form rows ---- */
.form-row {
  align-items: flex-start;
  padding-top: 18px;
  padding-bottom: 18px;
}

.row-label {
  flex: none;
  width: 104px;
  padding-top: 10px;
  font-size: 16px;
  font-weight: 500;
  color: var(--ui-ink);
}

.row-control {
  display: grid;
  flex: 1;
  gap: 6px;
  min-width: 0;
}

.row-label-strong {
  font-size: 15px;
  font-weight: 500;
}

.ui-group .ui-row.form-row + .ui-row::before,
.ui-group .ui-row + .ui-row::before {
  left: var(--row-pad-x);
}

.ui-row.is-nav {
  color: var(--section-ink);
  text-decoration: none;
}

.ui-row.is-nav .row-label-strong {
  color: var(--section-ink);
}

.row-link:hover {
  background: var(--section-hue-soft);
}

.form-actions {
  justify-content: flex-end;
}

.form-error {
  font-size: 13px;
  color: var(--ui-red-ink);
}

.ui-input.is-invalid {
  box-shadow: inset 0 0 0 1.5px var(--ui-red);
}

.pw {
  position: relative;
}

.pw .ui-input {
  padding-right: 44px;
}

.pw-toggle {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  place-items: center;
  width: 44px;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 0 var(--ui-r-control) var(--ui-r-control) 0;
  background: transparent;
  color: var(--ui-muted);
  cursor: pointer;
}

.pw-toggle:hover,
.pw-toggle:focus-visible {
  color: var(--ui-ink);
}

.strength-bar {
  display: flex;
  gap: 10px;
  align-items: center;
}

.strength-track {
  flex: 1;
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.strength-fill {
  height: 100%;
  border-radius: 999px;
  transition: width var(--ui-dur) var(--ui-ease), background var(--ui-dur) var(--ui-ease);
}

.strength-weak {
  background: var(--ui-red);
}

.strength-fair {
  background: var(--ui-orange);
}

.strength-good {
  background: var(--ui-teal);
}

.strength-strong {
  background: var(--ui-green);
}

.strength-label {
  min-width: 2.5em;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

/* notification device state */
.device-dot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--ui-faint);
}

.device-on .device-dot {
  background: var(--ui-green);
}

.device-off .device-dot {
  background: var(--ui-orange);
}

@media (max-width: 1024px) {
  .profile-cols {
    grid-template-columns: minmax(0, 1fr);
  }

  .identity-lead {
    padding: 28px;
  }
}

@media (max-width: 768px) {
  .identity-lead {
    grid-template-columns: minmax(0, 1fr);
    padding: 22px 20px;
  }

  .identity {
    gap: 16px;
  }

  .avatar {
    width: 72px;
    height: 72px;
    font-size: 30px;
  }

  .identity-name {
    font-size: 26px;
  }

  .admin-line {
    padding-top: 18px;
    padding-left: 0;
  }

  .admin-line::before {
    top: 0;
    right: 0;
    bottom: auto;
    width: auto;
    height: 0.5px;
  }

  .form-row {
    flex-direction: column;
    gap: 6px;
  }

  .row-label {
    width: auto;
    padding-top: 0;
    font-size: 14px;
  }

  .row-control {
    width: 100%;
  }

  .form-actions .btn-primary {
    flex: 1;
  }
}
</style>
