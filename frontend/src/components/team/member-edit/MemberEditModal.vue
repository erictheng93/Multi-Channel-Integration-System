<template>
  <Modal
    :show="show"
    :title="`編輯成員: ${member.name}`"
    size="lg"
    @close="handleClose"
  >
    <div class="member-edit-content">
      <!-- Member Basic Info -->
      <div class="member-info-section">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">登入 ID</span>
            <span class="info-value">{{ member.loginId }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">電子郵件</span>
            <span class="info-value">{{ member.email }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">角色</span>
            <span :class="['role-badge', member.role]">
              {{ getRoleDisplayName(member.role) }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">狀態</span>
            <span :class="['status-badge', member.status]">
              {{ member.status === 'active' ? '活躍' : '停用' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Multi-Team Selector (for agents only) -->
      <MultiTeamSelector
        v-if="member.role === 'agent'"
        :member-id="member.id"
        :all-teams="allTeams"
      />

      <!-- Admin Notice -->
      <div
        v-else
        class="admin-notice"
      >
        <span class="notice-icon">ℹ️</span>
        <span>管理員無需分配團隊</span>
      </div>
    </div>

    <template #footer>
      <button
        class="btn btn-secondary"
        @click="handleClose"
      >
        關閉
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
/**
 * MemberEditModal Component
 *
 * Extracted from TeamMemberCard.vue (lines 84-303)
 * Modal for editing member details and team assignments
 *
 * Features:
 * - Member basic info display
 * - Multi-team management via MultiTeamSelector
 * - Role-based UI (admin vs agent)
 */

import Modal from '@/components/ui/Modal.vue'
import MultiTeamSelector from '@/components/team/multi-team/MultiTeamSelector.vue'
import type { TeamMember, Team } from '@/types'

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

defineProps<Props>()
const emit = defineEmits<Emits>()

/**
 * Get display name for role
 */
const getRoleDisplayName = (role: string): string => {
  const roleMap: Record<string, string> = {
    admin: '管理員',
    agent: '客服'
  }
  return roleMap[role] || role
}

/**
 * Handle modal close
 */
const handleClose = () => {
  emit('close')
}
</script>

<style scoped>
.member-edit-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Member Info Section */
.member-info-section {
  padding: 20px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-label {
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
}

.info-value {
  color: #1e293b;
  font-size: 1rem;
  font-weight: 600;
}

/* Role Badge */
.role-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  width: fit-content;
}

.role-badge.admin {
  background: #dbeafe;
  color: #1e40af;
  border: 1px solid #93c5fd;
}

.role-badge.agent {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
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
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 24px;
  border: 1px solid;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-secondary {
  background: #f8fafc;
  color: #475569;
  border-color: #cbd5e1;
}

.btn-secondary:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
  transform: translateY(-1px);
}

/* Responsive */
@media (max-width: 640px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
