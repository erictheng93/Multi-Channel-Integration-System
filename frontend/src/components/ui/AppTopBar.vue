<template>
  <header class="top-bar">
    <nav
      class="breadcrumb"
      aria-label="目前位置"
    >
      <template v-if="sectionLabel">
        <span class="breadcrumb-section">{{ sectionLabel }}</span>
        <span
          class="breadcrumb-sep"
          aria-hidden="true"
        >/</span>
      </template>
      <b
        class="breadcrumb-item"
        aria-current="page"
      >{{ pageTitle }}</b>
    </nav>

    <div class="top-bar-actions">
      <!-- Stats slot (used by ConversationDetail page) -->
      <slot name="stats" />

      <!-- Status Indicator -->
      <div
        class="status-indicator"
        :class="`status-indicator--${connection.tone}`"
        role="status"
        :title="connection.hint"
      >
        <span class="status-dot" />
        <span class="status-text">{{ connection.label }}</span>
      </div>

      <!-- Notification Center -->
      <NotificationCenter @notification-click="(n: Notification) => $emit('notification-click', n)" />
    </div>
  </header>
</template>

<script setup lang="ts">
  import { NotificationCenter } from '@/components/ui'
  import type { Notification } from '@/stores/notifications'
  import { useWebSocketStore } from '@/stores/websocket'
  import { useConnectionStatus } from '@/composables/useConnectionStatus'

  defineProps<{
    pageTitle: string
    /** Nav section the page lives in (breadcrumb prefix); omit for pages outside the sidebar groups */
    sectionLabel?: string
  }>()

  defineEmits<{
    'notification-click': [notification: Notification]
  }>()

  // Realtime connection pill: bound to the websocket store, never static
  const connection = useConnectionStatus(useWebSocketStore())
</script>

<style scoped>
  .top-bar {
    position: relative;
    z-index: 5;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: var(--ui-topbar-h);
    padding: 0 var(--space-5);
    background-color: var(--ui-glass);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    box-shadow: inset 0 -0.5px 0 var(--ui-sep);
  }

  /* Context, not a second page title: section / page */
  .breadcrumb {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ui-muted);
    white-space: nowrap;
  }

  .breadcrumb-sep {
    color: var(--ui-faint);
  }

  .breadcrumb-item {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 600;
    color: var(--ui-ink);
  }

  .top-bar-actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--space-3);
  }

  /* Connection status: green pill */
  .status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    background: var(--ui-green-soft);
    color: var(--ui-green-ink);
    font-size: 12px;
    font-weight: 600;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    animation: none;
  }

  .status-dot {
    background-color: var(--ui-green);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-green) 25%, transparent);
  }

  .status-indicator--connecting {
    background: var(--ui-orange-soft);
    color: var(--ui-orange-ink);
  }

  .status-indicator--connecting .status-dot {
    background-color: var(--ui-orange);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-orange) 25%, transparent);
  }

  .status-indicator--offline {
    background: var(--ui-fill);
    color: var(--ui-muted);
  }

  .status-indicator--offline .status-dot {
    background-color: var(--ui-faint);
    box-shadow: none;
  }

  .status-text {
    color: inherit;
  }

  /* The fixed hamburger (44px at left 12px) sits inside the bar, so reserve its width
     and make the bar tall enough to center it. */
  @media (max-width: 768px) {
    .top-bar-actions {
      gap: var(--space-2);
    }

    .top-bar {
      min-height: 60px;
      padding: var(--space-2) var(--space-4) var(--space-2) 68px;
      padding-top: calc(var(--space-2) + env(safe-area-inset-top));
    }
  }
</style>
