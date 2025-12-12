<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="add-member-overlay"
        @click.self="handleClose"
        @keydown.esc="handleClose"
      >
        <div
          class="add-member-modal"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="modalTitleId"
        >
          <!-- Modal Header -->
          <div class="modal-header">
            <div class="header-content">
              <div class="header-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle
                    cx="9"
                    cy="7"
                    r="4"
                  />
                  <line
                    x1="19"
                    y1="8"
                    x2="19"
                    y2="14"
                  />
                  <line
                    x1="22"
                    y1="11"
                    x2="16"
                    y2="11"
                  />
                </svg>
              </div>
              <div class="header-text">
                <h2 :id="modalTitleId">
                  新增成員
                </h2>
                <p class="header-subtitle">
                  選擇要加入 <strong>{{ teamName }}</strong> 的成員
                </p>
              </div>
            </div>
            <button
              class="close-btn"
              aria-label="關閉"
              @click="handleClose"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line
                  x1="18"
                  y1="6"
                  x2="6"
                  y2="18"
                />
                <line
                  x1="6"
                  y1="6"
                  x2="18"
                  y2="18"
                />
              </svg>
            </button>
          </div>

          <!-- Search Bar -->
          <div class="search-section">
            <div class="search-wrapper">
              <svg
                class="search-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="8"
                />
                <line
                  x1="21"
                  y1="21"
                  x2="16.65"
                  y2="16.65"
                />
              </svg>
              <input
                ref="searchInput"
                v-model="searchQuery"
                type="text"
                class="search-input"
                placeholder="搜尋成員名稱或帳號..."
                @input="handleSearch"
              >
              <button
                v-if="searchQuery"
                class="clear-search"
                aria-label="清除搜尋"
                @click="clearSearch"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                  />
                  <line
                    x1="15"
                    y1="9"
                    x2="9"
                    y2="15"
                  />
                  <line
                    x1="9"
                    y1="9"
                    x2="15"
                    y2="15"
                  />
                </svg>
              </button>
            </div>
            <div class="search-stats">
              <span v-if="!loading && filteredMembers.length > 0">
                找到 <strong>{{ filteredMembers.length }}</strong> 位可用成員
              </span>
              <span v-else-if="!loading && searchQuery && filteredMembers.length === 0">
                沒有符合「{{ searchQuery }}」的成員
              </span>
            </div>
          </div>

          <!-- Members List -->
          <div class="members-section">
            <!-- Loading State -->
            <div
              v-if="loading"
              class="loading-state"
            >
              <div class="loading-spinner">
                <div class="spinner-ring" />
                <div class="spinner-ring" />
                <div class="spinner-ring" />
              </div>
              <span>載入可用成員中...</span>
            </div>

            <!-- Empty State -->
            <div
              v-else-if="filteredMembers.length === 0"
              class="empty-state"
            >
              <div class="empty-icon">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                  />
                  <path d="M8 15s1.5 2 4 2 4-2 4-2" />
                  <line
                    x1="9"
                    y1="9"
                    x2="9.01"
                    y2="9"
                  />
                  <line
                    x1="15"
                    y1="9"
                    x2="15.01"
                    y2="9"
                  />
                </svg>
              </div>
              <h3>{{ searchQuery ? '找不到符合的成員' : '沒有可新增的成員' }}</h3>
              <p>{{ searchQuery ? '請嘗試其他關鍵字' : '所有成員都已經在此團隊中了' }}</p>
            </div>

            <!-- Members Grid -->
            <div
              v-else
              class="members-grid"
            >
              <TransitionGroup name="member-list">
                <div
                  v-for="member in filteredMembers"
                  :key="member.id"
                  class="member-card"
                  :class="{ 'is-adding': addingMemberId === member.id }"
                >
                  <div
                    class="member-avatar"
                    :style="getAvatarStyle(member)"
                  >
                    {{ getInitials(member) }}
                  </div>
                  <div class="member-info">
                    <span class="member-name">{{ member.name || member.loginId }}</span>
                    <div class="member-meta">
                      <span
                        class="member-role"
                        :class="getRoleClass(member.role)"
                      >
                        {{ getRoleDisplayName(member.role) }}
                      </span>
                      <span
                        v-if="member.email"
                        class="member-email"
                      >{{ member.email }}</span>
                    </div>
                  </div>
                  <button
                    class="add-btn"
                    :disabled="addingMemberId === member.id"
                    @click="handleAddMember(member)"
                  >
                    <template v-if="addingMemberId === member.id">
                      <span class="btn-spinner" />
                      新增中
                    </template>
                    <template v-else>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                      >
                        <line
                          x1="12"
                          y1="5"
                          x2="12"
                          y2="19"
                        />
                        <line
                          x1="5"
                          y1="12"
                          x2="19"
                          y2="12"
                        />
                      </svg>
                      新增
                    </template>
                  </button>
                </div>
              </TransitionGroup>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer">
            <div class="footer-hint">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                />
                <line
                  x1="12"
                  y1="16"
                  x2="12"
                  y2="12"
                />
                <line
                  x1="12"
                  y1="8"
                  x2="12.01"
                  y2="8"
                />
              </svg>
              <span>新增後成員將立即可以存取此團隊的對話</span>
            </div>
            <button
              class="close-action"
              @click="handleClose"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { teamApi } from '@/api/team'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'
import type { TeamMember } from '@/types'

interface Props {
  isOpen: boolean
  teamId: number
  teamName: string
  currentMembers: TeamMember[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'close': []
  'member-added': [member: TeamMember]
}>()

// Composables
const { showWarning } = useConfirmDialog()
const { showSuccess, showError } = useToast()

// State
const searchQuery = ref('')
const loading = ref(false)
const availableMembers = ref<TeamMember[]>([])
const addingMemberId = ref<string | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

// Unique ID for accessibility
const modalTitleId = `add-member-modal-title-${Date.now()}`

// Computed
const filteredMembers = computed(() => {
  if (!searchQuery.value.trim()) {
    return availableMembers.value
  }

  const query = searchQuery.value.toLowerCase().trim()
  return availableMembers.value.filter(member => {
    const name = (member.name || '').toLowerCase()
    const loginId = (member.loginId || '').toLowerCase()
    const email = (member.email || '').toLowerCase()
    return name.includes(query) || loginId.includes(query) || email.includes(query)
  })
})

// Methods
const loadAvailableMembers = async () => {
  loading.value = true
  try {
    const response = await teamApi.getMembers()

    if (response.success && response.data) {
      // Filter out members already in the team
      const currentMemberIds = new Set(props.currentMembers.map(m => m.id))
      availableMembers.value = response.data.filter(
        member => !currentMemberIds.has(member.id) && member.status === 'active'
      )
    } else {
      console.error('載入可用成員失敗:', response.error)
      availableMembers.value = []
    }
  } catch (error) {
    console.error('載入可用成員失敗:', error)
    availableMembers.value = []
  } finally {
    loading.value = false
  }
}

const handleAddMember = async (member: TeamMember) => {
  try {
    const confirmed = await showWarning(
      '確定要新增此成員？',
      `將 ${member.name || member.loginId} 新增到 ${props.teamName}`
    )

    if (!confirmed) {return}

    addingMemberId.value = member.id

    const response = await teamApi.addMemberToTeam(props.teamId, member.id)

    if (response.success) {
      showSuccess(`已成功將 ${member.name || member.loginId} 新增到團隊`)

      // Remove from available list
      availableMembers.value = availableMembers.value.filter(m => m.id !== member.id)

      // Emit event to parent
      emit('member-added', member)
    } else {
      showError(response.error || '新增成員失敗')
    }
  } catch (error) {
    console.error('新增成員失敗:', error)
    showError('新增成員時發生錯誤')
  } finally {
    addingMemberId.value = null
  }
}

const handleSearch = () => {
  // Debounce is handled by Vue's reactivity
}

const clearSearch = () => {
  searchQuery.value = ''
  searchInput.value?.focus()
}

const handleClose = () => {
  emit('close')
}

const getInitials = (member: TeamMember): string => {
  const name = member.name || member.loginId
  if (!name) {return '?'}

  const names = name.split(' ').filter((n): n is string => n.trim().length > 0)
  if (names.length === 0) {return '?'}

  const firstName = names[0]
  if (!firstName) {return '?'}

  if (names.length === 1) {
    // Check if it's Chinese characters
    if (/[\u4e00-\u9fa5]/.test(firstName)) {
      return firstName.slice(0, 2)
    }
    return firstName.charAt(0).toUpperCase()
  }

  const lastName = names[names.length - 1]
  if (!lastName) {return firstName.charAt(0).toUpperCase()}

  // For Chinese names, take first char of each part
  if (/[\u4e00-\u9fa5]/.test(firstName)) {
    return (firstName.charAt(0) + lastName.charAt(0))
  }

  return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase()
}

const getAvatarStyle = (member: TeamMember) => {
  // Generate a consistent color based on member id or name
  const str = member.id || member.name || 'default'
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }

  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  ]

  const index = Math.abs(hash) % gradients.length
  return { background: gradients[index] }
}

const getRoleDisplayName = (role: string): string => {
  const roleMap: Record<string, string> = {
    admin: '管理員',
    team: '組長',
    agent: '客服'
  }
  return roleMap[role] || role
}

const getRoleClass = (role: string): string => {
  return `role-${role}`
}

// Handle keyboard events
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    handleClose()
  }
}

// Watch for modal open
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    // Reset state
    searchQuery.value = ''

    // Load available members
    await loadAvailableMembers()

    // Focus search input
    await nextTick()
    searchInput.value?.focus()

    // Prevent body scroll
    document.body.style.overflow = 'hidden'
  } else {
    // Restore body scroll
    document.body.style.overflow = ''
  }
})

// Watch for currentMembers changes (in case team members are updated externally)
watch(() => props.currentMembers, () => {
  if (props.isOpen) {
    // Re-filter available members
    const currentMemberIds = new Set(props.currentMembers.map(m => m.id))
    availableMembers.value = availableMembers.value.filter(
      member => !currentMemberIds.has(member.id)
    )
  }
}, { deep: true })

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
/* Modal Overlay */
.add-member-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* Modal Container */
.add-member-modal {
  width: 100%;
  max-width: 560px;
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 20px;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

/* Modal Header */
.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24px 24px 20px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
}

.header-content {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.header-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 14px;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-text h2 {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: -0.02em;
}

.header-subtitle {
  margin: 0;
  font-size: 0.9375rem;
  color: #64748b;
}

.header-subtitle strong {
  color: #475569;
  font-weight: 600;
}

.close-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.close-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #475569;
  transform: scale(1.05);
}

/* Search Section */
.search-section {
  padding: 20px 24px;
  background: #ffffff;
  border-bottom: 1px solid #f1f5f9;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 14px;
  color: #94a3b8;
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 48px;
  padding: 0 44px;
  font-size: 1rem;
  font-family: inherit;
  color: #1e293b;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  outline: none;
  transition: all 0.2s ease;
}

.search-input::placeholder {
  color: #94a3b8;
}

.search-input:focus {
  background: white;
  border-color: #667eea;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

.clear-search {
  position: absolute;
  right: 12px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e2e8f0;
  border: none;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-search:hover {
  background: #cbd5e1;
  color: #475569;
}

.search-stats {
  margin-top: 10px;
  font-size: 0.8125rem;
  color: #64748b;
}

.search-stats strong {
  color: #667eea;
  font-weight: 600;
}

/* Members Section */
.members-section {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  min-height: 200px;
  max-height: 400px;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px 24px;
  color: #64748b;
}

.loading-spinner {
  position: relative;
  width: 48px;
  height: 48px;
}

.spinner-ring {
  position: absolute;
  inset: 0;
  border: 3px solid transparent;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-ring:nth-child(2) {
  inset: 6px;
  border-top-color: #764ba2;
  animation-duration: 0.8s;
  animation-direction: reverse;
}

.spinner-ring:nth-child(3) {
  inset: 12px;
  border-top-color: #a78bfa;
  animation-duration: 1.2s;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  border-radius: 20px;
  color: #94a3b8;
}

.empty-state h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #475569;
}

.empty-state p {
  margin: 0;
  font-size: 0.9375rem;
  color: #94a3b8;
}

/* Members Grid */
.members-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Member Card */
.member-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  transition: all 0.25s ease;
}

.member-card:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.member-card.is-adding {
  opacity: 0.7;
  pointer-events: none;
}

.member-avatar {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: white;
  font-weight: 700;
  font-size: 0.9375rem;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.member-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.member-name {
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.member-role {
  padding: 3px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.member-role.role-admin {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #991b1b;
}

.member-role.role-team {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
}

.member-role.role-agent {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  color: #1e40af;
}

.member-email {
  font-size: 0.8125rem;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Add Button */
.add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

.add-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

.add-btn:active:not(:disabled) {
  transform: translateY(0);
}

.add-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Modal Footer */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

.footer-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  color: #64748b;
}

.footer-hint svg {
  flex-shrink: 0;
  color: #94a3b8;
}

.close-action {
  height: 42px;
  padding: 0 24px;
  font-size: 0.9375rem;
  font-weight: 600;
  font-family: inherit;
  color: #475569;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-action:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
  color: #1e293b;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .add-member-modal,
.modal-leave-to .add-member-modal {
  transform: scale(0.95) translateY(20px);
  opacity: 0;
}

.modal-enter-active .add-member-modal,
.modal-leave-active .add-member-modal {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* List Transitions */
.member-list-enter-active,
.member-list-leave-active {
  transition: all 0.3s ease;
}

.member-list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.member-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.member-list-move {
  transition: transform 0.3s ease;
}

/* Responsive */
@media (max-width: 640px) {
  .add-member-overlay {
    padding: 16px;
    align-items: flex-end;
  }

  .add-member-modal {
    max-height: calc(100vh - 32px);
    border-radius: 20px 20px 0 0;
  }

  .modal-header {
    padding: 20px;
  }

  .header-content {
    gap: 12px;
  }

  .header-icon {
    width: 42px;
    height: 42px;
  }

  .header-text h2 {
    font-size: 1.25rem;
  }

  .search-section {
    padding: 16px 20px;
  }

  .members-section {
    padding: 12px 20px;
    max-height: 50vh;
  }

  .member-card {
    padding: 12px 14px;
  }

  .modal-footer {
    flex-direction: column;
    padding: 16px 20px;
    gap: 12px;
  }

  .footer-hint {
    text-align: center;
  }

  .close-action {
    width: 100%;
  }
}

/* Scrollbar Styling */
.members-section::-webkit-scrollbar {
  width: 6px;
}

.members-section::-webkit-scrollbar-track {
  background: transparent;
}

.members-section::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.members-section::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
