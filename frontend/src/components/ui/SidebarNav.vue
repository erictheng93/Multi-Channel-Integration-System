<template>
  <!-- The nav is its own scroll region between the pinned header and the pinned profile:
       it fades at whichever edge has more items, and the active item is scrolled into view. -->
  <nav
    ref="navEl"
    class="sidebar-nav"
    :class="{ 'has-above': moreAbove, 'has-below': moreBelow }"
    aria-label="主要導覽"
    @scroll.passive="updateFades"
  >
    <section
      v-for="group in navigationGroups"
      :key="group.id"
      class="nav-group"
      :data-section="group.id"
    >
      <span
        v-if="!sidebarCollapsed || isMobile"
        class="nav-label"
      >{{ group.label }}</span>

      <template
        v-for="item in group.items"
        :key="item.path"
      >
        <!-- Expandable nav groups (Reports, Data, Settings) -->
        <ExpandableNavGroup
          v-if="item.submenu"
          :icon="item.icon"
          :label="item.label"
          :route-prefix="item.path"
          :expanded="expandedMenus[item.path] ?? false"
          :sidebar-collapsed="sidebarCollapsed"
          :is-mobile="isMobile"
          :items="item.submenu"
          @toggle="toggleSubmenu(item.path, item.submenu[0]?.path)"
        />

        <!-- Regular navigation items -->
        <router-link
          v-else
          :to="item.path"
          class="nav-item"
          :class="{
            active: currentPath === item.path,
            'nav-item--collapsed': sidebarCollapsed && !isMobile,
          }"
        >
          <component
            :is="item.icon"
            class="nav-icon"
          />
          <span
            v-if="!sidebarCollapsed || isMobile"
            class="nav-text"
          >{{ item.label }}</span>
          <span
            v-if="badgeFor(item.path)"
            class="nav-count"
            :class="{ 'nav-count--collapsed': sidebarCollapsed && !isMobile }"
            :title="badgeFor(item.path)?.hint"
            :aria-label="`${badgeFor(item.path)?.hint}：${badgeFor(item.path)?.text}`"
          >{{ badgeFor(item.path)?.text }}</span>
        </router-link>
      </template>
    </section>
  </nav>
</template>

<script setup lang="ts">
  import { computed, watch, reactive, ref, nextTick, onMounted, onBeforeUnmount, type Component } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'
  import { useUnreadStore } from '@/stores/unread'
  import { useNotificationsStore } from '@/stores/notifications'
  import { NAV_SECTIONS, sectionForPath } from '@/config/nav-sections'
  import { SECTION_NAV, sectionNavItems, type SectionNavItem, type SectionNavKey } from '@/config/section-nav'
  import { NAV_ICONS } from '@/config/nav-icons'
  import ExpandableNavGroup from './ExpandableNavGroup.vue'

  interface NavItem {
    path: string
    label: string
    icon: Component
    submenu?: readonly SectionNavItem[]
  }

  defineProps<{
    sidebarCollapsed: boolean
    isMobile: boolean
  }>()

  const iconFor = (path: string): Component => NAV_ICONS[path] as Component

  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()
  const currentPath = computed(() => route.path)
  const unreadStore = useUnreadStore()
  const notificationsStore = useNotificationsStore()

  const MAX_BADGE = 99
  const formatCount = (n: number): string => (n > MAX_BADGE ? `${MAX_BADGE}+` : String(n))

  // 對話 badge = 未讀 (personal); 通知 badge = unread notifications. Hidden at 0.
  const badgeFor = (path: string): { text: string; hint: string } | null => {
    if (path === '/conversations' && unreadStore.total > 0) {
      return { text: formatCount(unreadStore.total), hint: '未讀對話：你尚未開啟' }
    }
    if (path === '/notifications' && notificationsStore.unreadCount > 0) {
      return { text: formatCount(notificationsStore.unreadCount), hint: '未讀通知' }
    }
    return null
  }

  // Submenu expansion state keyed by route prefix
  const expandedMenus = reactive<Record<string, boolean>>({})

  // Accordion: only the section you are in shows its children. Another section's parent row
  // navigates to that section's first child (the route watcher then opens it).
  const toggleSubmenu = (path: string, firstChild?: string) => {
    if (expandedMenus[path]) {
      expandedMenus[path] = false
    } else if (firstChild) {
      void router.push(firstChild)
    } else {
      expandedMenus[path] = true
    }
    // the submenu animates open: re-evaluate the fades once it settled
    scheduleSettle()
  }

  // ── Scroll region: edge fades + keep the active item visible ──
  const navEl = ref<HTMLElement | null>(null)
  const moreAbove = ref(false)
  const moreBelow = ref(false)
  const EDGE_GAP = 28 // keep the revealed item clear of the fade
  const GROUP_GAP = 16 // .nav-group + .nav-group margin; must stay >= --nav-fade-top
  const NAV_PAD_BOTTOM = 10 // .sidebar-nav padding-bottom

  const updateFades = () => {
    const el = navEl.value
    if (!el) { return }
    moreAbove.value = el.scrollTop > 2
    moreBelow.value = el.scrollTop + el.clientHeight < el.scrollHeight - 2
  }

  const revealActive = () => {
    const el = navEl.value
    if (!el) { return }
    el.style.paddingBottom = ''
    // Everything fits (the common 900px-tall case): nothing to reveal, never scroll
    if (el.scrollHeight <= el.clientHeight + 1) {
      el.scrollTop = 0
      updateFades()
      return
    }
    // the open submenu's own item wins over its group header
    const active = el.querySelector<HTMLElement>('.submenu-item.active') ?? el.querySelector<HTMLElement>('.nav-item.active')
    if (active) {
      const box = el.getBoundingClientRect()
      const rect = active.getBoundingClientRect()
      if (rect.height > 0) {
        if (rect.bottom > box.bottom - EDGE_GAP) {
          const needed = el.scrollTop + rect.bottom - (box.bottom - EDGE_GAP)
          // Land on a group boundary so the top fade covers the gap between groups,
          // never half an item (a cut-off row under the logo reads as a bug)
          const activeTop = rect.top - box.top + el.scrollTop
          const groupStop = [...el.querySelectorAll<HTMLElement>('.nav-group')]
            .map(g => g.getBoundingClientRect().top - box.top + el.scrollTop - GROUP_GAP)
            .find(top => top >= needed && top <= activeTop - EDGE_GAP)
          // The stop can sit past the scroll range (the list overflows by less than a group):
          // pad the end by exactly the difference so the scroll can reach it
          if (groupStop !== undefined) {
            const short = Math.ceil(groupStop - (el.scrollHeight - el.clientHeight))
            if (short > 0) { el.style.paddingBottom = `${NAV_PAD_BOTTOM + short}px` }
          }
          el.scrollTop = groupStop ?? needed
        } else if (rect.top < box.top + EDGE_GAP) {
          el.scrollTop -= box.top + EDGE_GAP - rect.top
        }
      }
    }
    updateFades()
  }

  let settleTimer: ReturnType<typeof setTimeout> | undefined
  const scheduleSettle = () => {
    clearTimeout(settleTimer)
    settleTimer = setTimeout(() => { revealActive() }, 280)
  }

  let resizeObserver: InstanceType<typeof window.ResizeObserver> | undefined
  onMounted(() => {
    void nextTick(() => { revealActive(); scheduleSettle() })
    if (typeof window.ResizeObserver !== 'undefined' && navEl.value) {
      resizeObserver = new window.ResizeObserver(updateFades)
      resizeObserver.observe(navEl.value)
    }
  })
  onBeforeUnmount(() => {
    clearTimeout(settleTimer)
    resizeObserver?.disconnect()
  })

  // ── Navigation item definitions ──
  // Children of 報表 / 資料管理 / 系統設定 come from config/section-nav.ts so the in-page
  // fallback (UiSectionNav, <= 1024px) always shows the same names and order.
  const buildNavigationItems = (isAdmin: boolean): NavItem[] => {
    const group = (key: SectionNavKey, icon: Component): NavItem => ({
      path: SECTION_NAV[key].path,
      label: SECTION_NAV[key].label,
      icon,
      submenu: sectionNavItems(key, isAdmin),
    })

    const items: NavItem[] = [
      { path: '/dashboard', label: '儀表板', icon: iconFor('/dashboard') },
      { path: '/conversations', label: '對話', icon: iconFor('/conversations') },
      // Personal inbox + per-device desktop notification settings: visible to everyone, not under admin-only settings
      { path: '/notifications', label: '通知', icon: iconFor('/notifications') },
      { path: '/tags', label: '客戶標籤', icon: iconFor('/tags') },
      // Broadcast goes right after the tags item
      { path: '/broadcasts', label: '群發訊息', icon: iconFor('/broadcasts') },
      group('reports', iconFor('/reports')),
      group('data', iconFor('/data')),
    ]
    if (!isAdmin) { return items }
    return [
      ...items,
      { path: '/team', label: '團隊成員', icon: iconFor('/team') },
      { path: '/channels', label: '頻道', icon: iconFor('/channels') },
      { path: '/auto-reply', label: '自動回覆', icon: iconFor('/auto-reply') },
      { path: '/activities', label: '活動記錄', icon: iconFor('/activities') },
      { path: '/monitoring/api', label: 'API 監控', icon: iconFor('/monitoring/api') },
      { path: '/monitoring/websocket', label: '即時連線監控', icon: iconFor('/monitoring/websocket') },
      group('settings', iconFor('/settings')),
    ]
  }

  const navigationItems = computed(() => buildNavigationItems(authStore.currentAgent?.role === 'admin'))

  // Sidebar groups: same items, in the same order, bucketed under section labels
  const navigationGroups = computed(() =>
    NAV_SECTIONS.map((section) => ({
      id: section.id,
      label: section.label,
      items: navigationItems.value.filter((item) => sectionForPath(item.path)?.id === section.id),
    })).filter((group) => group.items.length > 0)
  )

  // Auto-expand submenus when route matches their prefix
  watch(
    () => route.path,
    (newPath) => {
      for (const prefix of ['/reports', '/data', '/settings']) {
        expandedMenus[prefix] = newPath === prefix || newPath.startsWith(`${prefix}/`)
      }
    },
    { flush: 'post', immediate: true },
  )

  watch(() => route.path, () => { scheduleSettle() }, { flush: 'post' })
</script>

<style scoped>
  .sidebar-nav {
    flex: 1;
    padding: 2px 10px 10px;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
    scrollbar-width: thin;
    scrollbar-color: var(--ui-fill-strong) transparent;
  }

  /* Fades hint that more items sit above / below the visible part */
  .sidebar-nav.has-above,
  .sidebar-nav.has-below {
    --nav-fade-top: 0px;
    --nav-fade-bottom: 0px;
    -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 var(--nav-fade-top), #000 calc(100% - var(--nav-fade-bottom)), transparent 100%);
    mask-image: linear-gradient(to bottom, transparent 0, #000 var(--nav-fade-top), #000 calc(100% - var(--nav-fade-bottom)), transparent 100%);
  }

  .sidebar-nav.has-above {
    --nav-fade-top: 16px;
  }

  .sidebar-nav.has-below {
    --nav-fade-bottom: 22px;
  }

  .sidebar-nav::-webkit-scrollbar {
    width: 4px;
  }

  .sidebar-nav::-webkit-scrollbar-track {
    background: transparent;
  }

  .sidebar-nav::-webkit-scrollbar-thumb {
    background: var(--ui-fill-strong);
    border-radius: 2px;
  }

  /* Group labels: 11.5px / 600, with 16px of air above every group after the first */
  .nav-group + .nav-group {
    margin-top: 16px;
  }

  .nav-label {
    display: block;
    padding: 0 10px 3px;
    font-size: var(--ui-t-nav-label);
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--ui-muted);
  }

  .nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 32px;
    padding: 0 10px;
    margin-bottom: 1px;
    border-radius: 9px;
    color: var(--ui-ink-2);
    font-size: 13.5px;
    font-weight: 500;
    text-decoration: none;
    overflow: hidden;
    transition:
      background-color var(--ui-dur) var(--ui-ease),
      color var(--ui-dur) var(--ui-ease);
  }

  /* Prop-driven collapsed style (replaces .sidebar-collapsed .nav-item) */
  .nav-item--collapsed {
    justify-content: center;
    padding: 0;
  }

  .nav-item:hover {
    background-color: var(--ui-fill);
  }

  /* Active: the whole row is tinted (accent wash), accent icon, ink label */
  .nav-item.active {
    background-color: var(--section-hue-soft);
    color: var(--ui-ink);
    font-weight: 500;
  }

  .nav-count {
    flex: none;
    min-width: 20px;
    height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--ui-red);
    color: #fff;
    font: 600 11px/18px var(--ui-font-display);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  /* Icon-only rail: the count becomes a corner dot-badge on the icon */
  .nav-count--collapsed {
    position: absolute;
    top: 2px;
    right: 4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 10px;
    line-height: 16px;
  }

  .nav-icon {
    flex-shrink: 0;
    width: 17px;
    height: 17px;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
    color: var(--ui-muted);
    transition: color var(--ui-dur) var(--ui-ease);
  }

  .nav-item.active .nav-icon {
    color: var(--section-hue);
  }

  .nav-text {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Medium screens: the rail shows icons only */
  @media (min-width: 769px) and (max-width: 1024px) {
    .nav-group + .nav-group {
      margin-top: 12px;
    }

    .nav-label,
    .nav-text {
      display: none;
    }

    .nav-item {
      justify-content: center;
      padding: 0;
    }

    .nav-count {
      position: absolute;
      top: 2px;
      right: 4px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      font-size: 10px;
      line-height: 16px;
    }
  }
</style>
