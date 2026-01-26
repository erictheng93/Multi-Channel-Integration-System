<template>
  <div
    class="member-edit-card"
    :class="{ 'has-changes': isDirty, 'has-errors': hasErrors }"
  >
    <!-- Card Header -->
    <div class="card-header">
      <div class="member-avatar">
        <img
          v-if="member.avatar"
          :src="member.avatar"
          :alt="member.name"
          class="avatar-image"
        >
        <div
          v-else
          class="avatar-placeholder"
        >
          {{ getInitials(member.name || member.loginId) }}
        </div>
      </div>
      <div class="member-info">
        <span class="member-login">{{ member.loginId }}</span>
        <span
          v-if="isDirty"
          class="change-indicator"
        >
          <span class="dot" />
          有變更
        </span>
      </div>
      <div
        v-if="isCurrentUser"
        class="self-badge"
      >
        <WarningIcon class="warning-icon" />
        <span>自己</span>
      </div>
    </div>

    <!-- Disabled Overlay for Current User -->
    <div
      v-if="isCurrentUser"
      class="disabled-overlay"
    >
      <span class="disabled-message">無法編輯自己的帳號</span>
    </div>

    <!-- Form Fields -->
    <div
      class="card-body"
      :class="{ 'is-disabled': isCurrentUser }"
    >
      <!-- Row 1: Name and Email -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">姓名</label>
          <input
            type="text"
            class="form-input"
            :class="{ 'has-error': errors.displayName }"
            :value="formData.displayName"
            :disabled="isCurrentUser"
            placeholder="請輸入姓名"
            maxlength="100"
            @input="handleInput('displayName', ($event.target as HTMLInputElement).value)"
          >
          <span
            v-if="errors.displayName"
            class="error-message"
          >
            {{ errors.displayName }}
          </span>
        </div>

        <div class="form-group">
          <label class="form-label">Email</label>
          <input
            type="email"
            class="form-input"
            :class="{ 'has-error': errors.email }"
            :value="formData.email"
            :disabled="isCurrentUser"
            placeholder="請輸入電子郵件"
            @input="handleInput('email', ($event.target as HTMLInputElement).value)"
          >
          <span
            v-if="errors.email"
            class="error-message"
          >
            {{ errors.email }}
          </span>
        </div>
      </div>

      <!-- Row 2: Role -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">角色</label>
          <select
            class="form-select"
            :value="formData.role"
            :disabled="isCurrentUser"
            @change="handleInput('role', ($event.target as HTMLSelectElement).value)"
          >
            <option value="agent">
              客服人員
            </option>
            <option value="admin">
              管理員
            </option>
          </select>
        </div>
      </div>

      <!-- Team Assignment Section (only for agents) -->
      <div
        v-if="formData.role === 'agent'"
        class="team-section"
      >
        <label class="form-label">團隊分配</label>
        <MultiTeamSelector
          :member-id="member.id"
          :all-teams="allTeams"
          :deferred-mode="true"
          :teams="displayTeams"
          :pending-changes="pendingTeamChanges"
          :loading="false"
          :hide-status-message="true"
          @add-team="handleAddTeam"
          @remove-team="handleRemoveTeam"
          @teams-loaded="handleTeamsLoaded"
        />
      </div>

      <!-- Admin Notice -->
      <div
        v-else
        class="admin-notice"
      >
        <span class="notice-icon">i</span>
        <span>管理員無需分配團隊</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * BulkMemberEditCard Component
 *
 * Individual member edit card for bulk editing modal.
 * Displays editable fields for name, email, role, and team assignment.
 */

import { computed } from 'vue'
import MultiTeamSelector from '@/components/team/multi-team/MultiTeamSelector.vue'
import WarningIcon from '@/components/icons/WarningIcon.vue'
import type { TeamMember, Team, AgentTeamMembership } from '@/types'
import type { BulkMemberEditState, PendingTeamChange } from '@/composables/team-management/useBulkMemberEdit'

interface Props {
  /** Member being edited */
  member: TeamMember

  /** Current form data */
  formData: BulkMemberEditState['formData']

  /** Form validation errors */
  errors: BulkMemberEditState['errors']

  /** Pending team changes */
  pendingTeamChanges: PendingTeamChange[]

  /** Display teams (current + pending) */
  displayTeams: AgentTeamMembership[]

  /** All available teams */
  allTeams: Team[]

  /** Whether this member form has changes */
  isDirty: boolean

  /** Current user ID (to prevent self-edit) */
  currentUserId?: string
}

interface Emits {
  /** Emitted when form field changes */
  (_e: 'update:field', _memberId: string, _field: keyof BulkMemberEditState['formData'], _value: string): void

  /** Emitted when team is added */
  (_e: 'add-team', _memberId: string, _teamId: number, _teamName: string): void

  /** Emitted when team is removed */
  (_e: 'remove-team', _memberId: string, _teamId: number): void

  /** Emitted when teams are loaded */
  (_e: 'teams-loaded', _memberId: string, _teams: AgentTeamMembership[]): void
}

const props = withDefaults(defineProps<Props>(), {
  currentUserId: ''
})

const emit = defineEmits<Emits>()

/**
 * Check if this is the current user
 */
const isCurrentUser = computed(() => props.currentUserId === props.member.id)

/**
 * Check if form has errors
 */
const hasErrors = computed(() => {
  return !!(props.errors.displayName || props.errors.email)
})

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  return name.charAt(0).toUpperCase()
}

/**
 * Handle form input changes
 */
function handleInput(field: keyof BulkMemberEditState['formData'], value: string) {
  if (isCurrentUser.value) {return}
  emit('update:field', props.member.id, field, value)
}

/**
 * Handle team addition
 */
function handleAddTeam(teamId: number, teamName: string) {
  if (isCurrentUser.value) {return}
  emit('add-team', props.member.id, teamId, teamName)
}

/**
 * Handle team removal
 */
function handleRemoveTeam(teamId: number) {
  if (isCurrentUser.value) {return}
  emit('remove-team', props.member.id, teamId)
}

/**
 * Handle teams loaded
 */
function handleTeamsLoaded(teams: AgentTeamMembership[]) {
  emit('teams-loaded', props.member.id, teams)
}
</script>

<style scoped>
.member-edit-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 1rem;
  transition: all 0.2s ease;
  position: relative;
}

.member-edit-card:hover {
  border-color: #d1d5db;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.member-edit-card.has-changes {
  border-color: #fbbf24;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
}

.member-edit-card.has-errors {
  border-color: #f87171;
}

/* Card Header */
.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #f3f4f6;
}

.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  font-weight: 600;
  font-size: 1rem;
}

.member-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.member-login {
  font-weight: 600;
  color: #374151;
  font-size: 0.9375rem;
}

.change-indicator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #d97706;
  font-weight: 500;
}

.change-indicator .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f59e0b;
}

.self-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 8px;
  color: #92400e;
  font-size: 0.75rem;
  font-weight: 500;
}

.warning-icon {
  width: 14px;
  height: 14px;
  color: #f59e0b;
}

/* Disabled Overlay */
.disabled-overlay {
  position: absolute;
  top: 60px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 0 0 12px 12px;
}

.disabled-message {
  padding: 0.5rem 1rem;
  background: #f3f4f6;
  border-radius: 8px;
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Card Body */
.card-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-body.is-disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* Form Elements */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #6b7280;
}

.form-input,
.form-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.875rem;
  color: #1f2937;
  background: white;
  transition: all 0.2s ease;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-input.has-error,
.form-select.has-error {
  border-color: #f87171;
}

.form-input:disabled,
.form-select:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.error-message {
  font-size: 0.75rem;
  color: #ef4444;
}

/* Team Section */
.team-section {
  padding-top: 0.5rem;
  border-top: 1px solid #f3f4f6;
}

/* Admin Notice */
.admin-notice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  color: #0369a1;
  font-size: 0.8125rem;
}

.notice-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #0ea5e9;
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
}

/* Responsive */
@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
