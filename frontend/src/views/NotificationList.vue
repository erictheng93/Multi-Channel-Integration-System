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

        <!-- Rail (wide screens): what is in the inbox, by priority and by period. Real counts from /notifications/stats. -->
        <aside
          v-if="stats"
          class="notif-rail"
          aria-label="通知概況"
        >
          <div class="ui-card rail-card">
            <section
              class="rail-lead"
              aria-labelledby="rail-lead-title"
            >
              <h2
                id="rail-lead-title"
                class="rail-label"
              >
                未讀通知
              </h2>
              <p class="rail-num">
                <span class="ui-num">{{ stats.unread }}</span><small>則</small>
              </p>
              <p class="rail-meta">
                <template v-if="urgentUnread > 0">
                  其中 <strong class="is-hot">{{ urgentUnread }} 則緊急</strong>
                </template>
                <template v-else-if="stats.unread > 0">
                  沒有緊急通知
                </template>
                <template v-else>
                  全部看完了
                </template>
              </p>
              <dl class="rail-time">
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

            <section
              v-if="priorityRows.length > 0"
              class="rail-sec"
              aria-labelledby="rail-priority"
            >
              <h2
                id="rail-priority"
                class="rail-label rail-label-pad"
              >
                依優先級
              </h2>
              <div
                class="rail-stack"
                aria-hidden="true"
              >
                <i
                  v-for="row in priorityRows"
                  :key="row.value"
                  :class="`tone-${row.value}`"
                  :style="{ flexGrow: row.total }"
                />
              </div>
              <button
                v-for="row in priorityRows"
                :key="row.value"
                type="button"
                class="rail-row"
                :class="{ 'is-selected': filters.selectedPriority.value === row.value }"
                :aria-pressed="filters.selectedPriority.value === row.value"
                @click="togglePriority(row.value)"
              >
                <span
                  class="rail-key"
                  :class="`tone-${row.value}`"
                  aria-hidden="true"
                />
                <span class="rail-name">{{ row.label }}</span>
                <span class="rail-total">{{ row.total }}</span>
              </button>
            </section>

            <section
              v-if="typeRows.length > 0"
              class="rail-sec"
              aria-labelledby="rail-type"
            >
              <h2
                id="rail-type"
                class="rail-label rail-label-pad"
              >
                依類型
              </h2>
              <button
                v-for="row in typeRows"
                :key="row.value"
                type="button"
                class="rail-row"
                :class="{ 'is-selected': filters.selectedType.value === row.value }"
                :aria-pressed="filters.selectedType.value === row.value"
                @click="toggleType(row.value)"
              >
                <span class="rail-name">{{ row.label }}</span>
                <span
                  class="rail-bar"
                  aria-hidden="true"
                ><i
                  :class="`bar-${row.value}`"
                  :style="{ width: `${row.share}%` }"
                /></span>
                <span class="rail-total">{{ row.total }}</span>
              </button>
            </section>
          </div>
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

// Each row carries its share of the largest row so the rail reads as a small bar chart, not a number list
function withShare<T extends { total: number }>(rows: T[]): Array<T & { share: number }> {
  const max = Math.max(1, ...rows.map((r) => r.total))
  return rows.map((r) => ({ ...r, share: Math.max(4, Math.round((r.total / max) * 100)) }))
}

const typeRows = computed(() =>
  withShare(filters.notificationTypes
    .map((t) => ({
      ...t,
      total: stats.value?.byType?.[t.value as keyof NonNullable<typeof stats.value>['byType']]?.total ?? 0,
      unread: stats.value?.byType?.[t.value as keyof NonNullable<typeof stats.value>['byType']]?.unread ?? 0
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total))
)

const priorityRows = computed(() =>
  withShare(filters.priorities
    .map((p) => ({
      ...p,
      total: stats.value?.byPriority?.[p.value as 'low' | 'normal' | 'high' | 'urgent']?.total ?? 0,
      unread: stats.value?.byPriority?.[p.value as 'low' | 'normal' | 'high' | 'urgent']?.unread ?? 0
    }))
    .filter((row) => row.total > 0))
)

const urgentUnread = computed(() => stats.value?.byPriority?.urgent?.unread ?? 0)

function togglePriority(value: string): void {
  filters.selectedPriority.value = (filters.selectedPriority.value === value ? '' : value) as typeof filters.selectedPriority.value
  filters.applyFilters()
}

function toggleType(value: string): void {
  filters.selectedType.value = (filters.selectedType.value === value ? '' : value) as typeof filters.selectedType.value
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

.notif-rail {
  position: sticky;
  top: 16px;
  min-width: 0;
}

.rail-card {
  display: grid;
  overflow: hidden;
  box-shadow: var(--ui-shadow-card);
}

.rail-lead {
  display: grid;
  gap: 4px;
  padding: 20px 22px 18px;
}

.rail-label {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.rail-label-pad {
  padding: 0 10px 4px;
}

.rail-num {
  margin: 0;
  font: 600 48px / 1.05 var(--ui-font-display);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.rail-num small {
  margin-left: 4px;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-ink-2);
}

.rail-meta {
  margin: 0;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.rail-meta .is-hot {
  font-weight: 600;
  color: var(--ui-red-ink);
}

.rail-sec {
  display: grid;
  gap: 2px;
  padding: 16px 12px 12px;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.rail-stack {
  display: flex;
  gap: 3px;
  height: 10px;
  margin: 0 10px 6px;
}

.rail-stack i {
  flex-basis: 0;
  min-width: 6px;
  border-radius: 999px;
}

.tone-urgent {
  background: var(--ui-red);
}

.tone-high {
  background: var(--ui-orange);
}

.tone-normal {
  background: var(--ui-accent);
}

.tone-low {
  background: var(--ui-faint);
}

.rail-key {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.rail-row {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  min-height: 44px;
  padding: 0 10px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.rail-row:hover {
  background: var(--ui-fill);
}

.rail-row.is-selected {
  background: var(--ui-sel-tint);
  box-shadow: var(--ui-sel-ring);
}

.rail-row:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.rail-name {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
}

/* type share: a solid bar against a visible track, so the ranking reads at a glance */
.rail-bar {
  flex: none;
  width: 72px;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill-strong);
}

/* each type keeps the colour of its icon tile on the cards, so the rail and the list read as one system */
.rail-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--ui-faint);
}

.rail-bar i.bar-new_message,
.rail-bar i.bar-new_conversation,
.rail-bar i.bar-agent_removed_from_team { background: var(--ui-red); }
.rail-bar i.bar-customer_responded { background: var(--ui-green); }
.rail-bar i.bar-conversation_assigned,
.rail-bar i.bar-customer_followed { background: var(--ui-blue); }
.rail-bar i.bar-conversation_transferred { background: #8e7cc3; }
.rail-bar i.bar-mention,
.rail-bar i.bar-task_reminder { background: var(--ui-orange); }

.rail-total {
  min-width: 2ch;
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
  text-align: right;
}

.rail-time {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 12px 0 0;
  padding: 12px 0 0;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.rail-time > div {
  display: grid;
  gap: 2px;
  padding: 0 10px;
}

.rail-time > div:first-child {
  padding-left: 0;
}

.rail-time > div + div {
  box-shadow: inset 0.5px 0 0 var(--ui-sep);
}

.rail-time dt {
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-ink-2);
}

.rail-time dd {
  margin: 0;
  font: 600 24px / 1.1 var(--ui-font-display);
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

@media (max-width: 768px) {
  .day-label {
    padding: 14px 16px 4px;
  }

  .load-more-section {
    padding: 10px 16px;
  }
}
</style>
