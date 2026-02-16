<template>
  <header class="top-bar">
    <div class="breadcrumb">
      <span class="breadcrumb-item">{{ pageTitle }}</span>
    </div>

    <div class="top-bar-actions">
      <!-- Stats slot (used by ConversationDetail page) -->
      <slot name="stats" />

      <!-- Notification Center -->
      <NotificationCenter @notification-click="(n: Notification) => $emit('notification-click', n)" />

      <!-- Status Indicator -->
      <div class="status-indicator">
        <div class="status-dot online" />
        <span class="status-text">線上</span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
  import { NotificationCenter } from '@/components/ui'
  import type { Notification } from '@/stores/notifications'

  defineProps<{
    pageTitle: string
  }>()

  defineEmits<{
    'notification-click': [notification: Notification]
  }>()
</script>

<style scoped>
  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    background-color: white;
    border-bottom: 1px solid var(--gray-200);
  }

  .breadcrumb-item {
    font-weight: 600;
    font-size: 1.125rem;
    color: var(--gray-900);
  }

  .top-bar-actions {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
  }

  .status-dot.online {
    background-color: var(--success-500);
  }

  .status-text {
    font-size: 0.875rem;
    color: var(--gray-600);
  }

  @media (max-width: 768px) {
    .top-bar {
      padding-left: 80px;
    }
  }
</style>
