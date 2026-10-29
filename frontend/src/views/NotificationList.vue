<!--
  NotificationList.vue

  Renders inside the app shell (sidebar + top bar) like every other page.
  Components: header, filters, card; state lives in useNotificationController.
-->

<template>
  <AppLayout>
    <div
      class="ui-page notification-page ui-rise"
      role="main"
      aria-label="通知頁面"
    >
      <!-- Page Header: subtitle from /notifications/stats -->
      <NotificationHeader
        :has-unread="hasUnread"
        :marking-all-read="actions.markingAllRead.value"
        :stats="stats"
        @mark-all-read="actions.handleMarkAllRead"
        @open-settings="showSettings = true"
      />

      <!-- Filters Section -->
      <NotificationFilters
        v-model:selected-type="filters.selectedType.value"
        v-model:selected-priority="filters.selectedPriority.value"
        v-model:selected-read-status="filters.selectedReadStatus.value"
        :has-active-filters="filters.hasActiveFilters.value"
        :notification-types="filters.notificationTypes"
        :priorities="filters.priorities"
        :counts="stats ? { total: stats.total, unread: stats.unread } : null"
        @apply-filters="filters.applyFilters"
        @clear-filters="filters.clearFilters"
      />

      <!-- Notifications List -->
      <section
        class="notifications-section ui-card"
        role="region"
        aria-label="通知列表"
        aria-live="polite"
        :aria-busy="loading"
      >
        <!-- Loading State -->
        <div
          v-if="loading && notifications.length === 0"
          class="loading-state"
          role="status"
          aria-live="polite"
        >
          <LoadingSpinner size="lg" />
          <p>載入通知中...</p>
        </div>

        <!-- Empty State -->
        <NotificationEmptyState
          v-else-if="notifications.length === 0"
          :has-active-filters="filters.hasActiveFilters.value"
          @clear-filters="filters.clearFilters"
        />

        <!-- Notifications grouped by day (Asia/Taipei) -->
        <div
          v-else
          class="notifications-list"
        >
          <div
            v-for="group in groups"
            :key="group.key"
            class="day-group"
          >
            <h2 class="day-label">
              {{ group.label }}
            </h2>
            <TransitionGroup name="notification-list">
              <NotificationCard
                v-for="item in group.items"
                :key="item.notification.id"
                :notification="item.notification"
                :index="item.index"
                :is-focused="keyboard.focusedNotificationIndex.value === item.index"
                @click="actions.handleNotificationClick"
                @mark-read="actions.handleMarkRead"
                @delete="actions.handleDelete"
                @set-ref="keyboard.setNotificationRef"
              />
            </TransitionGroup>
          </div>

          <!-- Load More -->
          <div
            v-if="canLoadMore"
            class="load-more-section"
          >
            <button
              class="btn btn-secondary"
              :disabled="loadingMore"
              @click="actions.handleLoadMore"
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
      <NotificationSettingsModal
        v-model:visible="showSettings"
        :settings="settings.settings.value"
        @save="settings.saveSettings"
      />
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useNotificationController } from '@/composables/notification/useNotificationController'
import AppLayout from '@/components/ui/AppLayout.vue'
import { LoadingSpinner } from '@/components/ui'
import {
  NotificationHeader,
  NotificationFilters,
  NotificationCard,
  NotificationEmptyState
} from '@/components/notification'
import NotificationSettingsModal from '@/components/notification/NotificationSettingsModal.vue'
import type { Notification } from '@/stores/notifications'

// ==================== Controller & State ====================

// Initialize main controller
const controller = useNotificationController()

// Extract state from controller
const {
  showSettings,
  notifications,
  stats,
  loading,
  loadingMore,
  pagination,
  canLoadMore,
  hasUnread,
  filters,
  actions,
  settings,
  keyboard
} = controller

// ==================== Day grouping ====================

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' })

interface IndexedNotification {
  notification: Notification
  /** Position in the flat list, used by keyboard navigation */
  index: number
}

interface DayGroup {
  key: string
  label: string
  items: IndexedNotification[]
}

const groups = computed<DayGroup[]>(() => {
  const nowMs = Date.now()
  const today = DAY_FORMAT.format(nowMs)
  const yesterday = DAY_FORMAT.format(nowMs - 864e5)
  const out: DayGroup[] = []
  notifications.value.forEach((notification, index) => {
    const key = DAY_FORMAT.format(new Date(notification.createdAt))
    let group = out[out.length - 1]
    if (!group || group.key !== key) {
      const label = key === today ? '今天' : key === yesterday ? '昨天' : key.replace(/-/g, '/')
      group = { key, label, items: [] }
      out.push(group)
    }
    group.items.push({ notification, index })
  })
  return out
})

// ==================== Lifecycle ====================

// /notifications?settings=1 (linked from 個人設定) opens the settings dialog straight away
const route = useRoute()
onMounted(async () => {
  await controller.initialize()
  if (route.query.settings === '1') { showSettings.value = true }
})

onUnmounted(() => {
  controller.cleanup()
})
</script>

<style scoped>

.notifications-section {
  min-height: 240px;
  overflow: hidden;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}

.loading-state p {
  margin-top: 16px;
  color: var(--ui-muted);
}

.notifications-list {
  padding: 4px 0 8px;
}

.day-label {
  margin: 0;
  padding: 16px 22px 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}

.load-more-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 24px 22px;
}

.load-more-info {
  margin: 0;
  font-size: 13px;
  color: var(--ui-muted);
}

.notification-list-enter-active,
.notification-list-leave-active {
  transition: opacity 0.3s var(--ui-ease), transform 0.3s var(--ui-ease);
}

.notification-list-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.notification-list-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

.notification-list-move {
  transition: transform 0.3s var(--ui-ease);
}

@media (max-width: 768px) {
  .day-label {
    padding: 14px 16px 4px;
  }
}
</style>
