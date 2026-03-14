<template>
  <div class="notification-center">
    <!-- 觸發按鈕 -->
    <button
      ref="triggerRef"
      class="notification-trigger"
      :class="{
        'notification-trigger-active': isOpen,
        'notification-trigger-has-unread': unreadCount > 0,
        'notification-trigger-ring': shouldRing
      }"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      :aria-label="unreadCount > 0 ? `通知中心 (${unreadCount} 則未讀)` : '通知中心'"
      :title="unreadCount > 0 ? `${unreadCount} 則未讀通知` : '通知中心'"
      @click="toggle"
    >
      <BellIcon
        :class="unreadCount > 0 ? 'notification-icon notification-icon-pulse' : 'notification-icon'"
      />
      <NotificationBadge
        v-if="unreadCount > 0"
        :count="unreadCount"
        size="sm"
        :pulse="hasUrgent"
        class="notification-trigger-badge"
      />
      <!-- 紅點指示器 -->
      <span
        v-if="unreadCount > 0"
        class="notification-trigger-dot"
      />
    </button>

    <!-- 通知面板 -->
    <Teleport to="body">
      <Transition name="notification-panel">
        <div
          v-if="isOpen"
          ref="panelRef"
          class="notification-panel"
          :style="panelStyles"
          role="dialog"
          aria-label="通知列表"
        >
          <!-- 標題列 -->
          <div class="notification-panel-header">
            <h3 class="notification-panel-title">
              通知
              <span
                v-if="unreadCount > 0"
                class="notification-panel-count"
              >
                {{ unreadCount }}
              </span>
            </h3>
            <div class="notification-panel-actions">
              <button
                v-if="unreadCount > 0"
                class="notification-action-btn"
                title="全部標記已讀"
                @click="handleMarkAllRead"
              >
                <CheckAllIcon />
              </button>
              <button
                class="notification-action-btn"
                title="重新整理"
                :disabled="loading"
                @click="handleRefresh"
              >
                <RefreshIcon :class="loading ? 'spin' : ''" />
              </button>
            </div>
          </div>

          <!-- 篩選標籤 -->
          <div class="notification-panel-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.value"
              class="notification-tab"
              :class="{ 'notification-tab-active': activeTab === tab.value }"
              @click="activeTab = tab.value"
            >
              {{ tab.label }}
              <span
                v-if="tab.count > 0"
                class="notification-tab-count"
              >
                {{ tab.count }}
              </span>
            </button>
          </div>

          <!-- 通知列表 -->
          <div
            class="notification-panel-content"
            @scroll="handleScroll"
          >
            <!-- 載入中 -->
            <div
              v-if="loading && notifications.length === 0"
              class="notification-loading"
            >
              <LoadingSpinner size="sm" />
              <span>載入中...</span>
            </div>

            <!-- 空狀態 -->
            <div
              v-else-if="filteredNotifications.length === 0"
              class="notification-empty"
            >
              <BellOffIcon class="notification-empty-icon" />
              <p>沒有{{ activeTab === 'unread' ? '未讀' : '' }}通知</p>
            </div>

            <!-- 通知項目 -->
            <div
              v-else
              class="notification-list"
            >
              <NotificationItem
                v-for="notification in filteredNotifications"
                :key="notification.id"
                :notification="notification"
                @click="handleNotificationClick(notification)"
                @mark-read="handleMarkRead(notification.id)"
                @delete="handleDelete(notification.id)"
              />

              <!-- 載入更多 -->
              <div
                v-if="canLoadMore"
                class="notification-load-more"
              >
                <button
                  class="notification-load-more-btn"
                  :disabled="loadingMore"
                  @click="handleLoadMore"
                >
                  {{ loadingMore ? '載入中...' : '載入更多' }}
                </button>
              </div>
            </div>
          </div>

          <!-- 底部 -->
          <div class="notification-panel-footer">
            <router-link
              to="/notifications"
              class="notification-view-all"
              @click="close"
            >
              查看全部通知
            </router-link>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useNotificationsStore, type Notification } from '@/stores/notifications'
import NotificationBadge from './NotificationBadge.vue'
import NotificationItem from './NotificationItem.vue'
import LoadingSpinner from './LoadingSpinner.vue'
import { BellIcon, BellOffIcon, CheckAllIcon, RefreshIcon } from '@/components/icons'

const emit = defineEmits<{
  (_e: 'notification-click', _notification: Notification): void
}>()

const store = useNotificationsStore()

// Refs
const triggerRef = ref<HTMLElement>()
const panelRef = ref<HTMLElement>()
const isOpen = ref(false)
const activeTab = ref<'all' | 'unread'>('all')
const panelStyles = ref({})
const shouldRing = ref(false)

// Computed
const notifications = computed(() => store.notifications)
const recentNotifications = computed(() => store.recentNotifications)
const unreadCount = computed(() => store.unreadCount)
const loading = computed(() => store.loading)
const loadingMore = computed(() => store.loadingMore)
const canLoadMore = computed(() => store.canLoadMore)

const hasUrgent = computed(() =>
  store.urgentNotifications.length > 0
)

const filteredNotifications = computed(() => {
  const list = notifications.value.length > 0 ? notifications.value : recentNotifications.value
  if (activeTab.value === 'unread') {
    return list.filter(n => !n.isRead)
  }
  return list
})

const tabs = computed(() => [
  { value: 'all' as const, label: '全部', count: notifications.value.length },
  { value: 'unread' as const, label: '未讀', count: unreadCount.value }
])

// Methods
const toggle = () => {
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}

const open = async () => {
  isOpen.value = true
  await nextTick()
  calculatePosition()

  // 載入通知
  if (notifications.value.length === 0) {
    await store.fetchNotifications()
  }

  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', calculatePosition)
}

const close = () => {
  isOpen.value = false
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', calculatePosition)
}

const calculatePosition = () => {
  if (!triggerRef.value || !panelRef.value) {return}

  const trigger = triggerRef.value.getBoundingClientRect()
  const panel = panelRef.value.getBoundingClientRect()
  const viewport = { width: window.innerWidth, height: window.innerHeight }

  let left = trigger.right - panel.width
  let top = trigger.bottom + 8

  // 防止超出邊界
  if (left < 8) {left = 8}
  if (left + panel.width > viewport.width - 8) {
    left = viewport.width - panel.width - 8
  }
  if (top + panel.height > viewport.height - 8) {
    top = trigger.top - panel.height - 8
  }

  panelStyles.value = {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    zIndex: 10000 // 新方案: 提升到最高层级
  }
}

const handleClickOutside = (event: Event) => {
  const target = event.target as Element
  if (!triggerRef.value?.contains(target) && !panelRef.value?.contains(target)) {
    close()
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    close()
  }
}

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  const { scrollTop, scrollHeight, clientHeight } = target

  // 接近底部時載入更多
  if (scrollHeight - scrollTop - clientHeight < 100 && canLoadMore.value && !loadingMore.value) {
    handleLoadMore()
  }
}

const handleRefresh = async () => {
  await store.refreshNotifications()
}

const handleMarkAllRead = async () => {
  await store.markAllAsRead()
}

const handleMarkRead = async (id: string) => {
  await store.markAsRead(id)
}

const handleDelete = async (id: string) => {
  await store.deleteNotification(id)
}

const handleLoadMore = async () => {
  await store.loadMoreNotifications()
}

const handleNotificationClick = (notification: Notification) => {
  // 標記已讀
  if (!notification.isRead) {
    store.markAsRead(notification.id)
  }

  emit('notification-click', notification)
  close()
}

// Lifecycle
onMounted(() => {
  // 初始載入未讀數量
  store.fetchUnreadCount()
  store.fetchRecentNotifications()

  // 開始輪詢
  store.startPolling(30000)
})

onUnmounted(() => {
  store.stopPolling()
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', calculatePosition)
})

// Watch for new notifications
watch(() => store.unreadCount, (newCount, oldCount) => {
  if (newCount > oldCount && !isOpen.value) {
    // 可以在這裡觸發桌面通知或音效
    console.log(` New notifications: ${newCount - oldCount}`)

    // 觸發搖鈴動畫
    shouldRing.value = true
    setTimeout(() => {
      shouldRing.value = false
    }, 1000)
  }
})

defineExpose({ open, close, toggle, isOpen })
</script>

<style scoped>
.notification-center {
  position: relative;
}

/* 觸發按鈕 */
.notification-trigger {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--gray-600);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.notification-trigger:hover {
  background: var(--gray-100);
  color: var(--gray-900);
}

.notification-trigger-active {
  background: var(--primary-50);
  color: var(--primary-600);
}

/* 有未讀通知時的樣式 */
.notification-trigger-has-unread {
  color: var(--primary-600);
}

.notification-trigger-has-unread:hover {
  background: var(--primary-50);
  color: var(--primary-700);
}

.notification-icon {
  width: 20px;
  height: 20px;
  transition: all var(--transition-fast);
}

/* 鈴鐺圖標脈動動畫 */
.notification-icon-pulse {
  animation: bellPulse 2s ease-in-out infinite;
}

@keyframes bellPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}

/* 搖鈴動畫 */
.notification-trigger-ring .notification-icon {
  animation: bellRing 0.5s ease-in-out;
}

@keyframes bellRing {
  0%, 100% {
    transform: rotate(0deg);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: rotate(-15deg);
  }
  20%, 40%, 60%, 80% {
    transform: rotate(15deg);
  }
}

.notification-trigger-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  pointer-events: none;
}

/* 紅點指示器 */
.notification-trigger-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  background: var(--red-500);
  border: 2px solid white;
  border-radius: 50%;
  pointer-events: none;
  animation: dotPulse 2s ease-in-out infinite;
}

@keyframes dotPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0);
  }
}

/* 面板 */
.notification-panel {
  width: 380px;
  max-height: 520px;
  background: white;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--gray-200);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.notification-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--gray-200);
}

.notification-panel-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0;
}

.notification-panel-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  background: var(--red-500);
  color: white;
  border-radius: 9999px;
}

.notification-panel-actions {
  display: flex;
  gap: var(--space-1);
}

.notification-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--gray-500);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.notification-action-btn:hover:not(:disabled) {
  background: var(--gray-100);
  color: var(--gray-700);
}

.notification-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.notification-action-btn svg {
  width: 16px;
  height: 16px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 標籤 */
.notification-panel-tabs {
  display: flex;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--gray-200);
}

.notification-tab {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-600);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.notification-tab:hover {
  color: var(--gray-900);
}

.notification-tab-active {
  color: var(--primary-600);
  border-bottom-color: var(--primary-500);
}

.notification-tab-count {
  font-size: 11px;
  padding: 1px 6px;
  background: var(--gray-100);
  border-radius: 9999px;
}

.notification-tab-active .notification-tab-count {
  background: var(--primary-100);
  color: var(--primary-700);
}

/* 內容區 */
.notification-panel-content {
  flex: 1;
  overflow-y: auto;
  min-height: 200px;
  max-height: 360px;
}

.notification-list {
  padding: var(--space-2);
}

.notification-loading,
.notification-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--gray-500);
}

.notification-empty-icon {
  width: 48px;
  height: 48px;
  color: var(--gray-300);
}

.notification-load-more {
  padding: var(--space-3);
  text-align: center;
}

.notification-load-more-btn {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  background: white;
  font-size: 0.875rem;
  color: var(--gray-700);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.notification-load-more-btn:hover:not(:disabled) {
  background: var(--gray-50);
  border-color: var(--gray-400);
}

.notification-load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 底部 */
.notification-panel-footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--gray-200);
  text-align: center;
}

.notification-view-all {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--primary-600);
  text-decoration: none;
}

.notification-view-all:hover {
  color: var(--primary-700);
  text-decoration: underline;
}

/* 動畫 */
.notification-panel-enter-active,
.notification-panel-leave-active {
  transition: all 0.2s ease;
}

.notification-panel-enter-from,
.notification-panel-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

/* 響應式 */
@media (max-width: 480px) {
  .notification-panel {
    width: calc(100vw - 16px);
    max-height: 70vh;
  }
}
</style>
