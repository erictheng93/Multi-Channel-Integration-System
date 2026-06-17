<template>
  <div class="app-layout">
    <!-- Mobile Menu Button -->
    <button
      v-if="isMobile"
      class="mobile-menu-btn"
      @click="toggleSidebar"
    >
      <div class="hamburger-menu">
        <span class="hamburger-line" />
        <span class="hamburger-line" />
        <span class="hamburger-line" />
      </div>
    </button>

    <!-- Mobile Overlay -->
    <div
      v-if="isMobile && showMobileMenu"
      class="mobile-overlay"
      @click="showMobileMenu = false"
    />

    <!-- Sidebar -->
    <aside
      class="sidebar"
      :class="{
        'sidebar-collapsed': sidebarCollapsed && !isMobile,
        'sidebar-mobile': isMobile,
        'sidebar-mobile-open': isMobile && showMobileMenu,
      }"
    >
      <SidebarHeader
        :sidebar-collapsed="sidebarCollapsed"
        :is-mobile="isMobile"
        @toggle="toggleSidebar"
        @close-mobile="showMobileMenu = false"
      />

      <SidebarNav
        :sidebar-collapsed="sidebarCollapsed"
        :is-mobile="isMobile"
      />

      <SidebarUserProfile
        :sidebar-collapsed="sidebarCollapsed"
        :is-mobile="isMobile"
      />
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <AppTopBar
        :page-title="currentPageTitle"
        @notification-click="handleNotificationClick"
      >
        <template #stats>
          <slot name="top-bar-stats" />
        </template>
      </AppTopBar>

      <!-- Page Content -->
      <div class="page-content">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, nextTick } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useSidebarState } from '@/composables/useSidebarState'
  import type { Notification } from '@/stores/notifications'

  import SidebarHeader from './SidebarHeader.vue'
  import SidebarNav from './SidebarNav.vue'
  import SidebarUserProfile from './SidebarUserProfile.vue'
  import AppTopBar from './AppTopBar.vue'

  const route = useRoute()
  const router = useRouter()

  const {
    sidebarCollapsed,
    showMobileMenu,
    isMobile,
    toggleSidebar,
    initialize,
    cleanup,
  } = useSidebarState()

  // Static page title map (avoids coupling to SidebarNav's navigation items)
  const PAGE_TITLES: Record<string, string> = {
    '/dashboard': '\u5100\u8868\u677F',
    '/conversations': '\u5C0D\u8A71\u7BA1\u7406',
    '/tags': '\u6A19\u7C64\u7BA1\u7406',
    '/reports': '\u5831\u8868\u7CFB\u7D71',
    '/data': '\u8CC7\u6599\u7BA1\u7406',
    '/team': '\u5718\u968A\u7BA1\u7406',
    '/channels': '\u983B\u9053\u7BA1\u7406',
    '/activities': '\u6D3B\u52D5\u8A18\u9304',
    '/monitoring/api': 'API\u76E3\u63A7',
    '/auto-reply': '\u81EA\u52D5\u56DE\u8986',
    '/settings': '\u7CFB\u7D71\u8A2D\u5B9A',
  }

  const currentPageTitle = computed(() => {
    const currentPath = route.path

    // Conversation detail pages
    if (currentPath.startsWith('/conversations/') && route.params.id) {
      return '\u5C0D\u8A71'
    }

    return PAGE_TITLES[currentPath] || '\u9801\u9762'
  })

  // Notification click routing logic
  const handleNotificationClick = (notification: Notification) => {
    const { type, data } = notification

    switch (type) {
      case 'new_message':
      case 'customer_responded':
        if (data?.conversationId) {
          router.push(`/conversations/${data.conversationId}`)
        }
        break
      case 'conversation_assigned':
      case 'conversation_transferred':
      case 'priority_changed':
        if (data?.conversationId) {
          router.push(`/conversations/${data.conversationId}`)
        }
        break
      case 'mention':
        if (data?.conversationId) {
          router.push(`/conversations/${data.conversationId}`)
        }
        break
      case 'system':
        router.push('/notifications')
        break
      case 'task_reminder':
        if (data?.conversationId) {
          router.push(`/conversations/${data.conversationId}`)
        }
        break
      default:
        router.push('/notifications')
    }
  }

  // Mobile click-outside handler (closes sidebar overlay)
  const handleClickOutside = (event: Event) => {
    const target = event.target as globalThis.Element
    if (!target.closest('.sidebar') && !target.closest('.mobile-menu-btn') && isMobile.value) {
      showMobileMenu.value = false
    }
  }

  onMounted(async () => {
    document.addEventListener('click', handleClickOutside)
    await nextTick()
    initialize()
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
    cleanup()
  })
</script>

<style scoped>
  .app-layout {
    display: flex;
    height: 100vh;
    background-color: #f9fafb !important;
  }

  /* Sidebar */
  .sidebar {
    width: 240px;
    background-color: white;
    border-right: 1px solid var(--gray-200);
    display: flex;
    flex-direction: column;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    z-index: 10;
    overflow: hidden;
  }

  .sidebar-collapsed {
    width: 80px;
  }

  /* Main Content */
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .page-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--space-6) var(--space-5);
    background-color: #f9fafb !important;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-behavior: smooth;
  }

  /* Custom Scrollbar Styles */
  .page-content::-webkit-scrollbar {
    width: 8px;
  }

  .page-content::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
  }

  .page-content::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    transition: background 0.3s ease;
  }

  .page-content::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.3);
  }

  .page-content {
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.2) rgba(0, 0, 0, 0.05);
  }

  /* Mobile Menu Button */
  .mobile-menu-btn {
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 25;
    width: 48px;
    height: 48px;
    border: none;
    background: white;
    border-radius: var(--radius-xl);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .mobile-menu-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  .mobile-menu-btn .hamburger-menu {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 20px;
    height: 16px;
  }

  .mobile-menu-btn .hamburger-line {
    width: 100%;
    height: 2px;
    background-color: var(--gray-700);
    border-radius: 1px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Mobile Overlay */
  .mobile-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 15;
    backdrop-filter: blur(4px);
  }

  /* Responsive Breakpoints */

  /* Large screens */
  @media (min-width: 1025px) {
    .sidebar {
      width: 240px;
    }

    .sidebar-collapsed {
      width: 80px;
    }

    .mobile-menu-btn {
      display: none;
    }
  }

  /* Medium screens */
  @media (min-width: 769px) and (max-width: 1024px) {
    .sidebar {
      width: 80px;
    }

    .sidebar-collapsed {
      width: 80px;
    }

    .mobile-menu-btn {
      display: none;
    }
  }

  /* Small screens - Mobile */
  @media (max-width: 768px) {
    .main-content {
      margin-left: 0;
      padding-top: 80px;
    }

    .page-content {
      padding: var(--space-4);
    }

    .sidebar {
      position: fixed;
      top: 0;
      left: -240px;
      bottom: 0;
      width: 240px;
      z-index: 20;
      transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 0 rgba(0, 0, 0, 0);
    }

    .sidebar-mobile-open {
      left: 0;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
    }
  }
</style>
