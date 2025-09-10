<template>
  <AppLayout>
    <div class="team-management">
      <!-- Header Section -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-info">
            <h1 class="page-title">
              團隊管理
            </h1>
            <p class="page-subtitle">
              管理系統人員與團隊設置，控制存取權限
            </p>
          </div>
          <div class="header-actions">
            <PrimaryActionButton
              text="新增成員"
              :icon="PlusIcon"
              :loading="loading"
              @click="showAddMemberModal = true"
            />
            <RefreshButton
              :loading="loading"
              @refresh="() => loadData(true)"
            />
          </div>
        </div>
      </div>

      <!-- Stats Overview -->
      <div class="stats-overview">
        <div class="stats-grid">
          <div class="stat-card members">
            <div class="stat-content">
              <div class="stat-number">
                {{ stats.totalMembers }}
              </div>
              <div class="stat-label">
                總成員數
              </div>
            </div>
            <div class="stat-icon">
              <UsersIcon />
            </div>
          </div>

          <div class="stat-card active">
            <div class="stat-content">
              <div class="stat-number">
                {{ stats.activeMembers }}
              </div>
              <div class="stat-label">
                活躍成員
              </div>
            </div>
            <div class="stat-icon">
              <UserCheckIcon />
            </div>
          </div>



          <div class="stat-card admins">
            <div class="stat-content">
              <div class="stat-number">
                {{ stats.adminCount }}
              </div>
              <div class="stat-label">
                管理員
              </div>
            </div>
            <div class="stat-icon">
              <ShieldIcon />
            </div>
          </div>
        </div>
      </div>

      <!-- Content Tabs -->
      <div class="content-section">
        <div class="content-header">
          <h2 class="content-title">
            <UsersIcon />
            人員管理 Staff Management ({{ teamMembers.length }})
          </h2>
        </div>

        <!-- Content -->
        <div class="content-body">
          <HamsterLoader
            v-if="loading"
            message="載入成員中..."
          />

          <EmptyState
            v-else-if="teamMembers.length === 0"
            title="尚無系統人員"
            description="新增第一位成員到您的團隊"
          >
            <template #icon>
              <UsersIcon />
            </template>
            <template #actions>
              <button
                class="btn btn-primary"
                @click="showAddMemberModal = true"
              >
                新增成員
              </button>
            </template>
          </EmptyState>

          <div
            v-else
            class="members-list"
          >
            <TeamMemberCard
              v-for="member in teamMembers"
              :key="member.id"
              :member="member"
              :current-user-id="currentAgent?.id"
              :loading="loading"
              @update-role="updateMemberRole"
              @toggle-status="toggleMemberStatus"
              @reset-password="resetMemberPassword"
              @remove-member="confirmRemoveMember"
            />
          </div>
        </div>
      </div>

      <!-- Teams Section -->
      <div class="content-section">
        <div class="content-header">
          <h2 class="content-title">
            <TeamsIcon />
            團隊設置 Team Settings ({{ teams.length }})
          </h2>
          <div class="header-actions">
            <PrimaryActionButton
              text="新增團隊"
              :icon="PlusIcon"
              :loading="loading"
              @click="showAddTeamModal = true"
            />
          </div>
        </div>

        <!-- Content -->
        <div class="content-body">
          <HamsterLoader
            v-if="loading"
            message="載入團隊中..."
          />

          <EmptyState
            v-else-if="teams.length === 0"
            title="尚無團隊"
            description="建立第一個團隊來管理客服人員"
          >
            <template #icon>
              <TeamsIcon />
            </template>
            <template #actions>
              <button
                class="btn btn-primary"
                @click="showAddTeamModal = true"
              >
                新增團隊
              </button>
            </template>
          </EmptyState>

          <div
            v-else
            class="teams-list"
          >
            <TeamCard
              v-for="team in teams"
              :key="team.id"
              :team="team"
              :loading="loading"
              @edit-team="editTeam"
              @toggle-status="toggleTeamStatus"
              @generate-qr="generateTeamQR"
              @remove-team="confirmRemoveTeam"
            />
          </div>
        </div>
      </div>

      <!-- 新增成員模態框 -->
      <div
        v-if="showAddMemberModal"
        class="modal-overlay"
      >
        <div
          class="modal"
          @click.stop
        >
          <div class="modal-header">
            <h2>新增系統人員</h2>
            <button
              class="close-btn"
              @click="closeAddMemberModal"
            >
              &times;
            </button>
          </div>
          <form
            class="modal-body"
            @submit.prevent="submitAddMember"
          >
            <div class="form-group">
              <label for="email">電子郵件 *</label>
              <input
                id="email"
                v-model="addMemberForm.email"
                type="email"
                required
                placeholder="請輸入電子郵件地址"
              >
            </div>
            <div class="form-group">
              <label for="name">姓名</label>
              <input
                id="name"
                v-model="addMemberForm.name"
                type="text"
                placeholder="請輸入成員姓名（中英文）"
                pattern="[a-zA-Z\u4e00-\u9fa5\s]*"
                title="請輸入中文或英文字符"
              >
            </div>
            <div class="form-group">
              <label for="password">密碼 *</label>
              <div class="password-input-wrapper">
                <input
                  id="password"
                  v-model="addMemberForm.password"
                  :type="showAddPassword ? 'text' : 'password'"
                  required
                  placeholder="請輸入初始密碼"
                  minlength="6"
                >
                <button
                  type="button"
                  class="password-toggle-btn"
                  :title="showAddPassword ? '隱藏密碼' : '顯示密碼'"
                  @click="toggleAddPasswordVisibility"
                >
                  {{ showAddPassword ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>
            <div class="form-group">
              <label for="role">角色 *</label>
              <select
                id="role"
                v-model="addMemberForm.role"
                required
              >
                <option value="agent">
                  客服
                </option>
                <option value="team">
                  團隊負責人
                </option>
                <option value="admin">
                  管理員
                </option>
              </select>
            </div>
            <div class="form-group">
              <label for="group">群組 (可選)</label>
              <input
                id="group"
                v-model="addMemberForm.group"
                type="text"
                placeholder="請輸入群組名稱"
              >
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  v-model="addMemberForm.isActive"
                  type="checkbox"
                >
                立即啟用帳戶
              </label>
            </div>
            <div class="modal-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click="closeAddMemberModal"
              >
                取消
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="addMemberLoading"
              >
                {{ addMemberLoading ? '新增中...' : '新增成員' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- 重設密碼模態框 -->
      <div
        v-if="showPasswordResetModal"
        class="modal-overlay"
      >
        <div
          class="modal password-reset-modal"
          @click.stop
        >
          <button
            class="close-btn modal-close"
            @click="closePasswordResetModal"
          >
            &times;
          </button>
          <div class="modal-icon">
            <div class="icon-container">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
              >
                <rect
                  x="3"
                  y="11"
                  width="18"
                  height="10"
                  rx="2"
                  ry="2"
                  stroke="white"
                  stroke-width="2"
                  fill="none"
                />
                <circle
                  cx="12"
                  cy="16"
                  r="1"
                  fill="white"
                />
                <path
                  d="m7 11V7a5 5 0 0 1 10 0v4"
                  stroke="white"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
          
          <form 
            class="modal-content" 
            @submit.prevent="submitPasswordReset"
          >
            <h3 class="modal-title">
              重設密碼
            </h3>
            <p class="modal-subtitle">
              為 {{ passwordResetMember?.name || passwordResetMember?.loginId }} 設定新密碼
            </p>
            
            <div class="form-group">
              <label for="newPassword">新密碼 *</label>
              <input
                id="newPassword"
                v-model="passwordResetForm.newPassword"
                type="password"
                required
                placeholder="請輸入新密碼"
                minlength="6"
                class="password-input"
              >
              <small class="form-hint">密碼至少需要 6 個字符</small>
            </div>

            <div class="form-group">
              <label for="confirmPassword">確認密碼 *</label>
              <input
                id="confirmPassword"
                v-model="passwordResetForm.confirmPassword"
                type="password"
                required
                placeholder="請再次輸入新密碼"
                class="password-input"
              >
              <div 
                v-if="passwordMismatch" 
                class="error-message"
              >
                密碼不一致
              </div>
            </div>

            <div class="form-group">
              <label class="section-label">密碼政策</label>
              <div class="password-policy-options">
                <label class="radio-option">
                  <input
                    v-model="passwordResetForm.policy"
                    type="radio"
                    value="changeable"
                  >
                  <span class="radio-text">
                    <strong>可更改</strong>
                    <small>用戶可以自行更改此密碼</small>
                  </span>
                </label>
                
                <label class="radio-option">
                  <input
                    v-model="passwordResetForm.policy"
                    type="radio"
                    value="unchangeable"
                  >
                  <span class="radio-text">
                    <strong>不可更改</strong>
                    <small>用戶無法更改此密碼</small>
                  </span>
                </label>
                
                <label class="radio-option">
                  <input
                    v-model="passwordResetForm.policy"
                    type="radio"
                    value="must_change"
                  >
                  <span class="radio-text">
                    <strong>登入時必須更改</strong>
                    <small>用戶首次登入時必須設定新密碼</small>
                  </span>
                </label>
              </div>
            </div>
          </form>
          
          <div class="modal-actions">
            <button
              type="button"
              class="btn-modern btn-secondary"
              @click="closePasswordResetModal"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
              取消
            </button>
            <button
              type="button"
              class="btn-modern btn-primary"
              :disabled="!isPasswordFormValid || passwordResetLoading"
              @click="submitPasswordReset"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              {{ passwordResetLoading ? '設定中...' : '設定密碼' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 新增團隊模態框 -->
      <div
        v-if="showAddTeamModal"
        class="modal-overlay"
      >
        <div
          class="modal"
          @click.stop
        >
          <div class="modal-header">
            <h2>新增團隊</h2>
            <button
              class="close-btn"
              @click="closeAddTeamModal"
            >
              &times;
            </button>
          </div>
          <form
            class="modal-body"
            @submit.prevent="submitAddTeam"
          >
            <div class="form-group">
              <label for="teamName">團隊名稱 *</label>
              <input
                id="teamName"
                v-model="addTeamForm.name"
                type="text"
                required
                placeholder="請輸入團隊名稱"
              >
            </div>
            <div class="form-group">
              <label for="teamDescription">團隊描述</label>
              <textarea
                id="teamDescription"
                v-model="addTeamForm.description"
                rows="3"
                placeholder="請輸入團隊描述（可選）"
              />
            </div>
            <div class="form-group">
              <label>團隊成員 (可選)</label>
              <div class="member-selection">
                <div class="member-selection-header">
                  <span class="selection-count">{{ addTeamForm.selectedMembers.length }} / {{ availableMembers.length }} 已選擇</span>
                  <button
                    type="button"
                    class="btn-link"
                    @click="toggleSelectAllMembers"
                  >
                    {{ isAllMembersSelected ? '取消全選' : '全選' }}
                  </button>
                </div>
                <div class="member-grid">
                  <div
                    v-for="member in availableMembers"
                    :key="member.id"
                    class="member-card"
                    :class="{ 'selected': addTeamForm.selectedMembers.includes(member.id) }"
                    @click="toggleMemberSelection(member.id)"
                  >
                    <div class="member-avatar">
                      <div class="avatar-circle">
                        {{ getInitials(member.name || member.loginId) }}
                      </div>
                      <div class="selection-indicator">
                        <CheckIcon />
                      </div>
                    </div>
                    
                    <div class="member-details">
                      <div class="member-name">
                        {{ member.name || member.loginId }}
                      </div>
                      <div
                        class="member-role-badge"
                        :class="`role-${member.role}`"
                      >
                        {{ getRoleDisplayName(member.role) }}
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  v-if="availableMembers.length === 0"
                  class="no-members"
                >
                  無可用成員
                </div>
              </div>
            </div>
            <div class="modal-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click="closeAddTeamModal"
              >
                取消
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="addTeamLoading"
              >
                {{ addTeamLoading ? '新增中...' : '新增團隊' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- 編輯團隊模態框 -->
      <div
        v-if="showEditTeamModal"
        class="modal-overlay"
      >
        <div
          class="modal"
          @click.stop
        >
          <div class="modal-header">
            <h2>編輯團隊</h2>
            <button
              class="close-btn"
              @click="closeEditTeamModal"
            >
              &times;
            </button>
          </div>
          <form
            class="modal-body"
            @submit.prevent="submitEditTeam"
          >
            <div class="form-group">
              <label for="editTeamName">團隊名稱 *</label>
              <input
                id="editTeamName"
                v-model="editTeamForm.name"
                type="text"
                required
                placeholder="請輸入團隊名稱"
              >
            </div>
            <div class="form-group">
              <label for="editTeamDescription">團隊描述</label>
              <textarea
                id="editTeamDescription"
                v-model="editTeamForm.description"
                rows="3"
                placeholder="請輸入團隊描述（可選）"
              />
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  v-model="editTeamForm.isActive"
                  type="checkbox"
                >
                啟用團隊
              </label>
            </div>
            <div class="modal-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click="closeEditTeamModal"
              >
                取消
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="editTeamLoading"
              >
                {{ editTeamLoading ? '更新中...' : '更新團隊' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- QR 碼顯示模態框 -->
      <div
        v-if="showQRModal"
        class="modal-overlay"
        @click="closeQRModal"
      >
        <div
          class="modal qr-modal"
          @click.stop
        >
          <div class="modal-header">
            <h2>團隊 QR 碼</h2>
            <button
              class="close-btn"
              @click="closeQRModal"
            >
              &times;
            </button>
          </div>
          <div class="modal-body qr-content">
            <div class="qr-display">
              <img
                v-if="currentQRCode"
                :src="currentQRCode"
                alt="Team QR Code"
                class="qr-image"
                style="width: 100%; height: 100%; object-fit: contain;"
                loading="lazy"
              >
              <HamsterLoader
                v-else
                message="生成 QR 碼中..."
              />
            </div>
            <p class="qr-description">
              掃描此 QR 碼可快速加入團隊 {{ currentTeam?.name }}
            </p>
            <div class="modal-actions">
              <button
                type="button"
                class="btn btn-primary"
                @click="closeQRModal"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 其他確認操作模態框 -->
      <div
        v-if="showConfirmModal"
        class="modal-overlay"
      >
        <div
          class="modal simple-confirm-modal"
          @click.stop
        >
          <div class="confirm-icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="#f59e0b"
                stroke-width="2"
                fill="#fef3c7"
              />
              <path
                d="M12 8v4"
                stroke="#f59e0b"
                stroke-width="2"
                stroke-linecap="round"
              />
              <path
                d="m12 16 .01 0"
                stroke="#f59e0b"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </div>
          <div class="confirm-content">
            <h3 class="confirm-title">
              確認操作
            </h3>
            <p class="confirm-message">
              {{ confirmMessage }}
            </p>
          </div>
          <div class="confirm-actions">
            <button
              class="btn-modern btn-cancel"
              @click="closeConfirmModal"
            >
              取消
            </button>
            <button
              class="btn-modern btn-confirm"
              @click="confirmAction"
            >
              確認
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables'
import { useTeamStore } from '@/stores/team'
import { useToast } from '@/composables/useToast'
import { teamApi } from '@/api/team'

const route = useRoute()
import type { TeamMember } from '@/types'
import AppLayout from '@/components/ui/AppLayout.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TeamMemberCard from '@/components/team/TeamMemberCard.vue'
import TeamCard from '@/components/team/TeamCard.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue'
import PlusIcon from '@/components/icons/PlusIcon.vue'
import UsersIcon from '@/components/icons/UsersIcon.vue'
import UserCheckIcon from '@/components/icons/UserCheckIcon.vue'
import ShieldIcon from '@/components/icons/ShieldIcon.vue'
import TeamsIcon from '@/components/icons/TeamsIcon.vue'
import CheckIcon from '@/components/icons/CheckIcon.vue'

// Icons are now imported from separate .vue files

// 組合式函數
const { currentAgent } = useAuth()
const { showSuccess, showError } = useToast()
// const { 
//   inviteMember, 
//   updateMemberStatus, 
//   deleteMember, 
//   revokeInvitation 
// } = useTeam()

// 響應式數據
const addMemberLoading = ref(false)
const showAddPassword = ref(false)

// Team interface
interface Team {
  id: number
  name: string
  description?: string
  qrCode?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  memberCount?: number
}

// 團隊管理相關狀態
const teams = ref<Team[]>([])
const addTeamLoading = ref(false)
const editTeamLoading = ref(false)
const showAddTeamModal = ref(false)
const showEditTeamModal = ref(false)
const showQRModal = ref(false)
const currentQRCode = ref('')
const currentTeam = ref<Team | null>(null)

// 從 store 獲取數據
const teamStore = useTeamStore()
// Access computed properties from the store with System Administrator pinned to top
const teamMembers = computed(() => {
  const members = teamStore.members
  const systemAdmin = members.find(member => 
    member.role === 'admin' && (
      member.name?.includes('系統管理員') || 
      member.name?.includes('System Administrator') ||
      member.name?.toLowerCase().includes('admin') ||
      member.loginId === 'admin' ||
      member.email?.includes('admin')
    )
  )
  const otherMembers = members.filter(member => 
    !(member.role === 'admin' && (
      member.name?.includes('系統管理員') || 
      member.name?.includes('System Administrator') ||
      member.name?.toLowerCase().includes('admin') ||
      member.loginId === 'admin' ||
      member.email?.includes('admin')
    ))
  )
  
  return systemAdmin ? [systemAdmin, ...otherMembers] : members
})
const loading = computed(() => teamStore.loading)
const stats = computed(() => teamStore.stats)

// 模態框狀態
const showAddMemberModal = ref(false)
const showConfirmModal = ref(false)
const showPasswordResetModal = ref(false)
const passwordResetLoading = ref(false)
const passwordResetMember = ref<TeamMember | null>(null)

// 表單數據
const addMemberForm = reactive({
  loginId: '',
  name: '',
  email: '',
  password: '',
  role: 'agent' as 'admin' | 'team' | 'agent',
  group: '',
  isActive: true
})

// 密碼重設表單
const passwordResetForm = reactive({
  newPassword: '',
  confirmPassword: '',
  policy: 'changeable' as 'changeable' | 'unchangeable' | 'must_change'
})

// 團隊表單數據
const addTeamForm = reactive({
  name: '',
  description: '',
  selectedMembers: [] as string[] // 所選的成員 ID 列表
})

const editTeamForm = reactive({
  id: 0,
  name: '',
  description: '',
  isActive: true
})

// 確認操作
const confirmMessage = ref('')
const confirmCallback = ref<(() => void) | null>(null)

// 密碼驗證
const passwordMismatch = computed(() => {
  return passwordResetForm.newPassword && 
         passwordResetForm.confirmPassword && 
         passwordResetForm.newPassword !== passwordResetForm.confirmPassword
})

const isPasswordFormValid = computed(() => {
  return passwordResetForm.newPassword.length >= 6 && 
         passwordResetForm.confirmPassword && 
         !passwordMismatch.value &&
         passwordResetForm.policy
})

// 可用成員列表 (不包括已有團隊的成員)
const availableMembers = computed(() => {
  return teamMembers.value.filter(member => 
    // 不包括管理員和已有團隊的成員
    member.role !== 'admin' && !member.teamId
  )
})

// 是否全選所有成員
const isAllMembersSelected = computed(() => {
  return availableMembers.value.length > 0 && 
         addTeamForm.selectedMembers.length === availableMembers.value.length
})

// 切換全選狀態
const toggleSelectAllMembers = () => {
  if (isAllMembersSelected.value) {
    addTeamForm.selectedMembers = []
  } else {
    addTeamForm.selectedMembers = availableMembers.value.map(member => member.id)
  }
}

// 切換單個成員選擇狀態
const toggleMemberSelection = (memberId: string) => {
  const index = addTeamForm.selectedMembers.indexOf(memberId)
  if (index > -1) {
    addTeamForm.selectedMembers.splice(index, 1)
  } else {
    addTeamForm.selectedMembers.push(memberId)
  }
}

// 取得姓名首字母
const getInitials = (name: string): string => {
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

// 取得角色顯示名稱
const getRoleDisplayName = (role: string): string => {
  const roleMap: Record<string, string> = {
    admin: '管理員',
    team: '組長',
    agent: '客服'
  }
  return roleMap[role] || role
}

// 載入數據 - 添加快取機制避免不必要的重載
const lastLoadTime = ref<number>(0)
const CACHE_DURATION = 30 * 1000 // 30秒快取

const loadData = async (force = false) => {
  const now = Date.now()
  // 如果非強制刷新且在快取時間內，跳過載入
  if (!force && now - lastLoadTime.value < CACHE_DURATION) {
    console.log('📋 Using cached data, skipping reload')
    return
  }
  
  lastLoadTime.value = now
  await Promise.all([
    teamStore.loadMembers(),
    loadTeams()
  ])
}

// 載入團隊數據
const loadTeams = async () => {
  try {
    const response = await teamApi.getTeams(true) // Include inactive teams
    if (response.success && response.data) {
      teams.value = response.data
    }
  } catch (error) {
    console.error('載入團隊失敗:', error)
    showError('載入團隊失敗', '請檢查網路連線或稍後重試')
  }
}

// 新增成員
const submitAddMember = async () => {
  addMemberLoading.value = true
  try {
    // 使用email作為loginId
    const memberData = {
      ...addMemberForm,
      loginId: addMemberForm.email
    }
    await teamStore.addMember(memberData)

    // 成功提示
    showSuccess('新增成員成功', '已成功新增系統人員')

    // 重置表單
    Object.assign(addMemberForm, {
      loginId: '',
      name: '',
      email: '',
      password: '',
      role: 'agent' as 'admin' | 'team' | 'agent',
      group: '',
      isActive: true
    })

    closeAddMemberModal()
  } catch (error) {
    console.error('新增成員失敗:', error)
    // 顯示錯誤訊息給用戶
    const errorMessage = error instanceof Error ? error.message : '新增成員失敗，請稍後重試'
    showError('新增成員失敗', errorMessage)
  } finally {
    addMemberLoading.value = false
  }
}

// 關閉新增成員模態框
const closeAddMemberModal = () => {
  showAddMemberModal.value = false
  showAddPassword.value = false
  // 重置表單
  Object.assign(addMemberForm, {
    loginId: '',
    name: '',
    email: '',
    password: '',
    role: 'agent' as 'admin' | 'team' | 'agent',
    group: '',
    isActive: true
  })
}

// 密碼顯示/隱藏切換
const toggleAddPasswordVisibility = () => {
  showAddPassword.value = !showAddPassword.value
}

// 更新成員角色
const updateMemberRole = async (memberId: string, role: string) => {
  try {
    await teamStore.updateMemberRole(memberId, role as 'admin' | 'team' | 'agent')
  } catch (error) {
    console.error('更新角色失敗:', error)
  }
}

// 切換成員狀態
const toggleMemberStatus = async (member: TeamMember) => {
  const newStatus = member.status === 'active' ? 'inactive' : 'active'
  try {
    await teamStore.updateMemberStatus(member.id, newStatus)
  } catch (error) {
    console.error('更新狀態失敗:', error)
  }
}

// 重設密碼
const resetMemberPassword = async (member: TeamMember) => {
  passwordResetMember.value = member
  // 重置表單
  Object.assign(passwordResetForm, {
    newPassword: '',
    confirmPassword: '',
    policy: 'changeable'
  })
  showPasswordResetModal.value = true
}

// 提交密碼重設
const submitPasswordReset = async () => {
  if (!isPasswordFormValid.value || !passwordResetMember.value) {return}
  
  passwordResetLoading.value = true
  try {
    await teamStore.resetPasswordWithPolicy(passwordResetMember.value.id, {
      newPassword: passwordResetForm.newPassword,
      policy: passwordResetForm.policy
    })
    
    // 顯示成功訊息
    showSuccess(
      '密碼設定成功',
      `成功為 ${passwordResetMember.value.name || passwordResetMember.value.loginId} 設定新密碼`,
      {
        duration: 5000, // 5秒顯示時間
        actionText: '確定'
      }
    )
    closePasswordResetModal()
  } catch (error) {
    console.error('設定密碼失敗:', error)
    showError('設定密碼失敗', '請檢查網路連線或稍後重試')
  } finally {
    passwordResetLoading.value = false
  }
}

// 關閉密碼重設模態框
const closePasswordResetModal = () => {
  showPasswordResetModal.value = false
  passwordResetMember.value = null
  Object.assign(passwordResetForm, {
    newPassword: '',
    confirmPassword: '',
    policy: 'changeable'
  })
}

// 移除成員
const confirmRemoveMember = (member: TeamMember) => {
  confirmMessage.value = `確定要移除成員 ${member.name} 嗎？此操作無法撤銷。`
  confirmCallback.value = async () => {
    try {
      await teamStore.removeMember(member.id)
    } catch (error) {
      console.error('移除成員失敗:', error)
    }
  }
  showConfirmModal.value = true
}

// 編輯成員 - 現在由TeamMemberCard組件直接處理
// 這個函數已經不再需要，因為TeamMemberCard使用teamStore統一處理

// 模態框控制

const closeConfirmModal = () => {
  showConfirmModal.value = false
  confirmCallback.value = null
}

const confirmAction = () => {
  if (confirmCallback.value) {
    confirmCallback.value()
  }
  closeConfirmModal()
}

// 團隊管理函數
// 新增團隊
const submitAddTeam = async () => {
  addTeamLoading.value = true
  try {
    // 先建立團隊
    const response = await teamApi.createTeam({
      name: addTeamForm.name,
      description: addTeamForm.description
    })
    
    if (response.success && response.data) {
      const newTeamId = response.data.id
      
      // 如果有選擇成員，將他們加入團隊
      if (addTeamForm.selectedMembers.length > 0) {
        for (const memberId of addTeamForm.selectedMembers) {
          try {
            await teamStore.updateMember(memberId, { teamId: newTeamId })
          } catch (memberError) {
            console.error(`新增成員 ${memberId} 到團隊失敗:`, memberError)
          }
        }
      }
      
      showSuccess('新增團隊成功', `已成功建立團隊並加入 ${addTeamForm.selectedMembers.length} 位成員`)
      Object.assign(addTeamForm, { name: '', description: '', selectedMembers: [] })
      closeAddTeamModal()
      await Promise.all([loadTeams(), teamStore.loadMembers()])
    }
  } catch (error) {
    console.error('新增團隊失敗:', error)
    showError('新增團隊失敗', error instanceof Error ? error.message : '請稍後重試')
  } finally {
    addTeamLoading.value = false
  }
}

// 關閉新增團隊模態框
const closeAddTeamModal = () => {
  showAddTeamModal.value = false
  Object.assign(addTeamForm, { name: '', description: '', selectedMembers: [] })
}

// 編輯團隊
const editTeam = (team: Team) => {
  Object.assign(editTeamForm, {
    id: team.id,
    name: team.name,
    description: team.description || '',
    isActive: team.isActive
  })
  showEditTeamModal.value = true
}

// 提交編輯團隊
const submitEditTeam = async () => {
  editTeamLoading.value = true
  try {
    const { id, ...updateData } = editTeamForm
    const response = await teamApi.updateTeam(id, updateData)
    if (response.success) {
      showSuccess('更新團隊成功', '已成功更新團隊資訊')
      closeEditTeamModal()
      await loadTeams()
    }
  } catch (error) {
    console.error('更新團隊失敗:', error)
    showError('更新團隊失敗', error instanceof Error ? error.message : '請稍後重試')
  } finally {
    editTeamLoading.value = false
  }
}

// 關閉編輯團隊模態框
const closeEditTeamModal = () => {
  showEditTeamModal.value = false
  Object.assign(editTeamForm, { id: 0, name: '', description: '', isActive: true })
}

// 切換團隊狀態
const toggleTeamStatus = async (team: Team) => {
  try {
    const newStatus = !team.isActive
    const response = await teamApi.updateTeam(team.id, { isActive: newStatus })
    if (response.success) {
      showSuccess('團隊狀態更新成功', `已${newStatus ? '啟用' : '停用'}團隊`)
      await loadTeams()
    }
  } catch (error) {
    console.error('更新團隊狀態失敗:', error)
    showError('更新團隊狀態失敗', '請稍後重試')
  }
}

// 生成團隊 QR 碼
const generateTeamQR = async (team: Team) => {
  currentTeam.value = team
  currentQRCode.value = ''
  showQRModal.value = true
  
  try {
    console.log(`正在為團隊 ${team.id} 生成 QR 碼...`);
    const response = await teamApi.generateTeamQR(team.id, {
      campaignName: `${team.name} 專用 QR 碼`,
      description: `團隊 ${team.name} 的客服 QR 碼`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
    
    console.log('API 回應:', response);
    
    if (response.success && response.data) {
      currentQRCode.value = response.data.qrCode
      console.log('QR 碼生成成功:', response.data)
    } else {
      console.error('QR 碼生成失敗 - API 回應:', response)
      showError('QR 碼生成失敗', response.error || '未知錯誤')
    }
  } catch (error) {
    console.error('生成 QR 碼失敗:', error)
    showError('生成 QR 碼失敗', '請稍後重試')
    closeQRModal()
  }
}

// 關閉 QR 碼模態框
const closeQRModal = () => {
  showQRModal.value = false
  currentQRCode.value = ''
  currentTeam.value = null
}

// 確認刪除團隊
const confirmRemoveTeam = (team: Team) => {
  confirmMessage.value = `確定要刪除團隊 ${team.name} 嗎？此操作無法撤銷。`
  confirmCallback.value = async () => {
    try {
      const response = await teamApi.deleteTeam(team.id)
      if (response.success) {
        showSuccess('刪除團隊成功', '已成功刪除團隊')
        await loadTeams()
      }
    } catch (error) {
      console.error('刪除團隊失敗:', error)
      showError('刪除團隊失敗', '請稍後重試')
    }
  }
  showConfirmModal.value = true
}

// 監聽路由變化，只在真正需要時刷新數據
watch(() => route.path, (newPath, oldPath) => {
  // 只在從其他頁面首次進入團隊管理頁面時才刷新資料
  if (newPath === '/team' && oldPath && oldPath !== '/team') {
    console.log('🔄 TeamManagement: Entering from external page, refreshing data')
    loadData()
  }
}, { immediate: false })

// 生命週期
onMounted(() => {
  console.log('🚀 TeamManagement mounted')
  loadData()
})
</script>
<style scoped>
.team-management {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

/* Header Section */
.page-header {
  margin-bottom: var(--space-12);
  padding: var(--space-8) 0;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 100%;
}

.header-info {
  flex: 1;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--gray-900);
  margin-bottom: var(--space-2);
  letter-spacing: -0.025em;
}

.page-subtitle {
  font-size: 1rem;
  color: var(--gray-600);
  font-weight: 400;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

/* Stats Overview */
.stats-overview {
  margin-bottom: var(--space-12);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
}

.stat-card {
  background: white;
  border-radius: var(--radius-2xl);
  padding: var(--space-8);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--gray-200);
  transition: background-color var(--transition-fast);
}

.stat-card.members::before {
  background: linear-gradient(180deg, #3b82f6, #2563eb);
}

.stat-card.active::before {
  background: linear-gradient(180deg, #10b981, #059669);
}

.stat-card.admins::before {
  background: linear-gradient(180deg, #8b5cf6, #7c3aed);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--gray-900);
  margin-bottom: var(--space-1);
  line-height: 1;
}

.stat-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-xl);
  background: var(--gray-50);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gray-600);
  flex-shrink: 0;
}

/* Content Section */
.content-section {
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  overflow: hidden;
}

.content-header {
  padding: var(--space-6) var(--space-8);
  border-bottom: 1px solid var(--gray-200);
  background: var(--gray-25);
}

.content-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  color: var(--gray-900);
  font-size: 1.25rem;
  font-weight: 600;
}

.content-body {
  padding: var(--space-8);
}

/* Lists */
.members-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.teams-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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
  z-index: 1000;
  padding: var(--space-4);
}

.modal {
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6);
  border-bottom: 1px solid var(--gray-200);
}

.modal-header h2 {
  margin: 0;
  color: var(--gray-900);
  font-size: 1.25rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--gray-500);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.close-btn:hover {
  color: var(--gray-700);
  background-color: var(--gray-100);
}

.modal-body {
  padding: var(--space-6);
}

.form-group {
  margin-bottom: var(--space-5);
}

.form-group label {
  display: block;
  margin-bottom: var(--space-2);
  color: var(--gray-700);
  font-size: 0.875rem;
  font-weight: 500;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
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

/* Password Input Styling */
.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrapper input {
  padding-right: 3rem;
}

.password-toggle-btn {
  position: absolute;
  right: var(--space-3);
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  line-height: 1;
  color: var(--gray-500);
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
}

.password-toggle-btn:hover {
  background-color: var(--gray-100);
  color: var(--gray-700);
}

.password-toggle-btn:focus {
  outline: none;
  background-color: var(--gray-100);
  box-shadow: 0 0 0 2px rgb(59 130 246 / 0.2);
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  margin-top: var(--space-6);
}

.password-reset-modal {
  max-width: 520px;
  max-height: 90vh; /* 限制最大高度 */
  padding: 0;
  text-align: left;
  border: none;
  background: white;
  border-radius: var(--radius-3xl);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  position: relative;
  display: flex; /* 使用 Flexbox 佈局 */
  flex-direction: column; /* 垂直排列 */
}

.modal-close {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  z-index: 10;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-full);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: var(--gray-500);
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.modal-close:hover {
  background: white;
  color: var(--gray-700);
  border-color: var(--gray-300);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.simple-confirm-modal {
  max-width: 420px;
  padding: var(--space-8);
  text-align: center;
  border: none;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-icon {
  padding: var(--space-8) var(--space-8) var(--space-4);
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  flex-shrink: 0; /* 確保圖標區域不會被壓縮 */
}

.icon-container {
  width: 64px;
  height: 64px;
  margin: 0 auto;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 25px -8px rgba(99, 102, 241, 0.4);
}

.icon-container svg {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.icon-container svg path,
.icon-container svg rect,
.icon-container svg circle {
  stroke: white;
  fill: white;
}

.modal-content {
  padding: var(--space-4) var(--space-8) var(--space-6);
  flex: 1; /* 讓內容區塊填滿可用空間 */
  overflow-y: auto; /* 內容可滾動 */
  min-height: 0; /* 允許 flex item 縮小 */
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 var(--space-3) 0;
  letter-spacing: -0.025em;
}

.modal-subtitle {
  font-size: 1rem;
  color: var(--gray-600);
  line-height: 1.6;
  margin: 0 0 var(--space-5) 0;
}

.warning-notice {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  color: #92400e;
  font-weight: 500;
}

.warning-notice svg {
  flex-shrink: 0;
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-8) var(--space-8);
  justify-content: center;
  flex-shrink: 0; /* 確保按鈕區域不會被壓縮 */
  border-top: 1px solid var(--gray-100); /* 添加分隔線 */
  background: white; /* 確保背景不透明 */
}

.btn-modern {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 120px;
  justify-content: center;
}

.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
  border: 1px solid var(--gray-200);
}

.btn-secondary:hover {
  background: var(--gray-200);
  border-color: var(--gray-300);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
}

/* Password Reset Form Styles */
.password-input {
  font-family: monospace;
  letter-spacing: 0.5px;
}

.form-hint {
  display: block;
  margin-top: var(--space-1);
  font-size: 0.75rem;
  color: var(--gray-500);
}

.error-message {
  display: block;
  margin-top: var(--space-1);
  font-size: 0.75rem;
  color: #ef4444;
  font-weight: 500;
}

.section-label {
  display: block;
  margin-bottom: var(--space-4);
  color: var(--gray-900);
  font-size: 0.875rem;
  font-weight: 600;
}

.password-policy-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.radio-option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.radio-option:hover {
  border-color: var(--gray-300);
  background-color: var(--gray-25);
}

.radio-option input[type="radio"]:checked + .radio-text {
  color: var(--gray-900);
}

.radio-option:has(input[type="radio"]:checked) {
  border-color: #6366f1;
  background-color: #f0f9ff;
}

.radio-option input[type="radio"] {
  margin: 0;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

.radio-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  color: var(--gray-700);
}

.radio-text strong {
  font-weight: 600;
  color: var(--gray-900);
}

.radio-text small {
  font-size: 0.75rem;
  color: var(--gray-500);
  font-weight: 400;
}

/* Simple Confirm Modal Styles */
.confirm-icon {
  margin-bottom: var(--space-6);
  display: flex;
  justify-content: center;
}

.confirm-content {
  margin-bottom: var(--space-8);
}

.confirm-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-3) 0;
}

.confirm-message {
  font-size: 1rem;
  color: var(--gray-600);
  line-height: 1.6;
  margin: 0;
}

/* Member Selection Styles */
.member-selection {
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.member-selection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--gray-100);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
}

.selection-count {
  font-size: 0.875rem;
  color: var(--gray-700);
  font-weight: 600;
}

.btn-link {
  background: var(--gray-900);
  border: none;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.btn-link:hover {
  background: black;
  color: white;
}

/* Modern Member Grid Design */
.member-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
  max-height: 400px;
  overflow-y: auto;
  padding: var(--space-2);
}

.member-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: white;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-normal);
  box-shadow: none;
}

.member-card:hover {
  border-color: var(--gray-500);
  background: var(--gray-50);
  transform: none;
  box-shadow: none;
}

.member-card.selected {
  border-color: var(--gray-900);
  background: var(--gray-50);
  box-shadow: 0 0 0 1px var(--gray-900);
}

.member-avatar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-circle {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background: var(--gray-200);
  color: var(--gray-700);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
  letter-spacing: -0.025em;
}

.selection-indicator {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0);
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.member-card.selected .selection-indicator {
  opacity: 1;
  transform: scale(1);
}

.selection-indicator svg {
  width: 18px;
  height: 18px;
}

/* 極簡邊框增強 */
.member-card.selected .selection-indicator svg circle {
  stroke: var(--gray-100);
  stroke-width: 1;
}

.member-details {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-weight: 700;
  color: black;
  font-size: 0.875rem;
  margin-bottom: var(--space-1);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-role-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.member-role-badge.role-admin {
  background: black;
  color: white;
  border: 1px solid black;
}

.member-role-badge.role-team {
  background: var(--gray-700);
  color: white;
  border: 1px solid var(--gray-700);
}

.member-role-badge.role-agent {
  background: var(--gray-200);
  color: var(--gray-800);
  border: 1px solid var(--gray-400);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .member-grid {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }
  
  .member-card {
    padding: var(--space-3);
  }
  
  .avatar-circle {
    width: 40px;
    height: 40px;
    font-size: 0.875rem;
  }
}

.no-members {
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: var(--gray-500);
  font-size: 0.875rem;
}

.confirm-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

.btn-cancel {
  background: var(--gray-100);
  color: var(--gray-700);
}

.btn-cancel:hover {
  background: var(--gray-200);
  transform: translateY(-1px);
}

.btn-confirm {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.btn-confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .team-management {
    padding: var(--space-4) var(--space-3);
  }

  .header-content {
    flex-direction: column;
    text-align: center;
    gap: var(--space-6);
  }

  .page-title {
    font-size: 2rem;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-4);
  }
}

@media (max-width: 768px) {
  .team-management {
    padding: var(--space-3) var(--space-2);
  }

  .page-title {
    font-size: 1.75rem;
  }

  .stat-card {
    padding: var(--space-6);
  }

  .stat-number {
    font-size: 2rem;
  }

  .content-header {
    padding: var(--space-4) var(--space-6);
  }

  .content-body {
    padding: var(--space-6);
  }

  .modal {
    margin: var(--space-2);
    max-width: none;
  }

  .modal-actions {
    flex-direction: column;
  }
}

@media (max-width: 640px) {
  .header-actions {
    flex-direction: column;
    width: 100%;
    gap: var(--space-3);
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .content-header {
    padding: var(--space-3) var(--space-4);
  }

  .content-title {
    font-size: 1.125rem;
  }

  .content-body {
    padding: var(--space-4);
  }

  .password-reset-modal {
    max-width: 350px;
    margin: var(--space-4);
    max-height: 85vh; /* 確保不會太高 */
    display: flex;
    flex-direction: column;
  }

  .simple-confirm-modal {
    max-width: 350px;
    margin: var(--space-4);
    padding: var(--space-6);
  }

  .modal-icon {
    padding: var(--space-6) var(--space-6) var(--space-3);
    flex-shrink: 0; /* 確保圖標區域不會被壓縮 */
  }

  .icon-container {
    width: 56px;
    height: 56px;
  }

  .modal-content {
    padding: var(--space-3) var(--space-6) var(--space-4);
    flex: 1; /* 讓內容區塊填滿可用空間 */
    overflow-y: auto; /* 內容可滾動 */
    min-height: 0; /* 允許 flex item 縮小 */
  }

  .modal-title {
    font-size: 1.25rem;
  }

  .modal-actions {
    flex-direction: column;
    padding: var(--space-4) var(--space-6) var(--space-6);
    flex-shrink: 0; /* 確保按鈕區域不會被壓縮 */
    border-top: 1px solid var(--gray-100); /* 添加分隔線 */
    background: white; /* 確保背景不透明 */
  }

  .btn-modern {
    min-width: 100%;
  }

  .password-policy-options {
    gap: var(--space-2);
  }

  .radio-option {
    padding: var(--space-2) var(--space-3);
  }

  .radio-text strong {
    font-size: 0.875rem;
  }

  .radio-text small {
    font-size: 0.7rem;
  }
}

/* QR Modal Styles */
.qr-modal {
  max-width: 400px;
  text-align: center;
}

.qr-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.qr-display {
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--gray-300);
  border-radius: var(--radius-xl);
  background: var(--gray-25);
}

.qr-image {
  max-width: 100%;
  max-height: 100%;
  border-radius: var(--radius-md);
}

.qr-description {
  color: var(--gray-600);
  font-size: 0.875rem;
  line-height: 1.6;
  margin: 0;
}

/* Team section header actions */
.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
}

.content-header .header-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

/* Reduced Motion Preference */
@media (prefers-reduced-motion: reduce) {
  .stat-card,
  .content-section,
  .btn,
  .btn-modern,
  .btn-primary,
  .btn-confirm,
  .btn-cancel,
  .modal,
  .team-card,
  .member-card {
    transition: none !important;
    transform: none !important;
  }

  .animate-spin {
    animation: none !important;
  }

  .slide-in-from-right {
    animation: none !important;
  }

  @keyframes spin {
    0%, 100% {
      transform: rotate(0deg);
    }
  }
}
</style>