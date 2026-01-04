<template>
  <div
    v-if="visible"
    class="modal-overlay"
  >
    <div
      class="modal modal-large"
      @click.stop
    >
      <!-- Header -->
      <div class="modal-header">
        <h2>編輯團隊</h2>
        <button
          class="close-btn"
          @click="handleClose"
        >
          &times;
        </button>
      </div>

      <!-- Form -->
      <form
        class="modal-body"
        @submit.prevent="handleSubmit"
      >
        <!-- 基本資訊 -->
        <div class="form-section">
          <h3 class="section-title">
            基本資訊
          </h3>

          <!-- 團隊名稱 -->
          <div class="form-group">
            <label for="edit-team-name">
              團隊名稱 <span class="required">*</span>
            </label>
            <input
              id="edit-team-name"
              v-model="form.name"
              type="text"
              placeholder="請輸入團隊名稱"
              required
            >
          </div>

          <!-- 團隊描述 -->
          <div class="form-group">
            <label for="edit-team-description">團隊描述</label>
            <textarea
              id="edit-team-description"
              v-model="form.description"
              rows="3"
              placeholder="請輸入團隊描述（選填）"
            />
          </div>

          <!-- 狀態 -->
          <div class="form-group">
            <label class="checkbox-label">
              <input
                v-model="form.isActive"
                type="checkbox"
              >
              <span>團隊啟用</span>
            </label>
          </div>
        </div>

        <!-- 現有成員 -->
        <div class="form-section">
          <h3 class="section-title">
            現有成員 ({{ currentMembers.length }})
          </h3>

          <div
            v-if="currentMembers.length > 0"
            class="current-members-list"
          >
            <div
              v-for="member in currentMembers"
              :key="member.id"
              class="member-card"
            >
              <div class="member-info">
                <div class="member-avatar">
                  {{ getInitials(member.name || '') }}
                </div>
                <div class="member-details">
                  <div class="member-name">
                    {{ member.name }}
                  </div>
                  <div class="member-meta">
                    {{ member.email }} • {{ getRoleDisplayName(member.role) }}
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="btn-remove-member"
                @click="handleRemoveMember(member.id)"
              >
                移除
              </button>
            </div>
          </div>

          <div
            v-else
            class="no-members-message"
          >
            此團隊目前沒有成員
          </div>
        </div>

        <!-- 可新增成員 -->
        <div
          v-if="availableMembers.length > 0"
          class="form-section"
        >
          <h3 class="section-title">
            可新增成員 ({{ availableMembers.length }} 位可用)
          </h3>

          <!-- 全選控制 -->
          <div class="select-all-section">
            <label class="checkbox-label">
              <input
                type="checkbox"
                :checked="isAllAvailableMembersSelected"
                @change="toggleSelectAll"
              >
              <span>全選</span>
            </label>
            <span class="selection-count">
              已選擇: {{ form.membersToAdd.length }} 位
            </span>
          </div>

          <!-- 成員網格 -->
          <div class="member-grid-compact">
            <div
              v-for="member in availableMembers"
              :key="member.id"
              class="member-checkbox-item"
            >
              <label class="member-checkbox-label">
                <input
                  type="checkbox"
                  :value="member.id"
                  :checked="form.membersToAdd.includes(member.id)"
                  @change="handleToggleMember(member.id)"
                >
                <div class="member-compact-info">
                  <div class="member-compact-avatar">
                    {{ getInitials(member.name || '') }}
                  </div>
                  <div class="member-compact-name">
                    {{ member.name }}
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div
          v-else
          class="no-available-members-message"
        >
          沒有可新增的成員（所有成員都已在此團隊）
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
            :disabled="loading"
          >
            {{ loading ? '更新中...' : '更新團隊 + 成員' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
 
import type { EditTeamFormData } from '@/composables/team-management'
import type { TeamMember } from '@/types'

interface Props {
  visible: boolean
  form: EditTeamFormData
  loading: boolean
  currentMembers: TeamMember[]
  availableMembers: TeamMember[]
  isAllAvailableMembersSelected: boolean
  getInitials: (_name: string) => string
  getRoleDisplayName: (_role: string) => string
}

interface Emits {
  (_e: 'close'): void
  (_e: 'submit'): void
  (_e: 'remove-member', _memberId: string): void
  (_e: 'toggle-available-member', _memberId: string): void
  (_e: 'toggle-select-all'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

function handleClose() {
  emit('close')
}

function handleSubmit() {
  emit('submit')
}

function handleRemoveMember(memberId: string) {
  emit('remove-member', memberId)
}

function handleToggleMember(memberId: string) {
  emit('toggle-available-member', memberId)
}

function toggleSelectAll() {
  emit('toggle-select-all')
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
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-large {
  max-width: 700px;
}

/* Modal Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  background: white;
  z-index: 1;
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

/* Form Sections */
.form-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #e5e7eb;
}

.form-section:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 1rem 0;
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

.form-group input[type="text"],
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.form-group textarea {
  resize: vertical;
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

/* Current Members List */
.current-members-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.member-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.2s;
}

.member-card:hover {
  background: #f9fafb;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.member-details {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-weight: 600;
  color: #1f2937;
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-meta {
  font-size: 0.75rem;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-remove-member {
  padding: 0.5rem 1rem;
  background: #fee2e2;
  color: #dc2626;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-remove-member:hover {
  background: #fecaca;
}

.no-members-message {
  padding: 2rem;
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
  background: #f9fafb;
  border-radius: 8px;
}

/* Select All Section */
.select-all-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.selection-count {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

/* Member Grid Compact */
.member-grid-compact {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.member-checkbox-item {
  display: flex;
}

.member-checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}

.member-checkbox-label:hover {
  background: #f9fafb;
}

.member-checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  cursor: pointer;
}

.member-compact-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.member-compact-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.member-compact-name {
  font-size: 0.875rem;
  color: #1f2937;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-available-members-message {
  padding: 2rem;
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
  background: #f9fafb;
  border-radius: 8px;
}

/* Modal Actions */
.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 1.5rem;
  margin-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
  position: sticky;
  bottom: 0;
  background: white;
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
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Responsive */
@media (max-width: 768px) {
  .modal-large {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }

  .modal-header,
  .modal-body {
    padding: 1rem;
  }

  .member-grid-compact {
    grid-template-columns: 1fr;
    max-height: 200px;
  }
}
</style>
