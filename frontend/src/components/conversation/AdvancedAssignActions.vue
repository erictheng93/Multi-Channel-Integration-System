<template>
  <div class="advanced-assign-actions">
    <!-- 當前指派狀態 -->
    <div
      v-if="conversation.status === 'assigned' && (conversation.assignedTeamId || conversation.assignedAgent)"
      class="current-assignment"
    >
      <div class="assignment-info">
        <div class="assignee-avatar">
          <TeamIcon v-if="conversation.assignedTeamId" />
          <span v-else>{{ getInitials(conversation.assignedAgent?.name) }}</span>
        </div>
        <div class="assignee-details">
          <div class="assignee-name">
            {{ getAssignedDisplayName() }}
          </div>
          <div class="assignee-role">
            {{ conversation.assignedTeamId ? '團隊' : getRoleDisplayName(conversation.assignedAgent?.role) }}
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
          v-if="canAssignToTeam"
          class="assign-btn primary"
          :disabled="isAssigning || loadingTeams"
          @click="toggleTeamSelector"
        >
          <TeamIcon class="btn-icon" />
          {{ isAssigning ? '指派中...' : (conversation.status === 'assigned' ? '重新指派團隊' : '指派給團隊') }}
          <ChevronDownIcon
            :class="`dropdown-icon ${showTeamSelector ? 'rotated' : ''}`"
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

      <!-- 團隊選擇面板 -->
      <div
        v-if="showTeamSelector"
        class="team-selector-panel"
      >
        <div class="panel-header">
          <h4>選擇指派團隊</h4>
          <button
            class="close-panel-btn"
            @click="closeTeamSelector"
          >
            <XIcon />
          </button>
        </div>

        <!-- 搜索框 -->
        <div class="search-section">
          <div class="search-input-wrapper">
            <SearchIcon class="search-icon" />
            <input
              v-model="teamSearchTerm"
              type="text"
              placeholder="搜索團隊..."
              class="search-input"
            >
          </div>
        </div>

        <!-- 團隊列表 -->
        <div class="teams-section">
          <div
            v-if="loadingTeams"
            class="loading-teams"
          >
            <HamsterLoader message="載入團隊中..." />
            <span>載入團隊中...</span>
          </div>

          <div
            v-else-if="filteredTeams.length === 0"
            class="no-teams"
          >
            <div class="no-teams-icon">
              <TeamIcon />
            </div>
            <p>沒有找到可用的團隊</p>
          </div>

          <div
            v-else
            class="teams-grid"
          >
            <div
              v-for="team in filteredTeams"
              :key="team.id"
              class="team-card"
              :class="{
                'selected': selectedTeam === team.id,
                'current': conversation.assignedTeamId === team.id
              }"
              @click="selectTeam(team.id)"
            >
              <div class="team-icon">
                <TeamIcon />
              </div>
              <div class="team-info">
                <div class="team-name">
                  {{ team.name }}
                </div>
                <div class="team-details">
                  <span class="team-member-count">
                    {{ team.memberCount || 0 }} 位成員
                  </span>
                  <span
                    v-if="conversation.assignedTeamId === team.id"
                    class="current-tag"
                  >
                    目前指派
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 確認操作 -->
        <div
          v-if="selectedTeam"
          class="confirm-section"
        >
          <div class="confirm-info">
            <span>{{ selectedTeam === conversation.assignedTeamId ? '重新確認指派給團隊：' : '將對話指派給團隊：' }}</span>
            <strong>{{ selectedTeamName || '未知團隊' }}</strong>
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
              :disabled="isAssigning || !selectedTeam"
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
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables'
import { useConversationsStore } from '@/stores/conversations'
import { usePermissions } from '@/services/permissionService'
import type { Conversation, Agent } from '@/types'
import { teamApi } from '@/api/team'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import {
  UserCheckIcon,
  TeamIcon,
  ChevronDownIcon,
  XCircleIcon,
  XIcon,
  SearchIcon
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
  canUnassignConversation
} = usePermissions()

// State
const isAssigning = ref(false)
const showTeamSelector = ref(false)
const loadingTeams = ref(false)
const teamSearchTerm = ref('')
const teams = ref<Array<{ id: number; name: string; memberCount?: number }>>([])
const selectedTeam = ref<number | null>(null)

// Confirm dialog
const { showWarning } = useConfirmDialog()

// 類型適配函數
const agentToTeamMember = (agent: Agent) => {
  if (!agent) {return null}
  return {
    id: agent.id,
    loginId: agent.email,
    name: agent.displayName || agent.name,
    email: agent.email,
    role: agent.role,
    status: (agent.isActive ? 'active' : 'inactive') as 'active' | 'inactive' | 'pending',
    group: undefined,
    teamId: agent.teamId,
    avatar: undefined,
    createdAt: new Date(agent.createdAt),
    updatedAt: new Date(),
    lastLoginAt: agent.lastActive ? new Date(agent.lastActive) : undefined
  }
}

// Computed
const canAssignToTeam = computed(() => {
  if (!currentAgent.value || currentAgent.value.role !== 'admin') {return false}

  const teamMemberAgent = agentToTeamMember(currentAgent.value)
  return canAssignConversation(teamMemberAgent, props.conversation) &&
         ['open', 'assigned'].includes(props.conversation.status)
})

const canUnassign = computed(() => {
  if (!currentAgent.value) {return false}

  const teamMemberAgent = agentToTeamMember(currentAgent.value)
  return canUnassignConversation(teamMemberAgent, props.conversation)
})

const filteredTeams = computed(() => {
  let teamList = teams.value

  // 搜索篩選
  if (teamSearchTerm.value.trim()) {
    const term = teamSearchTerm.value.toLowerCase()
    teamList = teamList.filter(team =>
      team.name.toLowerCase().includes(term)
    )
  }

  return teamList
})

const selectedTeamName = computed(() => {
  if (!selectedTeam.value) {return ''}
  const team = teams.value.find(t => t.id === selectedTeam.value)
  return team?.name || '未知團隊'
})

// Methods
const getAssignedDisplayName = () => {
  if (props.conversation.assignedTeamId) {
    // 從 teams 列表中查找團隊名稱
    const team = teams.value.find(t => t.id === props.conversation.assignedTeamId)
    return team?.name || `團隊 #${props.conversation.assignedTeamId}`
  }
  return props.conversation.assignedAgent?.name || '未知'
}

const toggleTeamSelector = async () => {
  if (showTeamSelector.value) {
    closeTeamSelector()
  } else {
    showTeamSelector.value = true
    await loadTeams()
  }
}

const closeTeamSelector = () => {
  showTeamSelector.value = false
  selectedTeam.value = null
  teamSearchTerm.value = ''
}

const loadTeams = async () => {
  if (teams.value.length > 0) {return} // 已載入

  loadingTeams.value = true
  try {
    const response = await teamApi.getTeams(true) // 只獲取活躍團隊

    if (response.success && response.data) {
      teams.value = response.data.map(team => ({
        id: team.id,
        name: team.name,
        memberCount: team.memberCount
      }))
    } else {
      emit('error', response.error || '載入團隊列表失敗')
    }
  } catch (error) {
    console.error('Load teams failed:', error)
    emit('error', '無法載入團隊列表')
  } finally {
    loadingTeams.value = false
  }
}

const selectTeam = (teamId: number) => {
  // 允許選擇任何團隊，包括當前已指派的團隊（用於重新確認指派）
  selectedTeam.value = selectedTeam.value === teamId ? null : teamId
}

const cancelSelection = () => {
  selectedTeam.value = null
}

const confirmAssignment = async () => {
  if (!selectedTeam.value || isAssigning.value) {
    console.warn('[AdvancedAssignActions] Invalid selection or already assigning')
    return
  }

  // 驗證團隊存在
  const teamExists = teams.value.some(t => t.id === selectedTeam.value)
  if (!teamExists) {
    emit('error', '選中的團隊不存在，請重新選擇')
    return
  }

  isAssigning.value = true
  try {
    const success = await conversationsStore.assignConversationToTeam(
      props.conversation.id,
      selectedTeam.value
    )

    if (success) {
      emit('assigned', props.conversation, `team-${selectedTeam.value}`)
      closeTeamSelector()
    } else {
      const teamName = selectedTeamName.value || '未知團隊'
      emit('error', `指派給團隊 ${teamName} 失敗`)
    }
  } catch (error) {
    console.error('Confirm assignment failed:', error)
    emit('error', '指派過程中發生錯誤')
  } finally {
    isAssigning.value = false
  }
}

const handleUnassign = async () => {
  if (isAssigning.value) {return}

  const confirmed = await showWarning('確定要取消對話指派嗎？')
  if (!confirmed) {
    return
  }

  isAssigning.value = true
  try {
    // TODO: 實作取消指派API
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

const getInitials = (name: string | undefined): string => {
  if (!name) {return 'U'}
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const getRoleDisplayName = (role: string | undefined): string => {
  if (!role) {return ''}
  const roleNames = {
    'admin': '管理員',
    'team': '團隊主管',
    'agent': '客服專員'
  }
  return roleNames[role as keyof typeof roleNames] || role
}

// 初始載入團隊列表（如果是管理員）
onMounted(() => {
  if (currentAgent.value?.role === 'admin') {
    loadTeams()
  }
})
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

.assignee-avatar svg {
  width: 20px;
  height: 20px;
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

.team-selector-panel {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  animation: panel-appear 0.3s ease-out;
}

@keyframes panel-appear {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-200);
}

.panel-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
}

.close-panel-btn {
  padding: var(--space-1);
  border: none;
  background: none;
  color: var(--gray-500);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.close-panel-btn:hover {
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

.teams-section {
  padding: var(--space-4);
  max-height: 400px;
  overflow-y: auto;
}

.loading-teams,
.no-teams {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-6);
  color: var(--gray-600);
  text-align: center;
}

.no-teams-icon {
  color: var(--gray-400);
  width: 48px;
  height: 48px;
}

.no-teams-icon svg {
  width: 48px;
  height: 48px;
}

.teams-grid {
  display: grid;
  gap: var(--space-2);
}

.team-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: white;
}

.team-card:hover {
  background: var(--gray-50);
  border-color: var(--gray-300);
  box-shadow: var(--shadow-sm);
}

.team-card.selected {
  background: var(--primary-50);
  border-color: var(--primary-400);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.team-card.current {
  background: var(--green-50);
  border-color: var(--green-200);
}

.team-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--blue-500), var(--blue-600));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.team-icon svg {
  width: 24px;
  height: 24px;
}

.team-info {
  flex: 1;
  min-width: 0;
}

.team-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: 4px;
}

.team-details {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.team-member-count {
  font-size: 0.875rem;
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

  .confirm-actions {
    flex-direction: column;
  }
}
</style>
