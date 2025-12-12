<template>
  <div class="notification-page">
    <!-- Page Header -->
    <header class="page-header">
      <div class="header-content">
        <div class="header-title-section">
          <h1 class="page-title">
            <span class="title-icon">
              <BellIcon />
            </span>
            通知中心
          </h1>
          <p class="page-subtitle">
            管理您的所有通知和提醒
          </p>
        </div>

        <div class="header-actions">
          <button
            v-if="hasUnread"
            class="btn btn-secondary"
            :disabled="markingAllRead"
            @click="handleMarkAllRead"
          >
            <CheckAllIcon v-if="!markingAllRead" />
            <LoadingSpinner
              v-else
              size="sm"
            />
            <span>全部標記已讀</span>
          </button>
          <button
            class="btn btn-icon"
            title="通知設定"
            @click="showSettings = true"
          >
            <SettingsIcon />
          </button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon stat-icon-total">
            <InboxIcon />
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats?.total || 0 }}</span>
            <span class="stat-label">全部通知</span>
          </div>
        </div>
        <div class="stat-card stat-card-highlight">
          <div class="stat-icon stat-icon-unread">
            <BellRingIcon />
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats?.unread || 0 }}</span>
            <span class="stat-label">未讀通知</span>
          </div>
          <div
            v-if="stats?.unread"
            class="stat-pulse"
          />
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon-today">
            <CalendarIcon />
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats?.timeRange?.today || 0 }}</span>
            <span class="stat-label">今日新增</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon-week">
            <TrendingUpIcon />
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats?.timeRange?.thisWeek || 0 }}</span>
            <span class="stat-label">本週通知</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Filters Section -->
    <section class="filters-section">
      <div class="filters-row">
        <!-- Type Filter -->
        <div class="filter-group">
          <label class="filter-label">類型</label>
          <select
            v-model="selectedType"
            class="filter-select"
            @change="applyFilters"
          >
            <option value="">
              全部類型
            </option>
            <option
              v-for="type in notificationTypes"
              :key="type.value"
              :value="type.value"
            >
              {{ type.label }}
            </option>
          </select>
        </div>

        <!-- Priority Filter -->
        <div class="filter-group">
          <label class="filter-label">優先級</label>
          <select
            v-model="selectedPriority"
            class="filter-select"
            @change="applyFilters"
          >
            <option value="">
              全部優先級
            </option>
            <option
              v-for="priority in priorities"
              :key="priority.value"
              :value="priority.value"
            >
              {{ priority.label }}
            </option>
          </select>
        </div>

        <!-- Read Status Filter -->
        <div class="filter-group">
          <label class="filter-label">狀態</label>
          <div class="filter-tabs">
            <button
              class="filter-tab"
              :class="{ active: selectedReadStatus === undefined }"
              @click="selectedReadStatus = undefined; applyFilters()"
            >
              全部
            </button>
            <button
              class="filter-tab"
              :class="{ active: selectedReadStatus === false }"
              @click="selectedReadStatus = false; applyFilters()"
            >
              <span class="tab-badge" />
              未讀
            </button>
            <button
              class="filter-tab"
              :class="{ active: selectedReadStatus === true }"
              @click="selectedReadStatus = true; applyFilters()"
            >
              已讀
            </button>
          </div>
        </div>

        <!-- Clear Filters -->
        <button
          v-if="hasActiveFilters"
          class="btn btn-ghost btn-sm"
          @click="clearFilters"
        >
          <XIcon />
          清除篩選
        </button>
      </div>
    </section>

    <!-- Notifications List -->
    <section class="notifications-section">
      <!-- Loading State -->
      <div
        v-if="loading && notifications.length === 0"
        class="loading-state"
      >
        <LoadingSpinner size="lg" />
        <p>載入通知中...</p>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="notifications.length === 0"
        class="empty-state"
      >
        <div class="empty-illustration">
          <div class="empty-bell">
            <BellOffIcon />
          </div>
          <div class="empty-particles">
            <span
              v-for="i in 5"
              :key="i"
              class="particle"
              :style="{ '--delay': i * 0.2 + 's' }"
            />
          </div>
        </div>
        <h3 class="empty-title">
          {{ hasActiveFilters ? '沒有符合條件的通知' : '暫無通知' }}
        </h3>
        <p class="empty-description">
          {{ hasActiveFilters ? '請嘗試調整篩選條件' : '新的通知將會顯示在這裡' }}
        </p>
        <button
          v-if="hasActiveFilters"
          class="btn btn-primary"
          @click="clearFilters"
        >
          清除篩選條件
        </button>
      </div>

      <!-- Notifications Grid -->
      <div
        v-else
        class="notifications-list"
      >
        <TransitionGroup name="notification-list">
          <article
            v-for="notification in notifications"
            :key="notification.id"
            class="notification-card"
            :class="{
              'notification-unread': !notification.isRead,
              'notification-urgent': notification.priority === 'urgent',
              'notification-high': notification.priority === 'high'
            }"
            @click="handleNotificationClick(notification)"
          >
            <!-- Priority Indicator -->
            <div
              v-if="notification.priority === 'urgent' || notification.priority === 'high'"
              class="priority-indicator"
              :class="`priority-${notification.priority}`"
            />

            <!-- Icon -->
            <div
              class="notification-icon"
              :class="getIconClass(notification.type)"
            >
              <component :is="getIcon(notification.type)" />
            </div>

            <!-- Content -->
            <div class="notification-content">
              <div class="notification-header">
                <h3 class="notification-title">
                  {{ notification.title }}
                </h3>
                <time class="notification-time">{{ formatTime(notification.createdAt) }}</time>
              </div>
              <p class="notification-text">
                {{ notification.content }}
              </p>
              <div class="notification-meta">
                <span
                  class="notification-type-badge"
                  :class="`type-${notification.type}`"
                >
                  {{ getTypeLabel(notification.type) }}
                </span>
                <span
                  v-if="notification.priority === 'urgent' || notification.priority === 'high'"
                  class="notification-priority-badge"
                  :class="`priority-${notification.priority}`"
                >
                  {{ notification.priority === 'urgent' ? '緊急' : '高優先' }}
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div
              class="notification-actions"
              @click.stop
            >
              <button
                v-if="!notification.isRead"
                class="action-btn"
                title="標記已讀"
                @click="handleMarkRead(notification.id)"
              >
                <CheckIcon />
              </button>
              <button
                class="action-btn action-btn-danger"
                title="刪除"
                @click="handleDelete(notification.id)"
              >
                <TrashIcon />
              </button>
            </div>

            <!-- Unread Indicator -->
            <div
              v-if="!notification.isRead"
              class="unread-dot"
            />
          </article>
        </TransitionGroup>

        <!-- Load More -->
        <div
          v-if="canLoadMore"
          class="load-more-section"
        >
          <button
            class="btn btn-secondary btn-lg"
            :disabled="loadingMore"
            @click="handleLoadMore"
          >
            <LoadingSpinner
              v-if="loadingMore"
              size="sm"
            />
            <span v-else>載入更多</span>
          </button>
          <p class="load-more-info">
            已顯示 {{ notifications.length }} / {{ pagination.total }} 則通知
          </p>
        </div>
      </div>
    </section>

    <!-- Settings Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showSettings"
          class="modal-overlay"
          @click.self="showSettings = false"
        >
          <div class="settings-modal">
            <header class="modal-header">
              <h2>通知設定</h2>
              <button
                class="modal-close"
                @click="showSettings = false"
              >
                <XIcon />
              </button>
            </header>

            <div class="modal-body">
              <div class="settings-group">
                <h3 class="settings-group-title">
                  通知偏好
                </h3>

                <label class="settings-toggle">
                  <span class="toggle-label">
                    <BellIcon class="toggle-icon" />
                    <span>
                      <strong>推送通知</strong>
                      <small>在瀏覽器接收即時通知</small>
                    </span>
                  </span>
                  <input
                    v-model="settings.pushEnabled"
                    type="checkbox"
                    class="toggle-input"
                    @change="saveSettings"
                  >
                  <span class="toggle-switch" />
                </label>

                <label class="settings-toggle">
                  <span class="toggle-label">
                    <VolumeIcon class="toggle-icon" />
                    <span>
                      <strong>通知音效</strong>
                      <small>收到通知時播放提示音</small>
                    </span>
                  </span>
                  <input
                    v-model="settings.soundEnabled"
                    type="checkbox"
                    class="toggle-input"
                    @change="saveSettings"
                  >
                  <span class="toggle-switch" />
                </label>

                <label class="settings-toggle">
                  <span class="toggle-label">
                    <MailIcon class="toggle-icon" />
                    <span>
                      <strong>郵件通知</strong>
                      <small>重要通知發送至郵箱</small>
                    </span>
                  </span>
                  <input
                    v-model="settings.emailEnabled"
                    type="checkbox"
                    class="toggle-input"
                    @change="saveSettings"
                  >
                  <span class="toggle-switch" />
                </label>
              </div>

              <div class="settings-group">
                <h3 class="settings-group-title">
                  通知類型
                </h3>

                <label class="settings-toggle">
                  <span class="toggle-label">
                    <MessageIcon class="toggle-icon" />
                    <span>
                      <strong>新訊息通知</strong>
                      <small>收到新客戶訊息時通知</small>
                    </span>
                  </span>
                  <input
                    v-model="settings.messageEnabled"
                    type="checkbox"
                    class="toggle-input"
                    @change="saveSettings"
                  >
                  <span class="toggle-switch" />
                </label>

                <label class="settings-toggle">
                  <span class="toggle-label">
                    <UserPlusIcon class="toggle-icon" />
                    <span>
                      <strong>指派通知</strong>
                      <small>對話指派給您時通知</small>
                    </span>
                  </span>
                  <input
                    v-model="settings.assignmentEnabled"
                    type="checkbox"
                    class="toggle-input"
                    @change="saveSettings"
                  >
                  <span class="toggle-switch" />
                </label>

                <label class="settings-toggle">
                  <span class="toggle-label">
                    <AtSignIcon class="toggle-icon" />
                    <span>
                      <strong>提及通知</strong>
                      <small>被同事提及時通知</small>
                    </span>
                  </span>
                  <input
                    v-model="settings.mentionEnabled"
                    type="checkbox"
                    class="toggle-input"
                    @change="saveSettings"
                  >
                  <span class="toggle-switch" />
                </label>
              </div>
            </div>

            <footer class="modal-footer">
              <button
                class="btn btn-secondary"
                @click="showSettings = false"
              >
                關閉
              </button>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationsStore, type Notification, type NotificationType, type NotificationPriority } from '@/stores/notifications'
import { useToast } from '@/composables/useToast'
import { LoadingSpinner } from '@/components/ui'
import {
  BellIcon,
  BellOffIcon,
  CheckIcon,
  TrashIcon,
  SettingsIcon,
  XIcon,
  MessageIcon,
  UserPlusIcon,
  AtSignIcon,
  AlertIcon,
  ClockIcon,
  ArrowRightIcon,
  InboxIcon,
  CalendarIcon,
  TrendingUpIcon,
  MailIcon,
  VolumeIcon
} from '@/components/icons'

// 額外圖標定義
const BellRingIcon = BellIcon
const CheckAllIcon = CheckIcon

const router = useRouter()
const store = useNotificationsStore()
const { showSuccess } = useToast()

// State
const showSettings = ref(false)
const markingAllRead = ref(false)
const selectedType = ref<NotificationType | ''>('')
const selectedPriority = ref<NotificationPriority | ''>('')
const selectedReadStatus = ref<boolean | undefined>(undefined)

// Settings state
const settings = ref({
  pushEnabled: true,
  soundEnabled: true,
  emailEnabled: false,
  messageEnabled: true,
  assignmentEnabled: true,
  mentionEnabled: true
})

// Computed
const notifications = computed(() => store.notifications)
const stats = computed(() => store.stats)
const loading = computed(() => store.loading)
const loadingMore = computed(() => store.loadingMore)
const pagination = computed(() => store.pagination)
const canLoadMore = computed(() => store.canLoadMore)
const hasUnread = computed(() => store.hasUnread)

const hasActiveFilters = computed(() =>
  selectedType.value !== '' ||
  selectedPriority.value !== '' ||
  selectedReadStatus.value !== undefined
)

// Notification types config
const notificationTypes = [
  { value: 'new_message', label: '新訊息' },
  { value: 'conversation_assigned', label: '對話指派' },
  { value: 'conversation_transferred', label: '對話轉移' },
  { value: 'mention', label: '提及' },
  { value: 'system', label: '系統通知' },
  { value: 'priority_changed', label: '優先級變更' },
  { value: 'customer_responded', label: '客戶回覆' },
  { value: 'task_reminder', label: '任務提醒' }
]

const priorities = [
  { value: 'urgent', label: '緊急' },
  { value: 'high', label: '高' },
  { value: 'normal', label: '一般' },
  { value: 'low', label: '低' }
]

// Methods
const applyFilters = () => {
  store.fetchNotifications({
    type: selectedType.value || undefined,
    priority: selectedPriority.value || undefined,
    isRead: selectedReadStatus.value
  })
}

const clearFilters = () => {
  selectedType.value = ''
  selectedPriority.value = ''
  selectedReadStatus.value = undefined
  store.clearFilters()
}

const handleMarkRead = async (id: string) => {
  const success = await store.markAsRead(id)
  if (success) {
    showSuccess('已標記為已讀')
  }
}

const handleMarkAllRead = async () => {
  markingAllRead.value = true
  try {
    const success = await store.markAllAsRead()
    if (success) {
      showSuccess('已將所有通知標記為已讀')
    }
  } finally {
    markingAllRead.value = false
  }
}

const handleDelete = async (id: string) => {
  const success = await store.deleteNotification(id)
  if (success) {
    showSuccess('通知已刪除')
  }
}

const handleLoadMore = () => {
  store.loadMoreNotifications()
}

const handleNotificationClick = (notification: Notification) => {
  // Mark as read
  if (!notification.isRead) {
    store.markAsRead(notification.id)
  }

  // Navigate based on type
  const { type, data } = notification

  if (['new_message', 'customer_responded', 'conversation_assigned', 'conversation_transferred', 'priority_changed', 'mention', 'task_reminder'].includes(type)) {
    if (data?.conversationId) {
      router.push(`/conversations/${data.conversationId}`)
    }
  }
}

const saveSettings = async () => {
  // TODO: Call API to save settings
  showSuccess('設定已儲存')
}

const getIcon = (type: NotificationType) => {
  const icons: Record<NotificationType, typeof MessageIcon> = {
    new_message: MessageIcon,
    conversation_assigned: UserPlusIcon,
    conversation_transferred: ArrowRightIcon,
    mention: AtSignIcon,
    system: BellIcon,
    priority_changed: AlertIcon,
    customer_responded: MessageIcon,
    task_reminder: ClockIcon,
    'agent_removed_from_team': AlertIcon  // 🆕
  }
  return icons[type] || BellIcon
}

const getIconClass = (type: NotificationType) => `icon-${type}`

const getTypeLabel = (type: NotificationType) => {
  const labels: Record<NotificationType, string> = {
    new_message: '新訊息',
    conversation_assigned: '對話指派',
    conversation_transferred: '對話轉移',
    mention: '提及',
    system: '系統',
    priority_changed: '優先級變更',
    customer_responded: '客戶回覆',
    task_reminder: '任務提醒',
    'agent_removed_from_team': '團隊成員變更'  // 🆕
  }
  return labels[type] || type
}

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) {return '剛剛'}
  if (minutes < 60) {return `${minutes} 分鐘前`}
  if (hours < 24) {return `${hours} 小時前`}
  if (days < 7) {return `${days} 天前`}

  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Lifecycle
onMounted(async () => {
  await Promise.all([
    store.fetchNotifications(),
    store.fetchStats()
  ])
})

// Watch for filter changes
watch([selectedType, selectedPriority, selectedReadStatus], () => {
  // Filters are applied via @change handlers
})
</script>

<style scoped>
/* Page Layout */
.notification-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-6);
}

/* Header */
.page-header {
  margin-bottom: var(--space-8);
}

.header-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.header-title-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.page-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0;
}

.title-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
  border-radius: var(--radius-xl);
  color: white;
}

.title-icon svg {
  width: 24px;
  height: 24px;
}

.page-subtitle {
  color: var(--gray-600);
  margin: 0;
  font-size: 1rem;
}

.header-actions {
  display: flex;
  gap: var(--space-3);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}

.stat-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
  background: white;
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-200);
  transition: all var(--transition-fast);
}

.stat-card:hover {
  border-color: var(--gray-300);
  box-shadow: var(--shadow-md);
}

.stat-card-highlight {
  border-color: var(--primary-200);
  background: linear-gradient(135deg, var(--primary-50), white);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}

.stat-icon svg {
  width: 24px;
  height: 24px;
}

.stat-icon-total {
  background: var(--gray-100);
  color: var(--gray-600);
}

.stat-icon-unread {
  background: var(--primary-100);
  color: var(--primary-600);
}

.stat-icon-today {
  background: var(--green-100);
  color: var(--green-600);
}

.stat-icon-week {
  background: var(--blue-100);
  color: var(--blue-600);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  line-height: 1.2;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--gray-500);
}

.stat-pulse {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  width: 8px;
  height: 8px;
  background: var(--primary-500);
  border-radius: var(--radius-full);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.5);
    opacity: 0.5;
  }
}

/* Filters */
.filters-section {
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  background: white;
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-200);
}

.filters-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.filter-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gray-500);
}

.filter-select {
  min-width: 160px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  background: white;
  font-size: 0.875rem;
  color: var(--gray-900);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-select:hover {
  border-color: var(--gray-400);
}

.filter-select:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.filter-tabs {
  display: flex;
  background: var(--gray-100);
  border-radius: var(--radius-lg);
  padding: 4px;
}

.filter-tab {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border: none;
  background: transparent;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-600);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-tab:hover {
  color: var(--gray-900);
}

.filter-tab.active {
  background: white;
  color: var(--primary-700);
  box-shadow: var(--shadow-sm);
}

.tab-badge {
  width: 6px;
  height: 6px;
  background: var(--primary-500);
  border-radius: var(--radius-full);
}

/* Notifications List */
.notifications-section {
  min-height: 400px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  text-align: center;
}

.loading-state p {
  margin-top: var(--space-4);
  color: var(--gray-500);
}

.empty-illustration {
  position: relative;
  margin-bottom: var(--space-6);
}

.empty-bell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  background: var(--gray-100);
  border-radius: var(--radius-full);
  color: var(--gray-400);
}

.empty-bell svg {
  width: 48px;
  height: 48px;
}

.empty-particles {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.particle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--gray-300);
  border-radius: var(--radius-full);
  animation: float 3s ease-in-out infinite;
  animation-delay: var(--delay);
}

.particle:nth-child(1) { transform: translate(-40px, -30px); }
.particle:nth-child(2) { transform: translate(40px, -20px); }
.particle:nth-child(3) { transform: translate(-30px, 40px); }
.particle:nth-child(4) { transform: translate(35px, 35px); }
.particle:nth-child(5) { transform: translate(0, -50px); }

@keyframes float {
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 0.7; transform: translateY(-10px); }
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-2);
}

.empty-description {
  color: var(--gray-500);
  margin: 0 0 var(--space-6);
}

/* Notification Cards */
.notifications-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.notification-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-5);
  background: white;
  border-radius: var(--radius-xl);
  border: 1px solid var(--gray-200);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.notification-card:hover {
  border-color: var(--gray-300);
  box-shadow: var(--shadow-md);
}

.notification-card:hover .notification-actions {
  opacity: 1;
}

.notification-unread {
  background: linear-gradient(135deg, var(--primary-50), white);
  border-color: var(--primary-200);
}

.notification-urgent {
  border-left: 4px solid var(--red-500);
}

.notification-high {
  border-left: 4px solid var(--yellow-500);
}

.priority-indicator {
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 32px 32px 0;
  border-color: transparent;
  border-radius: 0 var(--radius-xl) 0 0;
}

.priority-indicator.priority-urgent {
  border-right-color: var(--red-500);
}

.priority-indicator.priority-high {
  border-right-color: var(--yellow-500);
}

.notification-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}

.notification-icon svg {
  width: 22px;
  height: 22px;
}

.icon-new_message,
.icon-customer_responded {
  background: var(--blue-100);
  color: var(--blue-600);
}

.icon-conversation_assigned,
.icon-conversation_transferred {
  background: var(--green-100);
  color: var(--green-600);
}

.icon-mention {
  background: var(--purple-100);
  color: var(--purple-600);
}

.icon-system {
  background: var(--gray-100);
  color: var(--gray-600);
}

.icon-priority_changed {
  background: var(--yellow-100);
  color: var(--yellow-600);
}

.icon-task_reminder {
  background: var(--orange-100);
  color: var(--orange-600);
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-1);
}

.notification-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notification-time {
  font-size: 0.75rem;
  color: var(--gray-500);
  white-space: nowrap;
}

.notification-text {
  font-size: 0.875rem;
  color: var(--gray-600);
  line-height: 1.5;
  margin: 0 0 var(--space-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notification-meta {
  display: flex;
  gap: var(--space-2);
}

.notification-type-badge,
.notification-priority-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.notification-type-badge {
  background: var(--gray-100);
  color: var(--gray-600);
}

.notification-priority-badge {
  background: var(--red-100);
  color: var(--red-700);
}

.notification-priority-badge.priority-high {
  background: var(--yellow-100);
  color: var(--yellow-700);
}

.notification-actions {
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--gray-100);
  color: var(--gray-600);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: var(--gray-200);
  color: var(--gray-900);
}

.action-btn-danger:hover {
  background: var(--red-100);
  color: var(--red-600);
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.unread-dot {
  position: absolute;
  left: var(--space-2);
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  background: var(--primary-500);
  border-radius: var(--radius-full);
}

/* Load More */
.load-more-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6);
}

.load-more-info {
  font-size: 0.875rem;
  color: var(--gray-500);
  margin: 0;
}

/* Settings Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.settings-modal {
  width: 100%;
  max-width: 520px;
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-2xl);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--gray-200);
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--gray-500);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.modal-close:hover {
  background: var(--gray-100);
  color: var(--gray-700);
}

.modal-body {
  padding: var(--space-6);
  max-height: 60vh;
  overflow-y: auto;
}

.settings-group {
  margin-bottom: var(--space-6);
}

.settings-group:last-child {
  margin-bottom: 0;
}

.settings-group-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gray-500);
  margin: 0 0 var(--space-4);
}

.settings-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  margin-bottom: var(--space-2);
  background: var(--gray-50);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.settings-toggle:hover {
  background: var(--gray-100);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.toggle-icon {
  width: 20px;
  height: 20px;
  color: var(--gray-500);
}

.toggle-label span {
  display: flex;
  flex-direction: column;
}

.toggle-label strong {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--gray-900);
}

.toggle-label small {
  font-size: 0.8125rem;
  color: var(--gray-500);
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--gray-300);
  border-radius: 12px;
  transition: background var(--transition-fast);
  flex-shrink: 0;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast);
}

.toggle-input:checked + .toggle-switch {
  background: var(--primary-500);
}

.toggle-input:checked + .toggle-switch::after {
  transform: translateX(20px);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--gray-200);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  background: var(--primary-500);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-600);
}

.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
}

.btn-secondary:hover {
  background: var(--gray-200);
}

.btn-ghost {
  background: transparent;
  color: var(--gray-600);
}

.btn-ghost:hover {
  background: var(--gray-100);
}

.btn-icon {
  width: 40px;
  height: 40px;
  padding: 0;
  background: var(--gray-100);
  color: var(--gray-600);
  border-radius: var(--radius-lg);
}

.btn-icon:hover {
  background: var(--gray-200);
  color: var(--gray-900);
}

.btn-lg {
  padding: var(--space-3) var(--space-6);
  font-size: 1rem;
}

.btn-sm {
  padding: var(--space-1) var(--space-2);
  font-size: 0.8125rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn svg {
  width: 18px;
  height: 18px;
}

/* Animations */
.notification-list-enter-active,
.notification-list-leave-active {
  transition: all 0.3s ease;
}

.notification-list-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.notification-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.notification-list-move {
  transition: transform 0.3s ease;
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .settings-modal,
.modal-leave-to .settings-modal {
  transform: scale(0.95) translateY(20px);
}

/* Responsive */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .notification-page {
    padding: var(--space-4);
  }

  .header-content {
    flex-direction: column;
    gap: var(--space-4);
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .filters-row {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group {
    width: 100%;
  }

  .filter-tabs {
    width: 100%;
    justify-content: center;
  }

  .notification-card {
    padding: var(--space-4);
  }

  .notification-actions {
    opacity: 1;
  }
}
</style>
