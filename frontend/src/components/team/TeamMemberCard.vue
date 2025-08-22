<template>
  <div 
    class="member-card"
    :class="{ 'modal-open': showEditModal }"
  >
    <div 
      class="member-info"
      @click="openEditModal"
    >
      <div class="member-avatar">
        <img 
          v-if="member.avatar" 
          :src="member.avatar" 
          :alt="member.name"
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
    <div class="member-actions">
      <select 
        :value="member.role"
        :disabled="isCurrentUser || loading"
        class="role-select"
        @change="$emit('updateRole', member.id, ($event.target as HTMLSelectElement).value)"
      >
        <option value="agent">
          客服
        </option>
        <option value="admin">
          管理員
        </option>
      </select>
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
              <label for="editPassword">密碼</label>
              <div class="password-input-wrapper">
                <input
                  id="editPassword"
                  v-model="editForm.password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="請輸入新密碼"
                  autocomplete="new-password"
                  :readonly="!showPassword && !isPasswordLoaded"
                  :disabled="passwordLoading"
                >
                <button
                  type="button"
                  class="password-toggle-btn"
                  :title="passwordLoading ? '加載中...' : (showPassword ? '隱藏密碼' : '顯示密碼')"
                  :disabled="passwordLoading"
                  @click="togglePasswordVisibility"
                >
                  {{ passwordLoading ? '⏳' : (showPassword ? '🙈' : '👁️') }}
                </button>
              </div>
              <small class="form-help-text">管理員可以查看和修改成員密碼</small>
            </div>
            <div class="form-group">
              <label for="editRole">角色</label>
              <select
                id="editRole"
                v-model="editForm.role"
                :disabled="isCurrentUser"
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
              <label for="editGroup">群組</label>
              <input
                id="editGroup"
                v-model="editForm.group"
                type="text"
                placeholder="請輸入群組名稱"
              >
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
import type { TeamMember } from '@/types'
import { teamApi } from '@/api/team'

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
  updateRole: [memberId: string, role: string]
  toggleStatus: [member: TeamMember]
  resetPassword: [member: TeamMember]
  removeMember: [member: TeamMember]
  editMember: [memberId: string, data: Partial<TeamMember>]
}>()

// Modal state
const showEditModal = ref(false)
const editLoading = ref(false)
const showPassword = ref(false)
const actualPassword = ref('')
const isPasswordLoaded = ref(false)
const passwordLoading = ref(false)

// Edit form data
const editForm = reactive({
  name: '',
  email: '',
  password: '',
  role: 'agent' as 'admin' | 'team' | 'agent',
  group: '',
  isActive: true
})

// Initialize form when modal opens
watch(() => showEditModal.value, (newVal) => {
  if (newVal) {
    editForm.name = props.member.name || ''
    editForm.email = props.member.email || ''
    editForm.password = '••••••••' // 顯示偽密碼
    editForm.role = props.member.role
    editForm.group = props.member.group || ''
    editForm.isActive = props.member.status === 'active'
    showPassword.value = false
    actualPassword.value = '' // 重置實際密碼
    isPasswordLoaded.value = false // 確保每次都重新加載
    passwordLoading.value = false
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
    const updateData: {
      name: string;
      email: string;
      role: 'admin' | 'team' | 'agent';
      group: string;
      status: 'active' | 'inactive';
      password?: string;
    } = {
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
      group: editForm.group,
      status: editForm.isActive ? 'active' as const : 'inactive' as const
    }
    
    // 只有當密碼已加載且與原始密碼不同時才包含密碼更新
    if (isPasswordLoaded.value && editForm.password !== actualPassword.value && editForm.password !== '••••••••') {
      updateData.password = editForm.password
    }
    
    const response = await teamApi.updateMember(props.member.id, updateData)
    
    if (response.success) {
      emit('editMember', props.member.id, updateData)
      closeEditModal()
    } else {
      console.error('更新成員失敗:', response.message)
      // 可以在這裡添加用戶友好的錯誤提示
    }
  } catch (error) {
    console.error('更新成員失敗:', error)
    // 可以在這裡添加用戶友好的錯誤提示
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

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleString('zh-TW')
}

// Password visibility toggle
const togglePasswordVisibility = async () => {
  if (!showPassword.value) {
    // 當要顯示密碼時，從API加載真實密碼
    if (!isPasswordLoaded.value && !passwordLoading.value) {
      passwordLoading.value = true
      
      try {
        const response = await teamApi.getMemberPassword(props.member.id)
        
        if (response.success && response.data) {
          actualPassword.value = response.data.password
          editForm.password = actualPassword.value
          isPasswordLoaded.value = true
          showPassword.value = true
        } else {
          console.error('Failed to load password:', response.message)
          editForm.password = '••••••••'
        }
      } catch (error) {
        console.error('Error loading password:', error)
        editForm.password = '••••••••'
      } finally {
        passwordLoading.value = false
      }
    } else if (isPasswordLoaded.value) {
      // 如果已經加載過，直接顯示
      editForm.password = actualPassword.value
      showPassword.value = true
    }
  } else {
    // 隱藏時回到偽密碼
    showPassword.value = false
    editForm.password = '••••••••'
  }
}
</script>

<style scoped>
.member-card {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all var(--transition-fast);
  position: relative;
}

.member-card:hover:not(.modal-open) {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}

.member-card.modal-open {
  /* Prevent hover effects when modal is open */
  transform: none;
  transition: none;
}

.member-info {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex: 1;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  border-radius: var(--radius-lg);
  padding: var(--space-2);
  margin: calc(-1 * var(--space-2));
}

.member-info:hover:not(.member-card.modal-open .member-info) {
  background-color: var(--gray-50);
}

.member-card.modal-open .member-info:hover {
  background-color: transparent;
}

.member-avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  overflow: hidden;
  flex-shrink: 0;
}

.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.125rem;
}

.member-details h3 {
  margin: 0 0 var(--space-1) 0;
  color: var(--gray-900);
  font-size: 1rem;
  font-weight: 600;
}

.member-details .email {
  margin: 0 0 var(--space-2) 0;
  color: var(--gray-600);
  font-size: 0.875rem;
}

.member-meta {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
}

.role,
.status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.role.admin {
  background: #fef3c7;
  color: #92400e;
}

.role.team {
  background: #f3e8ff;
  color: #7c3aed;
}

.role.agent {
  background: #dbeafe;
  color: #1e40af;
}

.status.active {
  background: #d1fae5;
  color: #065f46;
}

.status.inactive {
  background: #fee2e2;
  color: #991b1b;
}

.status.pending {
  background: #fef3c7;
  color: #92400e;
}

.last-login {
  font-size: 12px;
  color: #9ca3af;
}

.member-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.role-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  min-width: 120px;
}

.role-select:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 8px 12px;
  font-size: 13px;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #d97706;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
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
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  max-width: 500px;
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
.form-group select {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.form-group input:focus,
.form-group select:focus {
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

/* Form help text styling */
.form-help-text {
  display: block;
  margin-top: var(--space-1);
  color: var(--gray-500);
  font-size: 0.75rem;
  line-height: 1.4;
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

  .role-select {
    min-width: auto;
    flex: 1;
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

  .role-select {
    grid-column: 1 / -1;
  }
}
</style>