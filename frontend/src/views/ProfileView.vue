<!--
  ProfileView.vue
  個人設定頁面 — 客服自助修改 displayName 與密碼（Email/角色由管理員管理）
  遵循 Apple-Native Soft Minimalism (docs/UIUX-Design-System.md)
  Composition (Service Rings direction): one elevated identity lead, then iOS-Settings style inset groups.
-->

<template>
  <AppLayout>
    <div class="ui-page profile-page ui-rise">
      <UiPageHead
        title="個人設定"
        subtitle="修改顯示名稱與密碼，其餘由管理員管理"
      />

      <div class="profile-stack">
        <!-- Lead: who you are, and the session you are signed in with -->
        <article
          class="ui-lead profile-hero"
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
              <div class="identity-sub">
                {{ identitySub }}
              </div>
              <ul
                class="identity-chips"
                aria-label="角色"
              >
                <li><span class="ui-pill ui-pill-blue">{{ roleLabel }}</span></li>
              </ul>
            </div>
          </div>

          <ul
            class="hero-teams"
            data-testid="admin-managed"
            aria-label="所屬團隊與我的角色"
          >
            <li
              v-for="row in teamRows"
              :key="row.id"
              class="team-tile"
            >
              <span class="team-tile-k">{{ row.isPrimary ? '主要團隊' : '團隊' }}</span>
              <span class="team-tile-v">{{ row.name }}</span>
              <span class="team-tile-s">{{ row.role }}</span>
            </li>
          </ul>

          <div
            id="session"
            class="hero-session"
          >
            <div class="session-k">
              登入有效至
            </div>
            <div class="session-v">
              {{ sessionParts.time }}
            </div>
            <div class="session-s">
              {{ sessionParts.date }}
            </div>
            <button
              type="button"
              class="btn btn-danger session-out"
              @click="onSignOut"
            >
              登出這個瀏覽器
            </button>
          </div>
        </article>

        <div class="profile-pair">
          <!-- 基本資料 -->
          <section
            id="basic"
            class="o-basic"
            aria-labelledby="basic-title"
          >
            <h2
              id="basic-title"
              class="ui-group-label"
            >
              基本資料
            </h2>
            <form
              class="ui-group name-card"
              @submit.prevent="onSaveProfile"
            >
              <div class="form-row">
                <label
                  class="row-label"
                  for="display-name"
                >顯示名稱</label>
                <div class="name-line">
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
                      :aria-describedby="profileErrors.displayName ? 'display-name-error' : 'display-name-hint'"
                      :disabled="profileSaving"
                    >
                    <span
                      v-if="profileErrors.displayName"
                      id="display-name-error"
                      class="form-error"
                    >
                      {{ profileErrors.displayName }}
                    </span>
                  </div>
                  <div
                    class="save-slot"
                    :class="{ 'is-open': profileChanged || profileSaving }"
                    :inert="!(profileChanged || profileSaving)"
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
                      {{ profileSaving ? '儲存中…' : '儲存' }}
                    </button>
                  </div>
                </div>
                <p
                  id="display-name-hint"
                  class="field-hint"
                >
                  會出現在你送出的訊息署名 · {{ profile.displayName.length }} / 50
                </p>
                <div class="sign-preview">
                  <span class="sign-k">客戶看到的署名</span>
                  <span class="sign-v">{{ profile.displayName || '—' }}</span>
                </div>
              </div>
            </form>
          </section>

          <!-- 通知偏好 — the settings already live on the notifications page -->
          <section
            id="notification-prefs"
            class="o-notify"
            aria-labelledby="prefs-title"
          >
            <h2
              id="prefs-title"
              class="ui-group-label"
            >
              通知偏好
            </h2>
            <div class="ui-group notify-card">
              <div
                class="notify-head"
                data-testid="device-notify"
              >
                <span
                  class="notify-ico"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    class="ico"
                  ><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                </span>
                <div class="ui-row-main row-label-strong">
                  這台裝置的桌面通知
                </div>
                <span
                  class="ui-pill ui-pill-dot"
                  :class="devicePerm.tone === 'on' ? 'ui-pill-green' : 'ui-pill-red'"
                >{{ devicePerm.label }}</span>
              </div>
              <p class="notify-hint">
                {{ devicePerm.hint }}
              </p>
              <div class="notify-actions">
                <span class="notify-actions-k">通知類型與提醒方式</span>
                <RouterLink
                  class="btn btn-primary"
                  :to="{ path: '/notifications', query: { settings: '1' } }"
                >
                  開啟通知設定
                  <svg
                    class="ico"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  ><path d="m9 6 6 6-6 6" /></svg>
                </RouterLink>
              </div>
            </div>
          </section>
        </div>

        <!-- 安全性 -->
        <section
          id="security"
          class="o-security"
          aria-labelledby="security-title"
        >
          <h2
            id="security-title"
            class="ui-group-label"
          >
            修改密碼
          </h2>
          <form
            id="pw-form"
            class="ui-group pw-card"
            @submit.prevent="onChangePassword"
          >
            <div class="pw-grid">
              <div class="form-cell">
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

              <div class="form-cell">
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

              <div class="form-cell">
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
            </div>

            <div class="form-actions">
              <p class="form-actions-note">
                修改後會自動登出，需用新密碼重新登入。
              </p>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="passwordSaving"
              >
                {{ passwordSaving ? '修改中…' : '修改密碼' }}
              </button>
            </div>
          </form>
        </section>
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
import { teamRoleText } from '@/utils/team-tone'
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
// Teams from /auth/me teams[]
const teams = computed(() => authStore.currentAgent?.teams ?? [])
const initial = computed(() => (profile.displayName.trim().charAt(0) || '?').toUpperCase())
// Avatar caption = the sign-in email (a person's profile is not a connection status); role and team sit below
const identitySub = computed(() => profile.email || '—')

// One row per team with my role in it (admins without a team role show 管理員)
const teamRows = computed(() =>
  teams.value.map((t) => {
    const role = authStore.currentAgent?.teamRoles?.[t.id]
    return { id: t.id, name: t.name, isPrimary: t.id === authStore.currentAgent?.primaryTeamId, role: role ? teamRoleText(role) : roleLabel.value }
  }),
)

// The session clock split for the lead: the time is the figure, the date its caption
const sessionParts = computed(() => {
  const exp = authStore.sessionExpiry
  if (!exp) { return { time: '有效', date: '登入狀態有效' } }
  const d = new Date(exp)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return { time: `${pad(d.getHours())}:${pad(d.getMinutes())}`, date: `${d.getMonth() + 1}/${d.getDate()} · 這個瀏覽器` }
})

async function onSignOut(): Promise<void> {
  try {
    await authStore.logout()
  } catch (err) {
    logger.warn('Sign out failed (continuing anyway)', { error: err })
  }
  router.push('/login')
}

// 這台裝置的桌面通知權限（瀏覽器 Notification.permission，只讀）
const devicePerm = computed(() => {
  const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  const shared = '桌面通知只套用於這台裝置，其餘跟著你的帳號。'
  if (perm === 'granted') { return { label: '已開啟', tone: 'on', hint: shared } }
  if (perm === 'denied') {
    return { label: '被瀏覽器封鎖', tone: 'off', hint: '到瀏覽器網址列左側的網站設定，把「通知」改為允許。' }
  }
  if (perm === 'unsupported') { return { label: '瀏覽器不支援', tone: 'off', hint: shared } }
  return { label: '尚未開啟', tone: 'off', hint: shared }
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

.profile-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.profile-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  align-items: stretch;
}

.profile-pair > section {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.profile-pair .ui-group {
  flex: 1;
}

/* ---- lead: identity + session (the one elevated object) ---- */
.profile-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(220px, 280px);
  box-shadow: var(--ui-shadow-card);
  overflow: hidden;
}

.identity {
  display: flex;
  gap: 24px;
  align-items: center;
  min-width: 0;
  padding: 28px 32px;
}

.avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: linear-gradient(160deg, #5aa8ff, #1d6fe0);
  color: #fff;
  font: 600 40px var(--ui-font-display);
}

.identity-text {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.identity-name {
  overflow: hidden;
  font: 700 34px / 1.15 var(--ui-font-display);
  letter-spacing: -0.03em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.identity-sub {
  overflow: hidden;
  font-size: 15px;
  color: var(--ui-ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.identity-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.hero-teams {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 12px;
  align-content: center;
  margin: 0;
  padding: 24px 28px 24px 8px;
  list-style: none;
}

.team-tile {
  display: grid;
  align-content: center;
  gap: 2px;
  min-width: 0;
  padding: 16px 18px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
}

.team-tile-k {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.team-tile-v {
  overflow: hidden;
  font: 700 20px / 1.25 var(--ui-font-display);
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-tile-s {
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-accent);
}

/* session: a quiet well on the right, the number answers "how long am I signed in" */
.hero-session {
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 2px;
  padding: 24px 28px;
  background: var(--ui-surface-2);
}

.session-k {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.session-v {
  font: 700 38px / 1.1 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.session-s {
  font-size: 14px;
  color: var(--ui-ink-2);
}

.session-out {
  margin-top: 14px;
}

/* ---- grouped form rows ---- */
.form-row,
.form-cell {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  min-width: 0;
  padding: 18px 20px;
}

.row-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink);
}

.row-control {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.row-label-strong {
  font-size: 16px;
  font-weight: 600;
}

/* placeholders are hints people need to read: secondary ink, not faint */
.ui-input::placeholder {
  color: var(--ui-ink-2);
  opacity: 1;
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

/* fields sit white on the white card; the 1px boundary does the separating */
.profile-page .ui-input {
  background: var(--ui-surface);
}

/* display name: input and its save action share one line */
.name-line {
  display: flex;
  align-items: flex-start;
}

.name-line .row-control {
  flex: 1;
}

.field-hint {
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: var(--ui-ink-2);
}

.sign-preview {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
  padding: 10px 14px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
}

.sign-k {
  font-size: 13px;
  color: var(--ui-ink-2);
}

.sign-v {
  min-width: 0;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 儲存 only exists while the name is changed; its slot slides open so the input never jumps */
.save-slot {
  display: flex;
  gap: 8px;
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-width var(--ui-dur) var(--ui-ease), opacity var(--ui-dur) var(--ui-ease);
}

.save-slot.is-open {
  max-width: 200px;
  margin-left: 10px;
  opacity: 1;
}

/* notification card: status, instruction, one primary action */
.notify-card {
  display: flex;
  flex-direction: column;
}

.notify-head {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 18px var(--row-pad-x) 6px 20px;
}

.notify-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--ui-surface-2);
  color: var(--ui-ink-2);
}

.notify-ico .ico {
  width: 18px;
  height: 18px;
}

.notify-hint {
  text-wrap: pretty;
  margin: 0;
  padding: 8px 20px 14px;
  font-size: 14px;
  line-height: 21px;
  color: var(--ui-ink-2);
}

.notify-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding: 14px 20px 18px;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.notify-actions-k {
  font-size: 14px;
  color: var(--ui-ink-2);
}

.notify-actions .btn {
  gap: 4px;
  text-decoration: none;
}

/* password: three fields on one row, the action closes the card */
.pw-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.pw-grid .form-cell {
  padding: 18px 20px 18px;
}

.form-actions {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 18px;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.form-actions-note {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  color: var(--ui-ink-2);
}

@media (max-width: 1024px) {
  .profile-pair {
    grid-template-columns: minmax(0, 1fr);
  }

  .pw-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .pw-grid .form-cell + .form-cell {
    padding-top: 0;
  }
}

/* Phone: condensed identity, one column in the order a person acts in */
@media (max-width: 768px) {
  .profile-hero {
    grid-template-columns: minmax(0, 1fr);
  }

  .identity {
    gap: 14px;
    padding: 20px;
  }

  .avatar {
    width: 60px;
    height: 60px;
    font-size: 26px;
  }

  .identity-name {
    font-size: 24px;
  }

  .identity-chips {
    margin-top: 8px;
  }

  .hero-teams {
    grid-auto-flow: row;
    padding: 0 20px 16px;
  }

  .team-tile {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'k s' 'v s';
    column-gap: 12px;
    padding: 12px 16px;
  }

  .team-tile-k {
    grid-area: k;
  }

  .team-tile-v {
    grid-area: v;
    font-size: 17px;
  }

  .team-tile-s {
    grid-area: s;
    align-self: center;
  }

  .notify-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .notify-actions-k {
    display: none;
  }

  .hero-session {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'k out' 'v out' 's out';
    align-items: center;
    padding: 14px 20px;
  }

  .session-k {
    grid-area: k;
  }

  .session-v {
    grid-area: v;
    font-size: 26px;
  }

  .session-s {
    grid-area: s;
  }

  .session-out {
    grid-area: out;
    margin: 0;
  }

  .form-actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .form-actions .btn {
    width: 100%;
  }

  .profile-page {
    padding-bottom: 28px;
  }
}
</style>
