<!--
  ProfileView.vue
  個人設定頁面 — 客服自助修改 displayName 與密碼（Email/角色由管理員管理）
  遵循 Apple-Native Soft Minimalism (docs/UIUX-Design-System.md)
-->

<template>
  <AppLayout>
    <div class="ui-page profile-page ui-rise">
      <!-- Page Header -->
      <UiPageHead
        title="個人設定"
        subtitle="修改顯示名稱與密碼，其餘由管理員管理"
      />

      <div class="profile-cols">
        <div class="profile-col">
          <!-- Card 1: 基本資料 -->
          <section
            id="basic"
            class="ui-card profile-card"
            aria-labelledby="basic-title"
          >
            <header class="ui-card-head">
              <div>
                <h2
                  id="basic-title"
                  class="ui-card-title"
                >
                  基本資料
                </h2>
                <div class="ui-card-sub">
                  顯示名稱會出現在你送出的訊息署名
                </div>
              </div>
            </header>

            <form
              class="form"
              @submit.prevent="onSaveProfile"
            >
              <div class="identity">
                <div class="avatar">
                  {{ initial }}
                  <span
                    class="presence"
                    :class="`presence--${connection.tone}`"
                    :title="connection.label"
                  />
                </div>
                <div>
                  <div class="identity-name">
                    {{ profile.displayName || '—' }}
                  </div>
                  <div class="identity-sub">
                    {{ identitySub }}
                  </div>
                </div>
              </div>

              <div class="ui-field">
                <label for="display-name">
                  顯示名稱 <span class="required">*</span>
                  <span class="count">{{ profile.displayName.length }} / 50</span>
                </label>
                <input
                  id="display-name"
                  v-model.trim="profile.displayName"
                  type="text"
                  maxlength="50"
                  class="ui-input"
                  :class="{ 'is-invalid': profileErrors.displayName }"
                  autocomplete="name"
                  :disabled="profileSaving"
                >
                <span
                  v-if="profileErrors.displayName"
                  class="form-error"
                >
                  {{ profileErrors.displayName }}
                </span>
              </div>

              <p
                class="admin-line"
                data-testid="admin-managed"
              >
                <span class="admin-head">
                  <svg
                    class="ico"
                    viewBox="0 0 24 24"
                  ><rect
                    x="4"
                    y="11"
                    width="16"
                    height="9"
                    rx="2"
                  /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                  <span class="admin-tag">由管理員管理</span>
                </span>
                <span class="admin-items">
                  <span
                    v-for="item in adminItems"
                    :key="item.label"
                    class="admin-item"
                  >
                    <span class="admin-label">{{ item.label }}</span>
                    <span class="admin-value">{{ item.value }}</span>
                  </span>
                </span>
              </p>

              <div class="form-actions">
                <button
                  type="button"
                  class="btn btn-ghost"
                  :disabled="!profileChanged || profileSaving"
                  @click="resetProfile"
                >
                  重設
                </button>
                <button
                  type="submit"
                  class="btn btn-primary"
                  :disabled="!profileChanged || profileSaving"
                >
                  {{ profileSaving ? '儲存中…' : '儲存變更' }}
                </button>
              </div>
            </form>
          </section>

          <!-- Card 2: 通知偏好 — the settings already live on the notifications page -->
          <section
            id="notification-prefs"
            class="ui-card profile-card"
            aria-labelledby="prefs-title"
          >
            <header class="ui-card-head">
              <div>
                <h2
                  id="prefs-title"
                  class="ui-card-title"
                >
                  通知偏好
                </h2>
                <div class="ui-card-sub">
                  桌面通知、提示偏好與通知類型
                </div>
              </div>
            </header>
            <div class="form prefs">
              <p class="prefs-text">
                桌面通知僅套用於這台裝置；提示偏好與通知類型跟著你的帳號。
              </p>
              <div class="form-actions">
                <RouterLink
                  class="btn btn-secondary"
                  :to="{ path: '/notifications', query: { settings: '1' } }"
                >
                  開啟通知設定
                </RouterLink>
              </div>
            </div>
          </section>
        </div>

        <div class="profile-col">
          <!-- Card 3: 安全性 -->
          <section
            id="security"
            class="ui-card profile-card"
            aria-labelledby="security-title"
          >
            <header class="ui-card-head">
              <div>
                <h2
                  id="security-title"
                  class="ui-card-title"
                >
                  安全性
                </h2>
                <div class="ui-card-sub">
                  定期更換密碼，保護客戶資料
                </div>
              </div>
            </header>

            <form
              class="form"
              @submit.prevent="onChangePassword"
            >
              <div class="ui-field">
                <label for="current-password">
                  目前密碼 <span class="required">*</span>
                </label>
                <div class="pw">
                  <input
                    id="current-password"
                    v-model="passwordForm.currentPassword"
                    :type="show.current ? 'text' : 'password'"
                    class="ui-input"
                    :class="{ 'is-invalid': passwordErrors.currentPassword }"
                    autocomplete="current-password"
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
                <span
                  v-else
                  class="ui-hint"
                >用來確認是你本人操作</span>
              </div>

              <div class="ui-field">
                <label for="new-password">
                  新密碼 <span class="required">*</span>
                </label>
                <div class="pw">
                  <input
                    id="new-password"
                    v-model="passwordForm.newPassword"
                    :type="show.next ? 'text' : 'password'"
                    class="ui-input"
                    :class="{ 'is-invalid': passwordErrors.newPassword }"
                    autocomplete="new-password"
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
                <span
                  v-else
                  class="ui-hint"
                >至少 8 個字元，混合大小寫、數字與符號會更安全</span>
              </div>

              <div class="ui-field">
                <label for="confirm-password">
                  確認新密碼 <span class="required">*</span>
                </label>
                <div class="pw">
                  <input
                    id="confirm-password"
                    v-model="passwordForm.confirmPassword"
                    :type="show.confirm ? 'text' : 'password'"
                    class="ui-input"
                    :class="{ 'is-invalid': passwordErrors.confirmPassword }"
                    autocomplete="new-password"
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
                <span
                  v-else
                  class="ui-hint"
                >再輸入一次新密碼</span>
              </div>

              <div class="form-actions">
                <p class="action-note">
                  修改後會自動登出，需用新密碼重新登入。
                </p>
                <button
                  type="submit"
                  class="btn btn-primary"
                  :disabled="!passwordReady || passwordSaving"
                >
                  {{ passwordSaving ? '修改中…' : '修改密碼' }}
                </button>
              </div>
            </form>
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

const passwordReady = computed(() => {
  return (
    passwordForm.currentPassword.length > 0 &&
    passwordForm.newPassword.length >= 8 &&
    passwordForm.confirmPassword.length > 0 &&
    passwordForm.newPassword === passwordForm.confirmPassword &&
    passwordForm.newPassword !== passwordForm.currentPassword
  )
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
  if (!validatePassword()) {return}

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

/* Cards size to their content; each column stacks its own cards (no stretched, half-empty cards) */
.profile-cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: stretch;
}

/* `.profile-col` only groups the markup. Desktop: basic (left) and security (right) share row 1
   and stretch to the same height, with each action row pinned to its card's bottom edge;
   the notification card is a full-width row 2. Below 1024px everything stacks in DOM order. */
.profile-col {
  display: contents;
}

.profile-card {
  display: flex;
  flex-direction: column;
}

.profile-card > .form {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.profile-card > .form > .form-actions {
  margin-top: auto;
}

#basic {
  grid-column: 1;
  grid-row: 1;
}

#security {
  grid-column: 2;
  grid-row: 1;
}

#notification-prefs {
  grid-column: 1 / -1;
  grid-row: 2;
}

#notification-prefs > .prefs {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

#notification-prefs > .prefs > .form-actions {
  flex: none;
  margin-top: 0;
  padding-top: 0;
}

.prefs {
  gap: 14px;
}

.prefs-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--ui-ink-2);
}

.prefs .btn {
  text-decoration: none;
}

.ico {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.form {
  display: grid;
  gap: 16px;
  padding: 4px 22px 22px;
}

/* Identity row: avatar with own websocket presence */
.identity {
  display: flex;
  gap: 14px;
  align-items: center;
  padding-bottom: 4px;
}

.avatar {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(160deg, #5aa8ff, #1d6fe0);
  color: #fff;
  font: 600 22px var(--ui-font-display);
}

.presence {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--ui-green);
  box-shadow: 0 0 0 3px var(--ui-surface);
}

.presence--connecting {
  background: var(--ui-orange);
}

.presence--offline {
  background: var(--ui-faint);
}

.identity-name {
  font: 600 17px var(--ui-font-display);
}

.identity-sub {
  font-size: 13px;
  color: var(--ui-muted);
}

.ui-field > label {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.required {
  color: var(--ui-red);
}

.count {
  margin-left: auto;
  font-size: 12px;
  font-weight: 400;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.ui-input.is-invalid {
  box-shadow: inset 0 0 0 1px var(--ui-red), 0 0 0 4px var(--ui-red-soft);
}

.form-error {
  font-size: 13px;
  color: var(--ui-red-ink);
}

/* Read-only facts block: eyebrow ("managed by admin") above the three facts; the facts
   wrap between items (never inside one), so it stays tidy at any width */
.admin-line {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--ui-r-control);
  background: var(--ui-surface-2);
  font-size: 14px;
  color: var(--ui-ink);
}

.admin-head {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: var(--ui-muted);
}

.admin-head .ico {
  flex: none;
  width: 13px;
  height: 13px;
}

.admin-items {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 0.7fr) minmax(0, 1.2fr);
  gap: 8px 16px;
  min-width: 0;
}

.admin-item {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.admin-label {
  font-size: 12px;
  color: var(--ui-muted);
}

.admin-value {
  min-width: 0;
  overflow-wrap: anywhere;
}

.action-note {
  flex: 1;
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.pw {
  position: relative;
}

.pw .ui-input {
  padding-right: 46px;
}

.pw-toggle {
  position: absolute;
  top: 50%;
  right: 4px;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ui-muted);
  cursor: pointer;
  transform: translateY(-50%);
}

.pw-toggle:hover {
  background: var(--ui-fill);
  color: var(--ui-ink-2);
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
  border-radius: inherit;
  transition: width var(--ui-dur) var(--ui-ease), background-color var(--ui-dur) var(--ui-ease);
}

.strength-weak {
  background: var(--ui-red);
}

.strength-fair {
  background: var(--ui-orange);
}

.strength-good {
  background: var(--ui-accent);
}

.strength-strong {
  background: var(--ui-green);
}

.strength-label {
  font-size: 13px;
  color: var(--ui-muted);
}

.form-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
  padding-top: 4px;
}

@media (max-width: 1024px) {
  .profile-cols {
    grid-template-columns: minmax(0, 1fr);
  }

  #basic,
  #security,
  #notification-prefs {
    grid-column: 1;
    grid-row: auto;
  }

  #notification-prefs > .prefs {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }
}

@media (max-width: 768px) {
  /* Phone: one fact per row, label left / value right */
  .admin-items {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }

  .admin-item {
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 8px;
    align-items: baseline;
  }

  .form {
    padding: 4px 16px 18px;
  }

  .form-actions {
    flex-wrap: wrap;
  }

  .action-note {
    flex-basis: 100%;
  }

  .form-actions .btn {
    flex: 1;
  }
}
</style>
