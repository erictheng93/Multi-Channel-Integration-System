<template>
  <div class="invitation-card">
    <div class="invitation-info">
      <h3>{{ invitation.email }}</h3>
      <div class="invitation-meta">
        <span
          class="role"
          :class="invitation.role"
        >
          {{ invitation.role === 'admin' ? '管理員' : '客服' }}
        </span>
        <span
          class="status"
          :class="invitation.status"
        >
          {{ getInvitationStatusText(invitation.status) }}
        </span>
        <span class="inviter">邀請人: {{ invitation.inviterName }}</span>
        <span
          class="expires"
          :class="{ expired: isExpired }"
        >
          到期: {{ formatDate(invitation.expiresAt) }}
        </span>
      </div>
      <p
        v-if="invitation.message"
        class="invitation-message"
      >
        {{ invitation.message }}
      </p>
    </div>
    <div class="invitation-actions">
      <button 
        class="btn btn-sm btn-primary"
        :disabled="!canResend || loading"
        title="重新發送邀請郵件"
        @click="$emit('resend', invitation.id)"
      >
        重新發送
      </button>
      <button 
        class="btn btn-sm btn-secondary"
        :disabled="loading"
        title="複製邀請連結"
        @click="$emit('copyLink', invitation.token)"
      >
        複製連結
      </button>
      <button 
        class="btn btn-sm btn-danger"
        :disabled="!canCancel || loading"
        title="取消邀請"
        @click="$emit('cancel', invitation.id)"
      >
        取消邀請
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Invitation } from '@/types'

interface Props {
  invitation: Invitation
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

defineEmits<{
  resend: [invitationId: string]
  copyLink: [token: string]
  cancel: [invitationId: string]
}>()

const isExpired = computed(() => {
  return new Date(props.invitation.expiresAt) < new Date()
})

const canResend = computed(() => {
  return props.invitation.status === 'pending' && !isExpired.value
})

const canCancel = computed(() => {
  return props.invitation.status === 'pending'
})

const getInvitationStatusText = (status: string) => {
  const statusMap = {
    pending: '待處理',
    accepted: '已接受',
    declined: '已拒絕',
    expired: '已過期'
  }
  return statusMap[status as keyof typeof statusMap] || status
}

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleString('zh-TW')
}
</script>

<style scoped>
.invitation-card {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all var(--transition-fast);
}

.invitation-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}

.invitation-info {
  flex: 1;
}

.invitation-info h3 {
  margin: 0 0 var(--space-2) 0;
  color: var(--gray-900);
  font-size: 1rem;
  font-weight: 600;
}

.invitation-meta {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: var(--space-2);
}

.role,
.status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.role.admin {
  background: #fef3c7;
  color: #92400e;
}

.role.agent {
  background: #dbeafe;
  color: #1e40af;
}

.status.pending {
  background: #fef3c7;
  color: #92400e;
}

.status.accepted {
  background: #d1fae5;
  color: #065f46;
}

.status.declined {
  background: #fee2e2;
  color: #991b1b;
}

.status.expired {
  background: #f3f4f6;
  color: #6b7280;
}

.inviter,
.expires {
  font-size: 12px;
  color: #9ca3af;
}

.expires.expired {
  color: #ef4444;
  font-weight: 500;
}

.invitation-message {
  margin: var(--space-2) 0 0 0;
  color: var(--gray-600);
  font-size: 0.875rem;
  font-style: italic;
  background: var(--gray-50);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--gray-200);
}

.invitation-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 11px;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

@media (max-width: 768px) {
  .invitation-card {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .invitation-actions {
    justify-content: center;
  }
}
</style>