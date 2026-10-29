<template>
  <nav
    class="sidebar-nav"
    aria-label="主要導覽"
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
  import { computed, watch, reactive, type Component } from 'vue'
  import { useRoute } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'
  import { useUnreadStore } from '@/stores/unread'
  import { useNotificationsStore } from '@/stores/notifications'
  import { NAV_SECTIONS, sectionForPath } from '@/config/nav-sections'
  import ExpandableNavGroup from './ExpandableNavGroup.vue'

  // Icon imports
  import DashboardIcon from '@/components/icons/DashboardIcon.vue'
  import ChatIcon from '@/components/icons/ChatIcon.vue'
  import TagIcon from '@/components/icons/TagIcon.vue'
  import UsersIcon from '@/components/icons/UsersIcon.vue'
  import ActivityIcon from '@/components/icons/ActivityIcon.vue'
  import SettingsIcon from '@/components/icons/SettingsIcon.vue'
  import MonitorIcon from '@/components/icons/MonitorIcon.vue'
  import ReportsIcon from '@/components/icons/ReportsIcon.vue'
  import DataManagementIcon from '@/components/icons/DataManagementIcon.vue'
  import ChannelIcon from '@/components/icons/ChannelIcon.vue'
  import AutoReplyIcon from '@/components/icons/AutoReplyIcon.vue'
  import SendIcon from '@/components/icons/SendIcon.vue'
  import BellIcon from '@/components/icons/BellIcon.vue'

  interface SubmenuItem {
    path: string
    label: string
  }

  interface NavItem {
    path: string
    label: string
    icon: Component
    submenu?: SubmenuItem[]
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
  }

  // ── Navigation item definitions ──
  const baseNavigationItems: NavItem[] = [
    { path: '/dashboard', label: '\u5100\u8868\u677F', icon: DashboardIcon },
    { path: '/conversations', label: '\u5C0D\u8A71\u7BA1\u7406', icon: ChatIcon },
    // Personal inbox + per-device desktop notification settings: visible to everyone, not under admin-only settings
    { path: '/notifications', label: '\u901A\u77E5\u4E2D\u5FC3', icon: BellIcon },
    { path: '/tags', label: '\u6A19\u7C64\u7BA1\u7406', icon: TagIcon },
    {
      path: '/reports',
      label: '\u5831\u8868\u7CFB\u7D71',
      icon: ReportsIcon,
      submenu: [
        { path: '/reports/dashboard', label: '\u5100\u8868\u677F' },
        { path: '/reports/templates', label: '\u6A21\u677F' },
        { path: '/reports/generate', label: '\u751F\u6210\u5831\u8868' },
      ],
    },
    {
      path: '/data',
      label: '\u8CC7\u6599\u7BA1\u7406',
      icon: DataManagementIcon,
      submenu: [
        { path: '/data/export', label: '\u532F\u51FA\u5C0D\u8A71\u8A18\u9304' },
      ],
    },
  ]

  const adminNavigationItems: NavItem[] = [
    ...baseNavigationItems,
    { path: '/team', label: '\u5718\u968A\u7BA1\u7406', icon: UsersIcon },
    { path: '/channels', label: '\u983B\u9053\u7BA1\u7406', icon: ChannelIcon },
    { path: '/auto-reply', label: '\u81EA\u52D5\u56DE\u8986', icon: AutoReplyIcon },
    { path: '/activities', label: '\u6D3B\u52D5\u8A18\u9304', icon: ActivityIcon },
    { path: '/monitoring/api', label: 'API\u76E3\u63A7', icon: MonitorIcon },
    { path: '/monitoring/websocket', label: 'WebSocket\u76E3\u63A7', icon: MonitorIcon },
    {
      path: '/settings',
      label: '\u7CFB\u7D71\u8A2D\u5B9A',
      icon: SettingsIcon,
      submenu: [
        { path: '/settings/general', label: '\u4E00\u822C\u8A2D\u5B9A' },
        { path: '/settings/integrations/line', label: 'LINE OA' },
        { path: '/settings/integrations/facebook', label: 'Facebook' },
        { path: '/settings/advanced', label: '\u9032\u968E\u8A2D\u5B9A' },
        { path: '/settings/maintenance/health', label: '\u5065\u5EB7\u6AA2\u67E5' },
      ],
    },
  ]

  const navigationItems = computed(() => {
    const isAdmin = authStore.currentAgent?.role === 'admin'
    // Broadcast goes right after the tags item; insert by path, not index, so items added above it stay safe
    const withBroadcast = (items: NavItem[]) => items.flatMap((item) => item.path === '/tags'
      ? [item, { path: '/broadcasts', label: '\u7FA4\u767C\u8A0A\u606F', icon: SendIcon }]
      : [item]
    )
    if (!isAdmin) { return withBroadcast(baseNavigationItems) }
    // 資料備份 is admin-only — inject it under 資料管理 for admins only
    return withBroadcast(adminNavigationItems.map((item) =>
      item.path === '/data'
        ? { ...item, submenu: [...(item.submenu ?? []), { path: '/data/backup', label: '資料備份' }] }
        : item
    ))
  })

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

  .nav-group + .nav-group {
    margin-top: 14px;
  }

  .nav-label {
    display: block;
    padding: 6px 10px 4px;
    font-size: var(--ui-t-cap);
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

  /* Active: raised white pill, accent icon */
  .nav-item.active {
    background-color: var(--ui-sel-bg);
    color: var(--ui-ink);
    font-weight: 600;
    box-shadow: var(--ui-shadow-pill);
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
