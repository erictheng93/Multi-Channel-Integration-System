<template>
  <div
    v-if="visible"
    class="modal-overlay"
  >
    <div
      class="modal"
      @click.stop
    >
      <!-- Header -->
      <div class="modal-header">
        <h2>設定密碼</h2>
        <button
          class="close-btn"
          @click="handleClose"
        >
          &times;
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit">
        <div class="modal-body">
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
        </div>

        <!-- Actions -->
        <div class="modal-actions">
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
          >
            {{ loading ? '設定中...' : '設定密碼' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
 
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
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

/* Modal Container */
.modal {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 450px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

/* Modal Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

/* Modal Body */
.modal-body {
  padding: 1.5rem;
}

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

/* Modal Actions */
.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

/* Buttons */
.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-primary {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Responsive */
@media (max-width: 640px) {
  .modal {
    max-width: 100%;
    border-radius: 12px 12px 0 0;
    margin-top: auto;
  }

  .modal-header,
  .modal-body,
  .modal-actions {
    padding: 1rem;
  }
}
</style>
