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
              管理團隊成員，控制系統存取權限
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
              @refresh="loadData"
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
            團隊成員 ({{ teamMembers.length }})
          </h2>
        </div>

        <!-- Content -->
        <div class="content-body">
          <LoadingSpinner
            v-if="loading"
            size="lg"
            text="載入成員中..."
          />

          <EmptyState
            v-else-if="teamMembers.length === 0"
            title="尚無團隊成員"
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
              @edit-member="editMember"
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
            <h2>新增團隊成員</h2>
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

const route = useRoute()
import type { TeamMember } from '@/types'
import AppLayout from '@/components/ui/AppLayout.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TeamMemberCard from '@/components/team/TeamMemberCard.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue'

// Icons
const PlusIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg>`
}


const UsersIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m22 21-3-3m0 0a2 2 0 0 0-3-3 2 2 0 0 0-3 3 2 2 0 0 0 3 3 2 2 0 0 0 3-3Z"/></svg>`
}

const UserCheckIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16,11 18,13 22,9"/></svg>`
}



const ShieldIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
}

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

// 載入數據
const loadData = async () => {
  await teamStore.loadMembers()
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
    showSuccess('新增成員成功', '已成功新增團隊成員')

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

// 編輯成員
const editMember = async (memberId: string, data: Partial<TeamMember>) => {
  try {
    await teamStore.updateMember(memberId, data)
  } catch (error) {
    console.error('編輯成員失敗:', error)
  }
}

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

// 監聽路由變化，確保TeamManagement頁面正確重新渲染
watch(() => route.path, (newPath, oldPath) => {
  console.log('🔄 TeamManagement: Route changed from', oldPath, 'to', newPath)
  
  // 如果路由到達TeamManagement頁面，確保數據刷新
  if (newPath === '/team') {
    console.log('🔄 TeamManagement: Refreshing data due to route change')
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
</style>