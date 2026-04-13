<template>
  <Modal
    :show="show"
    size="lg"
    :close-on-overlay="false"
    @close="handleClose"
  >
    <template #header>
      <div class="header-content">
        <div class="header-title">
          <span class="header-label">編輯成員</span>
          <span class="header-name">{{ member.name || member.loginId }}</span>
        </div>
        <div class="header-badges">
          <span :class="['status-badge', member.status]">
            {{ member.status === 'active' ? '活躍' : member.status === 'inactive' ? '停用' : '待處理' }}
          </span>
          <span
            v-if="isDirty"
            class="unsaved-indicator"
          >
            有未儲存的變更
          </span>
        </div>
      </div>
    </template>

    <div class="member-edit-content">
      <!-- Profile Edit Form -->
      <div class="form-section">
        <!-- Display Name and Email -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">姓名</label>
            <input
              v-model="formData.displayName"
              type="text"
              class="form-input"
              :class="{ 'has-error': formErrors.displayName }"
              placeholder="請輸入姓名"
              maxlength="100"
            >
            <span
              v-if="formErrors.displayName"
              class="error-message"
            >
              {{ formErrors.displayName }}
            </span>
          </div>

          <div class="form-group">
            <label class="form-label required">Email</label>
            <input
              v-model="formData.email"
              type="email"
              class="form-input"
              :class="{ 'has-error': formErrors.email }"
              placeholder="請輸入電子郵件"
            >
            <span
              v-if="formErrors.email"
              class="error-message"
            >
              {{ formErrors.email }}
            </span>
          </div>
        </div>

        <!-- Role -->
        <div class="form-group">
          <label class="form-label required">角色</label>
          <select
            v-model="formData.role"
            class="form-select"
            :class="{ 'has-error': formErrors.role }"
            :disabled="isSystemAdmin"
          >
            <option value="agent">
              客服人員
            </option>
            <option value="admin">
              管理員
            </option>
          </select>
          <span
            v-if="formErrors.role"
            class="error-message"
          >
            {{ formErrors.role }}
          </span>
          <span
            v-if="isSystemAdmin"
            class="field-hint"
          >
            系統管理員角色無法變更
          </span>
        </div>
      </div>

      <!-- Password Management Section -->
      <div class="section-divider">
        <span class="divider-text">密碼管理</span>
      </div>

      <div class="password-section">
        <!-- System Admin Warning -->
        <div
          v-if="isSystemAdmin"
          class="system-admin-warning"
        >
          <span class="warning-icon" />
          <span>系統管理員帳號無法透過此介面重設密碼</span>
        </div>

        <!-- Password Reset Button -->
        <template v-else>
          <button
            v-if="!showPasswordSection"
            class="btn btn-outline"
            @click="togglePasswordSection"
          >
            <span class="btn-icon" />
            重設密碼
          </button>

          <!-- Password Reset Form -->
          <div
            v-else
            class="password-form"
          >
            <div class="password-form-header">
              <span>設定新密碼</span>
              <button
                class="close-btn"
                @click="togglePasswordSection"
              />
            </div>

            <div class="form-group">
              <label class="form-label required">新密碼</label>
              <input
                v-model="passwordForm.newPassword"
                type="password"
                class="form-input"
                :class="{ 'has-error': passwordErrors.newPassword }"
                placeholder="請輸入新密碼（至少 6 個字元）"
              >
              <span
                v-if="passwordErrors.newPassword"
                class="error-message"
              >
                {{ passwordErrors.newPassword }}
              </span>
            </div>

            <div class="form-group">
              <label class="form-label required">確認密碼</label>
              <input
                v-model="passwordForm.confirmPassword"
                type="password"
                class="form-input"
                :class="{
                  'has-error': passwordMatchStatus === 'mismatch',
                  'has-success': passwordMatchStatus === 'match'
                }"
                placeholder="請再次輸入新密碼"
              >
              <!-- Real-time password match feedback -->
              <span
                v-if="passwordMatchStatus === 'mismatch'"
                class="error-message"
              >
                密碼不一致
              </span>
              <span
                v-else-if="passwordMatchStatus === 'match'"
                class="success-message"
              >
                密碼一致
              </span>
            </div>

            <button
              class="btn btn-primary password-submit-btn"
              :disabled="!isPasswordFormValid || isResettingPassword"
              @click="handleResetPassword"
            >
              <span
                v-if="isResettingPassword"
                class="loading-spinner"
              />
              {{ isResettingPassword ? '處理中...' : '設定新密碼' }}
            </button>
          </div>
        </template>
      </div>

      <!-- Team Assignment Section (for agents only) -->
      <template v-if="member.role === 'agent'">
        <div class="section-divider">
          <span class="divider-text">團隊分配</span>
        </div>

        <MultiTeamSelector
          :member-id="member.id"
          :all-teams="allTeams"
          :deferred-mode="true"
          :teams="displayTeams"
          :pending-changes="pendingTeamChanges"
          :loading="isSaving"
          :hide-status-message="true"
          @add-team="handleAddTeam"
          @remove-team="handleRemoveTeam"
          @teams-loaded="handleTeamsLoaded"
        />
      </template>

      <!-- Admin Notice -->
      <div
        v-else
        class="admin-notice"
      >
        <span class="notice-icon" />
        <span>管理員無需分配團隊</span>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer-actions">
        <button
          class="btn btn-secondary"
          @click="handleClose"
        >
          取消
        </button>
        <button
          class="btn btn-primary"
          :disabled="!isDirty || !isFormValid || isSaving"
          @click="handleSave"
        >
          <span
            v-if="isSaving"
            class="loading-spinner"
          />
          {{ isSaving ? '儲存中...' : '儲存變更' }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
/**
 * MemberEditModal Component
 *
 * Modal for editing member details including:
 * - Profile information (name, email, role)
 * - Password reset (admin can reset all passwords except System Administration)
 * - Team assignments via MultiTeamSelector
 *
 * Features:
 * - Form validation with error messages
 * - Dirty detection (enable/disable save button)
 * - System Admin protection
 * - Role change confirmation dialog
 * - Toast notifications
 */

import { toRef } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import MultiTeamSelector from '@/components/team/multi-team/MultiTeamSelector.vue'
import { useMemberEditForm } from '@/composables/team-management/useMemberEditForm'
import type { TeamMember, Team, AgentTeamMembership } from '@/types'

interface Props {
  /** Whether modal is visible */
  show: boolean

  /** Member to edit */
  member: TeamMember

  /** All available teams */
  allTeams: Team[]
}

interface Emits {
  /** Emitted when modal should close */
  (_e: 'close'): void

  /** Emitted when member data is saved */
  (_e: 'save'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Initialize member edit form composable
const memberRef = toRef(props, 'member')

const {
  formData,
  passwordForm,
  formErrors,
  passwordErrors,
  isFormValid,
  isPasswordFormValid,
  passwordMatchStatus,
  isDirty,
  isSaving,
  isResettingPassword,
  showPasswordSection,
  isSystemAdmin,
  // Team changes (deferred mode)
  pendingTeamChanges,
  displayTeams,
  addTeamToPending,
  removeTeamFromPending,
  initTeams,
  // Methods
  saveChanges,
  resetPassword,
  resetForm,
  togglePasswordSection
} = useMemberEditForm(memberRef, undefined, () => {
  emit('save')
})

/**
 * Handle save button click
 */
const handleSave = async () => {
  const success = await saveChanges()
  if (success) {
    emit('close')
  }
}

/**
 * Handle password reset
 */
const handleResetPassword = async () => {
  await resetPassword()
}

/**
 * Handle modal close
 */
const handleClose = () => {
  resetForm()
  emit('close')
}

/**
 * Handle adding team (deferred mode)
 */
const handleAddTeam = (teamId: number, teamName: string) => {
  addTeamToPending(teamId, teamName)
}

/**
 * Handle removing team (deferred mode)
 */
const handleRemoveTeam = (teamId: number) => {
  removeTeamFromPending(teamId)
}

/**
 * Handle teams loaded from server (initialize current teams)
 */
const handleTeamsLoaded = (teams: AgentTeamMembership[]) => {
  initTeams(teams)
}
</script>

<style scoped>
/* Header */
.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
}

.header-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  padding: 4px 12px;
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
  border-radius: 8px;
  border: 1px solid #bae6fd;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.unsaved-indicator {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.member-edit-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Form Section */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
}

.form-label.required::after {
  content: ' *';
  color: #ef4444;
}

.form-input,
.form-select {
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9375rem;
  color: #1e293b;
  background: #fff;
  transition: all 0.2s ease;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input.has-error,
.form-select.has-error {
  border-color: #ef4444;
}

.form-input.has-error:focus,
.form-select.has-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.form-input.has-success {
  border-color: #16a34a;
}

.form-input.has-success:focus {
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.1);
}

.form-input:disabled,
.form-select:disabled {
  background: #f8fafc;
  color: #94a3b8;
  cursor: not-allowed;
}

.error-message {
  color: #ef4444;
  font-size: 0.75rem;
}

.success-message {
  color: #16a34a;
  font-size: 0.75rem;
  font-weight: 500;
}

.field-hint {
  color: #94a3b8;
  font-size: 0.75rem;
  font-style: italic;
}

/* Status Badge */
.status-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  width: fit-content;
}

.status-badge.active {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.status-badge.inactive {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.status-badge.pending {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

/* Section Divider */
.section-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
}

.section-divider::before,
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e2e8f0;
}

.divider-text {
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
}

/* Password Section */
.password-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.system-admin-warning {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 12px;
  color: #92400e;
  font-size: 0.9375rem;
  font-weight: 500;
}

.warning-icon {
  font-size: 1.25rem;
}

.password-form {
  padding: 20px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.password-form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #1e293b;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1rem;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #e2e8f0;
  color: #64748b;
}

.password-submit-btn {
  align-self: flex-end;
}

/* Admin Notice */
.admin-notice {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: #dbeafe;
  border: 1px solid #93c5fd;
  border-radius: 12px;
  color: #1e40af;
  font-size: 1rem;
  font-weight: 500;
}

.notice-icon {
  font-size: 1.5rem;
}

/* Button Styles */
.btn-outline {
  background: transparent;
  color: #3b82f6;
  border-color: #3b82f6;
}

.btn-outline:hover:not(:disabled) {
  background: #eff6ff;
}

.btn-icon {
  font-size: 1rem;
}

/* Modal Footer */
.modal-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Loading Spinner */
.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}

.btn-outline .loading-spinner {
  border-color: rgba(59, 130, 246, 0.3);
  border-top-color: #3b82f6;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Responsive */
@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
