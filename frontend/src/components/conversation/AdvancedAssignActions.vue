<template>
  <div class="advanced-assign-actions">
    <!-- 當前指派狀態 -->
    <div 
      v-if="conversation.status === 'assigned' && conversation.assignedAgent"
      class="current-assignment"
    >
      <div class="assignment-info">
        <div class="assignee-avatar">
          {{ getInitials(conversation.assignedAgent.name) }}
        </div>
        <div class="assignee-details">
          <div class="assignee-name">
            {{ conversation.assignedAgent.name }}
          </div>
          <div class="assignee-role">
            {{ getRoleDisplayName(conversation.assignedAgent.role) }}
          </div>
        </div>
      </div>
      <div class="assignment-status">
        <UserCheckIcon class="status-icon" />
        <span>已指派</span>
      </div>
    </div>

    <!-- 指派操作區域 -->
    <div class="assign-controls">
      <!-- 主要操作按鈕 -->
      <div class="primary-actions">
        <button
          v-if="canAssignToMe"
          class="assign-btn primary"
          :disabled="isAssigning"
          @click="handleAssignToMe"
        >
          <UserPlusIcon class="btn-icon" />
          {{ isAssigning ? '指派中...' : '指派給我' }}
        </button>

        <button
          v-if="canReassign"
          class="assign-btn secondary"
          :disabled="isAssigning"
          @click="toggleAdvancedOptions"
        >
          <TeamIcon class="btn-icon" />
          重新指派
          <ChevronDownIcon 
            :class="`dropdown-icon ${showAdvancedOptions ? 'rotated' : ''}`"
          />
        </button>

        <button
          v-if="canUnassign"
          class="assign-btn danger"
          :disabled="isAssigning"
          @click="handleUnassign"
        >
          <XCircleIcon class="btn-icon" />
          取消指派
        </button>
      </div>

      <!-- 高級選項面板 -->
      <div 
        v-if="showAdvancedOptions"
        class="advanced-options"
      >
        <div class="options-header">
          <h4>選擇指派對象</h4>
          <button 
            class="close-options-btn"
            @click="closeAdvancedOptions"
          >
            <XIcon />
          </button>
        </div>

        <!-- 搜索框 -->
        <div class="search-section">
          <div class="search-input-wrapper">
            <SearchIcon class="search-icon" />
            <input
              v-model="searchTerm"
              type="text"
              placeholder="搜索成員..."
              class="search-input"
            >
          </div>
        </div>

        <!-- 角色篩選 -->
        <div class="filter-section">
          <div class="filter-tabs">
            <button
              v-for="filter in roleFilters"
              :key="filter.value"
              class="filter-tab"
              :class="{ 'active': activeRoleFilter === filter.value }"
              @click="activeRoleFilter = filter.value"
            >
              {{ filter.label }}
            </button>
          </div>
        </div>

        <!-- 成員列表 -->
        <div class="members-section">
          <div 
            v-if="loadingMembers"
            class="loading-members"
          >
            <LoadingSpinner size="sm" />
            <span>載入成員中...</span>
          </div>

          <div 
            v-else-if="filteredMembers.length === 0"
            class="no-members"
          >
            <div class="no-members-icon">
              <UsersIcon />
            </div>
            <p>沒有找到符合條件的成員</p>
          </div>

          <div 
            v-else
            class="members-grid"
          >
            <div
              v-for="member in filteredMembers"
              :key="member.id"
              class="member-card"
              :class="{ 
                'selected': selectedMember?.id === member.id,
                'current': member.id === conversation.assignedAgentId,
                'disabled': member.id === conversation.assignedAgentId && !canReassignSelf
              }"
              @click="selectMember(member)"
            >
              <div class="member-avatar">
                {{ getInitials(member.name || member.loginId) }}
              </div>
              <div class="member-info">
                <div class="member-name">
                  {{ member.name }}
                </div>
                <div class="member-details">
                  <span class="member-role">{{ getRoleDisplayName(member.role) }}</span>
                  <span 
                    v-if="member.id === conversation.assignedAgentId"
                    class="current-tag"
                  >
                    目前負責
                  </span>
                </div>
              </div>
              <div class="member-status">
                <div 
                  class="status-dot" 
                  :class="getStatusColor(member.status)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 確認操作 -->
        <div 
          v-if="selectedMember"
          class="confirm-section"
        >
          <div class="confirm-info">
            <span>將對話指派給：</span>
            <strong>{{ selectedMember.name || selectedMember.loginId }}</strong>
          </div>
          <div class="confirm-actions">
            <button
              class="confirm-btn cancel"
              @click="cancelSelection"
            >
              取消
            </button>
            <button
              class="confirm-btn confirm"
              :disabled="isAssigning"
              @click="confirmAssignment"
            >
              {{ isAssigning ? '處理中...' : '確認指派' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '@/composables'
import { useConversationsStore } from '@/stores/conversations'
import { usePermissions } from '@/services/permissionService'
import type { Conversation, TeamMember, Agent } from '@/types'
import { teamApi } from '@/api/team'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import {
  UserPlusIcon,
  UserCheckIcon,
  TeamIcon,
  ChevronDownIcon,
  XCircleIcon,
  XIcon,
  SearchIcon,
  UsersIcon
} from '@/components/icons'

interface Props {
  conversation: Conversation
}

const props = defineProps<Props>()

const emit = defineEmits<{
  assigned: [conversation: Conversation, assignedTo: string]
  unassigned: [conversation: Conversation]
  error: [message: string]
}>()

const { currentAgent } = useAuth()
const conversationsStore = useConversationsStore()
const { 
  canAssignConversation, 
  canUnassignConversation, 
  canViewTeamMembers 
} = usePermissions()

// State
const isAssigning = ref(false)
const showAdvancedOptions = ref(false)
const loadingMembers = ref(false)
const searchTerm = ref('')
const activeRoleFilter = ref<'all' | 'admin' | 'team' | 'agent'>('all')
const selectedMember = ref<TeamMember | null>(null)
const availableMembers = ref<TeamMember[]>([])

// 角色篩選選項
const roleFilters = [
  { value: 'all' as const, label: '全部成員' },
  { value: 'admin' as const, label: '管理員' },
  { value: 'team' as const, label: '團隊主管' },
  { value: 'agent' as const, label: '客服專員' }
]

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
    createdAt: agent.createdAt,
    updatedAt: new Date(),
    lastLoginAt: agent.lastActive
  }
}

// Computed
const canAssignToMe = computed(() => {
  if (!currentAgent.value) {return false}
  
  // 如果已經指派給我，就不顯示
  if (props.conversation.assignedAgentId === currentAgent.value.id) {
    return false
  }
  
  // 使用權限服務檢查是否可以指派給自己
  const teamMemberAgent = agentToTeamMember(currentAgent.value)
  return canAssignConversation(teamMemberAgent, props.conversation, currentAgent.value.id)
})

const canReassign = computed(() => {
  if (!currentAgent.value) {return false}
  
  // 使用權限服務檢查是否可以指派對話，並檢查是否可以查看團隊成員
  const teamMemberAgent = agentToTeamMember(currentAgent.value)
  return canAssignConversation(teamMemberAgent, props.conversation) && 
         canViewTeamMembers(teamMemberAgent) &&
         ['open', 'assigned'].includes(props.conversation.status)
})

const canUnassign = computed(() => {
  if (!currentAgent.value) {return false}
  
  // 使用權限服務檢查是否可以取消指派
  const teamMemberAgent = agentToTeamMember(currentAgent.value)
  return canUnassignConversation(teamMemberAgent, props.conversation)
})

const canReassignSelf = computed(() => {
  // 是否允許重新指派給當前已指派的人（通常不允許）
  return false
})

const filteredMembers = computed(() => {
  let members = availableMembers.value

  // 角色篩選
  if (activeRoleFilter.value !== 'all') {
    members = members.filter(member => member.role === activeRoleFilter.value)
  }

  // 搜索篩選
  if (searchTerm.value.trim()) {
    const term = searchTerm.value.toLowerCase()
    members = members.filter(member => 
      (member.name && member.name.toLowerCase().includes(term)) ||
      (member.email && member.email.toLowerCase().includes(term)) ||
      (member.loginId && member.loginId.toLowerCase().includes(term))
    )
  }

  return members
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
    console.error('Assign to me failed:', error)
    emit('error', '指派過程中發生錯誤')
  } finally {
    isAssigning.value = false
  }
}

const handleUnassign = async () => {
  if (isAssigning.value) {return}

  // 簡單確認
  if (!confirm('確定要取消對話指派嗎？')) {
    return
  }

  isAssigning.value = true
  try {
    // TODO: 實作取消指派API
    // 暫時使用指派給null或空值的方式
    console.log('Unassigning conversation:', props.conversation.id)
    emit('unassigned', props.conversation)
    emit('error', '取消指派功能開發中')
  } catch (error) {
    console.error('Unassign failed:', error)
    emit('error', '取消指派過程中發生錯誤')
  } finally {
    isAssigning.value = false
  }
}

const toggleAdvancedOptions = async () => {
  if (showAdvancedOptions.value) {
    closeAdvancedOptions()
  } else {
    showAdvancedOptions.value = true
    await loadAvailableMembers()
  }
}

const closeAdvancedOptions = () => {
  showAdvancedOptions.value = false
  selectedMember.value = null
  searchTerm.value = ''
  activeRoleFilter.value = 'all'
}

const loadAvailableMembers = async () => {
  if (availableMembers.value.length > 0) {return} // 已載入

  loadingMembers.value = true
  try {
    let response

    if (currentAgent.value?.role === 'admin') {
      // Admin 可以看到所有可指派的成員
      response = await teamApi.getAvailableAssignees()
    } else {
      // Team 和 Agent 只能看到同團隊的成員
      response = await teamApi.getTeamMembers(currentAgent.value?.teamId)
    }

    if (response.success && response.data) {
      availableMembers.value = response.data
    } else {
      emit('error', response.error || '載入成員列表失敗')
    }
  } catch (error) {
    console.error('Load available members failed:', error)
    emit('error', '無法載入成員列表')
  } finally {
    loadingMembers.value = false
  }
}

const selectMember = (member: TeamMember) => {
  if (member.id === props.conversation.assignedAgentId && !canReassignSelf.value) {
    return
  }
  
  selectedMember.value = selectedMember.value?.id === member.id ? null : member
}

const cancelSelection = () => {
  selectedMember.value = null
}

const confirmAssignment = async () => {
  if (!selectedMember.value || isAssigning.value) {return}

  isAssigning.value = true
  try {
    const success = await conversationsStore.assignConversation(
      props.conversation.id,
      selectedMember.value.id
    )
    
    if (success) {
      emit('assigned', props.conversation, selectedMember.value.id)
      closeAdvancedOptions()
    } else {
      emit('error', `指派給 ${selectedMember.value.name || selectedMember.value.loginId} 失敗`)
    }
  } catch (error) {
    console.error('Confirm assignment failed:', error)
    emit('error', '指派過程中發生錯誤')
  } finally {
    isAssigning.value = false
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

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'active': return 'status-active'
    case 'inactive': return 'status-inactive'
    case 'pending': return 'status-pending'
    default: return 'status-unknown'
  }
}
</script>

<style scoped>
.advanced-assign-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.current-assignment {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  background: var(--green-50);
  border: 1px solid var(--green-200);
  border-radius: var(--radius-lg);
}

.assignment-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.assignee-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--green-500), var(--green-600));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
}

.assignee-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.assignee-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
}

.assignee-role {
  font-size: 0.875rem;
  color: var(--green-700);
}

.assignment-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--green-700);
  font-size: 0.875rem;
  font-weight: 500;
}

.status-icon {
  width: 18px;
  height: 18px;
}

.assign-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.primary-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.assign-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: 1px solid;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.assign-btn.primary {
  background: var(--primary-600);
  border-color: var(--primary-600);
  color: white;
}

.assign-btn.primary:hover:not(:disabled) {
  background: var(--primary-700);
  border-color: var(--primary-700);
}

.assign-btn.secondary {
  background: white;
  border-color: var(--gray-300);
  color: var(--gray-700);
}

.assign-btn.secondary:hover:not(:disabled) {
  background: var(--gray-50);
  border-color: var(--gray-400);
}

.assign-btn.danger {
  background: white;
  border-color: var(--red-300);
  color: var(--red-600);
}

.assign-btn.danger:hover:not(:disabled) {
  background: var(--red-50);
  border-color: var(--red-400);
}

.assign-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

.dropdown-icon {
  width: 14px;
  height: 14px;
  margin-left: var(--space-1);
  transition: transform var(--transition-fast);
}

.dropdown-icon.rotated {
  transform: rotate(180deg);
}

.advanced-options {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.options-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-200);
}

.options-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
}

.close-options-btn {
  padding: var(--space-1);
  border: none;
  background: none;
  color: var(--gray-500);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.close-options-btn:hover {
  background: var(--gray-200);
  color: var(--gray-700);
}

.search-section {
  padding: var(--space-4);
  border-bottom: 1px solid var(--gray-100);
}

.search-input-wrapper {
  position: relative;
}

.search-icon {
  position: absolute;
  left: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--gray-400);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-10);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  transition: border-color var(--transition-fast);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.filter-section {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--gray-100);
}

.filter-tabs {
  display: flex;
  gap: var(--space-1);
}

.filter-tab {
  padding: var(--space-2) var(--space-3);
  border: none;
  background: none;
  color: var(--gray-600);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.filter-tab:hover {
  background: var(--gray-100);
  color: var(--gray-800);
}

.filter-tab.active {
  background: var(--primary-100);
  color: var(--primary-700);
}

.members-section {
  padding: var(--space-4);
  max-height: 400px;
  overflow-y: auto;
}

.loading-members,
.no-members {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-6);
  color: var(--gray-600);
  text-align: center;
}

.no-members-icon {
  color: var(--gray-400);
}

.members-grid {
  display: grid;
  gap: var(--space-2);
}

.member-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.member-card:hover:not(.disabled) {
  background: var(--gray-50);
  border-color: var(--gray-300);
}

.member-card.selected {
  background: var(--primary-50);
  border-color: var(--primary-300);
}

.member-card.current {
  background: var(--green-50);
  border-color: var(--green-200);
}

.member-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.75rem;
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

.member-details {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.member-role {
  font-size: 0.75rem;
  color: var(--gray-600);
}

.current-tag {
  padding: 2px var(--space-2);
  background: var(--green-100);
  color: var(--green-700);
  font-size: 0.625rem;
  font-weight: 500;
  border-radius: var(--radius-full);
}

.member-status {
  display: flex;
  align-items: center;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.status-active {
  background: var(--green-500);
}

.status-dot.status-inactive {
  background: var(--gray-400);
}

.status-dot.status-pending {
  background: var(--yellow-500);
}

.status-dot.status-unknown {
  background: var(--gray-300);
}

.confirm-section {
  padding: var(--space-4);
  background: var(--gray-50);
  border-top: 1px solid var(--gray-200);
}

.confirm-info {
  margin-bottom: var(--space-3);
  font-size: 0.875rem;
  color: var(--gray-700);
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.confirm-btn {
  padding: var(--space-2) var(--space-4);
  border: 1px solid;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.confirm-btn.cancel {
  background: white;
  border-color: var(--gray-300);
  color: var(--gray-700);
}

.confirm-btn.cancel:hover {
  background: var(--gray-50);
  border-color: var(--gray-400);
}

.confirm-btn.confirm {
  background: var(--primary-600);
  border-color: var(--primary-600);
  color: white;
}

.confirm-btn.confirm:hover:not(:disabled) {
  background: var(--primary-700);
  border-color: var(--primary-700);
}

.confirm-btn.confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 移動端適配 */
@media (max-width: 768px) {
  .primary-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .assign-btn {
    justify-content: center;
  }

  .members-grid {
    grid-template-columns: 1fr;
  }

  .confirm-actions {
    flex-direction: column;
  }
}

/* 動畫效果 */
.advanced-options {
  animation: options-appear 0.3s ease-out;
}

@keyframes options-appear {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.member-card {
  position: relative;
  overflow: hidden;
}

.member-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.1), transparent);
  transition: left 0.3s ease;
}

.member-card:hover::before {
  left: 100%;
}
</style>