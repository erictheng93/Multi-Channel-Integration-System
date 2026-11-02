<template>
  <div
    class="member-row"
    :class="{
      'modal-open': showEditModal,
      'selection-mode': isSelectionMode,
      'is-selected': isSelected,
      'is-off': member.status !== 'active'
    }"
    role="listitem"
    @click="handleCardClick"
  >
    <span
      v-if="!isSelectionMode"
      class="drag-handle"
      title="拖曳排序"
      @click.stop
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      ><circle
        cx="9"
        cy="6"
        r="1.4"
      /><circle
        cx="15"
        cy="6"
        r="1.4"
      /><circle
        cx="9"
        cy="12"
        r="1.4"
      /><circle
        cx="15"
        cy="12"
        r="1.4"
      /><circle
        cx="9"
        cy="18"
        r="1.4"
      /><circle
        cx="15"
        cy="18"
        r="1.4"
      /></svg>
    </span>

    <span
      v-if="isSelectionMode"
      class="cb-cell"
      @click.stop="toggleSelection"
    >
      <input
        type="checkbox"
        class="cb"
        :checked="isSelected"
        :disabled="isCurrentUser"
        :aria-label="isCurrentUser ? `選取${displayName}（自己）` : `選取${displayName}`"
        @click.stop="toggleSelection"
      >
    </span>

    <div class="who">
      <TeamAvatar
        :name="displayName"
        :seed="member.id"
        :src="member.avatar"
        :presence="presence"
      />
      <div class="who-text">
        <b>{{ displayName }}<span
          v-if="isCurrentUser"
          class="you"
        >你</span></b>
        <span class="mail">{{ member.email || '無電子郵件' }}</span>
      </div>
    </div>

    <div
      class="sysrole"
      :class="{ 'is-default': member.role !== 'admin' }"
    >
      <span
        class="ui-pill"
        :class="{ 'ui-pill-blue': member.role === 'admin' }"
      >{{ getRoleText(member.role) }}</span>
    </div>

    <div class="teams">
      <template v-if="visibleTeams.length > 0">
        <span
          v-for="t in visibleTeams"
          :key="t.teamId"
          class="ui-tag"
          :class="teamTagClass(t.teamId)"
        >{{ t.teamName || `團隊 ${t.teamId}` }}<span class="tr-in"> · {{ teamRoleText(t.roleInTeam) }}</span></span>
        <span
          v-if="hiddenTeamCount > 0"
          class="tr"
        >+{{ hiddenTeamCount }}</span>
      </template>
      <span
        v-else-if="member.primaryTeamName"
        class="ui-tag"
      >{{ member.primaryTeamName }}</span>
      <span
        v-else
        class="tr"
      >未加入團隊</span>
    </div>

    <div
      class="stcell"
      :class="{ 'is-active': member.status === 'active' }"
    >
      <span
        class="ui-pill"
        :class="statusClass"
      >{{ getStatusText(member.status) }}</span>
    </div>

    <div
      class="last"
      :title="lastLoginTitle"
    >
      {{ lastLogin }}
    </div>

    <div
      class="macts"
      @click.stop
    >
      <Dropdown
        placement="bottom-end"
        :disabled="loading"
      >
        <template #trigger>
          <span
            class="more-btn"
            :aria-label="`更多操作：${displayName}`"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              aria-hidden="true"
            ><circle
              cx="12"
              cy="5"
              r="1"
            /><circle
              cx="12"
              cy="12"
              r="1"
            /><circle
              cx="12"
              cy="19"
              r="1"
            /></svg>
          </span>
        </template>
        <DropdownItem
          :label="member.status === 'active' ? '停用' : '啟用'"
          :disabled="isCurrentUser || loading"
          @click="$emit('toggleStatus', member)"
        />
        <DropdownItem
          label="重設密碼"
          :disabled="loading"
          @click="$emit('resetPassword', member)"
        />
        <DropdownItem
          label="移除"
          variant="danger"
          :disabled="isCurrentUser || loading"
          @click="$emit('removeMember', member)"
        />
      </Dropdown>
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
import Dropdown from '@/components/ui/Dropdown.vue'
import DropdownItem from '@/components/ui/DropdownItem.vue'
import TeamAvatar from '@/components/team/TeamAvatar.vue'
import { formatLastLogin, teamRoleText, teamTagClass } from '@/utils/team-tone'
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

  /** Whether selection mode is active */
  isSelectionMode?: boolean

  /** Whether this member is selected */
  isSelected?: boolean

  /** online / offline; omit when presence is unknown */
  presence?: 'online' | 'offline'
}

const props = withDefaults(defineProps<Props>(), {
  currentUserId: '',
  loading: false,
  isSelectionMode: false,
  isSelected: false,
  presence: undefined
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
 * Handle row click
 * - In selection mode: toggle selection
 * - Normal mode: open edit modal
 */
const handleCardClick = (event: Event) => {
  if (props.isSelectionMode) {
    if (!isCurrentUser.value) {
      toggleSelection()
    }
  } else {
    openEditModal(event)
  }
}

const toggleSelection = () => {
  if (!isCurrentUser.value) {
    emit('toggleSelection', props.member.id)
  }
}

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
}

const isCurrentUser = computed(() => {
  return props.currentUserId === props.member.id
})

const displayName = computed(() => props.member.name || props.member.loginId)

/** Primary team first, then the rest in joined order. */
const sortedTeams = computed(() => {
  const list = [...(props.member.teams ?? [])]
  return list.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
})
const MAX_TEAMS = 2
const visibleTeams = computed(() => sortedTeams.value.slice(0, MAX_TEAMS))
const hiddenTeamCount = computed(() => Math.max(0, sortedTeams.value.length - MAX_TEAMS))

const lastLogin = computed(() => formatLastLogin(props.member.lastLoginAt))
const lastLoginTitle = computed(() =>
  props.member.lastLoginAt ? new Date(props.member.lastLoginAt).toLocaleString('zh-TW') : ''
)

const statusClass = computed(() => {
  if (props.member.status === 'active') {return 'ui-pill-green ui-pill-dot'}
  if (props.member.status === 'pending') {return 'ui-pill-orange'}
  return ''
})

const getStatusText = (status: string) => {
  const statusMap = {
    active: '啟用',
    inactive: '停用',
    pending: '待處理'
  }
  return statusMap[status as keyof typeof statusMap] || status
}

const getRoleText = (role: string) => {
  const roleMap = {
    admin: '管理員',
    agent: '客服'
  }
  return roleMap[role as keyof typeof roleMap] || role
}
</script>

<style scoped>
.member-row {
  position: relative;
  display: grid;
  grid-template-columns: var(--member-cols);
  column-gap: 16px;
  align-items: center;
  min-height: 64px;
  padding: 0 22px;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}
.member-row + .member-row::before {
  content: '';
  position: absolute;
  top: 0;
  right: 22px;
  left: 22px;
  height: 0.5px;
  background: var(--ui-sep);
}
.member-row:hover {
  background: color-mix(in srgb, var(--ui-fill) 40%, transparent);
}
.member-row.is-selected {
  background: var(--ui-sel-tint);
  box-shadow: var(--ui-sel-ring);
}
/* a disabled member stays readable (AA text); the 停用 state pill and a desaturated avatar carry the status */
.member-row.is-off :deep(.team-avatar) {
  filter: saturate(0.35);
}
.member-row.is-off .teams,
.member-row.is-off .sysrole {
  filter: saturate(0.4);
}

.drag-handle {
  position: absolute;
  top: 50%;
  left: 4px;
  display: grid;
  width: 16px;
  height: 28px;
  place-items: center;
  color: var(--ui-faint);
  cursor: grab;
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity var(--ui-dur) var(--ui-ease);
}
.drag-handle svg {
  width: 14px;
  height: 14px;
}
.member-row:hover .drag-handle {
  opacity: 1;
}

.cb-cell {
  display: block;
}
.cb {
  display: grid;
  width: 20px;
  height: 20px;
  margin: 0;
  place-items: center;
  border-radius: 50%;
  background: var(--ui-fill-strong);
  cursor: pointer;
  appearance: none;
  transition: background var(--ui-dur) var(--ui-ease);
}
.cb:checked {
  background: var(--ui-accent);
}
.cb:checked::after {
  content: '';
  width: 9px;
  height: 5px;
  border-bottom: 2px solid #fff;
  border-left: 2px solid #fff;
  transform: translateY(-1px) rotate(-45deg);
}
.cb:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.who {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}
.who-text {
  min-width: 0;
}
.who b {
  display: block;
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ui-ink);
}
.who .mail {
  display: block;
  overflow: hidden;
  font-size: 13px;
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.you {
  margin-left: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}
.teams {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.tr-in {
  font-weight: 500;
  opacity: 0.8;
}
.tr {
  font-size: 13px;
  color: var(--ui-muted);
}
.stcell,
.sysrole {
  display: flex;
  align-items: center;
}
.last {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}
.macts {
  display: flex;
  justify-content: flex-end;
}
.more-btn {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ui-ink-2);
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}
.more-btn:hover {
  background: var(--ui-fill);
}
.more-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.more-btn svg {
  width: 18px;
  height: 18px;
}

@media (max-width: 1280px) {
  .member-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 14px 22px;
    column-gap: 12px;
    row-gap: 10px;
  }
  .cb-cell {
    order: -1;
  }
  .who {
    flex: 1 1 calc(100% - 60px);
  }
  .macts {
    order: 1;
    margin-left: auto;
  }
  .sysrole,
  .teams,
  .stcell,
  .last {
    order: 2;
  }
  .last {
    margin-left: auto;
  }
}
@media (max-width: 768px) {
  .member-row {
    padding: 14px 16px;
  }
  .member-row + .member-row::before {
    left: 16px;
  }
  .drag-handle {
    display: none;
  }
  /* Phone rows keep to two chips: the plain "active" state is the default, only a deactivated
     account needs a pill of its own. */
  .stcell.is-active,
  .sysrole.is-default {
    display: none;
  }
}
</style>
