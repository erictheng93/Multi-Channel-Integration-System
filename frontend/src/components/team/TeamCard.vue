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
        @click="$emit('view-qr', team)"
        @mouseenter="$emit('prefetch-qr', team)"
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
    @click="closeModal"
  >
    <div
      class="modal-content"
      @click.stop
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
            <div class="section-title-group">
              <h3>團隊成員</h3>
            </div>
            <button
              class="btn btn-sm btn-primary"
              :disabled="loadingMembers"
              @click="openAddMemberModal"
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

        <!-- QR Code 資訊區塊 -->
        <div class="qr-code-section">
          <div class="section-header">
            <div class="section-title-group">
              <h3>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="section-icon"
                >
                  <rect
                    x="3"
                    y="3"
                    width="7"
                    height="7"
                  />
                  <rect
                    x="14"
                    y="3"
                    width="7"
                    height="7"
                  />
                  <rect
                    x="3"
                    y="14"
                    width="7"
                    height="7"
                  />
                  <rect
                    x="14"
                    y="14"
                    width="3"
                    height="3"
                  />
                  <rect
                    x="18"
                    y="14"
                    width="3"
                    height="3"
                  />
                  <rect
                    x="14"
                    y="18"
                    width="3"
                    height="3"
                  />
                  <rect
                    x="18"
                    y="18"
                    width="3"
                    height="3"
                  />
                </svg>
                QR Code 資訊
              </h3>
            </div>
            <button
              v-if="!currentQRCode && !loadingQRCode"
              class="btn btn-sm btn-primary"
              :disabled="generatingQR"
              @click="handleGenerateQR"
            >
              {{ generatingQR ? '生成中...' : '+ 生成 QR Code' }}
            </button>
          </div>

          <!-- Loading State -->
          <div
            v-if="loadingQRCode"
            class="qr-loading"
          >
            <HamsterLoader message="載入 QR Code 中..." />
          </div>

          <!-- No QR Code State -->
          <div
            v-else-if="!currentQRCode"
            class="qr-empty-state"
          >
            <div class="empty-qr-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <rect
                  x="3"
                  y="3"
                  width="7"
                  height="7"
                />
                <rect
                  x="14"
                  y="3"
                  width="7"
                  height="7"
                />
                <rect
                  x="3"
                  y="14"
                  width="7"
                  height="7"
                />
                <rect
                  x="14"
                  y="14"
                  width="3"
                  height="3"
                />
                <rect
                  x="18"
                  y="14"
                  width="3"
                  height="3"
                />
                <rect
                  x="14"
                  y="18"
                  width="3"
                  height="3"
                />
                <rect
                  x="18"
                  y="18"
                  width="3"
                  height="3"
                />
              </svg>
            </div>
            <p>此團隊尚未生成 QR Code</p>
            <span class="empty-hint">點擊上方按鈕生成專屬 QR Code，讓客戶輕鬆加入 LINE 官方帳號</span>
          </div>

          <!-- QR Code Display - Flex Bubble Design -->
          <div
            v-else
            class="qr-display"
          >
            <div class="qr-flex-layout">
              <!-- Left: Flex Bubble Card (QRcodeDesign.html Style) -->
              <div class="flex-bubble">
                <div class="bubble-body">
                  <!-- QR Code Image -->
                  <div class="qr-image-wrapper">
                    <img
                      :src="currentQRCode.qrCode"
                      alt="LINE QR Code"
                      class="qr-image"
                      @error="handleQRImageError"
                    >
                  </div>
                  <!-- Text Content -->
                  <h2 class="bubble-title">
                    {{ team.name }}
                  </h2>
                  <p class="bubble-subtitle">
                    掃描加入 LINE 官方帳號
                  </p>
                </div>
                <div class="bubble-footer">
                  <button
                    class="bubble-btn"
                    @click="downloadQRCode"
                  >
                    下載 QR Code
                  </button>
                </div>
              </div>

              <!-- Right: Info Panel -->
              <div class="qr-info-panel">
                <div class="qr-info-header">
                  <h4>LINE 官方帳號連結</h4>
                  <div class="qr-actions">
                    <button
                      class="btn-icon-sm"
                      title="重新生成 QR Code"
                      :disabled="generatingQR"
                      @click="handleGenerateQR"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M21 2v6h-6" />
                        <path d="M3 12a9 9 0 0115-6.7L21 8" />
                        <path d="M3 22v-6h6" />
                        <path d="M21 12a9 9 0 01-15 6.7L3 16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- LINE URL -->
                <div class="url-display">
                  <div class="url-text">
                    <span class="url-label">連結</span>
                    <code class="url-value">{{ currentQRCode.lineUrl }}</code>
                  </div>
                  <button
                    class="btn-copy"
                    :class="{ 'copied': urlCopied }"
                    @click="copyLineUrl"
                  >
                    <svg
                      v-if="!urlCopied"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <rect
                        x="9"
                        y="9"
                        width="13"
                        height="13"
                        rx="2"
                        ry="2"
                      />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    <svg
                      v-else
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {{ urlCopied ? '已複製' : '複製' }}
                  </button>
                </div>

                <!-- Stats Grid -->
                <div class="qr-stats-mini">
                  <div class="qr-stat-item">
                    <span class="qr-stat-label">使用次數</span>
                    <span class="qr-stat-value">
                      {{ currentQRCode.usageCount || 0 }}
                      <span
                        v-if="currentQRCode.maxUses"
                        class="qr-stat-max"
                      >/ {{ currentQRCode.maxUses }}</span>
                      <span
                        v-else
                        class="qr-stat-max"
                      >/ ∞</span>
                    </span>
                  </div>
                  <div class="qr-stat-item">
                    <span class="qr-stat-label">建立時間</span>
                    <span class="qr-stat-value">{{ formatDate(currentQRCode.createdAt) }}</span>
                  </div>
                  <div
                    v-if="currentQRCode.campaignName"
                    class="qr-stat-item"
                  >
                    <span class="qr-stat-label">活動名稱</span>
                    <span class="qr-stat-value">{{ currentQRCode.campaignName }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 新增成員 Modal -->
      <AddMemberModal
        :is-open="showAddMemberModal"
        :team-id="team.id"
        :team-name="team.name"
        :current-members="members"
        @close="closeAddMemberModal"
        @member-added="handleMemberAdded"
      />

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
import { ref, watch, reactive, computed } from 'vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import AddMemberModal from '@/components/team/AddMemberModal.vue'
import { teamApi } from '@/api/team'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useQRCodeStore } from '@/stores/qrcode'
import type { TeamMember, QRCode } from '@/types'

interface Team {
  id: number;
  name: string;
  description?: string;
  qrCode?: string;
  lineUrl?: string;  // 🆕 Phase 3: LINE 連結 URL
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
  'view-qr': [team: Team];  // 🔄 改為僅查看 QR Code（不生成）
  'prefetch-qr': [team: Team];  // 🆕 Phase 1: 懸停預載事件
  'remove-team': [team: Team];
  'member-updated': [];
  'team-updated': [];
}>();

// Composables
const { showDanger, showWarning, showConfirm } = useConfirmDialog()
const { showSuccess, showError } = useToast()
const authStore = useAuthStore()
const qrCodeStore = useQRCodeStore()

// 當前用戶資訊
const currentUser = computed(() => authStore.currentAgent)

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
const showAddMemberModal = ref(false)
const removingMemberId = ref<string | null>(null)

// QR Code 狀態
const currentQRCode = ref<QRCode | null>(null)
const loadingQRCode = ref(false)
const generatingQR = ref(false)
const urlCopied = ref(false)

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

const formatDate = (dateString: string | Date | undefined): string => {
  if (!dateString) {return '無期限'}
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  if (isNaN(date.getTime())) {return '無效日期'}
  return date.toLocaleDateString('zh-TW', {
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

  // 🆕 修正：每次打開 modal 都重新載入 QR Code，確保與其他元件同步
  // 移除 if (!currentQRCode.value) 檢查，總是載入最新資料
  await loadTeamQRCode()
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

// 載入團隊成員 - 使用新的多團隊 API 以確保與 agent_teams 表同步
const loadTeamMembers = async () => {
  loadingMembers.value = true
  try {
    // 使用新的多團隊 API: GET /teams/agent-teams/team/:teamId/members
    // 這個 API 從 agent_teams 表查詢，與 addMemberToTeam 使用的表一致
    const response = await teamApi.getTeamMembersWithTeams(props.team.id)
    if (response.success && response.data) {
      // 轉換數據格式：後端返回 displayName/isActive，前端需要 name/status
      members.value = response.data.map(member => ({
        id: member.id,
        loginId: member.email || member.id,
        name: member.displayName, // 後端: displayName → 前端: name
        email: member.email,
        role: member.role as 'admin' | 'agent',
        status: member.isActive ? 'active' : 'inactive', // 後端: isActive(bool) → 前端: status(string)
        teams: member.teams,
        teamCount: member.teams?.length || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as TeamMember))
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

// 顯示新增成員 Modal
const openAddMemberModal = () => {
  showAddMemberModal.value = true
}

// 關閉新增成員 Modal
const closeAddMemberModal = () => {
  showAddMemberModal.value = false
}

// 當成員被新增時的回調
const handleMemberAdded = (member: TeamMember) => {
  // 🔧 修復：使用樂觀更新，直接更新本地狀態而非重新載入 API
  // 這樣可以確保 UI 立即反映變化，避免 API 返回舊數據的問題

  // 將新成員轉換為正確格式並加入列表
  const newMember: TeamMember = {
    id: member.id,
    loginId: member.loginId || member.email || member.id,
    name: member.name || member.loginId || '未命名',
    email: member.email,
    role: member.role as 'admin' | 'agent',
    status: member.status || 'active',
    teams: member.teams || [],
    teamCount: member.teamCount || 1,
    createdAt: member.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  // 樂觀更新：直接將新成員加入到當前列表（使用新陣列觸發響應式更新）
  members.value = [...members.value, newMember]

  // 通知父組件更新（用於更新團隊卡片上的成員數量）
  emit('member-updated')
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

    // 🔧 修復：使用樂觀更新模式
    // 先保存原始列表，以便 API 失敗時恢復
    const originalMembers = [...members.value]

    // 樂觀更新：立即從列表中移除（使用新陣列觸發響應式更新）
    members.value = members.value.filter(m => m.id !== member.id)

    const response = await teamApi.removeMemberFromTeam(props.team.id, member.id)

    if (response.success) {
      showSuccess('成員移除成功')
      // 通知父組件更新（用於更新團隊卡片上的成員數量）
      emit('member-updated')
    } else {
      // API 失敗：恢復原始列表
      members.value = originalMembers
      showError(response.error || '移除成員失敗')
    }
  } catch (error) {
    console.error('移除成員失敗:', error)
    showError('移除成員時發生錯誤')
    // 發生錯誤時重新載入以確保數據一致性
    await loadTeamMembers()
  } finally {
    removingMemberId.value = null
  }
}

// QR Code 相關方法
// 🆕 使用 Pinia Store 統一管理 QR 碼狀態，與 TeamManagement 共享
const loadTeamQRCode = async () => {
  loadingQRCode.value = true
  try {
    console.log(`🔍 [TeamCard] 從 Store 載入 QR Code: team ${props.team.id}`)
    // 使用 Store 的 loadQRCode 方法，統一快取管理
    const qrCode = await qrCodeStore.loadQRCode(props.team.id)
    currentQRCode.value = qrCode

    if (qrCode) {
      console.log(`✅ [TeamCard] QR Code 載入成功`)
    } else {
      console.log(`📭 [TeamCard] 團隊尚未有 QR Code: team ${props.team.id}`)
    }
  } catch (error) {
    console.error('載入 QR Code 失敗:', error)
    currentQRCode.value = null
  } finally {
    loadingQRCode.value = false
  }
}

// 格式化角色名稱
const formatRole = (role: string): string => {
  const roleMap: Record<string, string> = {
    admin: '管理員',
    team: '組長',
    agent: '客服'
  }
  return roleMap[role] || role
}

// 格式化當前時間
const formatCurrentTime = (): string => {
  return new Date().toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 記錄活動日誌（前端記錄，實際活動由後端 API 自動記錄）
const logQRCodeActivity = (action: 'generate' | 'regenerate', success: boolean) => {
  const user = currentUser.value
  const logEntry = {
    timestamp: new Date().toISOString(),
    action: action === 'regenerate' ? 'QR_CODE_REGENERATE' : 'QR_CODE_GENERATE',
    teamId: props.team.id,
    teamName: props.team.name,
    userId: user?.id || 'unknown',
    userName: user?.displayName || 'Unknown User',
    userRole: user?.role || 'unknown',
    success,
    previousQRCode: action === 'regenerate' ? currentQRCode.value?.id : null
  }

  // 輸出到控制台供調試（實際活動由後端 API 自動記錄到資料庫）
  console.log('📝 [Activity Log] QR Code Operation:', logEntry)
}

// 🆕 使用 Pinia Store 統一管理 QR 碼狀態
const handleGenerateQR = async () => {
  const isRegeneration = !!currentQRCode.value

  // 如果是重新生成，顯示確認對話框
  if (isRegeneration) {
    const user = currentUser.value
    const userName = user?.displayName || 'Unknown User'
    const userRole = formatRole(user?.role || 'agent')
    const currentTime = formatCurrentTime()

    const confirmed = await showConfirm({
      title: '確認重新生成 QR Code',
      message: `此操作無法復原！重新生成將會：

  • 使舊的 QR Code 立即失效
  • 已印刷的宣傳品將無法使用
  • 重置掃描次數統計

操作人員：${userName}（${userRole}）
操作時間：${currentTime}
目標團隊：${props.team.name}`,
      type: 'danger',
      confirmText: '確認重新生成',
      cancelText: '取消'
    })

    if (!confirmed) {
      return
    }
  }

  try {
    generatingQR.value = true

    // 使用 Store 的 generateQRCode 方法
    // 該方法會先檢查現有 QR（如不是重新生成），無現有才生成新的
    console.log(`🔍 [TeamCard] 透過 Store ${isRegeneration ? '重新' : ''}生成 QR: team ${props.team.id}`)
    const qrCode = await qrCodeStore.generateQRCode(props.team.id, props.team.name, isRegeneration)

    if (qrCode) {
      // 記錄活動
      logQRCodeActivity(isRegeneration ? 'regenerate' : 'generate', true)

      // 更新本地狀態（與 Store 同步）
      currentQRCode.value = qrCode

      showSuccess(isRegeneration ? 'QR Code 已重新生成' : 'QR Code 生成成功')
    } else {
      logQRCodeActivity(isRegeneration ? 'regenerate' : 'generate', false)
      showError(qrCodeStore.error || '生成 QR Code 失敗')
    }
  } catch (error) {
    console.error('生成 QR Code 失敗:', error)
    logQRCodeActivity(isRegeneration ? 'regenerate' : 'generate', false)
    showError('生成 QR Code 時發生錯誤')
  } finally {
    generatingQR.value = false
  }
}

/**
 * 下載 QR Code 圖片 - Flex Bubble Card 樣式
 * 生成與畫面上完全一致的 Flex Bubble Card PNG 圖片
 * 使用 Canvas API 繪製完整卡片樣式
 */
const downloadQRCode = async () => {
  if (!currentQRCode.value?.qrCode) {return}

  const qrCodeDataUrl = currentQRCode.value.qrCode
  const teamName = props.team.name
  const filename = `DAC_QRCode_${Date.now()}.png`

  try {
    // 設計參數 (2x 縮放以獲得高清輸出)
    const scale = 2
    const cardWidth = 260 * scale
    const borderRadius = 20 * scale

    // Padding 設定 (對應 QRcodeDesign.html)
    const bodyPaddingTop = 35 * scale
    const footerPaddingX = 20 * scale
    const footerPaddingBottom = 20 * scale

    // QR Code 尺寸
    const qrSize = 140 * scale

    // 文字設定
    const titleFontSize = 19 * scale
    const titleMarginTop = 24 * scale
    const subtitleFontSize = 13 * scale
    const subtitleMarginTop = 8 * scale

    // 按鈕設定
    const btnHeight = 40 * scale
    const btnRadius = 10 * scale
    const btnFontSize = 15 * scale
    const btnMarginTop = 25 * scale

    // 計算總高度
    const titleHeight = titleFontSize * 1.2
    const subtitleHeight = subtitleFontSize * 1.2
    const cardHeight = bodyPaddingTop + qrSize + titleMarginTop + titleHeight +
                       subtitleMarginTop + subtitleHeight + btnMarginTop +
                       btnHeight + footerPaddingBottom

    // 建立 Canvas
    const canvas = document.createElement('canvas')
    canvas.width = cardWidth
    canvas.height = cardHeight
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('無法創建 Canvas 2D 上下文')
    }

    // 輔助函數：繪製圓角矩形
    const drawRoundedRect = (
      x: number, y: number, w: number, h: number, r: number
    ) => {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
    }

    // 1. 繪製卡片背景 (白色 + 圓角 + 陰影)
    // 先繪製陰影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'
    ctx.shadowBlur = 12 * scale
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 4 * scale

    ctx.fillStyle = '#FFFFFF'
    drawRoundedRect(0, 0, cardWidth, cardHeight, borderRadius)
    ctx.fill()

    // 關閉陰影
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    // 2. 載入並繪製 QR Code
    const qrImg = new window.Image()
    await new Promise<void>((resolve, reject) => {
      qrImg.onload = () => resolve()
      qrImg.onerror = () => reject(new Error('QR Code 圖片載入失敗'))
      qrImg.src = qrCodeDataUrl
    })

    // QR Code 位置 (置中)
    const qrX = (cardWidth - qrSize) / 2
    const qrY = bodyPaddingTop
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

    // 3. 繪製標題 (團隊名稱)
    ctx.fillStyle = '#000000'
    ctx.font = `600 ${titleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const titleY = qrY + qrSize + titleMarginTop
    ctx.fillText(teamName, cardWidth / 2, titleY)

    // 4. 繪製副標題
    ctx.fillStyle = '#8E8E93'
    ctx.font = `400 ${subtitleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

    const subtitleY = titleY + titleHeight + subtitleMarginTop
    ctx.fillText('掃描加入 LINE 官方帳號', cardWidth / 2, subtitleY)

    // 5. 繪製按鈕
    const btnWidth = cardWidth - (footerPaddingX * 2)
    const btnX = footerPaddingX
    const btnY = subtitleY + subtitleHeight + btnMarginTop

    // 按鈕背景
    ctx.fillStyle = '#F2F2F7'
    drawRoundedRect(btnX, btnY, btnWidth, btnHeight, btnRadius)
    ctx.fill()

    // 按鈕文字
    ctx.fillStyle = '#007AFF'
    ctx.font = `600 ${btnFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('掃描 QR Code 加入', cardWidth / 2, btnY + btnHeight / 2)

    // 轉換為 PNG 並下載
    const pngDataUrl = canvas.toDataURL('image/png', 1.0)
    const link = document.createElement('a')
    link.href = pngDataUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showSuccess('QR Code 卡片已下載')
  } catch (error) {
    console.error('QR Code 下載失敗:', error)
    showError('QR Code 下載失敗，請稍後再試')
  }
}

const copyLineUrl = async () => {
  if (!currentQRCode.value?.lineUrl) {return}

  try {
    await navigator.clipboard.writeText(currentQRCode.value.lineUrl)
    urlCopied.value = true
    showSuccess('連結已複製到剪貼簿')
    setTimeout(() => {
      urlCopied.value = false
    }, 2000)
  } catch (error) {
    console.error('複製失敗:', error)
    showError('複製連結失敗')
  }
}

const handleQRImageError = () => {
  console.error('QR Code 圖片載入失敗')
}

// 監聯 team 變化，重置 modal 狀態
watch(() => props.team.id, () => {
  showModal.value = false
  members.value = []
  showAddMemberModal.value = false
  currentQRCode.value = null
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

/* QR Code Section Styles */
.qr-code-section {
  margin-top: 28px;
  margin-bottom: 0;
}

.qr-code-section .section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-title-group {
  display: flex;
  align-items: center;
}

.qr-code-section h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #1e293b;
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0;
}

.section-icon {
  color: #667eea;
}

.qr-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.qr-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 2px dashed #cbd5e1;
  border-radius: 16px;
  text-align: center;
}

.empty-qr-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea20, #764ba220);
  border-radius: 20px;
  margin-bottom: 16px;
  color: #667eea;
}

.qr-empty-state p {
  color: #475569;
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.empty-hint {
  color: #94a3b8;
  font-size: 0.875rem;
  max-width: 300px;
  line-height: 1.5;
}

.qr-display {
  animation: fadeInUp 0.3s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Flex Layout for QR Display */
.qr-flex-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

/* ============================================
   Flex Bubble Card - QRcodeDesign.html Style
   ============================================ */
.flex-bubble {
  background-color: #FFFFFF;
  width: 260px;
  min-width: 260px;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  text-align: center;
  flex-shrink: 0;
}

.bubble-body {
  padding: 35px 30px 20px 30px;
}

.bubble-footer {
  padding: 0 20px 20px 20px;
}

/* QR Code Image - The Hero */
.qr-image-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
}

.qr-image {
  width: 140px;
  height: 140px;
  margin: 0 auto;
  display: block;
  object-fit: contain;
}

/* Typography - iOS/Apple Style */
.bubble-title {
  color: #000000;
  font-size: 19px;
  font-weight: 600;
  margin-top: 24px;
  margin-bottom: 0;
  letter-spacing: -0.5px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.bubble-subtitle {
  color: #8E8E93;
  font-size: 13px;
  margin-top: 8px;
  margin-bottom: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* Footer Button - iOS Secondary Style */
.bubble-btn {
  display: block;
  width: 100%;
  text-decoration: none;
  line-height: 40px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 10px;
  background-color: #F2F2F7;
  color: #007AFF;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.bubble-btn:hover {
  background-color: #E5E5EA;
}

.bubble-btn:active {
  background-color: #D1D1D6;
}

.qr-info-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  overflow: hidden;
}

.qr-info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.qr-info-header h4 {
  color: #1e293b;
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qr-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-icon-sm {
  width: 32px;
  height: 32px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #64748b;
  flex-shrink: 0;
}

.btn-icon-sm:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #475569;
  transform: translateY(-1px);
}

.btn-icon-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.url-display {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  min-width: 0;
  overflow: hidden;
}

.url-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
}

.url-label {
  color: #94a3b8;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.url-value {
  color: #475569;
  font-size: 0.8125rem;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  background: none;
  padding: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.btn-copy {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  border: 1px solid #667eea;
  background: linear-gradient(135deg, #667eea10, #764ba210);
  color: #667eea;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-copy:hover {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-copy.copied {
  background: linear-gradient(135deg, #10b981, #059669);
  border-color: #10b981;
  color: white;
}

.qr-stats-mini {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.qr-stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  min-width: 0;
  overflow: hidden;
}

.qr-stat-label {
  color: #94a3b8;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.qr-stat-value {
  color: #1e293b;
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qr-stat-max {
  color: #94a3b8;
  font-weight: 500;
}

/* ============================================
   QR Code Section Responsive - RWD
   ============================================ */

/* Tablet: Stack vertically */
@media (max-width: 768px) {
  .qr-flex-layout {
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .flex-bubble {
    width: 100%;
    max-width: 300px;
    min-width: auto;
  }

  .qr-info-panel {
    width: 100%;
  }
}

/* Mobile */
@media (max-width: 640px) {
  .qr-flex-layout {
    gap: 16px;
  }

  .flex-bubble {
    width: 100%;
    max-width: 280px;
    border-radius: 16px;
  }

  .bubble-body {
    padding: 28px 24px 16px 24px;
  }

  .bubble-footer {
    padding: 0 16px 16px 16px;
  }

  .qr-image {
    width: 120px;
    height: 120px;
  }

  .bubble-title {
    font-size: 17px;
    margin-top: 20px;
  }

  .bubble-subtitle {
    font-size: 12px;
    margin-top: 6px;
  }

  .bubble-btn {
    font-size: 14px;
    line-height: 36px;
  }

  .qr-info-panel {
    width: 100%;
  }

  .qr-info-header {
    flex-direction: column;
    gap: 10px;
    align-items: center;
  }

  .qr-info-header h4 {
    text-align: center;
  }

  .url-display {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .btn-copy {
    justify-content: center;
  }

  .qr-stats-mini {
    grid-template-columns: 1fr 1fr;
  }
}

/* Small Mobile */
@media (max-width: 375px) {
  .flex-bubble {
    max-width: 100%;
    border-radius: 14px;
  }

  .bubble-body {
    padding: 24px 20px 14px 20px;
  }

  .bubble-footer {
    padding: 0 14px 14px 14px;
  }

  .qr-image {
    width: 110px;
    height: 110px;
  }

  .bubble-title {
    font-size: 16px;
    margin-top: 18px;
  }

  .bubble-subtitle {
    font-size: 11px;
  }

  .bubble-btn {
    font-size: 13px;
    line-height: 34px;
    border-radius: 8px;
  }

  .qr-stats-mini {
    grid-template-columns: 1fr;
  }
}
</style>