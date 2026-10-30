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
        <div class="notif-main ui-card">
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
                  class="btn btn-secondary btn-sm"
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

        <!-- Rail (wide screens): what is in the inbox, by priority and by period. Real counts from /notifications/stats. -->
        <aside
          v-if="stats"
          class="notif-rail"
          aria-label="通知概況"
        >
          <section aria-labelledby="rail-prio">
            <h2
              id="rail-prio"
              class="ui-group-label"
            >
              依優先級
            </h2>
            <div class="ui-group">
              <button
                v-for="row in priorityRows"
                :key="row.value"
                type="button"
                class="ui-row rail-row"
                :class="{ 'is-selected': filters.selectedPriority.value === row.value }"
                :aria-pressed="filters.selectedPriority.value === row.value"
                @click="togglePriority(row.value)"
              >
                <span
                  class="rail-dot"
                  :class="`is-${row.value}`"
                  aria-hidden="true"
                />
                <span class="ui-row-main rail-name">{{ row.label }}</span>
                <span
                  v-if="row.unread > 0"
                  class="rail-unread"
                >{{ row.unread }} 未讀</span>
                <span class="rail-total">{{ row.total }}</span>
              </button>
            </div>
            <p class="ui-group-foot">
              點一下即可只看該優先級。
            </p>
          </section>

          <section
            v-if="typeRows.length > 0"
            aria-labelledby="rail-type"
          >
            <h2
              id="rail-type"
              class="ui-group-label"
            >
              依類型
            </h2>
            <div class="ui-group">
              <button
                v-for="row in typeRows"
                :key="row.value"
                type="button"
                class="ui-row rail-row rail-row-sm"
                :class="{ 'is-selected': filters.selectedType.value === row.value }"
                :aria-pressed="filters.selectedType.value === row.value"
                @click="toggleType(row.value)"
              >
                <span class="ui-row-main rail-name">{{ row.label }}</span>
                <span
                  v-if="row.unread > 0"
                  class="rail-unread"
                >{{ row.unread }} 未讀</span>
                <span class="rail-total">{{ row.total }}</span>
              </button>
            </div>
          </section>

          <section aria-labelledby="rail-time">
            <h2
              id="rail-time"
              class="ui-group-label"
            >
              收到的通知
            </h2>
            <dl class="ui-card rail-time">
              <div>
                <dt>今天</dt>
                <dd>{{ stats.timeRange?.today ?? 0 }}</dd>
              </div>
              <div>
                <dt>本週</dt>
                <dd>{{ stats.timeRange?.thisWeek ?? 0 }}</dd>
              </div>
              <div>
                <dt>本月</dt>
                <dd>{{ stats.timeRange?.thisMonth ?? 0 }}</dd>
              </div>
            </dl>
          </section>
        </aside>
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

const PRIORITY_ROWS = [
  { value: 'urgent', label: '緊急' },
  { value: 'high', label: '高' },
  { value: 'normal', label: '一般' },
  { value: 'low', label: '低' }
] as const

const priorityRows = computed(() =>
  PRIORITY_ROWS.map((row) => ({
    ...row,
    total: stats.value?.byPriority?.[row.value]?.total ?? 0,
    unread: stats.value?.byPriority?.[row.value]?.unread ?? 0
  })).filter((row) => row.total > 0)
)

const typeRows = computed(() =>
  filters.notificationTypes
    .map((t) => ({
      ...t,
      total: stats.value?.byType?.[t.value as keyof NonNullable<typeof stats.value>['byType']]?.total ?? 0,
      unread: stats.value?.byType?.[t.value as keyof NonNullable<typeof stats.value>['byType']]?.unread ?? 0
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
)

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

/* Inbox (left) + overview rail (right, wide screens only) */
.notif-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 20px;
  align-items: start;
}

.notif-main {
  min-width: 0;
  overflow: hidden;
}

.notif-rail .ui-group {
  --row-inset: 18px;
}

.notif-rail {
  display: grid;
  gap: 20px;
  min-width: 0;
}

.rail-row {
  width: 100%;
  min-height: 52px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.rail-row:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.rail-row-sm {
  min-height: 44px;
}

.rail-dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ui-faint);
}

.rail-dot.is-urgent {
  background: var(--ui-red);
}

.rail-dot.is-high {
  background: var(--ui-orange);
}

.rail-dot.is-normal {
  background: var(--ui-blue);
}

.rail-name {
  font-size: 15px;
  font-weight: 500;
}

.rail-unread {
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
  font-size: 13px;
  font-weight: 600;
}

.rail-total {
  min-width: 2ch;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink-2);
  text-align: right;
}

.rail-time {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  padding: 18px 8px;
}

.rail-time > div {
  display: grid;
  gap: 4px;
  padding: 0 14px;
}

.rail-time > div + div {
  box-shadow: inset 0.5px 0 0 var(--ui-sep);
}

.rail-time dt {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.rail-time dd {
  margin: 0;
  font: 600 28px / 1.1 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--ui-ink);
}

.notifications-section {
  min-height: 240px;
}

@media (max-width: 1024px) {
  .notif-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .notif-rail {
    display: none;
  }
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
  padding: 16px 24px 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
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

@media (max-width: 768px) {
  .day-label {
    padding: 14px 16px 4px;
  }

  .load-more-section {
    padding: 10px 16px;
  }
}
</style>
