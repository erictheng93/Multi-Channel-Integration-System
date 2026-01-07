<template>
  <div class="team-members-section">
    <!-- Section Header -->
    <div class="section-header">
      <div class="section-title-group">
        <h3>團隊成員</h3>
      </div>
      <button
        class="btn btn-sm btn-primary"
        :disabled="loading"
        @click="$emit('add-member')"
      >
        + 新增成員
      </button>
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
      @remove-member="handleRemoveMember"
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
 * - Confirmation dialog integration
 * - Toast notifications
 *
 * Responsibilities:
 * - State management (loading, removing)
 * - Member removal with confirmation
 * - Optimistic UI updates with rollback
 * - Event coordination
 */

import { ref } from 'vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import MemberGrid from './MemberGrid.vue'
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

// Sync localMembers with props.members
// This allows us to do optimistic updates while maintaining props reactivity
const syncMembers = () => {
  localMembers.value = [...props.members]
}

// Empty Icon Component
const EmptyIcon = {
  template: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="m9,9 6,6"></path>
    <path d="m15,9-6,6"></path>
  </svg>`
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
  padding: 14px 20px;
  font-size: 1rem;
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
</style>
