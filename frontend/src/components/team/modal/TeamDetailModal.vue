<template>
  <Modal
    :show="show"
    :title="`${team.name} 詳細資訊`"
    size="lg"
    @close="handleClose"
  >
    <div class="team-detail-content">
      <!-- 團隊編輯表單 -->
      <TeamEditForm
        v-if="isEditing"
        :form-data="teamForm.formData"
        :errors="teamForm.errors.value"
        :loading="teamForm.loading.value"
        @submit="handleFormSubmit"
        @cancel="handleCancelEdit"
        @update:name="handleNameUpdate"
        @update:description="handleDescriptionUpdate"
      />

      <!-- 團隊統計資訊 -->
      <div
        v-else
        class="team-stats"
      >
        <div class="section-header">
          <h3>團隊資訊</h3>
          <button
            class="btn btn-sm btn-secondary"
            @click="handleStartEdit"
          >
            ✏️ 編輯
          </button>
        </div>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">團隊名稱</span>
            <span class="stat-value">{{ team.name }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">團隊描述</span>
            <span class="stat-value">{{ team.description || '無描述' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">創建時間</span>
            <span class="stat-value">{{ formatDate(team.createdAt) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">最後更新</span>
            <span class="stat-value">{{ formatDate(team.updatedAt) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">團隊狀態</span>
            <span :class="['stat-value', 'status-badge', team.isActive ? 'active' : 'inactive']">
              {{ team.isActive ? '活躍中' : '已停用' }}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">成員數量</span>
            <span class="stat-value">{{ team.memberCount || 0 }} 位成員</span>
          </div>
        </div>
      </div>

      <!-- 成員列表 -->
      <slot name="members" />

      <!-- QR Code 區塊 -->
      <slot name="qr-code" />
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
 * TeamDetailModal Component
 *
 * Extracted from TeamCard.vue (lines 57-193)
 * Orchestrates team detail modal with edit form, stats, members, and QR code
 *
 * Features:
 * - Modal state management via useTeamModal
 * - Form state management via useTeamForm
 * - Team stats display with formatted dates
 * - Edit mode toggle
 * - Slot-based composition for flexible content
 */

import { watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import TeamEditForm from './TeamEditForm.vue'
import { useTeamForm } from '@/composables/team-management/useTeamForm'

interface Team {
  id: number
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  memberCount?: number
}

interface Props {
  /** Whether modal is visible */
  show: boolean

  /** Team data */
  team: Team

  /** Whether modal is in edit mode */
  isEditing: boolean
}

interface Emits {
  /** Emitted when modal should close */
  (_e: 'close'): void

  /** Emitted when edit mode should start */
  (_e: 'start-edit'): void

  /** Emitted when edit mode should cancel */
  (_e: 'cancel-edit'): void

  /** Emitted when team is successfully updated */
  (_e: 'team-updated'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Initialize team form composable
const teamForm = useTeamForm()

// Initialize form when modal opens or team changes
watch(() => [props.show, props.team.id], () => {
  if (props.show) {
    teamForm.initForm(props.team)
  }
}, { immediate: true })

/**
 * Format date string to readable format
 */
const formatDate = (dateString: string | Date | undefined): string => {
  if (!dateString) {
    return '無期限'
  }
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  if (isNaN(date.getTime())) {
    return '無效日期'
  }
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Handle modal close
 */
const handleClose = () => {
  emit('close')
}

/**
 * Handle start edit mode
 */
const handleStartEdit = () => {
  teamForm.initForm(props.team)
  emit('start-edit')
}

/**
 * Handle cancel edit mode
 */
const handleCancelEdit = () => {
  teamForm.resetForm()
  emit('cancel-edit')
}

/**
 * Handle form submission
 * 🆕 最小化刷新：useTeamForm.submitForm() 已直接更新 store，
 *    不再需要 emit('team-updated') 觸發全量重新載入
 */
const handleFormSubmit = async () => {
  const success = await teamForm.submitForm(props.team.id)
  if (success) {
    emit('cancel-edit') // Exit edit mode
    // 🆕 移除 emit('team-updated') - store 已在 submitForm 中直接更新
  }
}

/**
 * Handle name update from form
 */
const handleNameUpdate = (value: string) => {
  teamForm.formData.name = value
}

/**
 * Handle description update from form
 */
const handleDescriptionUpdate = (value: string) => {
  teamForm.formData.description = value
}
</script>

<style scoped>
.team-detail-content {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.team-stats {
  margin-bottom: 28px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h3 {
  color: #1e293b;
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.stat-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
}

.stat-label {
  color: #64748b;
  font-size: 1rem;
  font-weight: 500;
}

.stat-value {
  color: #1e293b;
  font-size: 1.125rem;
  font-weight: 700;
}

.status-badge {
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  display: inline-block;
  width: fit-content;
}

.status-badge.active {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.status-badge.inactive {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 16px 24px;
  border: 1px solid;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  min-width: 120px;
  justify-content: center;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 14px 20px;
  font-size: 1rem;
}

.btn-secondary {
  background: #f8fafc;
  color: #475569;
  border-color: #cbd5e1;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
  border-color: #94a3b8;
  transform: translateY(-1px);
}

/* Responsive */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
