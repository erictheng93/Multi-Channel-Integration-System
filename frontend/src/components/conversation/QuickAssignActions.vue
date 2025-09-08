<template>
  <div 
    v-if="showActions"
    class="quick-assign-actions"
    :class="{ 'compact': compactMode }"
  >
    <!-- 快速指派給我 -->
    <button
      v-if="canAssignToMe"
      class="quick-action-btn assign-me-btn"
      :disabled="isAssigning"
      @click="handleAssignToMe"
      @click.stop
    >
      <UserPlusIcon class="action-icon" />
      <span class="action-text">{{ isAssigning ? '指派中...' : '指派給我' }}</span>
    </button>

    <!-- 指派給其他人 -->
    <div 
      v-if="canAssignToOthers"
      class="assign-others-wrapper"
    >
      <button
        class="quick-action-btn assign-others-btn"
        :disabled="isAssigning || loadingTeamMembers"
        @click="toggleAssignMenu"
        @click.stop
      >
        <TeamIcon class="action-icon" />
        <span class="action-text">指派他人</span>
        <ChevronDownIcon 
          :class="`dropdown-icon ${showAssignMenu ? 'rotated' : ''}`"
        />
      </button>

      <!-- 指派選單 -->
      <div 
        v-if="showAssignMenu"
        class="assign-menu"
        @click.stop
      >
        <div class="assign-menu-header">
          <span>選擇指派對象</span>
          <button 
            class="close-menu-btn"
            @click="closeAssignMenu"
          >
            <XIcon />
          </button>
        </div>
        
        <div 
          v-if="loadingTeamMembers"
          class="menu-loading"
        >
          <LoadingSpinner size="sm" />
          <span>載入團隊成員中...</span>
        </div>

        <div 
          v-else-if="teamMembers.length === 0"
          class="menu-empty"
        >
          <span>暫無可指派的成員</span>
        </div>

        <div 
          v-else
          class="team-members-list"
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
            <div class="member-info">
              <div class="member-name">
                {{ member.name || member.loginId }}
              </div>
              <div class="member-role">
                {{ getRoleDisplayName(member.role) }}
              </div>
            </div>
            <div 
              v-if="member.id === conversation.assignedAgentId"
              class="current-assignee"
            >
              <CheckIcon />
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- 已指派狀態顯示 -->
    <div 
      v-if="conversation.status === 'assigned' && conversation.assignedAgent"
      class="assigned-status"
    >
      <UserCheckIcon class="status-icon" />
      <span class="status-text">{{ conversation.assignedAgent.name }}</span>
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
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import {
  UserPlusIcon,
  TeamIcon,
  ChevronDownIcon,
  XIcon,
  CheckIcon,
  UserCheckIcon
} from '@/components/icons'

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
  // 只有 open 狀態的對話才顯示指派操作
  return props.conversation.status === 'open' || props.conversation.status === 'assigned'
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
.quick-assign-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--gray-200);
}

.quick-assign-actions.compact {
  gap: var(--space-1);
  margin-top: var(--space-2);
  padding-top: var(--space-2);
}

.quick-action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  background: white;
  color: var(--gray-700);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.quick-action-btn:hover:not(:disabled) {
  border-color: var(--primary-400);
  background: var(--primary-50);
  color: var(--primary-700);
}

.quick-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.assign-me-btn:hover:not(:disabled) {
  border-color: var(--green-400);
  background: var(--green-50);
  color: var(--green-700);
}

.action-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.action-text {
  font-size: 0.75rem;
}

.assign-others-wrapper {
  position: relative;
}

.dropdown-icon {
  width: 12px;
  height: 12px;
  margin-left: var(--space-1);
  transition: transform var(--transition-fast);
}

.dropdown-icon.rotated {
  transform: rotate(180deg);
}

.assign-menu {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  min-width: 240px;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 50;
  overflow: hidden;
}

.assign-menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-200);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-800);
}

.close-menu-btn {
  padding: var(--space-1);
  border: none;
  background: none;
  color: var(--gray-500);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.close-menu-btn:hover {
  background: var(--gray-200);
  color: var(--gray-700);
}

.menu-loading,
.menu-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-4);
  color: var(--gray-600);
  font-size: 0.875rem;
}

.team-members-list {
  max-height: 200px;
  overflow-y: auto;
}

.team-member-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: none;
  background: white;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.team-member-item:hover:not(:disabled) {
  background: var(--gray-50);
}

.team-member-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-900);
  margin-bottom: 2px;
}

.member-role {
  font-size: 0.75rem;
  color: var(--gray-600);
}

.current-assignee {
  color: var(--green-600);
  flex-shrink: 0;
}

.assigned-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--green-50);
  border: 1px solid var(--green-200);
  border-radius: var(--radius-md);
  color: var(--green-700);
  font-size: 0.75rem;
  font-weight: 500;
}

.status-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.status-text {
  font-size: 0.75rem;
}

/* 移動端優化 */
@media (max-width: 768px) {
  .quick-assign-actions {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .quick-action-btn {
    justify-content: center;
    padding: var(--space-3);
  }

  .assign-menu {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90vw;
    max-width: 320px;
  }
}

/* 動畫效果 */
.assign-menu {
  animation: menu-appear 0.2s ease-out;
}

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

.team-member-item {
  position: relative;
  overflow: hidden;
}

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