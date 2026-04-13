<template>
  <Modal
    :show="visible"
    title="新增系統人員"
    size="md"
    :close-on-overlay="false"
    @close="handleClose"
  >
    <!-- Form Content -->
    <form @submit.prevent="handleSubmit">
      <!-- 姓名 -->
      <div class="form-group">
        <label for="add-member-name">
          姓名 <span class="required">*</span>
        </label>
        <input
          id="add-member-name"
          v-model="form.name"
          type="text"
          placeholder="請輸入姓名"
          required
        >
      </div>

      <!-- Email -->
      <div class="form-group">
        <label for="add-member-email">
          Email <span class="required">*</span>
        </label>
        <div class="email-input-wrapper">
          <input
            id="add-member-email"
            v-model="form.email"
            type="email"
            placeholder="請輸入 Email"
            required
            @blur="emit('email-blur')"
          >
          <span
            v-if="emailCheckLoading"
            class="email-check-spinner"
          />
        </div>
        <small class="form-hint">將作為登入帳號</small>
      </div>

      <!-- 密碼 -->
      <div class="form-group">
        <label for="add-member-password">
          密碼 <span class="required">*</span>
        </label>
        <div class="password-input">
          <input
            id="add-member-password"
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="請輸入密碼"
            required
          >
          <button
            type="button"
            class="password-toggle"
            @click="togglePassword"
          >
            {{ showPassword ? '隱藏' : '顯示' }}
          </button>
        </div>
      </div>

      <!-- 角色 -->
      <div class="form-group">
        <label for="add-member-role">
          角色 <span class="required">*</span>
        </label>
        <select
          id="add-member-role"
          v-model="form.role"
          required
        >
          <option :value="ROLES.AGENT">
            客服人員
          </option>
          <option :value="ROLES.ADMIN">
            管理員
          </option>
        </select>
      </div>

      <!-- 指派團隊 -->
      <div class="form-group">
        <label for="add-member-team">指派團隊</label>
        <select
          id="add-member-team"
          v-model="form.group"
        >
          <option value="">
            不指派團隊（選填）
          </option>
          <option
            v-for="team in activeTeams"
            :key="team.id"
            :value="team.id"
          >
            {{ team.name }}
            <template v-if="team.memberCount !== undefined">
              ({{ team.memberCount }} 位成員)
            </template>
          </option>
        </select>
        <small
          v-if="activeTeams.length === 0"
          class="form-hint form-hint-warning"
        >
          目前沒有可用的團隊，請先建立團隊
        </small>
      </div>

      <!-- 狀態 -->
      <div class="form-group">
        <label class="checkbox-label">
          <input
            v-model="form.isActive"
            type="checkbox"
          >
          <span>帳號啟用</span>
        </label>
      </div>
    </form>

    <!-- Footer Actions -->
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        @click="handleClose"
      >
        取消
      </button>
      <button
        type="submit"
        class="btn btn-primary"
        :disabled="loading"
        @click="handleSubmit"
      >
        {{ loading ? '新增中...' : '新增成員' }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import { ROLES } from '@/constants/roles'
import type { AddMemberFormData } from '@/composables/team-management'

/** 團隊類型定義 */
interface Team {
  id: number
  name: string
  description?: string
  isActive: boolean
  memberCount?: number
}

interface Props {
  /** Modal visibility state */
  visible: boolean

  /** Form data object (reactive) */
  form: AddMemberFormData

  /** Disable submit during API call */
  loading: boolean

  /** Password field visibility */
  showPassword: boolean

  /** 可選擇的團隊列表 */
  teams: Team[]

  /** Loading state for email duplicate check */
  emailCheckLoading?: boolean
}

interface Emits {
  (_e: 'close'): void
  (_e: 'submit'): void
  (_e: 'toggle-password'): void
  (_e: 'email-blur'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/** 只顯示啟用中的團隊 */
const activeTeams = computed(() => props.teams.filter(team => team.isActive))

function handleClose() {
  emit('close')
}

function handleSubmit() {
  emit('submit')
}

function togglePassword() {
  emit('toggle-password')
}
</script>

<style scoped>
/* Form Groups */
.form-group {
  margin-bottom: 1.25rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
}

.required {
  color: #ef4444;
}

.form-group input[type="text"],
.form-group input[type="email"],
.form-group input[type="password"],
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-hint {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.form-hint-warning {
  color: #f59e0b;
}

/* Password Input */
.password-input {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input input {
  padding-right: 4rem;
}

.password-toggle {
  position: absolute;
  right: 0.75rem;
  background: none;
  border: none;
  color: #6366f1;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: all 0.2s;
}

.password-toggle:hover {
  background: rgba(99, 102, 241, 0.1);
}

/* Checkbox */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: 500;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

/* Email check spinner */
.email-input-wrapper {
  position: relative;
}

.email-input-wrapper input {
  width: 100%;
  padding: 0.75rem;
  padding-right: 2.5rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.email-check-spinner {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  border: 2px solid #E5E7EB;
  border-top-color: #6366F1;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
</style>
