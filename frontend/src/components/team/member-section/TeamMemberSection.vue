<template>
  <div class="team-members-section">
    <!-- Section Header -->
    <div class="section-header">
      <div class="section-title-group">
        <h3>團隊成員</h3>
      </div>
      <div class="header-actions">
        <!-- 🆕 Bulk Selection Mode Toggle -->
        <button
          v-if="members.length > 0"
          class="btn btn-sm"
          :class="isSelectionMode ? 'btn-secondary' : 'btn-outline'"
          @click="toggleSelectionMode"
        >
          <CheckSquareIcon v-if="isSelectionMode" />
          <SquareIcon v-else />
          {{ isSelectionMode ? '取消選擇' : '批量選擇' }}
        </button>

        <!-- 🆕 Bulk Actions (shown when in selection mode with selections) -->
        <template v-if="isSelectionMode && selectedMemberIds.size > 0">
          <span class="selection-count">
            已選擇 {{ selectedMemberIds.size }} 位
          </span>
          <button
            class="btn btn-sm btn-danger"
            :disabled="bulkRemoveLoading"
            @click="handleBulkRemove"
          >
            <TrashIcon />
            {{ bulkRemoveLoading ? '移除中...' : '移除選取' }}
          </button>
        </template>

        <!-- 🆕 Select All (shown when in selection mode) -->
        <button
          v-if="isSelectionMode && members.length > 0"
          class="btn btn-sm btn-outline"
          @click="selectAllMembers"
        >
          全選
        </button>

        <!-- Add Member Button (hidden in selection mode) -->
        <button
          v-if="!isSelectionMode"
          class="btn btn-sm btn-primary"
          :disabled="loading"
          @click="$emit('add-member')"
        >
          + 新增成員
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="loading-members"
    >
      <HamsterLoader message="載入成員中..." />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="members.length === 0"
      class="no-members"
    >
      <EmptyIcon />
      <span>此團隊暫無成員</span>
    </div>

    <!-- Member Grid -->
    <MemberGrid
      v-else
      :members="members"
      :removing-member-id="removingMemberId"
      :is-selection-mode="isSelectionMode"
      :selected-member-ids="selectedMemberIds"
      @remove-member="handleRemoveMember"
      @toggle-selection="toggleMemberSelection"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * TeamMemberSection Component
 *
 * Extracted from TeamCard.vue (lines 154-212, 762-800)
 * Orchestrates team member management functionality
 *
 * Features:
 * - Member list display with loading/empty states
 * - Add member action
 * - Remove member with optimistic updates
 * - 🆕 Bulk selection mode
 * - 🆕 Bulk remove with confirmation
 * - Confirmation dialog integration
 * - Toast notifications
 *
 * Responsibilities:
 * - State management (loading, removing, selection)
 * - Member removal with confirmation
 * - Optimistic UI updates with rollback
 * - Event coordination
 */

import { ref, watch } from 'vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import MemberGrid from './MemberGrid.vue'
import CheckSquareIcon from '@/components/icons/CheckSquareIcon.vue'
import SquareIcon from '@/components/icons/SquareIcon.vue'
import TrashIcon from '@/components/icons/TrashIcon.vue'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'
import { teamApi } from '@/api/team'
import type { TeamMember } from '@/types'

interface Team {
  id: number
  name: string
}

interface Props {
  /** Team object */
  team: Team

  /** List of team members */
  members: TeamMember[]

  /** Loading state for members */
  loading?: boolean
}

interface Emits {
  /** Emitted when add member button is clicked */
  (_e: 'add-member'): void

  /** Emitted when a member is successfully removed */
  (_e: 'member-removed'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { showDanger } = useConfirmDialog()
const { showSuccess, showError } = useToast()

const removingMemberId = ref<string | null>(null)
const localMembers = ref<TeamMember[]>([...props.members])

// 🆕 Selection Mode State
const isSelectionMode = ref(false)
const selectedMemberIds = ref<Set<string>>(new Set())
const bulkRemoveLoading = ref(false)

// Sync localMembers with props.members
// This allows us to do optimistic updates while maintaining props reactivity
const syncMembers = () => {
  localMembers.value = [...props.members]
}

// Watch for props.members changes and reset selection
watch(() => props.members, () => {
  syncMembers()
  // Clear selections when members change (e.g., after removal)
  if (isSelectionMode.value) {
    // Keep only selected IDs that still exist in members
    const memberIds = new Set(props.members.map(m => m.id))
    const newSelection = new Set<string>()
    selectedMemberIds.value.forEach(id => {
      if (memberIds.has(id)) {
        newSelection.add(id)
      }
    })
    selectedMemberIds.value = newSelection
  }
}, { deep: true })

// Empty Icon Component
const EmptyIcon = {
  template: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="m9,9 6,6"></path>
    <path d="m15,9-6,6"></path>
  </svg>`
}

// 🆕 Toggle selection mode
const toggleSelectionMode = () => {
  isSelectionMode.value = !isSelectionMode.value
  if (!isSelectionMode.value) {
    // Clear selections when exiting selection mode
    selectedMemberIds.value = new Set()
  }
}

// 🆕 Toggle individual member selection
const toggleMemberSelection = (memberId: string) => {
  const newSet = new Set(selectedMemberIds.value)
  if (newSet.has(memberId)) {
    newSet.delete(memberId)
  } else {
    newSet.add(memberId)
  }
  selectedMemberIds.value = newSet
}

// 🆕 Select all members
const selectAllMembers = () => {
  const newSet = new Set<string>()
  props.members.forEach(member => {
    newSet.add(member.id)
  })
  selectedMemberIds.value = newSet
}

// 🆕 Handle bulk remove with confirmation
const handleBulkRemove = async () => {
  const selectedIds = Array.from(selectedMemberIds.value)

  if (selectedIds.length === 0) {
    showError('請選擇要移除的成員')
    return
  }

  // Get selected member names for confirmation message
  const selectedMembers = props.members.filter(m => selectedIds.includes(m.id))
  const memberNames = selectedMembers.map(m => m.name || m.loginId).join('、')

  const confirmed = await showDanger(
    '確定要批量移除成員？',
    `將從 ${props.team.name} 移除以下 ${selectedIds.length} 位成員：\n\n${memberNames}`
  )

  if (!confirmed) {
    return
  }

  bulkRemoveLoading.value = true

  try {
    const response = await teamApi.bulkRemoveMembersFromTeam(props.team.id, selectedIds)

    if (response.success && response.data) {
      const { removedCount, failed } = response.data

      if (removedCount > 0) {
        showSuccess(`成功移除 ${removedCount} 位成員`)
        // Exit selection mode and notify parent
        isSelectionMode.value = false
        selectedMemberIds.value = new Set()
        emit('member-removed')
      }

      if (failed && failed.length > 0) {
        const failedNames = failed.map(f => f.agentId).join(', ')
        showError(`部分成員移除失敗: ${failedNames}`)
      }
    } else {
      showError(response.error || '批量移除成員失敗')
    }
  } catch (error) {
    console.error('批量移除成員失敗:', error)
    showError('批量移除成員時發生錯誤')
  } finally {
    bulkRemoveLoading.value = false
  }
}

/**
 * Handle member removal with confirmation
 * Uses optimistic update pattern:
 * 1. Show confirmation dialog
 * 2. Optimistically remove from UI
 * 3. Call API
 * 4. If API fails, rollback and show error
 */
const handleRemoveMember = async (member: TeamMember) => {
  try {
    const confirmed = await showDanger(
      '確定要移除此成員？',
      `將 ${member.name || member.loginId} 從 ${props.team.name} 移除`
    )

    if (!confirmed) {
      return
    }

    removingMemberId.value = member.id

    // Save original list for rollback
    const originalMembers = [...localMembers.value]

    // Optimistic update: remove from local list immediately
    localMembers.value = localMembers.value.filter(m => m.id !== member.id)

    // Call API
    const response = await teamApi.removeMemberFromTeam(props.team.id, member.id)

    if (response.success) {
      showSuccess('成員移除成功')
      // Notify parent to refresh data
      emit('member-removed')
    } else {
      // API failed: rollback to original list
      localMembers.value = originalMembers
      showError(response.error || '移除成員失敗')
    }
  } catch (error) {
    console.error('移除成員失敗:', error)
    showError('移除成員時發生錯誤')
    // Sync with props to ensure consistency
    syncMembers()
  } finally {
    removingMemberId.value = null
  }
}
</script>

<style scoped>
.team-members-section {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.section-title-group {
  display: flex;
  align-items: center;
}

.section-header h3 {
  color: #1e293b;
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0;
}

/* 🆕 Header Actions */
.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.loading-members,
.no-members {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #64748b;
  font-size: 1rem;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.no-members {
  flex-direction: column;
  gap: 12px;
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
  padding: 10px 16px;
  font-size: 0.875rem;
  min-width: auto;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-color: #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #5a67d8, #6b4598);
  border-color: #5a67d8;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* 🆕 Secondary Button */
.btn-secondary {
  background: #e0e7ff;
  color: #4f46e5;
  border-color: #6366f1;
}

.btn-secondary:hover:not(:disabled) {
  background: #c7d2fe;
  border-color: #4f46e5;
}

/* 🆕 Outline Button */
.btn-outline {
  background: white;
  color: #4b5563;
  border-color: #d1d5db;
}

.btn-outline:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

/* 🆕 Danger Button */
.btn-danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
  border-color: #ef4444;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.btn-danger:hover:not(:disabled) {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  border-color: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

/* 🆕 Selection Count Badge */
.selection-count {
  padding: 8px 12px;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
}

/* Icon styling in buttons */
.btn :deep(svg) {
  width: 16px;
  height: 16px;
}
</style>
