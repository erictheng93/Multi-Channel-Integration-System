<template>
  <div
    class="member-card"
    :class="{
      'modal-open': showEditModal,
      'selection-mode': isSelectionMode,
      'selected': isSelected
    }"
    @click="handleCardClick"
  >
    <!-- 🆕 Selection Checkbox (shown in selection mode) -->
    <div
      v-if="isSelectionMode"
      class="selection-checkbox"
      @click.stop="toggleSelection"
    >
      <input
        type="checkbox"
        :checked="isSelected"
        :disabled="isCurrentUser"
        class="checkbox-input"
        @click.stop="toggleSelection"
      >
    </div>

    <!-- Drag Handle - Only this area triggers drag (hidden in selection mode) -->
    <div
      v-if="!isSelectionMode"
      class="drag-handle"
      @click.stop
    >
      <span class="drag-icon">⋮⋮</span>
    </div>

    <div class="flex items-center gap-4 flex-1 rounded-xl p-2 -m-2">
      <div
        class="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0"
        style="box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);"
      >
        <img
          v-if="member.avatar"
          :src="member.avatar"
          :alt="member.name"
          class="w-full h-full object-cover"
          loading="lazy"
        >
        <div
          v-else
          class="avatar-placeholder"
        >
          {{ (member.name || member.loginId).charAt(0).toUpperCase() }}
        </div>
      </div>
      <div class="flex-1">
        <h3 class="m-0 mb-1.5 text-gray-800 text-[1.375rem] font-bold">
          {{ member.name || member.loginId }}
        </h3>
        <p class="m-0 mb-3 text-gray-500 text-base">
          {{ member.email || '無電子郵件' }}
        </p>
        <div class="flex gap-3 items-center flex-wrap">
          <span
            class="role"
            :class="member.role"
          >
            <span class="text-base leading-none">{{ getRoleIcon(member.role) }}</span>
            {{ getRoleText(member.role) }}
          </span>
          <span
            class="status"
            :class="member.status"
          >
            {{ getStatusText(member.status) }}
          </span>
          <span
            v-if="member.lastLoginAt"
            class="text-sm text-gray-500 py-1.5 px-3 bg-gray-200 rounded-xl"
          >
            最後登入: {{ formatDate(member.lastLoginAt) }}
          </span>
        </div>
      </div>
    </div>
    <div
      class="flex gap-2 items-center flex-wrap"
      @click.stop
    >
      <button
        class="btn"
        :class="member.status === 'active' ? 'btn-danger' : 'btn-success'"
        :disabled="isCurrentUser || loading"
        @click="$emit('toggleStatus', member)"
      >
        {{ member.status === 'active' ? '停用' : '啟用' }}
      </button>
      <button
        class="btn btn-secondary"
        :disabled="loading"
        @click="$emit('resetPassword', member)"
      >
        重設密碼
      </button>
      <button
        class="btn btn-danger"
        :disabled="isCurrentUser || loading"
        @click="$emit('removeMember', member)"
      >
        移除
      </button>
    </div>

    <!-- Edit Member Modal -->
    <MemberEditModal
      :show="showEditModal"
      :member="member"
      :all-teams="allTeams"
      @close="closeEditModal"
      @save="handleMemberSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import MemberEditModal from '@/components/team/member-edit/MemberEditModal.vue'
import type { TeamMember, Team } from '@/types'

interface Props {
  /** Team member data */
  member: TeamMember

  /** Current logged-in user ID for self-protection */
  currentUserId?: string

  /** Disable actions during operations */
  loading?: boolean

  /** List of all teams for multi-team selection */
  allTeams: Team[]

  /** 🆕 Whether selection mode is active */
  isSelectionMode?: boolean

  /** 🆕 Whether this member is selected */
  isSelected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  currentUserId: '',
  loading: false,
  isSelectionMode: false,
  isSelected: false
})

const emit = defineEmits<{
  toggleStatus: [member: TeamMember]
  resetPassword: [member: TeamMember]
  removeMember: [member: TeamMember]
  toggleSelection: [memberId: string]
}>()

// Ensure emit is recognized as used (TypeScript doesn't detect template usage)
if (typeof emit !== 'undefined') { /* noop */ }

// Modal state
const showEditModal = ref(false)

/**
 * 🆕 Handle card click
 * - In selection mode: toggle selection
 * - Normal mode: open edit modal
 */
const handleCardClick = (event: Event) => {
  if (props.isSelectionMode) {
    // In selection mode, clicking the card toggles selection
    if (!isCurrentUser.value) {
      toggleSelection()
    }
  } else {
    // Normal mode: open edit modal
    openEditModal(event)
  }
}

/**
 * 🆕 Toggle member selection
 */
const toggleSelection = () => {
  if (!isCurrentUser.value) {
    emit('toggleSelection', props.member.id)
  }
}

// Modal control functions
const openEditModal = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
}

/**
 * Handle member save event from MemberEditModal
 * MemberEditModal handles all save logic internally
 */
const handleMemberSaved = () => {
  // Modal will be closed by the child component emitting 'close'
  // No additional action needed - MemberEditModal manages state updates
}

const isCurrentUser = computed(() => {
  return props.currentUserId === props.member.id
})

const getStatusText = (status: string) => {
  const statusMap = {
    active: '活躍',
    inactive: '停用',
    pending: '待處理'
  }
  return statusMap[status as keyof typeof statusMap] || status
}

const getRoleText = (role: string) => {
  const roleMap = {
    admin: '管理員',
    team: '團隊負責人',
    agent: '客服'
  }
  return roleMap[role as keyof typeof roleMap] || role
}

const getRoleIcon = (role: string) => {
  const iconMap = {
    admin: '👑',
    team: '👥',
    agent: '🎧'
  }
  return iconMap[role as keyof typeof iconMap] || '👤'
}

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleString('zh-TW')
}

</script>

<style scoped>
/* ============================================
   Complex CSS (Cannot use Tailwind)
   ============================================ */

/* Member Card - Main container with hover effect */
.member-card {
  @apply bg-gray-50 rounded-2xl p-6 pl-2;
  @apply border border-gray-200 flex justify-between items-center gap-2;
  @apply transition-all duration-300 relative min-h-[120px] cursor-pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* Drag Handle */
.drag-handle {
  @apply flex-shrink-0 w-8 h-full flex items-center justify-center;
  @apply cursor-grab select-none text-gray-400;
  @apply transition-colors duration-200 rounded-lg;
}

.drag-handle:hover {
  @apply text-gray-600 bg-gray-200;
}

.drag-handle:active {
  @apply cursor-grabbing text-primary-600;
}

.drag-icon {
  @apply text-xl font-bold tracking-tighter;
}

.member-card:hover:not(.modal-open):not(.selection-mode) {
  @apply -translate-y-0.5 bg-gray-100 border-gray-300;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
}

.member-card.modal-open {
  @apply transform-none transition-none;
}

/* 🆕 Selection Mode Styles */
.member-card.selection-mode {
  @apply cursor-pointer;
}

.member-card.selection-mode:hover:not(.selected) {
  @apply bg-blue-50 border-blue-200;
}

.member-card.selected {
  @apply bg-indigo-50 border-indigo-300;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

/* 🆕 Selection Checkbox */
.selection-checkbox {
  @apply flex-shrink-0 w-10 h-full flex items-center justify-center;
  @apply cursor-pointer;
}

.checkbox-input {
  @apply w-5 h-5 rounded border-2 border-gray-300;
  @apply cursor-pointer transition-all duration-200;
  accent-color: #6366f1;
}

.checkbox-input:checked {
  @apply border-indigo-500;
}

.checkbox-input:disabled {
  @apply cursor-not-allowed opacity-50;
}

/* Avatar Placeholder - Gradient background */
.avatar-placeholder {
  @apply w-full h-full text-white flex items-center justify-center;
  @apply font-bold text-[1.375rem];
  background: linear-gradient(135deg, #667eea, #764ba2);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Role & Status Badges - Backdrop filter effect */
.role,
.status {
  @apply inline-flex items-center gap-1.5 py-1.5 px-3;
  @apply rounded-full text-sm font-semibold;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.role.admin {
  @apply bg-yellow-100 text-yellow-800 border-yellow-400;
}

.role.team {
  @apply bg-purple-100 text-purple-700 border-purple-300;
}

.role.agent {
  @apply bg-blue-100 text-blue-800 border-blue-300;
}

.status.active {
  @apply bg-green-100 text-green-800 border-green-200;
}

.status.inactive {
  @apply bg-red-50 text-red-800 border-red-200;
}

.status.pending {
  @apply bg-yellow-100 text-yellow-800 border-yellow-400;
}

/* Multi-Team Selector - Gradient background */
.multi-team-selector {
  @apply border border-gray-200 rounded-xl p-4;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

/* ============================================
   Responsive - RWD
   ============================================ */

@media (max-width: 768px) {
  .member-card {
    @apply flex-col gap-4 items-stretch p-4;
  }
}
</style>