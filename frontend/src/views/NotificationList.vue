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

      <div class="notif-grid">
        <!-- The inbox at a glance: what needs you, then every type and priority as a filter row -->
        <NotificationRail
          v-if="stats && typeRows.length > 0"
          class="notif-rail"
          :unread="stats.unread"
          :urgent-unread="urgentUnread"
          :times="times"
          :types="typeRows"
          :priorities="priorityRows"
          :selected-type="filters.selectedType.value"
          :selected-priority="filters.selectedPriority.value"
          @toggle-type="toggleType"
          @toggle-priority="togglePriority"
        />

        <div class="notif-main ui-card">
          <NotificationFilters
            v-model:selected-type="filters.selectedType.value"
            v-model:selected-priority="filters.selectedPriority.value"
            v-model:selected-read-status="filters.selectedReadStatus.value"
            :has-active-filters="filters.hasActiveFilters.value"
            :notification-types="filters.notificationTypes"
            :priorities="filters.priorities"
            :counts="stats ? { total: stats.total, unread: stats.unread } : null"
            :show-type-select="!hasRail"
            :show-priority-select="!hasRail"
            :result-count="pagination.total"
            @apply-filters="filters.applyFilters"
            @clear-filters="filters.clearFilters"
          />

          <!-- Notifications List -->
          <section
            class="notifications-section"
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
                  <span class="day-count">{{ group.items.length }} 則</span>
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
        </div>
      </div>

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
import NotificationRail from '@/components/notification/NotificationRail.vue'
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

// ==================== Rail ====================

const typeRows = computed(() =>
  filters.notificationTypes
    .map((t) => ({
      ...t,
      total: stats.value?.byType?.[t.value as keyof NonNullable<typeof stats.value>['byType']]?.total ?? 0,
      unread: stats.value?.byType?.[t.value as keyof NonNullable<typeof stats.value>['byType']]?.unread ?? 0
    }))
    .filter((row) => row.total > 0)
)

const priorityRows = computed(() =>
  filters.priorities.map((p) => ({
    ...p,
    total: stats.value?.byPriority?.[p.value as keyof NonNullable<typeof stats.value>['byPriority']]?.total ?? 0,
    unread: stats.value?.byPriority?.[p.value as keyof NonNullable<typeof stats.value>['byPriority']]?.unread ?? 0
  }))
)

const hasRail = computed(() => !!stats.value && typeRows.value.length > 0)

const times = computed(() => [
  { label: '全部', value: stats.value?.total ?? 0 },
  { label: '今天', value: stats.value?.timeRange?.today ?? 0 },
  { label: '本週', value: stats.value?.timeRange?.thisWeek ?? 0 },
  { label: '本月', value: stats.value?.timeRange?.thisMonth ?? 0 }
])

const urgentUnread = computed(() => stats.value?.byPriority?.urgent?.unread ?? 0)

function toggleType(value: string): void {
  filters.selectedType.value = (filters.selectedType.value === value ? '' : value) as typeof filters.selectedType.value
  filters.applyFilters()
}

function togglePriority(value: string): void {
  filters.selectedPriority.value = (filters.selectedPriority.value === value ? '' : value) as typeof filters.selectedPriority.value
  filters.applyFilters()
}

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

/* Two columns: the list takes the room, the rail (the page's one elevated object) rides beside it */
.notif-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  grid-template-areas: "main rail";
  gap: var(--ui-page-gap);
  align-items: start;
}

.notif-rail {
  grid-area: rail;
  position: sticky;
  top: calc(var(--ui-topbar-h) + 16px);
}

.notif-main {
  grid-area: main;
  min-width: 0;
  overflow: hidden;
}

.notifications-section {
  min-height: 240px;
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
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin: 0;
  padding: 18px 24px 6px;
  font-size: 15px;
  font-weight: 700;
  color: var(--ui-ink);
}

.day-count {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

/* A footer strip, not a lone pill in an empty card: the count on the left, the action on the right */
.load-more-section {
  display: flex;
  flex-direction: row-reverse;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 6px;
  padding: 12px 22px;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
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

@media (max-width: 1024px) {
  .notif-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "rail" "main";
  }

  .notif-rail {
    position: static;
  }
}

@media (max-width: 768px) {
  .day-label {
    padding: 14px 16px 4px;
  }

  .load-more-section {
    padding: 10px 16px;
  }
}
</style>
