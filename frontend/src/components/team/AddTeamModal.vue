<template>
  <Modal
    :show="visible"
    title="新增團隊"
    size="lg"
    :close-on-overlay="false"
    @close="handleClose"
  >
    <!-- Form Content -->
    <form @submit.prevent="handleSubmit">
      <!-- 團隊名稱 -->
      <div class="form-group">
        <label for="team-name">
          團隊名稱 <span class="required">*</span>
        </label>
        <input
          id="team-name"
          v-model="form.name"
          type="text"
          placeholder="請輸入團隊名稱"
          required
        >
      </div>

      <!-- 團隊描述 -->
      <div class="form-group">
        <label for="team-description">團隊描述</label>
        <textarea
          id="team-description"
          v-model="form.description"
          rows="3"
          placeholder="請輸入團隊描述（選填）"
        />
      </div>

      <!-- 成員選擇 -->
      <div class="form-group">
        <label>
          選擇成員
          <span class="member-count">({{ form.selectedMembers.length }} / {{ availableMembers.length }})</span>
        </label>

        <!-- 全選控制 -->
        <div class="select-all-section">
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="isAllMembersSelected"
              @change="toggleSelectAll"
            >
            <span>全選</span>
          </label>
        </div>

        <!-- 成員列表 -->
        <div
          v-if="availableMembers.length > 0"
          class="member-selection-list"
        >
          <div
            v-for="member in availableMembers"
            :key="member.id"
            class="member-item"
          >
            <label class="member-label">
              <input
                type="checkbox"
                :value="member.id"
                :checked="form.selectedMembers.includes(member.id)"
                @change="handleMemberToggle(member.id)"
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
            </label>
          </div>
        </div>

        <!-- 無可用成員 -->
        <div
          v-else
          class="no-members"
        >
          無可用成員
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
        :disabled="loading"
        @click="handleSubmit"
      >
        {{ loading ? '新增中...' : '新增團隊' }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Modal from '@/components/ui/Modal.vue'
import type { AddTeamFormData } from '@/composables/team-management'
import type { TeamMember } from '@/types'

interface Props {
  visible: boolean
  form: AddTeamFormData
  loading: boolean
  availableMembers: TeamMember[]
  isAllMembersSelected: boolean
  getInitials: (_name: string) => string
  getRoleDisplayName: (_role: string) => string
}

interface Emits {
  (_e: 'close'): void
  (_e: 'submit'): void
  (_e: 'toggle-member', _memberId: string): void
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

function handleMemberToggle(memberId: string) {
  emit('toggle-member', memberId)
}

function toggleSelectAll() {
  emit('toggle-select-all')
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

.member-count {
  font-weight: 400;
  color: #6b7280;
  margin-left: 0.5rem;
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

/* Select All Section */
.select-all-section {
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 8px;
}

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

/* Member Selection List */
.member-selection-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.5rem;
}

.member-item {
  margin-bottom: 0.5rem;
}

.member-item:last-child {
  margin-bottom: 0;
}

.member-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.member-label:hover {
  background: #f9fafb;
}

.member-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  cursor: pointer;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
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

/* No Members */
.no-members {
  padding: 2rem;
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
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
</style>
