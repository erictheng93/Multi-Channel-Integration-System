<template>
  <div
    v-if="showActions"
    class="flex items-center mt-3 pt-3 border-t border-gray-200 md:flex-col md:items-stretch md:gap-2"
    :class="compactMode ? 'gap-1 mt-2 pt-2' : 'gap-2'"
  >
    <!-- 快速指派給我 -->
    <button
      v-if="canAssignToMe"
      class="quick-action-btn assign-me-btn"
      :disabled="isAssigning"
      @click="handleAssignToMe"
      @click.stop
    >
      <UserPlusIcon class="w-3.5 h-3.5 flex-shrink-0" />
      <span class="text-xs">{{ isAssigning ? '指派中...' : '指派給我' }}</span>
    </button>

    <!-- 指派給其他人 -->
    <div
      v-if="canAssignToOthers"
      class="relative"
    >
      <button
        class="quick-action-btn"
        :disabled="isAssigning || loadingTeamMembers"
        @click="toggleAssignMenu"
        @click.stop
      >
        <TeamIcon class="w-3.5 h-3.5 flex-shrink-0" />
        <span class="text-xs">指派他人</span>
        <ChevronDownIcon
          :class="`w-3 h-3 ml-1 transition-transform duration-200 ${showAssignMenu ? 'rotate-180' : ''}`"
        />
      </button>

      <!-- 指派選單 -->
      <div
        v-if="showAssignMenu"
        class="assign-menu"
        @click.stop
      >
        <div class="flex items-center justify-between py-3 px-4 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-800">
          <span>選擇指派對象</span>
          <button
            class="p-1 border-none bg-transparent text-gray-500 cursor-pointer rounded-sm transition-all hover:bg-gray-200 hover:text-gray-700"
            @click="closeAssignMenu"
          >
            <XIcon />
          </button>
        </div>

        <div
          v-if="loadingTeamMembers"
          class="flex items-center justify-center gap-2 p-4 text-gray-600 text-sm"
        >
          <HamsterLoader message="指派中..." />
          <span>載入團隊成員中...</span>
        </div>

        <div
          v-else-if="teamMembers.length === 0"
          class="flex items-center justify-center gap-2 p-4 text-gray-600 text-sm"
        >
          <span>暫無可指派的成員</span>
        </div>

        <div
          v-else
          class="max-h-[200px] overflow-y-auto"
        >
          <button
            v-for="member in teamMembers"
            :key="member.id"
            class="team-member-item"
            :disabled="isAssigning || member.id === conversation.assignedAgentId"
            @click="handleAssignToMember(member)"
          >
            <div class="member-avatar">
              {{ getInitials(member.name || member.loginId) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900 mb-0.5">
                {{ member.name || member.loginId }}
              </div>
              <div class="text-xs text-gray-600">
                {{ getRoleDisplayName(member.role) }}
              </div>
            </div>
            <div
              v-if="member.id === conversation.assignedAgentId"
              class="text-green-600 flex-shrink-0"
            >
              <CheckIcon />
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- 已指派狀態顯示 -->
    <div
      v-if="conversation.status === CONVERSATION_STATUS.IN_PROGRESS && conversation.assignedAgent"
      class="flex items-center gap-2 py-2 px-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-xs font-medium"
    >
      <UserCheckIcon class="w-3.5 h-3.5 flex-shrink-0" />
      <span class="text-xs">{{ conversation.assignedAgent.name }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuth } from '@/composables'
import { useConversationsStore } from '@/stores/conversations'
import { usePermissions } from '@/services/permissionService'
import type { Conversation, TeamMember, Agent } from '@/types'
import { teamApi } from '@/api/team'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import {
  UserPlusIcon,
  TeamIcon,
  ChevronDownIcon,
  XIcon,
  CheckIcon,
  UserCheckIcon
} from '@/components/icons'
import { CONVERSATION_STATUS, isOpenConversation } from '@/constants/conversation-status'

interface Props {
  conversation: Conversation
  compactMode?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  assigned: [conversation: Conversation, assignedTo: string]
  error: [message: string]
}>()

const { currentAgent } = useAuth()
const conversationsStore = useConversationsStore()
const { canAssignConversation, canViewTeamMembers } = usePermissions()

// State
const isAssigning = ref(false)
const showAssignMenu = ref(false)
const loadingTeamMembers = ref(false)
const teamMembers = ref<TeamMember[]>([])

// 類型適配函數
const agentToTeamMember = (agent: Agent): TeamMember | null => {
  if (!agent) {return null}
  return {
    id: agent.id,
    loginId: agent.email, // 使用email作為loginId
    name: agent.displayName || agent.name,
    email: agent.email,
    role: agent.role,
    status: agent.isActive ? 'active' : 'inactive',
    group: undefined,
    teamId: agent.teamId,
    avatar: undefined,
    createdAt: new Date(agent.createdAt),
    updatedAt: new Date(),
    lastLoginAt: agent.lastActive ? new Date(agent.lastActive) : undefined
  }
}

// Computed
const showActions = computed(() => {
  // 只有開放狀態的對話才顯示指派操作
  return isOpenConversation(props.conversation.status)
})

const canAssignToMe = computed(() => {
  if (!currentAgent.value) {return false}
  
  // 如果已經指派給我，就不顯示「指派給我」按鈕
  if (props.conversation.assignedAgentId === currentAgent.value.id) {
    return false
  }
  
  // 使用權限服務檢查是否可以指派給自己
  const teamMemberAgent = agentToTeamMember(currentAgent.value)
  return canAssignConversation(teamMemberAgent, props.conversation, currentAgent.value.id)
})

const canAssignToOthers = computed(() => {
  if (!currentAgent.value) {return false}
  
  // 使用權限服務檢查是否可以指派給他人，並檢查是否可以查看團隊成員
  const teamMemberAgent = agentToTeamMember(currentAgent.value)
  return canAssignConversation(teamMemberAgent, props.conversation) && 
         canViewTeamMembers(teamMemberAgent)
})

// Methods
const handleAssignToMe = async () => {
  if (!currentAgent.value || isAssigning.value) {return}

  isAssigning.value = true
  try {
    const success = await conversationsStore.assignConversation(
      props.conversation.id,
      currentAgent.value.id
    )
    
    if (success) {
      emit('assigned', props.conversation, currentAgent.value.id)
    } else {
      emit('error', '指派失敗，請重試')
    }
  } catch (error) {
    console.error('Quick assign to me failed:', error)
    emit('error', '指派過程中發生錯誤')
  } finally {
    isAssigning.value = false
  }
}

const handleAssignToMember = async (member: TeamMember) => {
  if (isAssigning.value || member.id === props.conversation.assignedAgentId) {
    return
  }

  isAssigning.value = true
  try {
    const success = await conversationsStore.assignConversation(
      props.conversation.id,
      member.id
    )
    
    if (success) {
      emit('assigned', props.conversation, member.id)
      closeAssignMenu()
    } else {
      emit('error', `指派給 ${member.name || member.loginId} 失敗`)
    }
  } catch (error) {
    console.error('Quick assign to member failed:', error)
    emit('error', '指派過程中發生錯誤')
  } finally {
    isAssigning.value = false
  }
}

const toggleAssignMenu = async () => {
  if (showAssignMenu.value) {
    closeAssignMenu()
  } else {
    await openAssignMenu()
  }
}

const openAssignMenu = async () => {
  showAssignMenu.value = true
  
  // 載入團隊成員（如果還沒載入）
  if (teamMembers.value.length === 0) {
    await loadTeamMembers()
  }
}

const closeAssignMenu = () => {
  showAssignMenu.value = false
}

const loadTeamMembers = async () => {
  if (!currentAgent.value?.teamId) {
    console.warn('No team ID found for current agent')
    return
  }

  loadingTeamMembers.value = true
  try {
    const response = await teamApi.getTeamMembers(currentAgent.value.teamId)
    if (response.success && response.data) {
      // 過濾掉當前用戶，並且只顯示可以被指派的成員
      teamMembers.value = response.data.filter(member => 
        member.id !== currentAgent.value?.id && 
        ['agent', 'team'].includes(member.role)
      )
    }
  } catch (error) {
    console.error('Failed to load team members:', error)
    emit('error', '載入團隊成員失敗')
  } finally {
    loadingTeamMembers.value = false
  }
}

const getInitials = (name: string | undefined): string => {
  if (!name) {return 'U'}
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const getRoleDisplayName = (role: string): string => {
  const roleNames = {
    'admin': '管理員',
    'team': '團隊主管',
    'agent': '客服專員'
  }
  return roleNames[role as keyof typeof roleNames] || role
}

// 點擊外部關閉選單
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (showAssignMenu.value && !target.closest('.assign-others-wrapper')) {
    closeAssignMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* Quick Action Button - Base styles with Tailwind @apply */
.quick-action-btn {
  @apply flex items-center gap-1 py-2 px-3 border border-gray-300 rounded-md;
  @apply bg-white text-gray-700 text-xs font-medium cursor-pointer whitespace-nowrap;
  @apply md:justify-center md:py-3;
  transition: all 0.15s ease;
}

.quick-action-btn:hover:not(:disabled) {
  @apply border-primary-400 bg-primary-50 text-primary-700;
}

.quick-action-btn:disabled {
  @apply opacity-60 cursor-not-allowed;
}

/* Assign Me Button - Specific hover state */
.assign-me-btn:hover:not(:disabled) {
  @apply border-green-400 bg-green-50 text-green-700;
}

/* Assign Menu - Dropdown positioning with animation */
.assign-menu {
  @apply absolute min-w-[240px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden;
  top: calc(100% + 0.25rem);
  left: 0;
  animation: menu-appear 0.2s ease-out;
}

/* Team Member Item - List item with gradient hover effect */
.team-member-item {
  @apply flex items-center gap-3 w-full py-3 px-4 border-none bg-white cursor-pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.15s ease;
}

.team-member-item:hover:not(:disabled) {
  @apply bg-gray-50;
}

.team-member-item:disabled {
  @apply opacity-60 cursor-not-allowed;
}

/* Member Avatar - Gradient background */
.member-avatar {
  @apply w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-semibold flex-shrink-0;
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
}

/* Responsive - Mobile optimization */
@media (max-width: 768px) {
  .assign-menu {
    @apply fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90vw;
    max-width: 320px;
  }
}

/* Animations */
@keyframes menu-appear {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Gradient hover effect for team member items */
.team-member-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.1), transparent);
  transition: left 0.3s ease;
}

.team-member-item:hover::before {
  left: 100%;
}
</style>