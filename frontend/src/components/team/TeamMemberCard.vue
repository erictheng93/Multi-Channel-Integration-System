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
        >你</span><span
          v-if="phoneRole"
          class="m-role"
          :class="phoneRole.cls"
        >{{ phoneRole.text }}</span></b>
        <span class="mail">{{ member.email || '無電子郵件' }}</span>
        <span
          class="m-last"
          :title="lastLoginTitle"
        ><template v-if="phoneTeams">{{ phoneTeams }}・</template><template v-if="member.status !== 'active'">{{ getStatusText(member.status) }}・</template>{{ lastLogin }}</span>
      </div>
    </div>

    <div class="roles">
      <div class="rank">
        <span
          v-if="member.role === 'admin'"
          class="ui-pill ui-pill-blue"
        >{{ getRoleText(member.role) }}</span>
        <span
          v-else
          class="ui-pill"
        >{{ getRoleText(member.role) }}</span>
      </div>
      <div class="memberships">
        <template v-if="visibleTeams.length > 0">
          <span
            v-for="t in visibleTeams"
            :key="t.teamId"
            class="tg"
          ><i
            class="tg-dot"
            :style="{ background: teamToneColor(t.teamId) }"
            aria-hidden="true"
          /><span class="tg-name">{{ t.teamName || `團隊 ${t.teamId}` }}</span><span
            class="rl"
            :class="`rl-${t.roleInTeam}`"
          >{{ teamRoleText(t.roleInTeam) }}</span></span>
          <span
            v-if="hiddenTeamCount > 0"
            class="tr"
          >+{{ hiddenTeamCount }}</span>
        </template>
        <span
          v-else-if="member.primaryTeamName"
          class="tg"
        ><i
          class="tg-dot"
          :style="{ background: teamToneColor(member.primaryTeamId ?? 0) }"
          aria-hidden="true"
        /><span class="tg-name">{{ member.primaryTeamName }}</span></span>
        <span
          v-else
          class="tr"
        >未加入團隊</span>
      </div>
    </div>

    <div
      class="last"
      :title="lastLoginTitle"
    >
      <span
        v-if="member.status !== 'active'"
        class="ui-pill"
        :class="statusClass"
      >{{ getStatusText(member.status) }}</span>
      <span
        v-if="presence === 'online' && member.status === 'active'"
        class="on-now"
      ><i aria-hidden="true" />在線</span>
      <span v-else>{{ lastLogin }}</span>
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
import { formatLastLogin, teamRoleText, teamToneColor } from '@/utils/team-tone'
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
/** Phone rows carry the teams in the meta line (the chips column is gone there) */
const phoneTeams = computed(() => {
  const names = (props.member.teams ?? []).map(t => t.teamName).filter(Boolean)
  return names.length > 0 ? names.join('、') : (props.member.primaryTeamName ?? '')
})

const visibleTeams = computed(() => sortedTeams.value.slice(0, MAX_TEAMS))
const hiddenTeamCount = computed(() => Math.max(0, sortedTeams.value.length - MAX_TEAMS))

/** Phone shows one role pill beside the name: system admin first, then the highest team role (plain members get none) */
const phoneRole = computed<{ text: string, cls: string } | null>(() => {
  if (props.member.role === 'admin') { return { text: getRoleText(props.member.role), cls: 'rl-admin' } }
  const roles = sortedTeams.value.map(t => t.roleInTeam)
  const top = roles.includes('supervisor') ? 'supervisor' : roles.includes('lead') ? 'lead' : null
  if (top) { return { text: teamRoleText(top), cls: `rl-${top}` } }
  // a plain member still gets a chip, so every row answers "what is this person's rank"
  return sortedTeams.value.length > 0 ? { text: teamRoleText('member'), cls: 'rl-member' } : null
})

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
.member-row.is-off .roles {
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
  color: var(--ui-ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.you {
  margin-left: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}
/* desktop: the two cells sit in the grid themselves; below 1280 they travel together on one line */
.roles {
  display: contents;
}
.rank {
  min-width: 0;
}
.rank-agent {
  font-size: 13.5px;
  color: var(--ui-ink-2);
}
/* team is plain text with its colour dot; the role beside it is the filled chip, so rank reads before team */
.memberships {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  min-width: 0;
  padding: 10px 0;
}
.tg {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.tg-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.tg-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-ink);
}
/* role ramp: admin blue, supervisor indigo, lead green, member plain text (colour follows rank, not decoration) */
.rl {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}
.rl-member {
  font-weight: 500;
}
.rl-lead,
.rl-supervisor,
.rl-admin,
.m-role {
  padding: 2px 9px;
  border-radius: 999px;
  line-height: 1.4;
}
.rl-lead {
  background: var(--ui-green-soft);
  color: color-mix(in srgb, var(--ui-green-ink) 72%, var(--ui-pill-shade));
}
.rl-supervisor {
  background: var(--ui-indigo-soft);
  color: color-mix(in srgb, var(--ui-indigo-ink) 72%, var(--ui-pill-shade));
}
.rl-admin {
  background: var(--ui-accent-soft);
  color: color-mix(in srgb, var(--ui-accent) 72%, var(--ui-pill-shade));
}
.rl-member {
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--ui-fill);
  line-height: 1.4;
  color: var(--ui-ink-2);
}
.m-last {
  display: none;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}
.m-role {
  display: none;
  margin-left: 8px;
  font-size: 13px;
  font-weight: 600;
  vertical-align: 1px;
}
.tr {
  font-size: 13px;
  color: var(--ui-muted);
}
.last {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: var(--ui-ink-2);
  font-variant-numeric: tabular-nums;
}
.macts {
  display: flex;
  justify-content: flex-end;
}
.on-now {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  font-weight: 600;
  color: var(--ui-green-ink);
}
.on-now i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ui-green);
}
/* the menu is quiet until the row is hovered or focused: no column of lone grey discs */
.more-btn {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ui-ink-2);
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}
.more-btn:hover,
.member-row:hover .more-btn {
  background: var(--ui-fill);
}
.more-btn:hover {
  background: var(--ui-fill-strong);
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
  .roles,
  .last {
    order: 2;
  }
  .roles {
    display: flex;
    flex: 1 1 0;
    flex-wrap: wrap;
    gap: 6px 16px;
    align-items: center;
    min-width: 55%;
  }
  .memberships {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px 14px;
    padding: 0;
  }
  .last {
    flex: none;
    margin-left: auto;
  }
}
@media (max-width: 768px) {
  /* Phone: two lines per member (name + rank pill, email), last login inline on the right */
  .member-row {
    flex-wrap: nowrap;
    padding: 12px 16px;
    column-gap: 10px;
  }
  .member-row + .member-row::before {
    left: 16px;
  }
  .drag-handle,
  .roles,
  .last {
    display: none;
  }
  .m-role {
    display: inline-block;
  }
  /* the full address stays readable: login time moves under it instead of squeezing it */
  .who .mail {
    overflow: visible;
    overflow-wrap: anywhere;
    white-space: normal;
  }
  .m-last {
    display: block;
  }
  .who {
    flex: 1 1 0;
  }
  .last {
    order: 1;
    margin-left: 0;
    font-size: 13px;
    white-space: nowrap;
  }
  .macts {
    order: 2;
    margin-left: 0;
  }
  .more-btn {
    width: 44px;
    height: 44px;
    margin-right: -6px;
    background: transparent;
  }
}
</style>
