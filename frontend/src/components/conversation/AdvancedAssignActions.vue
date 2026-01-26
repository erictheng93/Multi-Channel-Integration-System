<template>
  <div class="advanced-assign-actions">
    <!-- 當前指派狀態 -->
    <div
      v-if="conversation.assignedTeamId && conversation.status !== 'closed'"
      class="current-assignment"
    >
      <div class="assignment-info">
        <div class="assignee-avatar">
          <TeamIcon />
        </div>
        <div class="assignee-details">
          <div class="assignee-name">
            {{ getAssignedDisplayName() }}
          </div>
          <div class="assignee-role">
            團隊
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
          :disabled="isAssigning"
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

      <!-- 遮罩層 - 使用 Teleport 移到 body 层级避免 transform 影响 -->
      <Teleport to="body">
        <div
          v-if="showTeamSelector"
          class="modal-backdrop"
          @click.self="closeTeamSelector"
        />
      </Teleport>

      <!-- 團隊選擇面板 - 使用 Teleport 移到 body 层级避免 transform 影响 -->
      <Teleport to="body">
        <div
          v-if="showTeamSelector"
          class="team-selector-panel"
          @click.stop
        >
          <div class="panel-header">
            <h4>選擇指派團隊</h4>
            <div class="panel-header-actions">
              <!-- 🆕 手动刷新按钮 -->
              <button
                class="refresh-btn"
                :disabled="isLoadingTeams"
                :title="isLoadingTeams ? '載入中...' : '重新載入團隊列表'"
                @click="handleManualRefresh"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :class="{ 'spinning': isLoadingTeams }"
                >
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
              </button>
              <button
                class="close-panel-btn"
                @click="closeTeamSelector"
              >
                <XIcon />
              </button>
            </div>
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
            <!-- 🆕 加载状态：显示骨架屏 -->
            <div
              v-if="isLoadingTeams"
              class="loading-state"
            >
              <TeamListSkeleton :count="3" />
              <p class="loading-text">
                載入團隊中...
              </p>
            </div>

            <!-- 空状态：确认无团队数据 -->
            <div
              v-else-if="teams.length === 0"
              class="no-teams"
            >
              <div class="no-teams-icon">
                <TeamIcon />
              </div>
              <p>沒有找到可用的團隊</p>
            </div>

            <!-- 团队列表 -->
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
                @click.stop="selectTeam(team.id)"
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
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables'
import { useConversationsStore } from '@/stores/conversations'
import { usePermissions } from '@/services/permissionService'
import type { Conversation, Agent } from '@/types'
import { preloadService } from '@/services/preloadService'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'
import {
  UserCheckIcon,
  TeamIcon,
  ChevronDownIcon,
  XCircleIcon,
  XIcon,
  SearchIcon
} from '@/components/icons'
import TeamListSkeleton from '@/components/ui/TeamListSkeleton.vue'
import { CONVERSATION_STATUS, isOpenConversation } from '@/constants/conversation-status'

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
const teamSearchTerm = ref('')
const selectedTeam = ref<number | null>(null)
const isLoadingTeams = ref(false) // 🆕 加载状态

// Confirm dialog
const { showWarning } = useConfirmDialog()

// Toast notifications
const { showSuccess, showError } = useToast()

// 🚀 优化：使用预加载的团队数据
// 🆕 響應式整合：preloadService.getTeams() 現在返回 shallowRef.value
//    當快取更新時，teamsRef 會變化，觸發此 computed 自動重新計算
const teams = computed(() => {
  const cachedTeams = preloadService.getTeams()
  return cachedTeams.map(team => ({
    id: team.id,
    name: team.name,
    memberCount: team.memberCount
  }))
})

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
  if (!currentAgent.value || currentAgent.value.role !== 'admin') {
    return false
  }

  const teamMemberAgent = agentToTeamMember(currentAgent.value)
  const result = canAssignConversation(teamMemberAgent, props.conversation) &&
         isOpenConversation(props.conversation.status)

  return result
})

const canUnassign = computed(() => {
  if (!currentAgent.value) {
    return false
  }

  const teamMemberAgent = agentToTeamMember(currentAgent.value)
  const result = canUnassignConversation(teamMemberAgent, props.conversation)

  return result
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
  // Note: Individual assignment (assignedAgent) removed - only team-based assignment is supported now
  if (props.conversation.assignedTeamId) {
    // 從 teams 列表中查找團隊名稱
    const team = teams.value.find(t => t.id === props.conversation.assignedTeamId)
    return team?.name || `團隊 #${props.conversation.assignedTeamId}`
  }
  return '未指派'
}

const toggleTeamSelector = async () => {
  if (showTeamSelector.value) {
    closeTeamSelector()
  } else {
    showTeamSelector.value = true

    // 🆕 如果团队数据为空，显示加载状态
    if (teams.value.length === 0) {
      isLoadingTeams.value = true
    }

    // 🚀 优化：确保团队数据已加载（如果已在缓存中，立即返回）
    await preloadService.ensureTeamsLoaded()

    // 🆕 加载完成，关闭加载状态
    isLoadingTeams.value = false
  }
}

const closeTeamSelector = () => {
  showTeamSelector.value = false
  selectedTeam.value = null
  teamSearchTerm.value = ''
  isLoadingTeams.value = false // 🆕 重置加载状态
}

const selectTeam = (teamId: number) => {
  // 允許選擇任何團隊，包括當前已指派的團隊（用於重新確認指派）
  selectedTeam.value = selectedTeam.value === teamId ? null : teamId
}

const cancelSelection = () => {
  selectedTeam.value = null
}

// 🆕 手动刷新团队列表
const handleManualRefresh = async () => {
  if (isLoadingTeams.value) {return}

  console.log('🔄 [AdvancedAssignActions] Manual refresh triggered by user')
  isLoadingTeams.value = true

  try {
    // 强制刷新团队数据
    await preloadService.refreshTeams()
    showSuccess('刷新成功', '團隊列表已更新')
  } catch (error) {
    console.error('❌ [AdvancedAssignActions] Manual refresh failed:', error)
    showError('刷新失敗', '無法重新載入團隊列表，請稍後重試')
  } finally {
    isLoadingTeams.value = false
  }
}

// 🚀 优化：添加乐观更新支持
const confirmAssignment = async () => {
  if (!selectedTeam.value || isAssigning.value) {
    console.warn('[AdvancedAssignActions] Invalid selection or already assigning')
    return
  }

  // 驗證團隊存在
  const teamExists = teams.value.some(t => t.id === selectedTeam.value)
  if (!teamExists) {
    showError('指派失敗', '選中的團隊不存在，請重新選擇')
    emit('error', '選中的團隊不存在，請重新選擇')
    return
  }

  // ✅ 修复：保存 selectedTeam 到局部变量，避免被 closeTeamSelector() 清空
  const selectedTeamId = selectedTeam.value
  const selectedTeamData = teams.value.find(t => t.id === selectedTeamId)
  const teamName = selectedTeamData?.name || '團隊'
  console.log(`🎯 [AdvancedAssignActions] Starting assignment to team: ${teamName} (ID: ${selectedTeamId})`)

  // 🔄 轉指派確認：檢查是否從一個團隊轉指派到另一個團隊
  if (props.conversation.assignedTeamId && props.conversation.assignedTeamId !== selectedTeamId) {
    // 這是轉指派的情況
    const currentTeamId = props.conversation.assignedTeamId
    const currentTeamData = teams.value.find(t => t.id === currentTeamId)
    const currentTeamName = currentTeamData?.name || props.conversation.assignedTeam?.name || `團隊 #${currentTeamId}`

    console.log(`⚠️ [AdvancedAssignActions] Re-assignment detected: ${currentTeamName} → ${teamName}`)

    // 顯示轉指派確認對話框
    const confirmed = await showWarning(
      '確定要轉指派給其他團隊？',
      `此對話目前指派給「${currentTeamName}」，確定要轉指派給「${teamName}」嗎？`
    )

    if (!confirmed) {
      console.log('❌ [AdvancedAssignActions] Re-assignment cancelled by user')
      return
    }

    console.log('✅ [AdvancedAssignActions] Re-assignment confirmed by user')
  }

  // 🚀 步骤 1: 乐观更新 - 立即显示成功状态
  showSuccess('指派成功', `已成功將對話指派給「${teamName}」`)
  closeTeamSelector()  // 立即关闭面板，提升用户体验

  // 发送已指派事件（乐观）
  const optimisticConv = {
    ...props.conversation,
    assignedTeamId: selectedTeamId,
    assignedTeam: {
      id: selectedTeamId,
      name: teamName,
      description: null
    }
  }
  emit('assigned', optimisticConv, `team-${selectedTeamId}`)

  // 🔄 步骤 2: 后台同步到服务器
  isAssigning.value = true
  try {
    let success: boolean

    // 判斷是新指派還是轉指派
    const isTransfer = props.conversation.assignedTeamId && props.conversation.assignedTeamId !== selectedTeamId

    if (isTransfer) {
      // 🔄 轉指派：使用 transfer API（會觸發三方通知：舊團隊移除、新團隊添加、觀看者更新）
      const fromTeamId = props.conversation.assignedTeamId
      const fromTeamName = props.conversation.assignedTeam?.name || `團隊 #${fromTeamId}`
      console.log(`🔄 [AdvancedAssignActions] Using transfer API: ${fromTeamName} → ${teamName}`)

      success = await conversationsStore.transferConversationToTeam(
        props.conversation.id,
        fromTeamId,
        selectedTeamId,
        teamName,
        '管理員手動轉指派'
      )
    } else {
      // 🆕 新指派：使用 assign API
      console.log(`🆕 [AdvancedAssignActions] Using assign API: → ${teamName}`)

      success = await conversationsStore.assignConversationToTeam(
        props.conversation.id,
        selectedTeamId,  // ✅ 使用保存的局部变量
        teamName
      )
    }

    if (success) {
      console.log(`✅ [AdvancedAssignActions] ${isTransfer ? 'Transfer' : 'Assignment'} confirmed by server`)
      // 成功后不需要额外操作，UI已经更新
    } else {
      console.error(`❌ [AdvancedAssignActions] Server rejected ${isTransfer ? 'transfer' : 'assignment'}`)
      // 🔙 步骤 3: 失败时通知用户（不回滚UI，因为store会处理）
      showError(isTransfer ? '轉指派失敗' : '指派失敗', `服務器拒絕${isTransfer ? '轉指派' : '指派'}，請稍後重試`)
      emit('error', `${isTransfer ? '轉指派' : '指派'}給團隊 ${teamName} 失敗`)
    }
  } catch (error) {
    console.error('❌ [AdvancedAssignActions] Confirm assignment/transfer failed:', error)
    showError('操作失敗', '操作過程中發生錯誤，請稍後重試')
    emit('error', '操作過程中發生錯誤')
  } finally {
    isAssigning.value = false
  }
}

const handleUnassign = async () => {
  if (isAssigning.value) {
    return
  }

  // 確認對話是否已指派 (only team-based assignment is supported now)
  if (!props.conversation.assignedTeamId) {
    showError('無法取消指派', '此對話尚未指派')
    return
  }

  // 取得當前指派資訊用於提示
  const assignedName = props.conversation.assignedTeam?.name || '未知'
  const assignedType = '團隊'

  // 顯示確認對話框
  const confirmed = await showWarning(
    `確定要取消指派嗎？`,
    `此對話目前指派給${assignedType}「${assignedName}」，取消後將變為待處理狀態。`
  )

  if (!confirmed) {
    return
  }

  console.log(`🗑️ [AdvancedAssignActions] Starting unassign for conversation:`, props.conversation.id)

  // 🚀 步驟 1: 樂觀更新 - 立即顯示成功狀態
  showSuccess('取消指派成功', `已成功取消對話指派`)

  // 立即發送 unassigned 事件（樂觀）
  // Note: Individual assignment removed - only team-based assignment is supported now
  const optimisticConv: Conversation = {
    ...props.conversation,
    status: CONVERSATION_STATUS.PENDING,
    assignedTeamId: undefined,
    assignedTeam: undefined
  }
  emit('unassigned', optimisticConv)

  // 立即關閉面板，提升用戶體驗
  closeTeamSelector()

  // 🔄 步驟 2: 後台同步到服務器
  isAssigning.value = true
  try {
    // 調用 Store 的取消指派方法
    const success = await conversationsStore.unassignConversation(
      props.conversation.id,
      '管理員手動取消指派'
    )

    if (success) {
      console.log(`✅ [AdvancedAssignActions] Unassign confirmed by server`)
      // 成功後不需要額外操作，UI已經更新
    } else {
      console.error(`❌ [AdvancedAssignActions] Server rejected unassign`)
      // 🔙 步驟 3: 失敗時通知用戶（不回滾UI，因為store會處理）
      showError('取消指派失敗', '服務器拒絕取消指派，請稍後重試')
      emit('error', '取消指派失敗')
    }
  } catch (error) {
    console.error('❌ [AdvancedAssignActions] Unassign failed with exception:', error)
    showError('取消指派失敗', '取消指派過程中發生錯誤，請稍後重試')
    emit('error', '取消指派過程中發生錯誤')
  } finally {
    isAssigning.value = false
  }
}

// Note: Individual assignment UI removed - these functions kept for potential future use
const _getInitials = (name: string | undefined): string => {
  if (!name) {return 'U'}
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const _getRoleDisplayName = (role: string | undefined): string => {
  if (!role) {return ''}
  const roleNames = {
    'admin': '管理員',
    'team': '團隊主管',
    'agent': '客服專員'
  }
  return roleNames[role as keyof typeof roleNames] || role
}

// Suppress unused variable warnings
void _getInitials
void _getRoleDisplayName

// 🚀 优化：组件挂载时确保数据已预加载
onMounted(async () => {
  if (currentAgent.value?.role === 'admin') {
    // 确保团队数据已加载（如果已在缓存中，立即返回，用户感知延迟 < 50ms）
    await preloadService.ensureTeamsLoaded()
  }
})
</script>

<style scoped>
/* ... 样式保持不变 ... */
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
  /* ✅ 固定定位 + 居中 */
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;

  /* ✅ 尺寸约束 */
  width: min(480px, 90vw);  /* 最大480px，小屏幕时90%宽度 */
  max-height: 85vh;  /* 最大85%视口高度 */

  /* 原有样式 */
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-2xl);
  animation: panel-appear 0.3s ease-out;

  /* ✅ 弹性布局 */
  display: flex;
  flex-direction: column;
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

/* 🆕 Header actions group */
.panel-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* 🆕 Refresh button styles */
.refresh-btn {
  padding: var(--space-1);
  border: none;
  background: none;
  color: var(--gray-500);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--gray-200);
  color: var(--primary-600);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 🆕 Spinning animation for refresh icon */
.refresh-btn svg.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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
  /* ✅ 弹性增长，占据剩余空间 */
  flex: 1;
  overflow-y: auto;
  /* ✅ 平滑滚动 */
  scroll-behavior: smooth;
  /* ✅ 自定义滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: var(--gray-300) var(--gray-100);
}

.teams-section::-webkit-scrollbar {
  width: 8px;
}

.teams-section::-webkit-scrollbar-track {
  background: var(--gray-100);
  border-radius: 4px;
}

.teams-section::-webkit-scrollbar-thumb {
  background: var(--gray-300);
  border-radius: 4px;
}

.teams-section::-webkit-scrollbar-thumb:hover {
  background: var(--gray-400);
}

/* 🆕 加载状态样式 */
.loading-state {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.loading-text {
  text-align: center;
  color: var(--gray-500);
  font-size: 0.875rem;
  margin-top: var(--space-2);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

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
  /* ✅ 固定在底部，不滚动 */
  flex-shrink: 0;
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

/* ✅ 遮罩層樣式 */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  animation: backdrop-appear 0.3s ease-out;
  backdrop-filter: blur(2px);
}

@keyframes backdrop-appear {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
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

  /* ✅ 移动端面板优化 */
  .team-selector-panel {
    width: 95vw;
    max-height: 90vh;
  }

  .panel-header h4 {
    font-size: 0.875rem;
  }

  .teams-grid {
    gap: var(--space-3);
  }

  .team-card {
    padding: var(--space-3);
  }
}
</style>
