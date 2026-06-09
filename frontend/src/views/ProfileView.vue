<!--
  ProfileView.vue
  個人設定頁面 — 客服自助修改 displayName 與密碼（Email/角色由管理員管理）
  遵循 Apple-Native Soft Minimalism (docs/UIUX-Design-System.md)
-->

<template>
  <AppLayout>
    <div class="profile-page">
      <!-- Page Header -->
      <header class="profile-header">
        <h1 class="page-title">
          個人設定
        </h1>
        <p class="page-subtitle">
          管理您的帳號資訊與安全性設定
        </p>
      </header>

      <!-- Bento Grid -->
      <div class="profile-grid">
        <!-- Card 1: 基本資料 -->
        <section
          id="basic"
          class="profile-card"
          aria-labelledby="basic-title"
        >
          <header class="card-header">
            <h2
              id="basic-title"
              class="card-title"
            >
              基本資料
            </h2>
            <p class="card-subtitle">
              您可以修改顯示名稱；Email、角色與團隊由管理員管理。
            </p>
          </header>

          <form
            class="form"
            @submit.prevent="onSaveProfile"
          >
            <div class="form-field">
              <label
                for="display-name"
                class="form-label"
              >
                顯示名稱 <span class="required">*</span>
              </label>
              <input
                id="display-name"
                v-model.trim="profile.displayName"
                type="text"
                maxlength="50"
                class="form-input"
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

            <div class="form-field">
              <label class="form-label">
                Email
              </label>
              <div class="readonly-value">
                {{ profile.email || '—' }}
                <span class="readonly-hint">（由管理員管理）</span>
              </div>
            </div>

            <div class="form-field">
              <label class="form-label">
                角色
              </label>
              <div class="readonly-value">
                {{ roleLabel }}
                <span class="readonly-hint">（由管理員管理）</span>
              </div>
            </div>

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

        <!-- Card 2: 安全性 -->
        <section
          id="security"
          class="profile-card"
          aria-labelledby="security-title"
        >
          <header class="card-header">
            <h2
              id="security-title"
              class="card-title"
            >
              安全性
            </h2>
            <p class="card-subtitle">
              修改密碼後，您將被自動登出並需要重新登入。
            </p>
          </header>

          <form
            class="form"
            @submit.prevent="onChangePassword"
          >
            <div class="form-field">
              <label
                for="current-password"
                class="form-label"
              >
                目前密碼 <span class="required">*</span>
              </label>
              <input
                id="current-password"
                v-model="passwordForm.currentPassword"
                type="password"
                class="form-input"
                :class="{ 'is-invalid': passwordErrors.currentPassword }"
                autocomplete="current-password"
                :disabled="passwordSaving"
              >
              <span
                v-if="passwordErrors.currentPassword"
                class="form-error"
              >
                {{ passwordErrors.currentPassword }}
              </span>
            </div>

            <div class="form-field">
              <label
                for="new-password"
                class="form-label"
              >
                新密碼 <span class="required">*</span>
              </label>
              <input
                id="new-password"
                v-model="passwordForm.newPassword"
                type="password"
                class="form-input"
                :class="{ 'is-invalid': passwordErrors.newPassword }"
                autocomplete="new-password"
                :disabled="passwordSaving"
              >
              <div
                v-if="passwordForm.newPassword"
                class="strength-bar"
              >
                <div
                  class="strength-fill"
                  :class="`strength-${passwordStrength.level}`"
                  :style="{ width: `${passwordStrength.percent}%` }"
                />
                <span class="strength-label">{{ passwordStrength.label }}</span>
              </div>
              <span
                v-if="passwordErrors.newPassword"
                class="form-error"
              >
                {{ passwordErrors.newPassword }}
              </span>
            </div>

            <div class="form-field">
              <label
                for="confirm-password"
                class="form-label"
              >
                確認新密碼 <span class="required">*</span>
              </label>
              <input
                id="confirm-password"
                v-model="passwordForm.confirmPassword"
                type="password"
                class="form-input"
                :class="{ 'is-invalid': passwordErrors.confirmPassword }"
                autocomplete="new-password"
                :disabled="passwordSaving"
              >
              <span
                v-if="passwordErrors.confirmPassword"
                class="form-error"
              >
                {{ passwordErrors.confirmPassword }}
              </span>
            </div>

            <div class="form-actions">
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
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/ui/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
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
  if (role === 'agent') {return '客服人員'}
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
.profile-page {
  padding: 20px;
  background: #f2f2f7;
  min-height: 100%;
}

.profile-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 28px;
  font-weight: 600;
  color: #1c1c1e;
  margin: 0 0 4px 0;
}

.page-subtitle {
  font-size: 15px;
  color: #8e8e93;
  margin: 0;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
  max-width: 1200px;
}

.profile-card {
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 6%);
  padding: 24px;
  scroll-margin-top: 80px;
}

.card-header {
  margin-bottom: 20px;
}

.card-title {
  font-size: 20px;
  font-weight: 600;
  color: #1c1c1e;
  margin: 0 0 4px 0;
}

.card-subtitle {
  font-size: 13px;
  color: #8e8e93;
  margin: 0;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: #1c1c1e;
}

.required {
  color: #ff3b30;
  margin-left: 2px;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  background: #f2f2f7;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  color: #1c1c1e;
  outline: none;
  transition: background 200ms ease-out, box-shadow 200ms ease-out;
}

.form-input:focus {
  background: #ffffff;
  box-shadow: 0 0 0 2px #007aff;
}

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-input.is-invalid {
  box-shadow: 0 0 0 2px #ff3b30;
}

.form-error {
  font-size: 12px;
  color: #ff3b30;
}

.readonly-value {
  padding: 10px 14px;
  background: #f2f2f7;
  border-radius: 12px;
  font-size: 15px;
  color: #1c1c1e;
}

.readonly-hint {
  font-size: 12px;
  color: #8e8e93;
  margin-left: 8px;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}

.strength-bar {
  position: relative;
  height: 4px;
  background: #f2f2f7;
  border-radius: 2px;
  overflow: hidden;
  margin-top: 6px;
}

.strength-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 200ms ease-out, background 200ms ease-out;
}

.strength-fill.strength-weak {
  background: #ff3b30;
}

.strength-fill.strength-fair {
  background: #ff9500;
}

.strength-fill.strength-good {
  background: #007aff;
}

.strength-fill.strength-strong {
  background: #34c759;
}

.strength-label {
  position: absolute;
  right: 0;
  top: -18px;
  font-size: 11px;
  color: #8e8e93;
}

@media (max-width: 640px) {
  .profile-page {
    padding: 16px;
  }

  .profile-grid {
    grid-template-columns: 1fr;
  }

  .profile-card {
    padding: 20px;
  }
}
</style>
