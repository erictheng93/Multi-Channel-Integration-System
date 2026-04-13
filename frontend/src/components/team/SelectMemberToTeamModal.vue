<template>
  <Modal
    :show="visible"
    :title="`將成員加入 ${teamName}`"
    size="md"
    @close="handleClose"
  >
    <!-- 搜索框 -->
    <div class="search-box">
      <SearchIcon />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索成員名稱或 Email..."
        class="search-input"
      >
      <button
        v-if="searchQuery"
        class="clear-btn"
        type="button"
        @click="searchQuery = ''"
      >
        <XIcon />
      </button>
    </div>

    <!-- 載入中狀態 -->
    <div
      v-if="loading"
      class="loading-state"
    >
      <HamsterLoader message="載入成員列表中..." />
    </div>

    <!-- 空狀態 -->
    <div
      v-else-if="filteredMembers.length === 0"
      class="empty-state"
    >
      <EmptyIcon />
      <span v-if="searchQuery">找不到符合「{{ searchQuery }}」的成員</span>
      <span v-else>沒有可添加的成員</span>
      <small v-if="!searchQuery">所有成員都已在此團隊中</small>
    </div>

    <!-- 成員列表 -->
    <div
      v-else
      class="member-list"
    >
      <div
        v-for="member in filteredMembers"
        :key="member.id"
        :class="['member-item', { selected: selectedMemberIds.has(member.id) }]"
        @click="toggleSelection(member.id)"
      >
        <div class="member-checkbox">
          <CheckIcon v-if="selectedMemberIds.has(member.id)" />
        </div>
        <div class="member-info">
          <div class="member-name">
            {{ member.displayName }}
          </div>
          <div class="member-email">
            {{ member.email }}
          </div>
        </div>
        <div class="member-role-badge">
          {{ member.role === 'admin' ? '管理員' : '客服' }}
        </div>
      </div>
    </div>

    <!-- 團隊角色選擇 -->
    <div
      v-if="filteredMembers.length > 0"
      class="role-selector"
    >
      <label for="team-role">加入後的團隊角色：</label>
      <select
        id="team-role"
        v-model="selectedRole"
        class="role-select"
      >
        <option value="member">
          成員
        </option>
        <option value="lead">
          組長
        </option>
        <option value="supervisor">
          主管
        </option>
      </select>
    </div>

    <!-- Footer -->
    <template #footer>
      <div class="footer-left">
        <button
          v-if="filteredMembers.length > 0"
          type="button"
          class="btn btn-text"
          @click="selectAll"
        >
          全選
        </button>
        <button
          v-if="selectedMemberIds.size > 0"
          type="button"
          class="btn btn-text"
          @click="clearSelection"
        >
          取消選擇
        </button>
        <span
          v-if="selectedMemberIds.size > 0"
          class="selection-count"
        >
          已選擇 {{ selectedMemberIds.size }} 位
        </span>
      </div>
      <div class="footer-right">
        <button
          type="button"
          class="btn btn-secondary"
          @click="handleClose"
        >
          取消
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!canSubmit || submitting"
          @click="handleSubmit"
        >
          {{ submitting ? '新增中...' : `新增 (${selectedMemberIds.size})` }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
/**
 * SelectMemberToTeamModal Component
 *
 * 選擇現有成員加入團隊的 Modal
 * - 顯示不在當前團隊中的成員列表
 * - 支持搜索過濾
 * - 支持多選
 * - 設定團隊角色 (member/lead/supervisor)
 */

import { computed, watch, ref } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import { XIcon, CheckIcon } from '@/components/icons'
import { useSelectMemberToTeam } from '@/composables/team-management'
import type { AvailableMember, TeamRoleInTeam } from '@/composables/team-management'

interface Props {
  /** Modal visibility */
  visible: boolean

  /** Target team ID */
  teamId: number

  /** Target team name */
  teamName: string

  /** Current team member IDs (to exclude from list) */
  currentMemberIds?: string[]
}

interface Emits {
  /** Close modal */
  (_e: 'close'): void

  /** Members added successfully */
  (_e: 'members-added'): void
}

const props = withDefaults(defineProps<Props>(), {
  currentMemberIds: () => []
})

const emit = defineEmits<Emits>()

// Use composable
const selectMember = useSelectMemberToTeam()

// Local refs for v-model binding
const searchQuery = ref('')
const selectedRole = ref<TeamRoleInTeam>('member')
const selectedMemberIds = ref<Set<string>>(new Set())

// Computed
const loading = computed(() => selectMember.loading.value)
const submitting = computed(() => selectMember.submitting.value)
const filteredMembers = computed<AvailableMember[]>(() => {
  let members = selectMember.availableMembers.value.filter(
    member => !props.currentMemberIds.includes(member.id)
  )

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    members = members.filter(
      member =>
        member.displayName?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query)
    )
  }

  return members
})

const canSubmit = computed(() => {
  return selectedMemberIds.value.size > 0 && !submitting.value
})

// Watch visibility to load data
watch(() => props.visible, async (visible) => {
  if (visible && props.teamId) {
    // Reset state
    searchQuery.value = ''
    selectedRole.value = 'member'
    selectedMemberIds.value = new Set()

    // Load available members
    await selectMember.openModal(props.teamId, props.teamName, props.currentMemberIds)
  }
})

// Methods
function toggleSelection(memberId: string) {
  const newSet = new Set(selectedMemberIds.value)
  if (newSet.has(memberId)) {
    newSet.delete(memberId)
  } else {
    newSet.add(memberId)
  }
  selectedMemberIds.value = newSet
}

function selectAll() {
  const newSet = new Set<string>()
  filteredMembers.value.forEach(member => {
    newSet.add(member.id)
  })
  selectedMemberIds.value = newSet
}

function clearSelection() {
  selectedMemberIds.value = new Set()
}

function handleClose() {
  selectMember.closeModal()
  emit('close')
}

async function handleSubmit() {
  if (!canSubmit.value) {
    return
  }

  // Update composable state
  selectMember.selectedMemberIds.value = selectedMemberIds.value
  selectMember.selectedRole.value = selectedRole.value

  const success = await selectMember.submitAddMembers()

  if (success) {
    emit('members-added')
    emit('close')
  }
}

// Icon components
const SearchIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.3-4.3"></path>
  </svg>`
}

const EmptyIcon = {
  template: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>`
}
</script>

<style scoped>
/* Search Box */
.search-box {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.search-box svg {
  position: absolute;
  left: 12px;
  color: #9ca3af;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 12px 40px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 0.9375rem;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.clear-btn {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #9ca3af;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-btn:hover {
  background: #f3f4f6;
  color: #6b7280;
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6b7280;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #9ca3af;
  text-align: center;
  gap: 8px;
}

.empty-state svg {
  margin-bottom: 8px;
}

.empty-state span {
  font-size: 1rem;
  color: #6b7280;
}

.empty-state small {
  font-size: 0.875rem;
  color: #9ca3af;
}

/* Member List */
.member-list {
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.15s;
  border-bottom: 1px solid #f3f4f6;
}

.member-item:last-child {
  border-bottom: none;
}

.member-item:hover {
  background: #f9fafb;
}

.member-item.selected {
  background: #eef2ff;
}

.member-item.selected:hover {
  background: #e0e7ff;
}

/* Checkbox */
.member-checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid #d1d5db;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}

.member-item.selected .member-checkbox {
  background: #6366f1;
  border-color: #6366f1;
  color: white;
}

.member-checkbox svg {
  width: 14px;
  height: 14px;
}

/* Member Info */
.member-info {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-weight: 600;
  color: #1f2937;
  font-size: 0.9375rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-email {
  font-size: 0.8125rem;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Role Badge */
.member-role-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
  background: #f3f4f6;
  color: #4b5563;
  flex-shrink: 0;
}

/* Role Selector */
.role-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 10px;
}

.role-selector label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
}

.role-select {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  background: white;
  cursor: pointer;
}

.role-select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

/* Footer */
.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer-right {
  display: flex;
  gap: 8px;
}

.selection-count {
  padding: 6px 12px;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.8125rem;
}

/* Buttons */
.btn-text {
  background: transparent;
  color: #6366f1;
  padding: 8px 12px;
}

.btn-text:hover {
  background: #f3f4f6;
}

/* Responsive */
@media (max-width: 640px) {
  .role-selector {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .footer-left,
  .footer-right {
    flex-wrap: wrap;
  }
}

/* Override modal footer to use space-between */
:deep(.modal-footer) {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
}
</style>
