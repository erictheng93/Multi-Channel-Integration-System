<template>
  <AppLayout>
    <div class="activity-log">
      <!-- Header -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-info">
            <h1 class="page-title">
              活動記錄
            </h1>
            <p class="page-subtitle">
              查看系統操作記錄和用戶活動
            </p>
          </div>
          <div class="header-actions">
            <PrimaryActionButton
              text="匯出記錄"
              :icon="DownloadIcon"
              :loading="loading"
              @click="exportActivities"
            />
            <PrimaryActionButton
              text="清除篩選"
              :icon="XIcon"
              @click="clearFilters"
            />
            <PrimaryActionButton
              text="刷新"
              :icon="RefreshIcon"
              :loading="loading"
              @click="refreshData"
            />
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-section">
        <div class="filters-grid">
          <div class="filter-group">
            <label for="userFilter">用戶</label>
            <select
              id="userFilter"
              v-model="filters.userId"
              class="form-select"
              @change="applyFilters"
            >
              <option value="">
                所有用戶
              </option>
              <option
                v-for="user in users"
                :key="user.id"
                :value="user.id"
              >
                {{ user.name }} ({{ user.role }})
              </option>
            </select>
          </div>

          <div class="filter-group">
            <label for="actionFilter">操作類型</label>
            <select
              id="actionFilter"
              v-model="filters.action"
              class="form-select"
              @change="applyFilters"
            >
              <option value="">
                所有操作
              </option>
              <option value="conversation_assign">
                對話指派
              </option>
              <option value="conversation_transfer">
                對話轉移
              </option>
              <option value="conversation_close">
                對話關閉
              </option>
              <option value="message_send">
                發送訊息
              </option>
              <option value="user_login">
                用戶登入
              </option>
              <option value="settings_update">
                設定更新
              </option>
            </select>
          </div>

          <div class="filter-group">
            <label for="resourceFilter">資源類型</label>
            <select
              id="resourceFilter"
              v-model="filters.resourceType"
              class="form-select"
              @change="applyFilters"
            >
              <option value="">
                所有資源
              </option>
              <option value="conversation">
                對話
              </option>
              <option value="message">
                訊息
              </option>
              <option value="user">
                用戶
              </option>
              <option value="system">
                系統
              </option>
            </select>
          </div>

          <div class="filter-group">
            <label for="dateRange">時間範圍</label>
            <select
              id="dateRange"
              v-model="dateRange"
              class="form-select"
              @change="applyDateRange"
            >
              <option value="today">
                今天
              </option>
              <option value="week">
                最近一週
              </option>
              <option value="month">
                最近一個月
              </option>
              <option value="custom">
                自訂範圍
              </option>
            </select>
          </div>
        </div>

        <!-- Custom Date Range -->
        <div
          v-if="dateRange === 'custom'"
          class="date-range-inputs"
        >
          <div class="date-input-group">
            <label for="startDate">開始日期</label>
            <input
              id="startDate"
              v-model="customDateRange.start"
              type="datetime-local"
              class="form-input"
              @change="applyFilters"
            >
          </div>
          <div class="date-input-group">
            <label for="endDate">結束日期</label>
            <input
              id="endDate"
              v-model="customDateRange.end"
              type="datetime-local"
              class="form-input"
              @change="applyFilters"
            >
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div
        v-if="loading"
        class="loading-container"
      >
        <div class="loading-spinner" />
        <p>載入活動記錄中...</p>
      </div>

      <!-- Activities List -->
      <div
        v-else-if="activities.length > 0"
        class="activities-container"
      >
        <div class="activities-list">
          <div
            v-for="activity in activities"
            :key="activity.id"
            class="activity-item"
          >
            <div class="activity-icon">
              <component :is="getActivityIcon(activity.action)" />
            </div>

            <div class="activity-content">
              <div class="activity-header">
                <span class="activity-user">{{ activity.userName }}</span>
                <span class="activity-role">{{ getRoleLabel(activity.userRole) }}</span>
                <span class="activity-time">{{ formatTime(activity.createdAt) }}</span>
              </div>

              <div class="activity-description">
                {{ getActivityDescription(activity) }}
              </div>

              <div
                v-if="activity.details"
                class="activity-details"
              >
                <button
                  class="details-toggle"
                  @click="toggleDetails(activity.id)"
                >
                  {{ expandedDetails.has(activity.id) ? '隱藏詳情' : '顯示詳情' }}
                </button>

                <div
                  v-if="expandedDetails.has(activity.id)"
                  class="details-content"
                >
                  <pre>{{ JSON.stringify(activity.details, null, 2) }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div class="pagination-container">
          <button
            class="btn btn-secondary"
            :disabled="currentPage <= 1 || loading"
            @click="loadPage(currentPage - 1)"
          >
            上一頁
          </button>

          <span class="pagination-info">
            第 {{ currentPage }} 頁，共 {{ totalPages }} 頁
            (總計 {{ totalRecords }} 筆記錄)
          </span>

          <button
            class="btn btn-secondary"
            :disabled="currentPage >= totalPages || loading"
            @click="loadPage(currentPage + 1)"
          >
            下一頁
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else
        class="empty-state"
      >
        <div class="empty-icon">
          📋
        </div>
        <h3>沒有活動記錄</h3>
        <p>在選定的時間範圍內沒有找到任何活動記錄</p>
      </div>

      <!-- Error State -->
      <div
        v-if="error"
        class="error-message"
      >
        {{ error }}
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
import AppLayout from '@/components/ui/AppLayout.vue'
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue'
import { DownloadIcon, XIcon, RefreshIcon } from '@/components/icons'

// Icons (you can replace with actual icon components)
const UserIcon = 'div'
const MessageIcon = 'div'
const SettingsIcon = 'div'
const TransferIcon = 'div'
const CloseIcon = 'div'

interface ActivityLog {
  id: number
  userId: string
  userName: string
  userRole: string
  action: string
  resourceType: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

interface User {
  id: string
  name: string
  role: string
}

// State
const activities = ref<ActivityLog[]>([])
const users = ref<User[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const expandedDetails = ref(new Set<number>())

// Filters
const filters = reactive({
  userId: '',
  action: '',
  resourceType: ''
})

const dateRange = ref('week')
const customDateRange = reactive({
  start: '',
  end: ''
})

// Pagination
const pagination = ref({
  page: 1,
  pageSize: 50,
  total: 0,
  totalPages: 0
})

// Auth
const authStore = useAuthStore()

// Computed
const isAdmin = computed(() => authStore.currentAgent?.role === 'admin')

// Safe pagination access
const currentPage = computed(() => pagination.value?.page || 1)
const totalPages = computed(() => pagination.value?.totalPages || 0)
const totalRecords = computed(() => pagination.value?.total || 0)

// Methods
const loadActivities = async (page = 1) => {
  loading.value = true
  error.value = null

  try {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pagination.value.pageSize.toString()
    })

    if (filters.userId) { params.append('userId', filters.userId) }
    if (filters.action) { params.append('action', filters.action) }
    if (filters.resourceType) { params.append('resourceType', filters.resourceType) }

    // Add date filters
    const dateFilters = getDateFilters()
    if (dateFilters.startDate) { params.append('startDate', dateFilters.startDate) }
    if (dateFilters.endDate) { params.append('endDate', dateFilters.endDate) }

    const response = await fetch(`/api/activities?${params}`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to load activities')
    }

    const data = await response.json()

    if (data.success) {
      activities.value = data.data || []
      pagination.value = {
        page: data.pagination?.page || 1,
        pageSize: data.pagination?.pageSize || 50,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0
      }
    } else {
      throw new Error(data.error || 'Failed to load activities')
    }

  } catch (err) {
    console.error('Failed to load activities:', err)
    error.value = err instanceof Error ? err.message : '載入活動記錄失敗'
    // Reset to safe defaults on error
    activities.value = []
    pagination.value = {
      page: 1,
      pageSize: 50,
      total: 0,
      totalPages: 0
    }
  } finally {
    loading.value = false
  }
}

const loadUsers = async () => {
  if (!isAdmin.value) { return }

  try {
    const response = await fetch('/api/team/members', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        users.value = data.data.map((member: Record<string, unknown>) => ({
          id: member.id,
          name: member.name,
          role: member.role
        }))
      }
    }
  } catch (err) {
    console.error('Failed to load users:', err)
  }
}

const getDateFilters = () => {
  const now = new Date()
  let startDate = ''
  let endDate = ''

  switch (dateRange.value) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      break
    case 'week': {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      startDate = weekAgo.toISOString()
      break
    }
    case 'month': {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      startDate = monthAgo.toISOString()
      break
    }
    case 'custom':
      if (customDateRange.start) {
        startDate = new Date(customDateRange.start).toISOString()
      }
      if (customDateRange.end) {
        endDate = new Date(customDateRange.end).toISOString()
      }
      break
  }

  return { startDate, endDate }
}

const applyFilters = () => {
  pagination.value.page = 1
  loadActivities(1)
}

const applyDateRange = () => {
  if (dateRange.value === 'custom') {
    // Set default custom range to last week
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    customDateRange.end = now.toISOString().slice(0, 16)
    customDateRange.start = weekAgo.toISOString().slice(0, 16)
  }
  applyFilters()
}

const clearFilters = () => {
  filters.userId = ''
  filters.action = ''
  filters.resourceType = ''
  dateRange.value = 'week'
  customDateRange.start = ''
  customDateRange.end = ''
  applyFilters()
}

const loadPage = (page: number) => {
  loadActivities(page)
}

const toggleDetails = (activityId: number) => {
  if (expandedDetails.value.has(activityId)) {
    expandedDetails.value.delete(activityId)
  } else {
    expandedDetails.value.add(activityId)
  }
}

const getActivityIcon = (action: string) => {
  switch (action) {
    case 'conversation_assign':
    case 'conversation_transfer':
      return TransferIcon
    case 'conversation_close':
      return CloseIcon
    case 'message_send':
      return MessageIcon
    case 'user_login':
    case 'user_logout':
      return UserIcon
    case 'settings_update':
      return SettingsIcon
    default:
      return UserIcon
  }
}

const getActivityDescription = (activity: ActivityLog) => {
  const actionMap: Record<string, string> = {
    conversation_assign: '指派了對話',
    conversation_transfer: '轉移了對話',
    conversation_close: '關閉了對話',
    conversation_reopen: '重新開啟了對話',
    message_send: '發送了訊息',
    message_recall: '撤回了訊息',
    user_login: '登入系統',
    user_logout: '登出系統',
    user_create: '創建了用戶',
    user_update: '更新了用戶資訊',
    user_delete: '刪除了用戶',
    settings_update: '更新了系統設定',
    team_invite: '邀請了團隊成員',
    team_member_update: '更新了團隊成員',
    team_member_remove: '移除了團隊成員'
  }

  const description = actionMap[activity.action] || activity.action
  const resourceInfo = activity.resourceId ? ` (${activity.resourceType}: ${activity.resourceId})` : ''

  return `${description}${resourceInfo}`
}

const getRoleLabel = (role: string) => {
  const roleMap: Record<string, string> = {
    admin: '管理員',
    team: '團隊管理員',
    agent: '客服'
  }
  return roleMap[role] || role
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) { return '剛剛' }
  if (diffMins < 60) { return `${diffMins} 分鐘前` }
  if (diffHours < 24) { return `${diffHours} 小時前` }
  if (diffDays < 7) { return `${diffDays} 天前` }

  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const exportActivities = async () => {
  try {
    loading.value = true

    // 構建匯出參數，包含當前的篩選條件
    const params = new URLSearchParams()

    if (filters.userId) { params.append('userId', filters.userId) }
    if (filters.action) { params.append('action', filters.action) }
    if (filters.resourceType) { params.append('resourceType', filters.resourceType) }

    // 添加日期篩選
    const dateFilters = getDateFilters()
    if (dateFilters.startDate) { params.append('startDate', dateFilters.startDate) }
    if (dateFilters.endDate) { params.append('endDate', dateFilters.endDate) }

    // 匯出格式
    params.append('format', 'csv')
    params.append('export', 'true')

    const response = await fetch(`/api/activities/export?${params}`, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!response.ok) {
      throw new Error('匯出失敗')
    }

    // 下載檔案
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    // 生成檔案名稱
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)
    link.download = `activity-log-${dateStr}.csv`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

  } catch (err) {
    console.error('Export failed:', err)
    error.value = err instanceof Error ? err.message : '匯出失敗'
  } finally {
    loading.value = false
  }
}

const refreshData = async () => {
  await Promise.all([
    loadActivities(1),
    loadUsers()
  ])
}

// 監聽路由變化，確保ActivityLog頁面正確重新渲染
watch(() => route.path, (newPath, oldPath) => {
  console.log('🔄 ActivityLog: Route changed from', oldPath, 'to', newPath)

  // 如果路由到達ActivityLog頁面，確保數據刷新
  if (newPath === '/activities') {
    console.log('🔄 ActivityLog: Refreshing data due to route change')
    refreshData()
  }
}, { immediate: false })

// Lifecycle
onMounted(() => {
  console.log('🚀 ActivityLog mounted')
  loadActivities()
  loadUsers()
})
</script>

<style scoped>
.activity-log {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

.page-header {
  margin-bottom: var(--space-6);
}

.header-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.header-info {
  flex: 1;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.page-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--text-base);
}

.filters-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.filter-group label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text-primary);
}

.form-select,
.form-input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: var(--color-background);
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-alpha);
}

.date-range-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.date-input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}



.activities-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* Activities list - dividers handled by individual activity items */

.activity-item {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4);
  transition: background-color 0.2s;
  border-bottom: 1px solid var(--color-border);
}

.activity-item:last-child {
  border-bottom: none;
}

/* Activity item styles moved above */

.activity-item:hover {
  background: var(--color-background);
}

.activity-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  background: var(--color-primary-light);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.activity-user {
  font-weight: 500;
  color: var(--color-text-primary);
}

.activity-role {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
  background: var(--color-secondary-light);
  color: var(--color-secondary);
  border-radius: var(--radius-full);
}

.activity-time {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-left: auto;
}

.activity-description {
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.activity-details {
  margin-top: var(--space-3);
}

.details-toggle {
  font-size: var(--text-sm);
  color: var(--color-primary);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}

.details-content {
  margin-top: var(--space-2);
  padding: var(--space-3);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  overflow-x: auto;
}

.details-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.pagination-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-top: 1px solid var(--color-border);
  background: var(--color-background);
}

.pagination-info {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  color: var(--color-text-secondary);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--space-4);
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.empty-state {
  text-align: center;
  padding: var(--space-8);
  color: var(--color-text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: var(--space-4);
}

.empty-state h3 {
  margin-bottom: var(--space-2);
  color: var(--color-text-primary);
}

.error-message {
  background: var(--color-error-light);
  color: var(--color-error);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  margin-top: var(--space-4);
}

.btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-background);
}

/* Responsive Design */
@media (max-width: 768px) {
  .activity-log {
    padding: var(--space-4) var(--space-2);
  }

  .filters-grid {
    grid-template-columns: 1fr;
  }

  .date-range-inputs {
    grid-template-columns: 1fr;
  }

  .activity-item {
    flex-direction: column;
    gap: var(--space-3);
  }

  .activity-header {
    flex-wrap: wrap;
  }

  .pagination-container {
    flex-direction: column;
    gap: var(--space-3);
  }
}

@media (max-width: 640px) {
  .activity-log {
    padding: var(--space-3) var(--space-2);
  }

  .page-title {
    font-size: var(--text-xl);
  }

  .header-content {
    flex-direction: column;
    gap: var(--space-4);
    text-align: center;
  }

  .header-actions {
    justify-content: center;
    flex-wrap: wrap;
  }

  .filters-grid {
    gap: var(--space-3);
  }

  .activity-item {
    padding: var(--space-3);
  }

  .activity-icon {
    width: 36px;
    height: 36px;
  }
}

@media (max-width: 480px) {
  .activity-log {
    padding: var(--space-3) var(--space-1);
  }

  .page-title {
    font-size: var(--text-lg);
  }

  .filters-section {
    padding: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .filters-grid {
    gap: var(--space-2);
  }

  .filter-group {
    gap: var(--space-1);
  }

  .date-range-inputs {
    gap: var(--space-2);
    margin-top: var(--space-3);
    padding-top: var(--space-3);
  }

  .activity-item {
    padding: var(--space-2);
    gap: var(--space-2);
  }

  .activity-icon {
    width: 32px;
    height: 32px;
  }

  .btn {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
    min-height: 44px;
  }
}

@media (max-width: 320px) {
  .activity-log {
    padding: var(--space-2) var(--space-1);
  }

  .page-title {
    font-size: var(--text-base);
    line-height: 1.3;
  }

  .filters-section {
    padding: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .activity-item {
    padding: var(--space-2);
    gap: var(--space-1);
  }

  .activity-icon {
    width: 28px;
    height: 28px;
  }

  .btn {
    padding: var(--space-2);
    font-size: var(--text-xs);
    min-height: 44px;
    min-width: 44px;
  }

  .header-actions {
    flex-direction: column;
    gap: var(--space-2);
  }
}

/* Reduced Motion Preference */
@media (prefers-reduced-motion: reduce) {
  .activity-item,
  .btn,
  .form-select,
  .form-input {
    transition: none;
  }

  .spinner {
    animation: none;
  }

  @keyframes spin {
    0%, 100% {
      transform: rotate(0deg);
    }
  }
}
</style>