<template>
  <div 
    class="member-card"
    :class="{ 'modal-open': showEditModal }"
    @click="openEditModal"
  >
    <div 
      class="member-info"
    >
      <div
        class="member-avatar"
        style="width: 48px; height: 48px;"
      >
        <img 
          v-if="member.avatar" 
          :src="member.avatar" 
          :alt="member.name"
          style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;"
          loading="lazy"
        >
        <div
          v-else
          class="avatar-placeholder"
        >
          {{ (member.name || member.loginId).charAt(0).toUpperCase() }}
        </div>
      </div>
      <div class="member-details">
        <h3>{{ member.name || member.loginId }}</h3>
        <p class="email">
          {{ member.email || '無電子郵件' }}
        </p>
        <div class="member-meta">
          <span
            class="role"
            :class="member.role"
          >
            <span class="role-icon">{{ getRoleIcon(member.role) }}</span>
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
            class="last-login"
          >
            最後登入: {{ formatDate(member.lastLoginAt) }}
          </span>
        </div>
      </div>
    </div>
    <div
      class="member-actions"
      @click.stop
    >
      <button
        class="btn btn-sm"
        :class="member.status === 'active' ? 'btn-warning' : 'btn-success'"
        :disabled="isCurrentUser || loading"
        @click="$emit('toggleStatus', member)"
      >
        {{ member.status === 'active' ? '停用' : '啟用' }}
      </button>
      <button 
        class="btn btn-sm btn-secondary"
        :disabled="loading"
        @click="$emit('resetPassword', member)"
      >
        重設密碼
      </button>
      <button 
        class="btn btn-sm btn-danger"
        :disabled="isCurrentUser || loading"
        @click="$emit('removeMember', member)"
      >
        移除
      </button>
    </div>

    <!-- Edit Member Modal -->
    <Teleport to="body">
      <div
        v-if="showEditModal"
        class="modal-overlay"
        tabindex="-1"
        @keydown.esc="closeEditModal"
        @click="closeEditModal"
      >
        <div
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          @click.stop
        >
          <div class="modal-header">
            <h2 id="modal-title">
              編輯成員資訊
            </h2>
            <button
              class="close-btn"
              aria-label="關閉對話框"
              type="button"
              @click="closeEditModal"
            >
              &times;
            </button>
          </div>
          <form
            class="modal-body"
            @submit.prevent="submitEdit"
          >
            <div class="form-group">
              <label for="editName">姓名</label>
              <input
                id="editName"
                v-model="editForm.name"
                type="text"
                placeholder="請輸入成員姓名"
              >
            </div>
            <div class="form-group">
              <label for="editEmail">電子郵件</label>
              <input
                id="editEmail"
                v-model="editForm.email"
                type="email"
                placeholder="請輸入電子郵件地址"
              >
            </div>
            <div class="form-group">
              <label for="editRole">角色</label>
              <select
                id="editRole"
                v-model="editForm.role"
                :disabled="isCurrentUser"
              >
                <option value="agent">
                  🎧 客服
                </option>
                <option value="admin">
                  👑 管理員
                </option>
              </select>
              <div
                v-if="editForm.role"
                class="role-permissions-info"
              >
                <div
                  v-if="editForm.role === 'admin'"
                  class="permission-warning"
                >
                  <strong>⚠️ 管理員權限包括：</strong>
                  <ul>
                    <li>管理所有團隊成員</li>
                    <li>修改系統設定</li>
                    <li>查看所有對話紀錄</li>
                    <li>刪除資料</li>
                  </ul>
                </div>
                <div
                  v-else-if="editForm.role === 'agent'"
                  class="permission-info"
                >
                  <strong>ℹ️ 客服權限包括：</strong>
                  <ul>
                    <li>查看對話</li>
                    <li>回覆訊息</li>
                    <li>標記客戶</li>
                  </ul>
                </div>
              </div>
            </div>
            <!-- Multi-Team Selector (支援多團隊) -->
            <div class="form-group">
              <label>所屬群組</label>
              <div class="multi-team-selector">
                <!-- 已加入的團隊列表 (Chips) -->
                <div class="team-chips-container">
                  <TransitionGroup name="chip">
                    <div
                      v-for="membership in memberTeams"
                      :key="membership.teamId"
                      class="team-chip"
                      :class="{ 'is-primary': membership.isPrimary }"
                    >
                      <span class="chip-icon">{{ membership.isPrimary ? '⭐' : '👥' }}</span>
                      <span class="chip-name">{{ membership.teamName || `團隊 #${membership.teamId}` }}</span>
                      <span
                        v-if="membership.roleInTeam !== 'member'"
                        class="chip-role"
                      >
                        {{ getRoleInTeamText(membership.roleInTeam) }}
                      </span>
                      <button
                        type="button"
                        class="chip-remove"
                        :disabled="teamOperationLoading"
                        :title="`從「${membership.teamName}」移除`"
                        @click="removeFromTeam(membership.teamId)"
                      >
                        ×
                      </button>
                      <button
                        v-if="!membership.isPrimary && memberTeams.length > 1"
                        type="button"
                        class="chip-star"
                        :disabled="teamOperationLoading"
                        title="設為主要團隊"
                        @click="setPrimaryTeam(membership.teamId)"
                      >
                        ☆
                      </button>
                    </div>
                  </TransitionGroup>

                  <!-- Empty State -->
                  <div
                    v-if="memberTeams.length === 0"
                    class="no-teams-message"
                  >
                    <span class="empty-icon">📭</span>
                    <span>尚未加入任何群組</span>
                  </div>
                </div>

                <!-- 添加團隊下拉選單 -->
                <div class="add-team-section">
                  <select
                    v-model="selectedTeamToAdd"
                    class="team-add-select"
                    :disabled="availableTeamsToJoin.length === 0 || teamOperationLoading"
                  >
                    <option
                      :value="null"
                      disabled
                    >
                      {{ availableTeamsToJoin.length === 0 ? '已加入所有可用群組' : '+ 選擇群組加入...' }}
                    </option>
                    <option
                      v-for="team in availableTeamsToJoin"
                      :key="team.id"
                      :value="team.id"
                    >
                      {{ team.name }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-add-team"
                    :disabled="!selectedTeamToAdd || teamOperationLoading"
                    @click="addToTeam"
                  >
                    <span
                      v-if="teamOperationLoading"
                      class="loading-spinner"
                    >⏳</span>
                    <span v-else>加入</span>
                  </button>
                </div>

                <!-- Team Operation Status -->
                <div
                  v-if="teamOperationStatus"
                  class="team-operation-status"
                  :class="teamOperationStatus.type"
                >
                  {{ teamOperationStatus.message }}
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  v-model="editForm.isActive"
                  type="checkbox"
                >
                帳戶啟用狀態
              </label>
            </div>
            <div class="modal-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click="closeEditModal"
              >
                取消
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="editLoading"
              >
                {{ editLoading ? '更新中...' : '更新' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, watch, nextTick, onUnmounted } from 'vue'
import type { TeamMember, AgentTeamMembership } from '@/types'
import { teamApi } from '@/api/team'
import { useTeamStore } from '@/stores/team'
import { useToast } from '@/composables/useToast'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

interface Props {
  member: TeamMember
  currentUserId?: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  currentUserId: '',
  loading: false
})

const emit = defineEmits<{
  toggleStatus: [member: TeamMember]
  resetPassword: [member: TeamMember]
  removeMember: [member: TeamMember]
}>()

// Ensure emit is recognized as used (TypeScript doesn't detect template usage)
if (typeof emit !== 'undefined') { /* noop */ }

// 組合式函數
const teamStore = useTeamStore()
const { showSuccess, showError } = useToast()
const { showWarning } = useConfirmDialog()

// Modal state
const showEditModal = ref(false)
const editLoading = ref(false)

// 團隊列表狀態
const teams = ref<Array<{
  id: number;
  name: string;
  isActive: boolean;
}>>([])

// Multi-team management state
const memberTeams = ref<AgentTeamMembership[]>([])
const selectedTeamToAdd = ref<number | null>(null)
const teamOperationLoading = ref(false)
const teamOperationStatus = ref<{ type: 'success' | 'error'; message: string } | null>(null)

// 計算可加入的團隊 (排除已加入的)
const availableTeamsToJoin = computed(() => {
  const joinedTeamIds = new Set(memberTeams.value.map(t => t.teamId))
  return teams.value.filter(team => !joinedTeamIds.has(team.id))
})

// 載入團隊列表
const loadTeams = async () => {
  try {
    const response = await teamApi.getTeams(false) // 只獲取活躍的團隊
    if (response.success && response.data) {
      teams.value = response.data.filter(team => team.isActive)
    }
  } catch (error) {
    console.error('獲取團隊列表失敗:', error)
  }
}

// 載入成員所屬團隊
const loadMemberTeams = async () => {
  try {
    // 優先使用 props.member.teams (如果已有多團隊資訊)
    if (props.member.teams && props.member.teams.length > 0) {
      memberTeams.value = [...props.member.teams]
    } else {
      // 從 API 獲取
      const response = await teamApi.getAgentTeams(props.member.id)
      if (response.success && response.data) {
        memberTeams.value = response.data
      }
    }
  } catch (error) {
    console.error('載入成員團隊失敗:', error)
    // 回退：使用舊的 teamId 作為單一團隊
    if (props.member.teamId) {
      const team = teams.value.find(t => t.id === props.member.teamId)
      memberTeams.value = [{
        teamId: props.member.teamId,
        teamName: team?.name,
        roleInTeam: 'member',
        isPrimary: true
      }]
    } else {
      memberTeams.value = []
    }
  }
}

// 加入團隊
const addToTeam = async () => {
  if (!selectedTeamToAdd.value) {return}

  teamOperationLoading.value = true
  teamOperationStatus.value = null

  try {
    const response = await teamApi.joinTeam(props.member.id, selectedTeamToAdd.value, {
      roleInTeam: 'member',
      isPrimary: memberTeams.value.length === 0
    })

    if (response.success && response.data) {
      // 添加到本地列表
      const teamInfo = teams.value.find(t => t.id === selectedTeamToAdd.value)
      memberTeams.value.push({
        teamId: response.data.teamId,
        teamName: teamInfo?.name || `團隊 #${response.data.teamId}`,
        roleInTeam: response.data.roleInTeam || 'member',
        isPrimary: response.data.isPrimary || false,
        joinedAt: response.data.joinedAt
      })

      selectedTeamToAdd.value = null
      teamOperationStatus.value = { type: 'success', message: '成功加入團隊' }
      showSuccess('加入成功', `已將 ${props.member.name || props.member.loginId} 加入團隊`)

      // 3秒後清除狀態
      setTimeout(() => { teamOperationStatus.value = null }, 3000)
    }
  } catch (error) {
    console.error('加入團隊失敗:', error)
    teamOperationStatus.value = { type: 'error', message: error instanceof Error ? error.message : '加入團隊失敗' }
    showError('加入失敗', error instanceof Error ? error.message : '加入團隊失敗')
  } finally {
    teamOperationLoading.value = false
  }
}

// 從團隊移除
const removeFromTeam = async (teamId: number) => {
  const teamInfo = memberTeams.value.find(t => t.teamId === teamId)
  const teamName = teamInfo?.teamName || `團隊 #${teamId}`

  const confirmed = await showWarning(
    '確認移除',
    `確定要將 ${props.member.name || props.member.loginId} 從「${teamName}」移除嗎？`,
    { confirmText: '確認移除', cancelText: '取消' }
  )

  if (!confirmed) {return}

  teamOperationLoading.value = true
  teamOperationStatus.value = null

  try {
    const response = await teamApi.leaveTeam(props.member.id, teamId)

    if (response.success) {
      // 從本地列表移除
      memberTeams.value = memberTeams.value.filter(t => t.teamId !== teamId)
      teamOperationStatus.value = { type: 'success', message: '已從團隊移除' }
      showSuccess('移除成功', `已將 ${props.member.name || props.member.loginId} 從「${teamName}」移除`)

      setTimeout(() => { teamOperationStatus.value = null }, 3000)
    }
  } catch (error) {
    console.error('從團隊移除失敗:', error)
    teamOperationStatus.value = { type: 'error', message: error instanceof Error ? error.message : '移除失敗' }
    showError('移除失敗', error instanceof Error ? error.message : '從團隊移除失敗')
  } finally {
    teamOperationLoading.value = false
  }
}

// 設為主要團隊
const setPrimaryTeam = async (teamId: number) => {
  teamOperationLoading.value = true
  teamOperationStatus.value = null

  try {
    const response = await teamApi.setPrimaryTeam(props.member.id, teamId)

    if (response.success) {
      // 更新本地列表
      memberTeams.value = memberTeams.value.map(t => ({
        ...t,
        isPrimary: t.teamId === teamId
      }))

      teamOperationStatus.value = { type: 'success', message: '已設為主要團隊' }
      showSuccess('設定成功', '已更新主要團隊')

      setTimeout(() => { teamOperationStatus.value = null }, 3000)
    }
  } catch (error) {
    console.error('設定主要團隊失敗:', error)
    teamOperationStatus.value = { type: 'error', message: error instanceof Error ? error.message : '設定失敗' }
    showError('設定失敗', error instanceof Error ? error.message : '設定主要團隊失敗')
  } finally {
    teamOperationLoading.value = false
  }
}

// 取得團隊內角色顯示文字
const getRoleInTeamText = (role: string) => {
  const roleMap: Record<string, string> = {
    lead: '組長',
    supervisor: '主管',
    member: '成員'
  }
  return roleMap[role] || role
}

// Edit form data - Simplified from 3-tier to 2-tier role system
const editForm = reactive({
  name: '',
  email: '',
  role: 'agent' as 'admin' | 'agent',
  teamId: null as number | null,
  isActive: true
})

// Initialize form when modal opens
watch(() => showEditModal.value, async (newVal) => {
  if (newVal) {
    editForm.name = props.member.name || ''
    editForm.email = props.member.email || ''
    editForm.role = props.member.role
    editForm.teamId = props.member.teamId ?? null
    editForm.isActive = props.member.status === 'active'

    // 重置多團隊狀態
    selectedTeamToAdd.value = null
    teamOperationStatus.value = null

    // 載入團隊列表和成員所屬團隊
    await Promise.all([
      loadTeams(),
      loadMemberTeams()
    ])
  }
})

// Modal control functions
const openEditModal = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  showEditModal.value = true
  // Focus management for accessibility
  nextTick(() => {
    const firstInput = document.querySelector('#editName') as HTMLInputElement
    if (firstInput) {
      firstInput.focus()
    }
  })
}

const closeEditModal = () => {
  showEditModal.value = false
}


// Keyboard event handler for ESC key
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && showEditModal.value) {
    closeEditModal()
  }
}

// Add global keyboard listener when modal is open
watch(showEditModal, (isOpen) => {
  if (isOpen) {
    document.addEventListener('keydown', handleKeydown)
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
  }
})

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})

// Submit edit form
const submitEdit = async () => {
  editLoading.value = true
  try {
    // 檢查角色是否變更
    const roleChanged = editForm.role !== props.member.role

    // 如果角色變更，顯示確認對話框
    if (roleChanged) {
      const roleChangeMessage = editForm.role === 'admin'
        ? '您確定要將此用戶提升為管理員嗎？管理員將擁有所有系統權限。'
        : '您確定要將此用戶降級為客服嗎？將失去管理員權限。'

      const confirmed = await showWarning(
        '確認角色變更',
        roleChangeMessage,
        {
          confirmText: '確認變更',
          cancelText: '取消'
        }
      )

      if (!confirmed) {
        editLoading.value = false
        return
      }
    }

    const updateData: Partial<TeamMember> = {
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
      teamId: editForm.teamId ?? undefined,
      status: editForm.isActive ? 'active' as const : 'inactive' as const
    }

    // 使用teamStore統一處理，避免雙重調用
    await teamStore.updateMember(props.member.id, updateData)

    // 顯示成功訊息
    showSuccess(
      '更新成功',
      `已成功更新 ${props.member.name || props.member.loginId} 的資訊`
    )

    closeEditModal()
  } catch (error) {
    console.error('更新成員失敗:', error)
    // 顯示錯誤訊息給用戶
    const errorMessage = error instanceof Error ? error.message : '更新成員失敗，請稍後重試'
    showError('更新失敗', errorMessage)
  } finally {
    editLoading.value = false
  }
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
.member-card {
  background: #f8fafc;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s ease;
  position: relative;
  min-height: 120px;
  cursor: pointer;
}

.member-card:hover:not(.modal-open) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.member-card.modal-open {
  /* Prevent hover effects when modal is open */
  transform: none;
  transition: none;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  border-radius: 12px;
  padding: 8px;
  margin: -8px;
}


.member-avatar {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.375rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.member-details h3 {
  margin: 0 0 6px 0;
  color: #1e293b;
  font-size: 1.375rem;
  font-weight: 700;
}

.member-details .email {
  margin: 0 0 12px 0;
  color: #64748b;
  font-size: 1rem;
}

.member-meta {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
}

.role,
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.role-icon {
  font-size: 1rem;
  line-height: 1;
}

.role.admin {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fbbf24;
}

.role.team {
  background: #f3e8ff;
  color: #7c3aed;
  border: 1px solid #c4b5fd;
}

.role.agent {
  background: #dbeafe;
  color: #1e40af;
  border: 1px solid #93c5fd;
}

.status.active {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.status.inactive {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.status.pending {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fbbf24;
}

.last-login {
  font-size: 0.875rem;
  color: #64748b;
  padding: 6px 12px;
  background: #e2e8f0;
  border-radius: 12px;
}

.member-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 16px 24px;
  border: 1px solid;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  min-width: 120px;
  justify-content: center;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 14px 20px;
  font-size: 1rem;
}

.btn-secondary {
  background: #f8fafc;
  color: #475569;
  border-color: #cbd5e1;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
  border-color: #94a3b8;
  transform: translateY(-1px);
}

.btn-success {
  background: #dcfce7;
  color: #166534;
  border-color: #16a34a;
}

.btn-success:hover:not(:disabled) {
  background: #bbf7d0;
  border-color: #15803d;
  transform: translateY(-1px);
}

.btn-warning {
  background: #fef3c7;
  color: #92400e;
  border-color: #fbbf24;
}

.btn-warning:hover:not(:disabled) {
  background: #fde68a;
  border-color: #f59e0b;
  transform: translateY(-1px);
}

.btn-danger {
  background: #fee2e2;
  color: #991b1b;
  border-color: #ef4444;
}

.btn-danger:hover:not(:disabled) {
  background: #fecaca;
  border-color: #dc2626;
  transform: translateY(-1px);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: var(--space-4);
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideIn 0.3s ease-out;
  transform-origin: center;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28px;
  border-bottom: 1px solid #e2e8f0;
  background: white;
}

.modal-header h2 {
  margin: 0;
  color: #1e293b;
  font-size: 1.5rem;
  font-weight: 700;
}

.close-btn {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  font-size: 1.5rem;
  color: #64748b;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #475569;
  background-color: #e2e8f0;
  border-color: #94a3b8;
  transform: translateY(-1px);
}

.modal-body {
  padding: 28px;
  background: #f8fafc;
}

.form-group {
  margin-bottom: var(--space-5);
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 600;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 16px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: white;
  color: #475569;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  background: #fefeff;
}

.form-group input:hover,
.form-group select:hover {
  border-color: #94a3b8;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  font-size: 0.875rem;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
}

/* Role permissions info styling */
.role-permissions-info {
  margin-top: 12px;
  padding: 12px;
  border-radius: 8px;
  font-size: 0.875rem;
}

.permission-warning {
  background: #fef3c7;
  border: 1px solid #fbbf24;
  color: #92400e;
}

.permission-info {
  background: #dbeafe;
  border: 1px solid #93c5fd;
  color: #1e40af;
}

.role-permissions-info strong {
  display: block;
  margin-bottom: 8px;
  font-size: 0.875rem;
}

.role-permissions-info ul {
  margin: 0;
  padding-left: 20px;
  list-style-type: disc;
}

.role-permissions-info li {
  margin: 4px 0;
  line-height: 1.5;
}

/* Form help text styling */
.form-help-text {
  display: block;
  margin-top: var(--space-1);
  color: var(--gray-500);
  font-size: 0.75rem;
  line-height: 1.4;
}

.form-instructions {
  opacity: 0.8;
  font-size: 0.7rem;
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  margin-top: var(--space-6);
}

/* Responsive Design */
@media (max-width: 768px) {
  .member-card {
    flex-direction: column;
    gap: var(--space-4);
    align-items: stretch;
    padding: var(--space-4);
  }
  
  .member-info {
    justify-content: flex-start;
    text-align: left;
  }
  
  .member-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .btn-sm {
    flex: 1;
    min-width: 80px;
  }

  .modal-overlay {
    padding: var(--space-2);
    align-items: flex-end;
  }

  .modal {
    margin: 0;
    max-width: none;
    max-height: 85vh;
    border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .modal-actions {
    flex-direction: column;
    gap: var(--space-3);
  }

  .modal-actions .btn {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .member-card {
    padding: var(--space-3);
  }

  .member-avatar {
    width: 40px;
    height: 40px;
  }

  .avatar-placeholder {
    font-size: 1rem;
  }

  .member-details h3 {
    font-size: 0.9rem;
  }

  .member-details .email {
    font-size: 0.8rem;
  }

  .member-actions {
    grid-template-columns: 1fr 1fr;
    display: grid;
    gap: var(--space-2);
  }
}

/* =====================================================
   Multi-Team Selector Styles
   ===================================================== */

.multi-team-selector {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.team-chips-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 44px;
  align-items: flex-start;
  margin-bottom: 12px;
}

/* Team Chip Styles */
.team-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  transition: all 0.2s ease;
  animation: chipAppear 0.3s ease-out;
}

@keyframes chipAppear {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(-5px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.team-chip:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.team-chip.is-primary {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.team-chip.is-primary:hover {
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
}

.chip-icon {
  font-size: 1rem;
  line-height: 1;
}

.chip-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-role {
  font-size: 0.7rem;
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.chip-remove,
.chip-star {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  line-height: 1;
  transition: all 0.2s ease;
  padding: 0;
}

.chip-remove:hover {
  background: rgba(239, 68, 68, 0.8);
  transform: scale(1.1);
}

.chip-star:hover {
  background: rgba(251, 191, 36, 0.8);
  transform: scale(1.1);
}

.chip-remove:disabled,
.chip-star:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Empty State */
.no-teams-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #94a3b8;
  font-size: 0.9rem;
  padding: 12px;
  background: white;
  border-radius: 8px;
  border: 1px dashed #cbd5e1;
  width: 100%;
}

.empty-icon {
  font-size: 1.2rem;
}

/* Add Team Section */
.add-team-section {
  display: flex;
  gap: 8px;
  align-items: center;
}

.team-add-select {
  flex: 1;
  padding: 10px 12px !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 8px !important;
  font-size: 0.9rem !important;
  background: white !important;
  color: #475569 !important;
  transition: all 0.2s ease;
}

.team-add-select:focus {
  border-color: #667eea !important;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15) !important;
}

.team-add-select:disabled {
  background: #f1f5f9 !important;
  color: #94a3b8 !important;
  cursor: not-allowed;
}

.btn-add-team {
  padding: 10px 16px !important;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
  color: white !important;
  border: none !important;
  border-radius: 8px !important;
  font-size: 0.9rem !important;
  font-weight: 600 !important;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-add-team:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-add-team:disabled {
  background: #94a3b8 !important;
  cursor: not-allowed;
  transform: none;
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Operation Status */
.team-operation-status {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  animation: statusAppear 0.3s ease-out;
}

@keyframes statusAppear {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.team-operation-status.success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.team-operation-status.error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

/* Chip Transition Animations */
.chip-enter-active,
.chip-leave-active {
  transition: all 0.3s ease;
}

.chip-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.chip-leave-to {
  opacity: 0;
  transform: scale(0.8) translateX(-10px);
}

.chip-move {
  transition: transform 0.3s ease;
}

/* Responsive adjustments for multi-team selector */
@media (max-width: 480px) {
  .multi-team-selector {
    padding: 12px;
  }

  .team-chip {
    padding: 6px 10px;
    font-size: 0.8rem;
  }

  .chip-name {
    max-width: 100px;
  }

  .add-team-section {
    flex-direction: column;
  }

  .team-add-select {
    width: 100%;
  }

  .btn-add-team {
    width: 100%;
  }
}
</style>