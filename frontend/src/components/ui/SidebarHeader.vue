<template>
  <div
    class="sidebar-header"
    :class="{
      'sidebar-header--collapsed': sidebarCollapsed && !isMobile,
      'sidebar-header--mobile': isMobile,
    }"
  >
    <div
      v-if="!sidebarCollapsed || isMobile"
      class="logo"
    >
      <div class="logo-icon">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" />
        </svg>
      </div>
      <span class="logo-text">多渠道客服整合</span>
    </div>
    <button
      v-if="!isMobile"
      class="sidebar-toggle"
      :class="{ collapsed: sidebarCollapsed }"
      :aria-label="sidebarCollapsed ? '展開側邊欄' : '收合側邊欄'"
      @click="$emit('toggle')"
    >
      <!-- Sidebar panel icon (not a chevron: the nav groups already use chevrons to expand).
           The left pane is filled while the sidebar is open. -->
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect
          x="3"
          y="4"
          width="18"
          height="16"
          rx="3.5"
        />
        <path d="M9.5 4v16" />
        <path
          v-if="!sidebarCollapsed"
          class="panel-fill"
          d="M3 7.5a3.5 3.5 0 0 1 3.5-3.5h3v16h-3A3.5 3.5 0 0 1 3 16.5Z"
          fill="currentColor"
          stroke="none"
          opacity="0.22"
        />
      </svg>
    </button>
    <!-- Mobile close button -->
    <button
      v-if="isMobile"
      class="mobile-close-btn"
      aria-label="關閉選單"
      @click="$emit('close-mobile')"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="m18 6-12 12" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
  defineProps<{
    sidebarCollapsed: boolean
    isMobile: boolean
  }>()

  defineEmits<{
    toggle: []
    'close-mobile': []
  }>()
</script>

<style scoped>
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 14px 14px 18px;
    min-height: 64px;
  }

  /* Prop-driven collapsed style (replaces .sidebar-collapsed .sidebar-header) */
  .sidebar-header--collapsed {
    justify-content: center;
    padding: 18px 10px 14px;
  }

  /* Prop-driven mobile style (replaces .sidebar-mobile .sidebar-header) */
  .sidebar-header--mobile {
    justify-content: space-between;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .logo-icon {
    flex: none;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    background: linear-gradient(160deg, #3d9bff, #0060df);
    box-shadow:
      inset 0 0.5px 0 rgba(255, 255, 255, 0.4),
      0 1px 3px rgba(0, 96, 223, 0.3);
  }

  .logo-icon svg {
    width: 17px;
    height: 17px;
    fill: #fff;
  }

  .logo-text {
    overflow: hidden;
    font: 600 15px/1.2 var(--ui-font-display);
    letter-spacing: -0.01em;
    color: var(--ui-ink);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .sidebar-toggle,
  .mobile-close-btn {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--ui-muted);
    cursor: pointer;
    transition:
      background-color var(--ui-dur) var(--ui-ease),
      color var(--ui-dur) var(--ui-ease);
  }

  .sidebar-toggle:hover,
  .mobile-close-btn:hover {
    background-color: var(--ui-fill);
    color: var(--ui-ink-2);
  }

  /* Medium screens: the rail has no room for the toggle next to the logo */
  @media (min-width: 769px) and (max-width: 1024px) {
    .sidebar-header {
      justify-content: center;
      padding: 18px 10px 14px;
    }

    .logo-text,
    .sidebar-toggle {
      display: none;
    }
  }
</style>
