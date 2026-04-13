<template>
  <Modal
    :show="visible"
    title="批量編輯成員"
    size="xl"
    @close="handleClose"
  >
    <!-- Header Summary -->
    <div class="modal-summary">
      <UsersIcon class="summary-icon" />
      <div class="summary-content">
        <span>正在編輯 <strong>{{ memberCount }}</strong> 位成員</span>
        <span
          v-if="changedMemberCount > 0"
          class="changes-badge"
        >
          {{ changedMemberCount }} 位有變更
        </span>
        <span
          v-if="useVirtualScroll"
          class="virtual-badge"
        >
          虛擬滾動已啟用
        </span>
      </div>
    </div>

    <!-- Members List (Virtual Scrolling for large lists) -->
    <div
      v-if="useVirtualScroll"
      ref="scrollContainerRef"
      class="members-list-container virtual-scroll"
    >
      <div
        class="members-list virtual"
        :style="{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }"
      >
        <div
          v-for="virtualItem in virtualizer.getVirtualItems()"
          :key="getMemberEntry(virtualItem.index)?.[0] || virtualItem.index"
          :ref="(el) => el && virtualizer.measureElement(el as Element)"
          :data-index="virtualItem.index"
          class="virtual-item"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualItem.start}px)`
          }"
        >
          <BulkMemberEditCard
            v-if="getMemberEntry(virtualItem.index)"
            :member="getMemberEntry(virtualItem.index)![1].originalMember"
            :form-data="getMemberEntry(virtualItem.index)![1].formData"
            :errors="getMemberEntry(virtualItem.index)![1].errors"
            :pending-team-changes="getMemberEntry(virtualItem.index)![1].pendingTeamChanges"
            :display-teams="getDisplayTeams(getMemberEntry(virtualItem.index)![0])"
            :all-teams="allTeams"
            :is-dirty="isMemberDirty(getMemberEntry(virtualItem.index)![0])"
            :current-user-id="currentUserId"
            @update:field="handleFieldUpdate"
            @add-team="handleAddTeam"
            @remove-team="handleRemoveTeam"
            @teams-loaded="handleTeamsLoaded"
          />
        </div>
      </div>
    </div>

    <!-- Regular Members List (For small lists) -->
    <div
      v-else
      class="members-list-container"
    >
      <div class="members-list">
        <BulkMemberEditCard
          v-for="[memberId, state] in memberStates"
          :key="memberId"
          :member="state.originalMember"
          :form-data="state.formData"
          :errors="state.errors"
          :pending-team-changes="state.pendingTeamChanges"
          :display-teams="getDisplayTeams(memberId)"
          :all-teams="allTeams"
          :is-dirty="isMemberDirty(memberId)"
          :current-user-id="currentUserId"
          @update:field="handleFieldUpdate"
          @add-team="handleAddTeam"
          @remove-team="handleRemoveTeam"
          @teams-loaded="handleTeamsLoaded"
        />
      </div>
    </div>

    <!-- Warning Note -->
    <div class="warning-note">
      <WarningIcon class="warning-icon" />
      <span>無法編輯自己的帳號，您的資料將不會被變更</span>
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <div class="footer-info">
        <span
          v-if="hasAnyChanges"
          class="changes-summary"
        >
          {{ changedMemberCount }} 位成員有待儲存的變更
        </span>
      </div>
      <div class="footer-actions">
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
          :disabled="isLoading || !hasAnyChanges || !isAllFormsValid"
          @click="handleSubmit"
        >
          {{ isLoading ? '儲存中...' : `儲存變更 (${changedMemberCount})` }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
/**
 * BulkEditMemberModal Component
 *
 * Modal for editing multiple members individually.
 * Each member is displayed as a card with editable fields:
 * - Name (姓名)
 * - Email
 * - Role (角色)
 * - Team Assignment (團隊分配)
 *
 * Features:
 * - Virtual scrolling for 10+ members (performance optimization)
 * - Individual form state per member
 * - Deferred save mode for all changes
 */

import { ref, computed, watch } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import Modal from '@/components/ui/Modal.vue'
import BulkMemberEditCard from '@/components/team/BulkMemberEditCard.vue'
import UsersIcon from '@/components/icons/UsersIcon.vue'
import WarningIcon from '@/components/icons/WarningIcon.vue'
import { useBulkMemberEdit, type BulkMemberEditState } from '@/composables/team-management/useBulkMemberEdit'
import type { TeamMember, Team, AgentTeamMembership } from '@/types'

// ==================== Type Definitions ====================

interface Props {
  /** Modal visibility state */
  visible: boolean

  /** Selected members to edit */
  selectedMembers: TeamMember[]

  /** All available teams */
  allTeams: Team[]

  /** Current user ID */
  currentUserId?: string
}

interface SavedPayload {
  updatedCount: number
  undoToken?: string
  undoExpiresAt?: string
}

interface Emits {
  (_e: 'close'): void
  (_e: 'saved', _payload: SavedPayload): void
}

// ==================== Define Macros ====================

const props = withDefaults(defineProps<Props>(), {
  currentUserId: ''
})

const emit = defineEmits<Emits>()

// ==================== Constants ====================

/** Threshold for enabling virtual scrolling */
const VIRTUAL_SCROLL_THRESHOLD = 10

// Refs for virtual scrolling
const scrollContainerRef = ref<HTMLElement>()

// Initialize bulk edit composable
const {
  memberStates,
  isLoading,
  hasAnyChanges,
  changedMemberCount,
  isAllFormsValid,
  initializeMembers,
  updateMemberForm,
  addTeamToMember,
  removeTeamFromMember,
  initMemberTeams,
  getDisplayTeams,
  isMemberDirty,
  saveAllChanges,
  reset
} = useBulkMemberEdit()

/**
 * Number of members being edited
 */
const memberCount = computed(() => props.selectedMembers.length)

/**
 * Whether to use virtual scrolling (10+ members)
 */
const useVirtualScroll = computed(() => memberCount.value >= VIRTUAL_SCROLL_THRESHOLD)

/**
 * Convert Map to array for virtual scrolling
 */
const memberStatesList = computed(() => Array.from(memberStates.value.entries()))

/**
 * Get member entry by index (type-safe helper for virtual scrolling)
 */
function getMemberEntry(index: number): [string, BulkMemberEditState] | undefined {
  return memberStatesList.value[index]
}

/**
 * Virtual list setup for large member counts
 */
const virtualizer = useVirtualizer({
  get count() {
    return memberStatesList.value.length
  },
  getScrollElement: () => scrollContainerRef.value || null,
  estimateSize: () => 280, // Estimated height for member card
  overscan: 3, // Render 3 extra items above/below visible area
  measureElement: (element) => element?.getBoundingClientRect().height || 280
})

/**
 * Watch for visibility changes to initialize/reset
 */
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      // Initialize when modal opens
      initializeMembers(props.selectedMembers)
    } else {
      // Reset when modal closes
      reset()
    }
  },
  { immediate: true }
)

/**
 * Handle form field update
 */
function handleFieldUpdate(
  memberId: string,
  field: keyof BulkMemberEditState['formData'],
  value: string
) {
  updateMemberForm(memberId, field, value)
}

/**
 * Handle team addition
 */
function handleAddTeam(memberId: string, teamId: number, teamName: string) {
  addTeamToMember(memberId, teamId, teamName)
}

/**
 * Handle team removal
 */
function handleRemoveTeam(memberId: string, teamId: number) {
  removeTeamFromMember(memberId, teamId)
}

/**
 * Handle teams loaded for a member
 */
function handleTeamsLoaded(memberId: string, teams: AgentTeamMembership[]) {
  initMemberTeams(memberId, teams)
}

/**
 * Handle close
 */
function handleClose() {
  emit('close')
}

/**
 * Handle submit
 */
async function handleSubmit() {
  const result = await saveAllChanges(props.currentUserId || '')

  if (result.success || result.updatedCount > 0) {
    emit('saved', {
      updatedCount: result.updatedCount,
      undoToken: result.undoToken,
      undoExpiresAt: result.undoExpiresAt
    })
    emit('close')
  }
}
</script>

<style scoped>
/* Modal Summary */
.modal-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #bae6fd;
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

.summary-icon {
  width: 24px;
  height: 24px;
  color: #0284c7;
  flex-shrink: 0;
}

.summary-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #0369a1;
  font-size: 0.9375rem;
  flex-wrap: wrap;
}

.changes-badge {
  padding: 0.25rem 0.625rem;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 6px;
  color: #92400e;
  font-size: 0.8125rem;
  font-weight: 500;
}

.virtual-badge {
  padding: 0.25rem 0.625rem;
  background: #dbeafe;
  border: 1px solid #93c5fd;
  border-radius: 6px;
  color: #1e40af;
  font-size: 0.75rem;
  font-weight: 500;
}

/* Members List Container */
.members-list-container {
  max-height: 50vh;
  overflow-y: auto;
  margin: 0 -1.5rem;
  padding: 0 1.5rem;
}

.members-list-container.virtual-scroll {
  /* Fixed height for virtual scrolling */
  height: 50vh;
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.members-list.virtual {
  /* Virtual list uses absolute positioning */
  gap: 0;
}

.virtual-item {
  padding-bottom: 1rem; /* Gap between items */
}

/* Warning Note */
.warning-note {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  color: #92400e;
  font-size: 0.8125rem;
  line-height: 1.5;
  margin-top: 1.5rem;
}

.warning-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: #f59e0b;
}

/* Footer */
.footer-info {
  flex: 1;
  display: flex;
  align-items: center;
}

.changes-summary {
  font-size: 0.875rem;
  color: #6b7280;
}

.footer-actions {
  display: flex;
  gap: 0.75rem;
}

/* Scrollbar Styling */
.members-list-container::-webkit-scrollbar {
  width: 8px;
}

.members-list-container::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.members-list-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.members-list-container::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
