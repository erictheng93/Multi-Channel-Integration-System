<!--
  NotificationList.vue (Refactored)

  Size: ~200 lines (down from 1,865 lines)
  Components: 5 reusable components
  Controller: useNotificationController composable
-->

<template>
  <div
    class="notification-page"
    role="main"
    aria-label="通知中心頁面"
  >
    <!-- Page Header -->
    <NotificationHeader
      :has-unread="hasUnread"
      :marking-all-read="actions.markingAllRead.value"
      @mark-all-read="actions.handleMarkAllRead"
      @open-settings="showSettings = true"
    />

    <!-- Stats Overview -->
    <NotificationStats :stats="stats" />

    <!-- Filters Section -->
    <NotificationFilters
      v-model:selected-type="filters.selectedType.value"
      v-model:selected-priority="filters.selectedPriority.value"
      v-model:selected-read-status="filters.selectedReadStatus.value"
      :has-active-filters="filters.hasActiveFilters.value"
      :notification-types="filters.notificationTypes"
      :priorities="filters.priorities"
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

      <!-- Notifications Grid -->
      <div
        v-else
        class="notifications-list"
      >
        <TransitionGroup name="notification-list">
          <NotificationCard
            v-for="(notification, index) in notifications"
            :key="notification.id"
            :notification="notification"
            :index="index"
            :is-focused="keyboard.focusedNotificationIndex.value === index"
            @click="actions.handleNotificationClick"
            @mark-read="actions.handleMarkRead"
            @delete="actions.handleDelete"
            @set-ref="keyboard.setNotificationRef"
          />
        </TransitionGroup>

        <!-- Load More -->
        <div
          v-if="canLoadMore"
          class="load-more-section"
        >
          <button
            class="btn btn-secondary btn-lg"
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
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useNotificationController } from '@/composables/notification/useNotificationController'
import { LoadingSpinner } from '@/components/ui'
import {
  NotificationHeader,
  NotificationStats,
  NotificationFilters,
  NotificationCard,
  NotificationEmptyState
} from '@/components/notification'
import NotificationSettingsModal from '@/components/notification/NotificationSettingsModal.vue'

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

// ==================== Lifecycle ====================

onMounted(async () => {
  await controller.initialize()
})

onUnmounted(() => {
  controller.cleanup()
})
</script>

<style scoped>
/* ==================== Page Layout ==================== */
.notification-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-6);
}

/* ==================== Notifications List ==================== */
.notifications-section {
  min-height: 400px;
}

.loading-state {
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

.notifications-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* ==================== Load More ==================== */
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

/* ==================== Buttons ==================== */
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

.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
}

.btn-secondary:hover {
  background: var(--gray-200);
}

.btn-lg {
  padding: var(--space-3) var(--space-6);
  font-size: 1rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn svg {
  width: 18px;
  height: 18px;
}

/* ==================== Animations ==================== */
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

/* ==================== Responsive Design ==================== */
@media (max-width: 768px) {
  .notification-page {
    padding: var(--space-4);
  }
}
</style>
