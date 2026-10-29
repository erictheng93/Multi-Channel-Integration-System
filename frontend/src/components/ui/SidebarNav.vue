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
          @toggle="toggleSubmenu(item.path)"
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
  import { useRoute } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'
  import { useUnreadStore } from '@/stores/unread'
  import { useNotificationsStore } from '@/stores/notifications'
  import { NAV_SECTIONS, sectionForPath } from '@/config/nav-sections'
  import { SECTION_NAV, sectionNavItems, type SectionNavItem, type SectionNavKey } from '@/config/section-nav'
  import ExpandableNavGroup from './ExpandableNavGroup.vue'

  // Icon imports
  import DashboardIcon from '@/components/icons/DashboardIcon.vue'
  import ChatIcon from '@/components/icons/ChatIcon.vue'
  import TagIcon from '@/components/icons/TagIcon.vue'
  import UsersIcon from '@/components/icons/UsersIcon.vue'
  import ActivityIcon from '@/components/icons/ActivityIcon.vue'
  import SettingsIcon from '@/components/icons/SettingsIcon.vue'
  import ApiIcon from '@/components/icons/ApiIcon.vue'
  import RealtimeIcon from '@/components/icons/RealtimeIcon.vue'
  import ReportsIcon from '@/components/icons/ReportsIcon.vue'
  import DataManagementIcon from '@/components/icons/DataManagementIcon.vue'
  import ChannelIcon from '@/components/icons/ChannelIcon.vue'
  import AutoReplyIcon from '@/components/icons/AutoReplyIcon.vue'
  import SendIcon from '@/components/icons/SendIcon.vue'
  import BellIcon from '@/components/icons/BellIcon.vue'

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

  const route = useRoute()
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

  const toggleSubmenu = (path: string) => {
    expandedMenus[path] = !expandedMenus[path]
    // the submenu animates open: re-evaluate the fades once it settled
    scheduleSettle()
  }

  // ── Scroll region: edge fades + keep the active item visible ──
  const navEl = ref<HTMLElement | null>(null)
  const moreAbove = ref(false)
  const moreBelow = ref(false)
  const EDGE_GAP = 28 // keep the revealed item clear of the fade

  const updateFades = () => {
    const el = navEl.value
    if (!el) { return }
    moreAbove.value = el.scrollTop > 2
    moreBelow.value = el.scrollTop + el.clientHeight < el.scrollHeight - 2
  }

  const revealActive = () => {
    const el = navEl.value
    if (!el) { return }
    // the open submenu's own item wins over its group header
    const active = el.querySelector<HTMLElement>('.submenu-item.active') ?? el.querySelector<HTMLElement>('.nav-item.active')
    if (active) {
      const box = el.getBoundingClientRect()
      const rect = active.getBoundingClientRect()
      if (rect.height > 0) {
        if (rect.bottom > box.bottom - EDGE_GAP) {
          el.scrollTop += rect.bottom - (box.bottom - EDGE_GAP)
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
      { path: '/dashboard', label: '儀表板', icon: DashboardIcon },
      { path: '/conversations', label: '對話', icon: ChatIcon },
      // Personal inbox + per-device desktop notification settings: visible to everyone, not under admin-only settings
      { path: '/notifications', label: '通知', icon: BellIcon },
      { path: '/tags', label: '客戶標籤', icon: TagIcon },
      // Broadcast goes right after the tags item
      { path: '/broadcasts', label: '群發訊息', icon: SendIcon },
      group('reports', ReportsIcon),
      group('data', DataManagementIcon),
    ]
    if (!isAdmin) { return items }
    return [
      ...items,
      { path: '/team', label: '團隊成員', icon: UsersIcon },
      { path: '/channels', label: '頻道', icon: ChannelIcon },
      { path: '/auto-reply', label: '自動回覆', icon: AutoReplyIcon },
      { path: '/activities', label: '活動記錄', icon: ActivityIcon },
      { path: '/monitoring/api', label: 'API 監控', icon: ApiIcon },
      { path: '/monitoring/websocket', label: '即時連線監控', icon: RealtimeIcon },
      group('settings', SettingsIcon),
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
      if (newPath.startsWith('/reports')) {
        expandedMenus['/reports'] = true
      }
      if (newPath.startsWith('/data')) {
        expandedMenus['/data'] = true
      }
      if (newPath.startsWith('/settings')) {
        expandedMenus['/settings'] = true
      }
    },
    { flush: 'post', immediate: true },
  )

  watch(() => route.path, () => { scheduleSettle() }, { flush: 'post' })
</script>

<style scoped>
  .sidebar-nav {
    flex: 1;
    padding: 4px 10px 12px;
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
    --nav-fade-top: 22px;
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

  /* Group labels: 11.5px / 600, with 24px of air above every group after the first */
  .nav-group + .nav-group {
    margin-top: 24px;
  }

  .nav-label {
    display: block;
    padding: 0 10px 6px;
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
    height: 34px;
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
    background-color: var(--ui-accent-soft);
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
    color: var(--ui-accent);
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
