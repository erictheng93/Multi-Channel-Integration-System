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
        &#x1F4AC;
      </div>
      <span class="logo-text">多渠道客服整合</span>
    </div>
    <button
      v-if="!isMobile"
      class="sidebar-toggle"
      :class="{ collapsed: sidebarCollapsed }"
      @click="$emit('toggle')"
    >
      <!-- Hamburger menu when collapsed -->
      <div
        v-if="sidebarCollapsed"
        class="hamburger-menu"
      >
        <span class="hamburger-line" />
        <span class="hamburger-line" />
        <span class="hamburger-line" />
      </div>
      <!-- Arrow when expanded -->
      <svg
        v-else
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
    <!-- Mobile close button -->
    <button
      v-if="isMobile"
      class="mobile-close-btn"
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
    padding: var(--space-6);
    border-bottom: 1px solid var(--gray-200);
    min-height: 80px;
  }

  /* Prop-driven collapsed style (replaces .sidebar-collapsed .sidebar-header) */
  .sidebar-header--collapsed {
    justify-content: center;
    padding: var(--space-4);
  }

  /* Prop-driven mobile style (replaces .sidebar-mobile .sidebar-header) */
  .sidebar-header--mobile {
    justify-content: space-between;
    padding: var(--space-6);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    opacity: 1;
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .logo-icon {
    font-size: 1.5rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
    border-radius: var(--radius-lg);
  }

  .logo-text {
    font-weight: 600;
    font-size: 1.125rem;
    color: var(--gray-900);
    white-space: nowrap;
  }

  .sidebar-toggle {
    padding: var(--space-2);
    border: none;
    background: none;
    color: var(--gray-500);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    position: relative;
    overflow: hidden;
  }

  .sidebar-toggle:hover {
    background-color: var(--gray-100);
    color: var(--gray-700);
    transform: scale(1.05);
  }

  .sidebar-toggle:active {
    transform: scale(0.95);
  }

  .sidebar-toggle svg {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: center;
  }

  .sidebar-toggle.collapsed svg {
    transform: rotate(180deg);
  }

  .sidebar-toggle::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    background: var(--primary-100);
    border-radius: 50%;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translate(-50%, -50%);
    z-index: -1;
  }

  .sidebar-toggle:hover::before {
    width: 100%;
    height: 100%;
  }

  /* Hamburger Menu Styles */
  .hamburger-menu {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 18px;
    height: 14px;
  }

  .hamburger-line {
    width: 100%;
    height: 2px;
    background-color: currentColor;
    border-radius: 1px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: center;
  }

  .sidebar-toggle:hover .hamburger-line {
    background-color: var(--gray-700);
  }

  .sidebar-toggle:hover .hamburger-line:nth-child(1) {
    transform: translateY(1px);
  }

  .sidebar-toggle:hover .hamburger-line:nth-child(3) {
    transform: translateY(-1px);
  }

  /* Mobile Close Button */
  .mobile-close-btn {
    padding: var(--space-2);
    border: none;
    background: none;
    color: var(--gray-500);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
  }

  .mobile-close-btn:hover {
    background-color: var(--gray-100);
    color: var(--gray-700);
  }
</style>
