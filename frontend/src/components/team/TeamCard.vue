<template>
  <div
    class="team-card"
    @click="showTeamDetails"
  >
    <!-- 主要卡片內容 -->
    <div class="team-info">
      <div class="team-avatar">
        <div class="avatar-placeholder">
          {{ getTeamInitial(team.name) }}
        </div>
      </div>
      <div class="team-details">
        <h3>{{ team.name }}</h3>
        <p class="description">
          {{ team.description || '無描述' }}
        </p>
        <div class="team-meta">
          <span :class="['status', team.isActive ? 'active' : 'inactive']">
            {{ team.isActive ? '活躍' : '停用' }}
          </span>
          <span class="member-count">{{ team.memberCount || 0 }} 成員</span>
        </div>
      </div>
    </div>
    
    <!-- 操作按鈕區 -->
    <div
      class="team-actions"
      @click.stop
    >
      <button
        :class="['btn', 'btn-sm', team.isActive ? 'btn-warning' : 'btn-success']"
        :disabled="loading"
        @click="$emit('toggle-status', team)"
      >
        {{ team.isActive ? '停用' : '啟用' }}
      </button>
      <button
        class="btn btn-sm btn-secondary"
        :disabled="loading"
        @click="$emit('generate-qr', team)"
      >
        QR 碼
      </button>
      <button
        class="btn btn-sm btn-danger"
        :disabled="loading"
        @click="$emit('remove-team', team)"
      >
        刪除團隊
      </button>
    </div>
  </div>

  <!-- 團隊詳情 Modal -->
  <div
    v-if="showModal"
    class="modal-overlay"
  >
    <div
      class="modal-content"
    >
      <!-- Modal Header -->
      <div class="modal-header">
        <h2>{{ team.name }} 詳細資訊</h2>
        <button 
          class="close-button" 
          @click="closeModal"
        >
          &times;
        </button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        <!-- 團隊編輯表單 -->
        <div
          v-if="isEditing"
          class="team-edit-form"
        >
          <h3>編輯團隊資訊</h3>
          <form @submit.prevent="saveTeamEdit">
            <div class="form-group">
              <label for="teamName">團隊名稱</label>
              <input
                id="teamName"
                v-model="editForm.name"
                type="text"
                placeholder="請輸入團隊名稱"
                required
              >
            </div>
            <div class="form-group">
              <label for="teamDescription">團隊描述</label>
              <textarea
                id="teamDescription"
                v-model="editForm.description"
                rows="3"
                placeholder="請輸入團隊描述"
              />
            </div>
            <div class="form-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click="cancelEdit"
              >
                取消
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="editLoading"
              >
                {{ editLoading ? '儲存中...' : '儲存變更' }}
              </button>
            </div>
          </form>
        </div>

        <!-- 團隊統計資訊 -->
        <div
          v-else
          class="team-stats"
        >
          <div class="section-header">
            <h3>團隊資訊</h3>
            <button
              class="btn btn-sm btn-secondary"
              @click="startEdit"
            >
              ✏️ 編輯
            </button>
          </div>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">團隊名稱</span>
              <span class="stat-value">{{ team.name }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">團隊描述</span>
              <span class="stat-value">{{ team.description || '無描述' }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">創建時間</span>
              <span class="stat-value">{{ formatDate(team.createdAt) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">最後更新</span>
              <span class="stat-value">{{ formatDate(team.updatedAt) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">團隊狀態</span>
              <span :class="['stat-value', 'status-badge', team.isActive ? 'active' : 'inactive']">
                {{ team.isActive ? '活躍中' : '已停用' }}
              </span>
            </div>
            <div class="stat-item">
              <span class="stat-label">成員數量</span>
              <span class="stat-value">{{ team.memberCount || 0 }} 位成員</span>
            </div>
          </div>
        </div>

        <!-- 成員列表 -->
        <div class="team-members-section">
          <div class="section-header">
            <h3>團隊成員</h3>
            <button
              class="btn btn-sm btn-primary"
              :disabled="loadingMembers || addingMember"
              @click="showAddMemberDialog"
            >
              + 新增成員
            </button>
          </div>

          <div
            v-if="loadingMembers"
            class="loading-members"
          >
            <HamsterLoader
              message="載入成員中..."
            />
          </div>

          <div
            v-else-if="members.length === 0"
            class="no-members"
          >
            <EmptyIcon />
            <span>此團隊暫無成員</span>
          </div>

          <div
            v-else
            class="members-grid"
          >
            <div
              v-for="member in members"
              :key="member.id"
              class="member-item"
            >
              <div class="member-avatar">
                {{ getInitials(member) }}
              </div>
              <div class="member-info">
                <span class="member-name">{{ member.name || member.loginId }}</span>
                <span class="member-role">{{ getRoleDisplayName(member.role) }}</span>
              </div>
              <button
                class="btn-remove"
                :disabled="removingMemberId === member.id"
                title="從團隊移除"
                @click.stop="handleRemoveMember(member)"
              >
                {{ removingMemberId === member.id ? '移除中...' : '✕' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 新增成員選擇器 -->
        <div
          v-if="showAddMemberSelector"
          class="add-member-section"
        >
          <div class="add-member-header">
            <h4>選擇要新增的成員</h4>
            <button
              class="close-selector"
              @click="showAddMemberSelector = false"
            >
              ✕
            </button>
          </div>

          <div
            v-if="loadingAvailableMembers"
            class="loading-members"
          >
            <HamsterLoader message="載入可用成員中..." />
          </div>

          <div
            v-else-if="availableMembers.length === 0"
            class="no-members"
          >
            <EmptyIcon />
            <span>沒有可新增的成員</span>
          </div>

          <div
            v-else
            class="available-members-list"
          >
            <div
              v-for="member in availableMembers"
              :key="member.id"
              class="available-member-item"
              @click="handleAddMember(member)"
            >
              <div class="member-avatar-small">
                {{ getInitials(member) }}
              </div>
              <div class="member-info-small">
                <span class="member-name-small">{{ member.name || member.loginId }}</span>
                <span class="member-role-small">{{ getRoleDisplayName(member.role) }}</span>
              </div>
              <button
                class="btn-add-small"
                :disabled="addingMember"
              >
                {{ addingMember ? '新增中...' : '+ 新增' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer">
        <button 
          class="btn btn-secondary" 
          @click="closeModal"
        >
          關閉
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, reactive } from 'vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import { teamApi } from '@/api/team'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'
import type { TeamMember } from '@/types'

interface Team {
  id: number;
  name: string;
  description?: string;
  qrCode?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}

const props = defineProps<{
  team: Team;
  loading?: boolean;
}>();

const emit = defineEmits<{
  'toggle-status': [team: Team];
  'generate-qr': [team: Team];
  'remove-team': [team: Team];
  'member-updated': [];
  'team-updated': [];
}>();

// Composables
const { showDanger, showWarning } = useConfirmDialog()
const { showSuccess, showError } = useToast()

// 組件狀態
const showModal = ref(false)
const members = ref<TeamMember[]>([])
const loadingMembers = ref(false)

// 編輯狀態
const isEditing = ref(false)
const editLoading = ref(false)
const editForm = reactive({
  name: '',
  description: ''
})

// 成員管理狀態
const showAddMemberSelector = ref(false)
const availableMembers = ref<TeamMember[]>([])
const loadingAvailableMembers = ref(false)
const addingMember = ref(false)
const removingMemberId = ref<string | null>(null)

// 圖標組件
const EmptyIcon = {
  template: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="m9,9 6,6"></path>
    <path d="m15,9-6,6"></path>
  </svg>`
}

// 工具函數
const getTeamInitial = (name: string): string => {
  return name.charAt(0).toUpperCase();
};

const getInitials = (member: TeamMember): string => {
  const name = member.name || member.loginId
  if (!name) {
    return '?'
  }
  const names = name.split(' ').filter(n => n.trim())
  if (names.length === 0) {
    return '?'
  }
  if (names.length === 1) {
    const firstName = names[0]
    return firstName ? firstName.charAt(0).toUpperCase() : '?'
  }
  const firstName = names[0]
  const lastName = names[names.length - 1]
  return firstName && lastName ? (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() : '?'
}

const getRoleDisplayName = (role: string): string => {
  const roleMap: Record<string, string> = {
    admin: '管理員',
    team: '組長', 
    agent: '客服'
  }
  return roleMap[role] || role
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Modal 控制功能
const showTeamDetails = async () => {
  showModal.value = true
  isEditing.value = false

  // 如果還沒載入成員，則載入成員資料
  if (members.value.length === 0) {
    await loadTeamMembers()
  }
}

const closeModal = () => {
  showModal.value = false
  isEditing.value = false
}

// 編輯功能
const startEdit = () => {
  editForm.name = props.team.name
  editForm.description = props.team.description || ''
  isEditing.value = true
}

const cancelEdit = () => {
  isEditing.value = false
}

const saveTeamEdit = async () => {
  try {
    const confirmed = await showWarning(
      '確定要更新團隊資訊？',
      `團隊名稱將更新為 "${editForm.name}"`
    )

    if (!confirmed) {return}

    editLoading.value = true

    const response = await teamApi.updateTeam(props.team.id, {
      name: editForm.name,
      description: editForm.description
    })

    if (response.success) {
      showSuccess('團隊更新成功')
      isEditing.value = false

      // 通知父組件更新
      emit('team-updated')
    } else {
      showError(response.error || '更新團隊失敗')
    }
  } catch (error) {
    console.error('更新團隊失敗:', error)
    showError('更新團隊時發生錯誤')
  } finally {
    editLoading.value = false
  }
}

// 載入團隊成員
const loadTeamMembers = async () => {
  loadingMembers.value = true
  try {
    const response = await teamApi.getTeamMembersByTeam(props.team.id)
    if (response.success && response.data) {
      members.value = response.data
    } else {
      console.error('載入團隊成員失敗:', response.error)
      members.value = []
    }
  } catch (error) {
    console.error('載入團隊成員失敗:', error)
    members.value = []
  } finally {
    loadingMembers.value = false
  }
}

// 載入可用成員（未分配到此團隊的成員）
const loadAvailableMembers = async () => {
  loadingAvailableMembers.value = true
  try {
    const [allMembersResponse] = await Promise.all([
      teamApi.getMembers()
    ])

    if (allMembersResponse.success && allMembersResponse.data) {
      // 過濾出未分配到當前團隊的成員
      const currentMemberIds = new Set(members.value.map(m => m.id))
      availableMembers.value = allMembersResponse.data.filter(
        member => !currentMemberIds.has(member.id) && member.status === 'active'
      )
    } else {
      console.error('載入可用成員失敗:', allMembersResponse.error)
      availableMembers.value = []
    }
  } catch (error) {
    console.error('載入可用成員失敗:', error)
    availableMembers.value = []
  } finally {
    loadingAvailableMembers.value = false
  }
}

// 顯示新增成員對話框
const showAddMemberDialog = async () => {
  showAddMemberSelector.value = true
  await loadAvailableMembers()
}

// 新增成員到團隊
const handleAddMember = async (member: TeamMember) => {
  try {
    const confirmed = await showWarning(
      '確定要新增此成員？',
      `將 ${member.name || member.loginId} 新增到 ${props.team.name}`
    )

    if (!confirmed) {return}

    addingMember.value = true

    const response = await teamApi.addMemberToTeam(props.team.id, member.id)

    if (response.success) {
      showSuccess('成員新增成功')

      // 重新載入團隊成員列表
      await loadTeamMembers()

      // 重新載入可用成員列表
      await loadAvailableMembers()

      // 通知父組件更新
      emit('member-updated')
    } else {
      showError(response.error || '新增成員失敗')
    }
  } catch (error) {
    console.error('新增成員失敗:', error)
    showError('新增成員時發生錯誤')
  } finally {
    addingMember.value = false
  }
}

// 從團隊移除成員
const handleRemoveMember = async (member: TeamMember) => {
  try {
    const confirmed = await showDanger(
      '確定要移除此成員？',
      `將 ${member.name || member.loginId} 從 ${props.team.name} 移除`
    )

    if (!confirmed) {return}

    removingMemberId.value = member.id

    const response = await teamApi.removeMemberFromTeam(props.team.id, member.id)

    if (response.success) {
      showSuccess('成員移除成功')

      // 重新載入團隊成員列表
      await loadTeamMembers()

      // 如果正在顯示新增成員選擇器，也重新載入可用成員
      if (showAddMemberSelector.value) {
        await loadAvailableMembers()
      }

      // 通知父組件更新
      emit('member-updated')
    } else {
      showError(response.error || '移除成員失敗')
    }
  } catch (error) {
    console.error('移除成員失敗:', error)
    showError('移除成員時發生錯誤')
  } finally {
    removingMemberId.value = null
  }
}

// 監聽 team 變化，重置 modal 狀態
watch(() => props.team.id, () => {
  showModal.value = false
  members.value = []
  showAddMemberSelector.value = false
  availableMembers.value = []
})
</script>

<style scoped>
.team-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  transition: all 0.3s ease;
  min-height: 120px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.team-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.team-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.team-avatar {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.avatar-placeholder {
  color: white;
  font-weight: 700;
  font-size: 1.375rem;
  text-transform: uppercase;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.team-details {
  flex: 1;
  min-width: 0;
}

.team-details h3 {
  margin: 0 0 6px 0;
  color: #1e293b;
  font-size: 1.375rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.description {
  margin: 0 0 12px 0;
  color: #64748b;
  font-size: 1rem;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.team-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.status {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
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

.member-count {
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 6px 12px;
  background: #e2e8f0;
  border-radius: 12px;
}

.team-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  flex-shrink: 0;
  flex-wrap: wrap;
}

/* Modal 樣式 */
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
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 700px;
  width: 90%;
  max-height: 85vh;
  overflow: hidden;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
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
  color: #1e293b;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1.5rem;
  font-weight: normal;
  line-height: 1;
}

.close-button:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
  color: #475569;
  transform: translateY(-1px);
}

.modal-body {
  padding: 28px;
  max-height: 65vh;
  overflow-y: auto;
  background: #f8fafc;
}

/* 團隊編輯表單 */
.team-edit-form {
  margin-bottom: 28px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.team-edit-form h3 {
  color: #1e293b;
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0 0 20px 0;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 600;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: #f8fafc;
  color: #475569;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  background: white;
}

.form-group input:hover,
.form-group textarea:hover {
  border-color: #94a3b8;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.team-stats {
  margin-bottom: 28px;
}

.team-stats h3 {
  color: #1e293b;
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0 0 20px 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.stat-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
}

.stat-label {
  color: #64748b;
  font-size: 1rem;
  font-weight: 500;
}

.stat-value {
  color: #1e293b;
  font-size: 1.125rem;
  font-weight: 700;
}

.status-badge {
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  display: inline-block;
  width: fit-content;
}

.status-badge.active {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.status-badge.inactive {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.team-members-section {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h3 {
  color: #1e293b;
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0;
}

.team-members-section h3 {
  color: #1e293b;
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0 0 20px 0;
}

.loading-members, .no-members {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #64748b;
  font-size: 1rem;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.no-members {
  flex-direction: column;
  gap: 12px;
}

.members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.member-item:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
}

.member-avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.member-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.member-name {
  color: #1e293b;
  font-size: 1.125rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.member-role {
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
}

.btn-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #fecaca;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1rem;
  font-weight: 600;
  flex-shrink: 0;
}

.btn-remove:hover:not(:disabled) {
  background: #fecaca;
  border-color: #ef4444;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
}

.btn-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  font-size: 0.75rem;
}

.add-member-section {
  margin-top: 24px;
  padding: 20px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.add-member-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.add-member-header h4 {
  color: #1e293b;
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
}

.close-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1.25rem;
  font-weight: normal;
  line-height: 1;
}

.close-selector:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
  color: #475569;
}

.available-members-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.available-member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.available-member-item:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.member-avatar-small {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 0.875rem;
  flex-shrink: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.member-info-small {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.member-name-small {
  color: #1e293b;
  font-size: 1rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-role-small {
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 500;
}

.btn-add-small {
  padding: 8px 16px;
  border: 1px solid #16a34a;
  background: #dcfce7;
  color: #166534;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-add-small:hover:not(:disabled) {
  background: #bbf7d0;
  border-color: #15803d;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2);
}

.btn-add-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-footer {
  padding: 20px 28px;
  border-top: 1px solid #e2e8f0;
  background: white;
  display: flex;
  justify-content: flex-end;
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

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-color: #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #5a67d8, #6b4598);
  border-color: #5a67d8;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

@media (max-width: 768px) {
  .team-card {
    flex-direction: column;
    gap: var(--space-4);
    align-items: stretch;
    padding: var(--space-4);
  }

  .team-info {
    justify-content: flex-start;
    text-align: left;
  }

  .team-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .btn-sm {
    flex: 1;
    min-width: 80px;
  }

  .modal-content {
    width: 95%;
    max-height: 90vh;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 16px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .members-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .team-info {
    gap: 12px;
  }

  .team-avatar {
    width: 48px;
    height: 48px;
  }

  .avatar-placeholder {
    font-size: 1.125rem;
  }

  .team-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .team-actions {
    flex-wrap: wrap;
  }

  .modal-header h2 {
    font-size: 1.125rem;
  }

  .modal-body {
    max-height: 70vh;
  }

  .team-stats h3,
  .team-members-section h3 {
    font-size: 1rem;
  }
}
</style>