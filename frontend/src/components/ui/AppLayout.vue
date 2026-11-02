<template>
  <div
    class="app-layout"
    :data-section="sectionId"
  >
    <!-- Mobile Menu Button -->
    <button
      v-if="isMobile && !showMobileMenu"
      class="mobile-menu-btn"
      aria-label="開啟選單"
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
        :section-label="currentSectionLabel"
        :title-collapsed="titleCollapsed"
        @notification-click="handleNotificationClick"
      >
        <template #stats>
          <slot name="top-bar-stats" />
        </template>
      </AppTopBar>

      <!-- Page Content -->
      <div
        ref="pageEl"
        class="page-content"
        @scroll.passive="evaluateTitle"
      >
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, nextTick, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useSidebarState } from '@/composables/useSidebarState'
  import { sectionForPath, sectionIdForPath } from '@/config/nav-sections'
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

  // Page title comes from the route's own meta (router/index.ts), never a generic fallback.
  // Nested routes use the deepest matched record's title.
  const currentPageTitle = computed(() => {
    const metaTitle = route.meta.title
    if (typeof metaTitle === 'string' && metaTitle) {
      return metaTitle
    }
    // Last resort for a route without a title: the nav section it lives in
    return sectionForPath(route.path)?.label ?? ''
  })

  // Section the page belongs to (same grouping as the sidebar); empty for pages like /profile
  // Colour identity of the page: the CSS tokens --section-hue / -soft / -ink resolve from this attribute
  const sectionId = computed(() => sectionIdForPath(route.path))
  const currentSectionLabel = computed(() => {
    // /profile sits outside the sidebar groups: 帳號 is its parent segment
    const label = sectionForPath(route.path)?.label ?? (route.path === '/profile' ? '帳號' : '')
    return label === currentPageTitle.value ? '' : label
  })

  // iOS large-title collapse (phone): the page's own H1 is the title while it is on screen; the
  // top bar names the page only once the H1 has scrolled away. A page without a `.ui-page-title`
  // (e.g. the conversation thread) keeps the title in the bar. Desktop ignores this flag.
  const pageEl = ref<HTMLElement | null>(null)
  const titleCollapsed = ref(true)
  const evaluateTitle = () => {
    const scroller = pageEl.value
    if (!scroller) { return }
    const h1 = scroller.querySelector<HTMLElement>('.ui-page-title')
    titleCollapsed.value = !h1 || h1.getBoundingClientRect().bottom < scroller.getBoundingClientRect().top + 4
  }
  let titleFrame = 0
  const scheduleTitleCheck = () => {
    window.cancelAnimationFrame(titleFrame)
    titleFrame = window.requestAnimationFrame(evaluateTitle)
  }
  let pageObserver: InstanceType<typeof window.MutationObserver> | undefined
  watch(() => route.fullPath, () => { void nextTick(scheduleTitleCheck) })

  // Notification click routing logic
  const handleNotificationClick = (notification: Notification) => {
    const { type, data } = notification

    switch (type) {
      case 'new_message':
      case 'new_conversation':
      case 'customer_responded':
        if (data?.conversationId) {
          router.push(`/conversations/${data.conversationId}`)
        }
        break
      case 'conversation_assigned':
      case 'conversation_transferred':
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
    if (pageEl.value && typeof window.MutationObserver !== 'undefined') {
      // lazy routes and late data render the page head after mount
      pageObserver = new window.MutationObserver(scheduleTitleCheck)
      pageObserver.observe(pageEl.value, { childList: true, subtree: true })
    }
    scheduleTitleCheck()
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
    pageObserver?.disconnect()
    window.cancelAnimationFrame(titleFrame)
    cleanup()
  })
</script>

<style scoped>
  .app-layout {
    display: flex;
    height: 100vh;
    height: 100dvh;
    /* landscape phones: the notch sits at the left/right edge (viewport-fit=cover) */
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
    background-color: var(--ui-canvas);
    color: var(--ui-ink);
    font-family: var(--ui-font-ui);
  }

  /* Sidebar: quiet frosted rail on the canvas. The frost lives on a pseudo-element
     because backdrop-filter on the sidebar itself would trap the fixed user menu. */
  .sidebar {
    width: var(--ui-sidebar-w);
    flex: none;
    display: flex;
    flex-direction: column;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    z-index: 10;
    overflow: hidden;
    box-shadow: inset -0.5px 0 0 var(--ui-sep);
  }

  .sidebar::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: var(--ui-sidebar-bg);
    backdrop-filter: saturate(180%) blur(24px);
    -webkit-backdrop-filter: saturate(180%) blur(24px);
  }

  .sidebar-collapsed {
    width: 80px;
  }

  /* Main Content */
  .main-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .page-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--ui-gutter);
    background-color: transparent;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-behavior: smooth;
    scrollbar-width: thin;
    scrollbar-color: var(--ui-fill-strong) transparent;
  }

  .page-content::-webkit-scrollbar {
    width: 8px;
  }

  .page-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .page-content::-webkit-scrollbar-thumb {
    background: var(--ui-fill-strong);
    border-radius: 4px;
  }

  /* Mobile Menu Button */
  .mobile-menu-btn {
    position: fixed;
    top: calc(8px + env(safe-area-inset-top));
    left: calc(12px + env(safe-area-inset-left));
    z-index: 25;
    width: 44px;
    height: 44px;
    border: none;
    background: var(--ui-surface);
    border-radius: 14px;
    box-shadow: var(--ui-shadow-pill);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 120ms var(--ui-ease);
  }

  .mobile-menu-btn:active {
    transform: scale(0.96);
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
    background-color: var(--ui-ink-2);
    border-radius: 1px;
  }

  /* Mobile Overlay */
  .mobile-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.32);
    z-index: 15;
    backdrop-filter: blur(4px);
  }

  /* Responsive Breakpoints */

  /* Large screens */
  @media (min-width: 1025px) {
    .sidebar {
      width: var(--ui-sidebar-w);
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
    }

    .page-content {
      padding: var(--space-4);
      padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
    }

    .sidebar {
      position: fixed;
      top: 0;
      left: -260px;
      bottom: 0;
      width: 260px;
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
      z-index: 20;
      transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 0 rgba(0, 0, 0, 0);
    }

    .sidebar::before {
      background: var(--ui-canvas);
    }

    .sidebar-mobile-open {
      left: 0;
      box-shadow: var(--ui-shadow-raised);
    }
  }
</style>
