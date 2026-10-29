<template>
  <AppLayout>
    <div class="ui-page team-management ui-rise">
      <!-- Header Section -->
      <UiPageHead
        title="團隊成員"
        :subtitle="members.length > 0 ? headSummary : ''"
      >
        <template #actions>
          <RefreshButton
            :loading="loading"
            @refresh="controller.refresh"
          />
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="loading"
            @click="controller.team.openAddTeamModal"
          >
            <svg
              class="head-ico"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="M12 5v14M5 12h14" /></svg>新增團隊
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="loading"
            @click="controller.member.openAddMemberModal"
          >
            <svg
              class="head-ico"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle
              cx="9"
              cy="7"
              r="4"
            /><path d="M19 8v6M22 11h-6" /></svg>新增成員
          </button>
        </template>
      </UiPageHead>

      <!-- Presence strip: who is online right now, and where. One compact card; no art, no stretched halves -->
      <section
        v-if="members.length > 0"
        class="ui-card presence"
        aria-label="目前在線"
      >
        <div class="pres-lead">
          <div class="pres-label">
            <span
              class="pres-dot"
              aria-hidden="true"
            />目前在線
          </div>
          <div
            class="pres-value"
            :aria-busy="(loading && !presence.available.value) || undefined"
          >
            {{ onlineCount === null ? '—' : onlineCount }}<small v-if="onlineCount !== null">位</small>
          </div>
          <p class="pres-meaning">
            {{ onlineMeaning }}
          </p>
        </div>
        <ul
          v-if="teamOnline.length > 0"
          class="tm-list"
          aria-label="各團隊在線"
        >
          <li
            v-for="row in teamOnline"
            :key="row.id"
            class="tm-row"
          >
            <span class="tm-top">
              <span class="tm-name">{{ row.name }}</span>
              <span class="tm-n"><b>{{ row.online === null ? '—' : row.online }}</b> / {{ row.total }}</span>
            </span>
            <span class="tm-bar"><i :style="{ width: row.percent + '%' }" /></span>
          </li>
        </ul>
      </section>

      <!-- Member Management Section -->
      <MemberListSection
        :members="members"
        :all-teams="teams"
        :loading="loading"
        :current-user-id="currentUserId"
        :online-ids="presence.onlineIds.value"
        :presence-available="presence.available.value"
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
        @sort-change="handleMemberSortChange"
        @sort-toggle="memberSorting.toggleSortOrder"
        @sort-mode-change="memberSortMode.setSortMode"
        @custom-order-change="memberSortMode.updateCustomOrder"
        @toggle-selection-mode="controller.member.toggleSelectionMode"
        @toggle-member-selection="controller.member.toggleMemberSelection"
        @select-all="() => controller.member.selectAllMembers(currentUserId || '')"
        @select-page="handleSelectPage"
        @bulk-edit="controller.member.openBulkEditModal"
        @bulk-delete="() => controller.member.bulkDeleteMembers(currentUserId || '')"
      />

      <!-- Team Management Section -->
      <TeamListSection
        :teams="teams"
        :members="members"
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
        @sort-change="handleTeamSortChange"
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
        :email-check-loading="controller.member.emailCheckLoading.value"
        :teams="teams"
        @close="controller.member.closeAddMemberModal"
        @submit="controller.member.submitAddMember"
        @toggle-password="controller.member.toggleAddPasswordVisibility"
        @email-blur="controller.member.checkEmailOnBlur"
      />

      <!-- Duplicate Member Detection Modal -->
      <DuplicateMemberModal
        :visible="controller.member.duplicateModalVisible.value"
        :status="controller.member.duplicateStatus.value"
        :member="controller.member.duplicateMember.value"
        @close="controller.member.closeDuplicateModal"
        @reactivate="controller.member.handleReactivate"
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
import UiPageHead from '@/components/ui/UiPageHead.vue'
import { onMounted, onUnmounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTeamManagementController } from '@/composables/team-management'
import { useTeamPresence } from '@/composables/team-management/useTeamPresence'
import { useToast } from '@/composables/useToast'
import { teamApi } from '@/api/team'
import type { MemberSortField, TeamSortField } from '@/composables/useListSorting'
import AppLayout from '@/components/ui/AppLayout.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import MemberListSection from '@/components/team/MemberListSection.vue'
import TeamListSection from '@/components/team/TeamListSection.vue'
import AddMemberModal from '@/components/team/AddMemberModal.vue'
import DuplicateMemberModal from '@/components/team/DuplicateMemberModal.vue'
import AddTeamModal from '@/components/team/AddTeamModal.vue'
import EditTeamModal from '@/components/team/EditTeamModal.vue'
import PasswordResetModal from '@/components/team/PasswordResetModal.vue'
import BulkEditMemberModal from '@/components/team/BulkEditMemberModal.vue'

// ==================== Controller & State ====================

// Initialize main controller
const controller = useTeamManagementController()

// Online dots (GET /team/presence)
const presence = useTeamPresence()

// Toast notifications
const { showSuccess, showError } = useToast()

// Auth store for current user
const authStore = useAuthStore()
const currentUserId = computed(() => authStore.currentAgent?.id)

// Extract state from controller
const { loading, teams, members, stats, memberSorting, teamSorting, memberSortMode, teamSortMode } = controller

/** "8 位成員分屬 2 個團隊。王柏翰已停用，無法登入。" built from loaded data only (who is online lives in the lead metric). */
const headSummary = computed(() => {
  let text = `${members.value.length} 位成員分屬 ${stats.value.teamCount} 個團隊。`
  const inactive = members.value.filter(m => m.status === 'inactive')
  const [onlyInactive] = inactive
  if (inactive.length === 1 && onlyInactive) {
    text += `${onlyInactive.name || onlyInactive.loginId}已停用，無法登入。`
  } else if (inactive.length > 1) {
    text += `${inactive.length} 位成員已停用，無法登入。`
  }
  return text
})

/** Online members; null when presence is unavailable (never a made-up zero) */
const onlineCount = computed<number | null>(() =>
  presence.available.value ? members.value.filter(m => presence.onlineIds.value.has(m.id)).length : null
)

const onlineMeaning = computed(() => {
  if (onlineCount.value === null) {
    return '目前無法取得在線狀態'
  }
  const active = members.value.filter(m => m.status !== 'inactive').length
  return `共 ${active} 位啟用中的成員`
})

/** Online / total per team, from the loaded members only */
const teamOnline = computed(() =>
  teams.value
    .map((team) => {
      const people = members.value.filter(
        m => m.status !== 'inactive' && (m.primaryTeamId === team.id || (m.teams ?? []).some(t => t.teamId === team.id))
      )
      const online = presence.available.value ? people.filter(m => presence.onlineIds.value.has(m.id)).length : null
      return {
        id: team.id,
        name: team.name,
        total: people.length,
        online,
        percent: online === null || people.length === 0 ? 0 : Math.round((online / people.length) * 100)
      }
    })
    .filter(row => row.total > 0)
)

// Handle select-page: add page member IDs to selection
function handleSelectPage(memberIds: string[]) {
  for (const id of memberIds) {
    if (id !== currentUserId.value && !controller.member.selectedMemberIds.value.has(id)) {
      controller.member.toggleMemberSelection(id)
    }
  }
}

function isMemberSortField(field: string): field is MemberSortField {
  return memberSorting.sortOptions.some(option => option.field === field)
}

function isTeamSortField(field: string): field is TeamSortField {
  return teamSorting.sortOptions.some(option => option.field === field)
}

function handleMemberSortChange(field: string) {
  if (isMemberSortField(field)) {
    memberSorting.setSortField(field)
  }
}

function handleTeamSortChange(field: string) {
  if (isTeamSortField(field)) {
    teamSorting.setSortField(field)
  }
}

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
  presence.start()
  await controller.initialize()
})

onUnmounted(() => {
  controller.cleanup()
})
</script>

<style scoped>
/* ==================== Page Layout ==================== */
.head-ico {
  width: 16px;
  height: 16px;
}

.presence {
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  gap: 8px 32px;
  align-items: center;
  padding: 18px 24px;
}

.pres-lead {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.pres-label {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: var(--ui-t-meta);
  font-weight: 600;
  color: var(--ui-ink-2);
}

.pres-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ui-green);
}

.pres-value {
  font: 600 44px / 1.1 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.pres-value small {
  margin-left: 4px;
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-muted);
}

.pres-meaning {
  margin: 0;
  font-size: var(--ui-t-meta);
  color: var(--ui-muted);
}

/* Teams as equal columns beside the number, each a name, a count and a bar */
.tm-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 18px 28px;
  margin: 0;
  padding: 0 0 0 32px;
  list-style: none;
  box-shadow: inset 0.5px 0 0 var(--ui-sep);
}

.tm-row {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.tm-top {
  display: flex;
  gap: 10px;
  align-items: baseline;
  justify-content: space-between;
  font-size: 14px;
}

.tm-name {
  min-width: 0;
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tm-bar {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.tm-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ui-green);
  transition: width var(--ui-dur) var(--ui-ease);
}

.tm-n {
  flex: none;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.tm-n b {
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-ink);
}

@media (max-width: 1024px) {
  .presence {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }

  .tm-list {
    padding: 14px 0 0;
    box-shadow: inset 0 0.5px 0 var(--ui-sep);
  }
}

/* Phone: the number and its caption share a line, so the list starts within the first screen */
@media (max-width: 768px) {
  .presence {
    padding: 14px 16px;
  }

  .pres-lead {
    grid-template-columns: auto 1fr;
    column-gap: 12px;
    align-items: baseline;
  }

  .pres-label {
    grid-column: 1 / -1;
  }

  .pres-value {
    font-size: 36px;
  }

  .pres-meaning {
    align-self: center;
  }
}
</style>
