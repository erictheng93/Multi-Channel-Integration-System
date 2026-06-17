<template>
  <nav class="sidebar-nav">
    <template
      v-for="item in navigationItems"
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
      </router-link>
    </template>
  </nav>
</template>

<script setup lang="ts">
  import { computed, watch, reactive, type Component } from 'vue'
  import { useRoute } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'
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

  // Submenu expansion state keyed by route prefix
  const expandedMenus = reactive<Record<string, boolean>>({})

  const toggleSubmenu = (path: string) => {
    expandedMenus[path] = !expandedMenus[path]
  }

  // ── Navigation item definitions ──
  const baseNavigationItems: NavItem[] = [
    { path: '/dashboard', label: '\u5100\u8868\u677F', icon: DashboardIcon },
    { path: '/conversations', label: '\u5C0D\u8A71\u7BA1\u7406', icon: ChatIcon },
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
    if (!isAdmin) { return baseNavigationItems }
    // 資料備份 is admin-only — inject it under 資料管理 for admins only
    return adminNavigationItems.map((item) =>
      item.path === '/data'
        ? { ...item, submenu: [...(item.submenu ?? []), { path: '/data/backup', label: '資料備份' }] }
        : item
    )
  })

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
    padding: var(--space-4);
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
  }

  /* Thin scrollbar */
  .sidebar-nav::-webkit-scrollbar {
    width: 4px;
  }

  .sidebar-nav::-webkit-scrollbar-track {
    background: transparent;
  }

  .sidebar-nav::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.15);
    border-radius: 2px;
  }

  .sidebar-nav::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.25);
  }

  .sidebar-nav {
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-1);
    color: var(--gray-600);
    text-decoration: none;
    border-radius: var(--radius-lg);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-weight: 500;
    position: relative;
    overflow: hidden;
  }

  /* Prop-driven collapsed style (replaces .sidebar-collapsed .nav-item) */
  .nav-item--collapsed {
    justify-content: center;
    padding: var(--space-3);
  }

  .nav-item:hover {
    background-color: var(--gray-100);
    color: var(--gray-900);
  }

  .nav-item.active {
    background-color: var(--primary-50);
    color: var(--primary-700);
  }

  .nav-icon {
    flex-shrink: 0;
  }

  .nav-text {
    white-space: nowrap;
    opacity: 1;
    transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    flex: 1;
  }

  /* Medium screens - hide text */
  @media (min-width: 769px) and (max-width: 1024px) {
    .nav-text {
      opacity: 0;
    }
  }
</style>
