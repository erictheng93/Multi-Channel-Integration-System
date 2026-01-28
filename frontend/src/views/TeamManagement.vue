<template>
  <AppLayout>
    <div class="team-management">
      <!-- Header Section -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-info">
            <h1 class="page-title">
              團隊管理
            </h1>
            <p class="page-subtitle">
              管理系統人員與團隊設置，控制存取權限
            </p>
          </div>
          <div class="header-actions">
            <RefreshButton
              :loading="loading"
              @refresh="controller.refresh"
            />
          </div>
        </div>
      </div>

      <!-- Stats Overview -->
      <TeamStatsOverview :stats="stats" />

      <!-- Member Management Section -->
      <MemberListSection
        :members="members"
        :all-teams="teams"
        :loading="loading"
        :current-user-id="currentUserId"
        :sort-options="memberSorting.sortOptions"
        :sort-state="memberSorting.sortState.value"
        :current-sort-label="memberSorting.currentSortLabel.value"
        :sort-mode="memberSortMode.sortMode.value"
        :is-selection-mode="controller.member.isSelectionMode.value"
        :selected-member-ids="controller.member.selectedMemberIds.value"
        :selected-count="controller.member.selectedCount.value"
        @add-member="controller.member.openAddMemberModal"
        @update-role="controller.member.updateMemberRole"
        @toggle-status="controller.member.toggleMemberStatus"
        @reset-password="controller.member.openPasswordResetModal"
        @remove-member="controller.member.removeMember"
        @sort-change="(field: string) => memberSorting.setSortField(field as any)"
        @sort-toggle="memberSorting.toggleSortOrder"
        @sort-mode-change="memberSortMode.setSortMode"
        @custom-order-change="memberSortMode.updateCustomOrder"
        @toggle-selection-mode="controller.member.toggleSelectionMode"
        @toggle-member-selection="controller.member.toggleMemberSelection"
        @select-all="() => controller.member.selectAllMembers(currentUserId || '')"
        @bulk-edit="controller.member.openBulkEditModal"
        @bulk-delete="() => controller.member.bulkDeleteMembers(currentUserId || '')"
      />

      <!-- Team Management Section -->
      <TeamListSection
        :teams="teams"
        :loading="loading"
        :sort-options="teamSorting.sortOptions"
        :sort-state="teamSorting.sortState.value"
        :current-sort-label="teamSorting.currentSortLabel.value"
        :sort-mode="teamSortMode.sortMode.value"
        @add-team="controller.team.openAddTeamModal"
        @toggle-status="controller.team.toggleTeamStatus"
        @remove-team="controller.team.removeTeam"
        @member-updated="controller.team.handleMemberUpdated"
        @team-updated="controller.refresh"
        @sort-change="(field: string) => teamSorting.setSortField(field as any)"
        @sort-toggle="teamSorting.toggleSortOrder"
        @sort-mode-change="teamSortMode.setSortMode"
        @custom-order-change="teamSortMode.updateCustomOrder"
      />

      <!-- Modals -->
      <!-- Add Member Modal -->
      <AddMemberModal
        :visible="controller.member.addMemberModal.value"
        :form="controller.member.addMemberForm"
        :loading="controller.member.addMemberLoading.value"
        :show-password="controller.member.showAddPassword.value"
        :teams="teams"
        @close="controller.member.closeAddMemberModal"
        @submit="controller.member.submitAddMember"
        @toggle-password="controller.member.toggleAddPasswordVisibility"
      />

      <!-- Add Team Modal -->
      <AddTeamModal
        :visible="controller.team.addTeamModal.value"
        :form="controller.team.addTeamForm"
        :loading="controller.team.addTeamLoading.value"
        :available-members="controller.team.availableMembers.value"
        :is-all-members-selected="controller.team.isAllMembersSelected.value"
        :get-initials="controller.team.getInitials"
        :get-role-display-name="controller.team.getRoleDisplayName"
        @close="controller.team.closeAddTeamModal"
        @submit="controller.team.submitAddTeam"
        @toggle-member="controller.team.toggleMemberSelection"
        @toggle-select-all="controller.team.toggleSelectAllMembers"
      />

      <!-- Edit Team Modal -->
      <EditTeamModal
        :visible="controller.team.editTeamModal.value"
        :form="controller.team.editTeamForm"
        :loading="controller.team.editTeamLoading.value"
        :current-members="controller.team.editTeamCurrentMembers.value"
        :available-members="controller.team.editTeamAvailableMembers.value"
        :is-all-available-members-selected="controller.team.isAllAvailableMembersSelected.value"
        :get-initials="controller.team.getInitials"
        :get-role-display-name="controller.team.getRoleDisplayName"
        @close="controller.team.closeEditTeamModal"
        @submit="controller.team.submitEditTeam"
        @remove-member="controller.team.removeMemberFromTeam"
        @toggle-available-member="controller.team.toggleAvailableMemberSelection"
        @toggle-select-all="controller.team.toggleSelectAllAvailableMembers"
      />

      <!-- Password Reset Modal -->
      <PasswordResetModal
        :visible="controller.member.passwordResetModal.value"
        :form="controller.member.passwordResetForm"
        :member="controller.member.passwordResetMember.value"
        :loading="controller.member.passwordResetLoading.value"
        :password-mismatch="controller.member.passwordMismatch.value"
        :is-password-form-valid="controller.member.isPasswordFormValid.value"
        @close="controller.member.closePasswordResetModal"
        @submit="controller.member.submitPasswordReset"
      />

      <!-- Bulk Edit Member Modal -->
      <BulkEditMemberModal
        :visible="controller.member.bulkEditModal.value"
        :selected-members="selectedMembersForBulkEdit"
        :all-teams="teams"
        :current-user-id="currentUserId"
        @close="controller.member.closeBulkEditModal"
        @saved="handleBulkEditSaved"
      />
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTeamManagementController } from '@/composables/team-management'
import { useToast } from '@/composables/useToast'
import { teamApi } from '@/api/team'
import AppLayout from '@/components/ui/AppLayout.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import TeamStatsOverview from '@/components/team/TeamStatsOverview.vue'
import MemberListSection from '@/components/team/MemberListSection.vue'
import TeamListSection from '@/components/team/TeamListSection.vue'
import AddMemberModal from '@/components/team/AddMemberModal.vue'
import AddTeamModal from '@/components/team/AddTeamModal.vue'
import EditTeamModal from '@/components/team/EditTeamModal.vue'
import PasswordResetModal from '@/components/team/PasswordResetModal.vue'
import BulkEditMemberModal from '@/components/team/BulkEditMemberModal.vue'

// ==================== Controller & State ====================

// Initialize main controller
const controller = useTeamManagementController()

// Toast notifications
const { showSuccess, showError } = useToast()

// Auth store for current user
const authStore = useAuthStore()
const currentUserId = computed(() => authStore.currentAgent?.id)

// Extract state from controller
const { loading, teams, members, stats, memberSorting, teamSorting, memberSortMode, teamSortMode } = controller

// Computed: Get selected members for bulk edit
const selectedMembersForBulkEdit = computed(() => {
  const selectedIds = controller.member.selectedMemberIds.value
  return members.value.filter(m => selectedIds.has(m.id))
})

/** Payload from bulk edit saved event */
interface BulkEditSavedPayload {
  updatedCount: number
  undoToken?: string
  undoExpiresAt?: string
}

/**
 * Handler for bulk edit saved
 * Shows undo toast with 10-second countdown if undo token is available
 */
const handleBulkEditSaved = (payload: BulkEditSavedPayload) => {
  // Exit selection mode after successful bulk edit
  if (controller.member.isSelectionMode.value) {
    controller.member.toggleSelectionMode()
  }

  // Refresh data to ensure UI is up to date
  controller.refresh()

  // Show undo toast if undo token is available
  if (payload.undoToken) {
    showSuccess(
      '批量編輯成功',
      `已成功更新 ${payload.updatedCount} 位成員`,
      {
        duration: 10000,
        showProgress: true,
        actionText: '復原',
        onAction: async () => {
          try {
            if (!payload.undoToken) {
              return
            }
            const response = await teamApi.undoBatchEdit(payload.undoToken)

            if (response.success && response.data) {
              showSuccess('已復原', `已成功恢復 ${response.data.restoredCount} 位成員的資料`)
              // Refresh to reflect restored data
              controller.refresh()
            } else {
              showError('復原失敗', response.error || '無法恢復成員資料')
            }
          } catch (err) {
            console.error('復原失敗:', err)
            showError('復原失敗', '無法恢復成員資料，可能已超過時限')
          }
        }
      }
    )
  } else {
    // No undo token, just show simple success message
    showSuccess('批量編輯成功', `已成功更新 ${payload.updatedCount} 位成員`)
  }
}

// ==================== Lifecycle ====================

onMounted(async () => {
  await controller.initialize()
})

onUnmounted(() => {
  controller.cleanup()
})
</script>

<style scoped>
/* ==================== Page Layout ==================== */
.team-management {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

/* ==================== Page Header ==================== */
.page-header {
  margin-bottom: 2rem;
}

.header-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.header-info {
  flex: 1;
  min-width: 0;
}

.page-title {
  font-size: 2rem;
  font-weight: 800;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
  background: linear-gradient(135deg, #1f2937 0%, #4b5563 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-subtitle {
  font-size: 1rem;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

/* ==================== Responsive Design ==================== */
@media (max-width: 768px) {
  .team-management {
    padding: 1rem;
  }

  .page-title {
    font-size: 1.5rem;
  }

  .page-subtitle {
    font-size: 0.875rem;
  }

  .header-content {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: flex-end;
  }
}
</style>
