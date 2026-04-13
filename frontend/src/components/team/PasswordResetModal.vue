<template>
  <Modal
    :show="visible"
    title="設定密碼"
    size="sm"
    :close-on-overlay="false"
    @close="handleClose"
  >
    <!-- Form Content -->
    <form @submit.prevent="handleSubmit">
      <!-- 成員信息 -->
      <div
        v-if="member"
        class="member-info-section"
      >
        <div class="member-avatar">
          {{ member.name?.charAt(0)?.toUpperCase() || 'U' }}
        </div>
        <div class="member-details">
          <div class="member-name">
            {{ member.name }}
          </div>
          <div class="member-email">
            {{ member.email }}
          </div>
        </div>
      </div>

      <!-- 新密碼 -->
      <div class="form-group">
        <label for="new-password">
          新密碼 <span class="required">*</span>
        </label>
        <input
          id="new-password"
          v-model="form.newPassword"
          type="password"
          placeholder="請輸入新密碼（至少 6 個字元）"
          required
          minlength="6"
        >
        <small class="form-hint">密碼長度至少 6 個字元</small>
      </div>

      <!-- 確認密碼 -->
      <div class="form-group">
        <label for="confirm-password">
          確認密碼 <span class="required">*</span>
        </label>
        <input
          id="confirm-password"
          v-model="form.confirmPassword"
          type="password"
          placeholder="請再次輸入新密碼"
          required
          minlength="6"
        >
        <div
          v-if="passwordMismatch"
          class="error-message"
        >
          密碼不一致，請重新輸入
        </div>
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
        :disabled="loading || !isPasswordFormValid"
        @click="handleSubmit"
      >
        {{ loading ? '設定中...' : '設定密碼' }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Modal from '@/components/ui/Modal.vue'
import type { PasswordResetFormData } from '@/composables/team-management'
import type { TeamMember } from '@/types'

interface Props {
  visible: boolean
  form: PasswordResetFormData
  member: TeamMember | null
  loading: boolean
  passwordMismatch: boolean
  isPasswordFormValid: boolean
}

interface Emits {
  (_e: 'close'): void
  (_e: 'submit'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

function handleClose() {
  emit('close')
}

function handleSubmit() {
  emit('submit')
}
</script>

<style scoped>
/* Member Info Section */
.member-info-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.member-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.125rem;
  flex-shrink: 0;
}

.member-details {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-weight: 600;
  color: #1f2937;
  font-size: 1rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-email {
  font-size: 0.875rem;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

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

.form-group input[type="password"] {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
}

.form-hint {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.error-message {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #ef4444;
  font-weight: 500;
}

</style>
