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
      <div class="sidebar-header">
        <div
          v-if="!sidebarCollapsed"
          class="logo"
        >
          <div class="logo-icon">
            💬
          </div>
          <span class="logo-text">多渠道客服整合</span>
        </div>
        <button
          v-if="!isMobile"
          class="sidebar-toggle"
          :class="{ collapsed: sidebarCollapsed }"
          @click="toggleSidebar"
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
          @click="showMobileMenu = false"
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

      <nav class="sidebar-nav">
        <!-- Regular navigation items -->
        <template
          v-for="item in navigationItems"
          :key="item.path"
        >
          <!-- Expandable Reports Item -->
          <div
            v-if="item.path === '/reports'"
            class="nav-item-group"
          >
            <div
              class="nav-item expandable"
              :class="{ active: $route.path.startsWith('/reports') }"
              @click="toggleReportsSubmenu"
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
                v-if="!sidebarCollapsed || isMobile"
                class="expand-icon"
                :class="{ expanded: isReportsExpanded }"
              >
                ▶
              </span>
            </div>

            <!-- Reports Submenu -->
            <transition name="submenu">
              <div
                v-show="isReportsExpanded && (!sidebarCollapsed || isMobile)"
                class="submenu"
              >
                <router-link
                  to="/reports/dashboard"
                  class="submenu-item"
                  :class="{ active: $route.path === '/reports/dashboard' }"
                >
                  <span>儀表板</span>
                </router-link>

                <router-link
                  to="/reports/templates"
                  class="submenu-item"
                  :class="{ active: $route.path === '/reports/templates' }"
                >
                  <span>模板</span>
                </router-link>

                <router-link
                  to="/reports/generate"
                  class="submenu-item"
                  :class="{ active: $route.path === '/reports/generate' }"
                >
                  <span>生成報表</span>
                </router-link>
              </div>
            </transition>
          </div>

          <!-- Expandable Data Management Item -->
          <div
            v-else-if="item.path === '/data'"
            class="nav-item-group"
          >
            <div
              class="nav-item expandable"
              :class="{ active: $route.path.startsWith('/data') }"
              @click="toggleDataManagementSubmenu"
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
                v-if="!sidebarCollapsed || isMobile"
                class="expand-icon"
                :class="{ expanded: isDataManagementExpanded }"
              >
                &#9654;
              </span>
            </div>

            <!-- Data Management Submenu -->
            <transition name="submenu">
              <div
                v-show="isDataManagementExpanded && (!sidebarCollapsed || isMobile)"
                class="submenu"
              >
                <router-link
                  to="/data/export"
                  class="submenu-item"
                  :class="{ active: $route.path === '/data/export' }"
                >
                  <span>匯出對話記錄</span>
                </router-link>
              </div>
            </transition>
          </div>

          <!-- Expandable Settings Item -->
          <div
            v-else-if="item.path === '/settings'"
            class="nav-item-group"
          >
            <div
              class="nav-item expandable"
              :class="{ active: $route.path.startsWith('/settings') }"
              @click="toggleSettingsSubmenu"
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
                v-if="!sidebarCollapsed || isMobile"
                class="expand-icon"
                :class="{ expanded: isSettingsExpanded }"
              >
                ▶
              </span>
            </div>

            <!-- Settings Submenu -->
            <transition name="submenu">
              <div
                v-show="isSettingsExpanded && (!sidebarCollapsed || isMobile)"
                class="submenu"
              >
                <router-link
                  to="/settings/general"
                  class="submenu-item"
                  :class="{ active: $route.path === '/settings/general' }"
                >
                  <span>一般設定</span>
                </router-link>

                <router-link
                  to="/settings/integrations/line"
                  class="submenu-item"
                  :class="{ active: $route.path === '/settings/integrations/line' }"
                >
                  <span>LINE OA</span>
                </router-link>

                <router-link
                  to="/settings/integrations/facebook"
                  class="submenu-item"
                  :class="{ active: $route.path === '/settings/integrations/facebook' }"
                >
                  <span>Facebook</span>
                </router-link>

                <router-link
                  to="/settings/advanced"
                  class="submenu-item"
                  :class="{ active: $route.path === '/settings/advanced' }"
                >
                  <span>進階設定</span>
                </router-link>

                <router-link
                  to="/settings/maintenance/backup"
                  class="submenu-item"
                  :class="{ active: $route.path === '/settings/maintenance/backup' }"
                >
                  <span>備份管理</span>
                </router-link>

                <router-link
                  to="/settings/maintenance/cache"
                  class="submenu-item"
                  :class="{ active: $route.path === '/settings/maintenance/cache' }"
                >
                  <span>快取管理</span>
                </router-link>
              </div>
            </transition>
          </div>

          <!-- Regular navigation items -->
          <router-link
            v-else
            :to="item.path"
            class="nav-item"
            :class="{ active: $route.path === item.path }"
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

      <div class="sidebar-footer">
        <div
          class="user-profile"
          :class="{ collapsed: sidebarCollapsed }"
          @click="handleUserProfileClick"
        >
          <div class="user-avatar">
            {{ userInitials }}
          </div>
          <div
            v-if="!sidebarCollapsed || isMobile"
            class="user-info"
          >
            <div class="user-name">
              {{ authStore.currentAgent?.name }}
            </div>
            <div class="user-role">
              {{ authStore.currentAgent?.role }}
            </div>
          </div>
          <button
            v-if="(!sidebarCollapsed || isMobile) && !isMobile"
            class="user-menu-btn"
            title="用戶菜單"
            @click.stop="toggleUserMenu()"
          >
            <ChevronUpIcon :class="{ rotated: showUserMenu }" />
          </button>
        </div>

        <!-- User Dropdown Menu -->
        <div
          v-if="showUserMenu && (!sidebarCollapsed || isMobile) && !isMobile"
          class="user-menu modern-menu"
        >
          <div
            class="user-menu-item"
            @click="viewProfile"
          >
            <UserIcon />
            <span>個人資料</span>
          </div>
          <div
            class="user-menu-item"
            @click="changePassword"
          >
            <KeyIcon />
            <span>修改密碼</span>
          </div>
          <div class="user-menu-divider" />
          <div
            class="user-menu-item logout"
            @click="handleLogout"
          >
            <LogoutIcon />
            <span>登出</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Top Bar -->
      <header class="top-bar">
        <div class="breadcrumb">
          <span class="breadcrumb-item">{{ currentPageTitle }}</span>
        </div>

        <div class="top-bar-actions">
          <!-- 統計資訊 Slot (用於對話詳情頁) -->
          <slot name="top-bar-stats" />

          <!-- Notification Center (新版整合組件) -->
          <NotificationCenter @notification-click="handleNotificationClick" />

          <!-- Status Indicator -->
          <div class="status-indicator">
            <div class="status-dot online" />
            <span class="status-text">線上</span>
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <div class="page-content">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
  import { ref, shallowRef, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'
  import { useToast } from '@/composables/useToast'
  import { useConfirm } from '@/composables/useConfirm'
  import { NotificationCenter } from '@/components/ui'
  import type { Notification } from '@/stores/notifications'
  import DashboardIcon from '@/components/icons/DashboardIcon.vue'
  import ChatIcon from '@/components/icons/ChatIcon.vue'
  import TagIcon from '@/components/icons/TagIcon.vue'
  import LogoutIcon from '@/components/icons/LogoutIcon.vue'
  import ChevronUpIcon from '@/components/icons/ChevronUpIcon.vue'
  import UserIcon from '@/components/icons/UserIcon.vue'
  import KeyIcon from '@/components/icons/KeyIcon.vue'
  import UsersIcon from '@/components/icons/UsersIcon.vue'
  import ActivityIcon from '@/components/icons/ActivityIcon.vue'
  import SettingsIcon from '@/components/icons/SettingsIcon.vue'
  import MonitorIcon from '@/components/icons/MonitorIcon.vue'
  import ReportsIcon from '@/components/icons/ReportsIcon.vue'
  import DataManagementIcon from '@/components/icons/DataManagementIcon.vue'
  import ChannelIcon from '@/components/icons/ChannelIcon.vue'

  // Icons are now imported from separate .vue files

  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()
  const { showError } = useToast()
  const { confirmInfo } = useConfirm()

  const sidebarCollapsed = shallowRef(false)
  const isAutoCollapsed = ref(false)
  const showMobileMenu = shallowRef(false)
  const showUserMenu = ref(false)
  const isMobile = shallowRef(false)
  const isReportsExpanded = ref(false)
  const isDataManagementExpanded = ref(false)
  const isSettingsExpanded = ref(false)

  const baseNavigationItems = [
    { path: '/dashboard', label: '儀表板', icon: DashboardIcon },
    { path: '/conversations', label: '對話管理', icon: ChatIcon },
    { path: '/customers/tags', label: '標籤管理', icon: TagIcon },
    { path: '/reports', label: '報表系統', icon: ReportsIcon },
    { path: '/data', label: '資料管理', icon: DataManagementIcon },
  ]

  const adminNavigationItems = [
    ...baseNavigationItems,
    { path: '/team', label: '團隊管理', icon: UsersIcon },
    { path: '/channels', label: '頻道管理', icon: ChannelIcon },
    { path: '/activities', label: '活動記錄', icon: ActivityIcon },
    { path: '/api-monitor', label: 'API監控', icon: MonitorIcon },
    { path: '/settings', label: '系統設定', icon: SettingsIcon },
  ]

  // Use computed with proper caching to prevent infinite loops
  const navigationItems = computed(() => {
    // Directly check role without intermediate variables
    const isAdmin = authStore.currentAgent?.role === 'admin'
    return isAdmin ? adminNavigationItems : baseNavigationItems
  })

  // CRITICAL FIX: Pure functions without ANY side effects
  // Computed functions must be completely pure - no console.log, no console.error
  const currentPageTitle = computed(() => {
    const currentPath = route.path

    // 特殊处理对话详情页面
    if (currentPath.startsWith('/conversations/') && route.params.id) {
      return '對話'
    }

    const item = navigationItems.value.find(item => item.path === currentPath)
    return item?.label || '頁面'
  })

  // Pure function - no external state mutation, no side effects
  const userInitials = computed(() => {
    const agent = authStore?.currentAgent

    if (!agent || !agent.name) {
      return 'U'
    }

    const name = String(agent.name)
    if (!name || name.length === 0) {
      return 'U'
    }

    const parts = name.split(' ').filter(n => n && n.length > 0)
    if (!parts || parts.length === 0) {
      return 'U'
    }

    const initials = parts
      .map(n => n[0])
      .join('')
      .toUpperCase()
    return initials || 'U'
  })

  // 處理通知點擊事件 - 根據通知類型導航到相應頁面
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
        // 提及通知 - 導航到相關對話或內部討論
        if (data?.conversationId) {
          router.push(`/conversations/${data.conversationId}`)
        }
        break
      case 'system':
        // 系統通知 - 可能導航到設定或公告頁面
        router.push('/notifications')
        break
      case 'task_reminder':
        // 任務提醒 - 導航到相關任務
        if (data?.conversationId) {
          router.push(`/conversations/${data.conversationId}`)
        }
        break
      default:
        // 預設導航到通知列表
        router.push('/notifications')
    }
  }

  const toggleSidebar = () => {
    if (isMobile.value) {
      showMobileMenu.value = !showMobileMenu.value
    } else {
      sidebarCollapsed.value = !sidebarCollapsed.value
      isAutoCollapsed.value = false // 手動操作時清除自動摺疊狀態
    }
  }

  const toggleReportsSubmenu = () => {
    isReportsExpanded.value = !isReportsExpanded.value
  }

  const toggleDataManagementSubmenu = () => {
    isDataManagementExpanded.value = !isDataManagementExpanded.value
  }

  const toggleSettingsSubmenu = () => {
    isSettingsExpanded.value = !isSettingsExpanded.value
  }

  // Fix: Debounced resize handler to prevent recursive updates
  let resizeTimeout: ReturnType<typeof setTimeout>

  const handleResize = () => {
    // Clear the previous timeout on every call to debounce the event
    clearTimeout(resizeTimeout)

    resizeTimeout = setTimeout(() => {
      const width = window.innerWidth
      const newIsMobile = width <= 768

      // Apply mobile state change
      if (isMobile.value !== newIsMobile) {
        isMobile.value = newIsMobile
      }

      // Logic for sidebar visibility based on width
      if (newIsMobile) {
        // On mobile, ensure the desktop-style collapsed state is not active
        // and let showMobileMenu control visibility.
        sidebarCollapsed.value = false
        isAutoCollapsed.value = false
      } else {
        // On desktop/tablet
        if (width >= 1025) {
          // Large screens: restore from auto-collapse
          if (isAutoCollapsed.value) {
            sidebarCollapsed.value = false
            isAutoCollapsed.value = false
          }
        } else {
          // width >= 769 && width <= 1024
          // Medium screens: auto-collapse
          if (!sidebarCollapsed.value || isAutoCollapsed.value) {
            sidebarCollapsed.value = true
            isAutoCollapsed.value = true
          }
        }
        // Always hide mobile menu on non-mobile screens
        showMobileMenu.value = false
      }
    }, 150) // 150ms debounce delay
  }

  const handleUserProfileClick = () => {
    if (!sidebarCollapsed.value) {
      toggleUserMenu()
    }
  }

  const toggleUserMenu = () => {
    showUserMenu.value = !showUserMenu.value
  }

  const viewProfile = () => {
    showUserMenu.value = false
    // TODO: 實現個人資料頁面
    console.log('查看個人資料')
  }

  const changePassword = () => {
    showUserMenu.value = false
    // TODO: 實現修改密碼功能
    console.log('修改密碼')
  }

  const handleLogout = async () => {
    showUserMenu.value = false

    // 顯示確認對話框
    const confirmed = await confirmInfo(
      '登出確認',
      '確定要登出嗎？登出後需要重新輸入帳號密碼。',
      '登出'
    )
    if (confirmed) {
      try {
        await authStore.logout()
      } catch (error) {
        console.error('登出失敗:', error)
        showError('登出失敗', '請稍後再試')
      }
    }
  }

  // 點擊外部關閉菜單
  const handleClickOutside = (event: Event) => {
    const target = event.target as globalThis.Element
    if (!target.closest('.user-profile') && !target.closest('.user-menu')) {
      showUserMenu.value = false
    }
    if (!target.closest('.sidebar') && !target.closest('.mobile-menu-btn') && isMobile.value) {
      showMobileMenu.value = false
    }
  }

  // Watch route changes to update UI state
  // Use flush: 'post' to prevent recursive updates during render
  // Use immediate: true so expandable menus are open on initial page load / refresh
  watch(
    () => route.path,
    newPath => {
      // Auto-expand reports submenu when on any reports route
      if (newPath.startsWith('/reports')) {
        isReportsExpanded.value = true
      }

      // Auto-expand data management submenu when on any /data route
      if (newPath.startsWith('/data')) {
        isDataManagementExpanded.value = true
      }

      // Auto-expand settings submenu when on any settings route
      if (newPath.startsWith('/settings')) {
        isSettingsExpanded.value = true
      }

      // Close user menu when route changes
      showUserMenu.value = false
    },
    { flush: 'post', immediate: true }
  )

  onMounted(async () => {
    // Load notifications or other initialization
    document.addEventListener('click', handleClickOutside)
    window.addEventListener('resize', handleResize)

    // Wait for next tick to ensure DOM is fully rendered before initial resize
    await nextTick()
    handleResize() // 初始化時檢查屏幕尺寸
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
    window.removeEventListener('resize', handleResize)
  })
</script>

<style scoped>
  .app-layout {
    display: flex;
    height: 100vh;
    background-color: #f9fafb !important;
    /* 固定背景顏色，不受主題影響 */
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

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-6);
    border-bottom: 1px solid var(--gray-200);
    min-height: 80px;
  }

  .sidebar-collapsed .sidebar-header {
    justify-content: center;
    padding: var(--space-4);
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

  /* Hamburger animation on hover */
  .sidebar-toggle:hover .hamburger-line:nth-child(1) {
    transform: translateY(1px);
  }

  .sidebar-toggle:hover .hamburger-line:nth-child(3) {
    transform: translateY(-1px);
  }

  .sidebar-nav {
    flex: 1;
    padding: var(--space-4);
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0; /* required for flex child to shrink and scroll */
  }

  /* Thin scrollbar for sidebar nav */
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

  /* Nav Item Group for Expandable Items */
  .nav-item-group {
    margin-bottom: var(--space-2);
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

  .nav-item.expandable {
    cursor: pointer;
    justify-content: space-between;
  }

  .sidebar-collapsed .nav-item {
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

  .sidebar-collapsed .nav-text {
    opacity: 0;
  }

  /* Expand Icon */
  .expand-icon {
    font-size: 0.75rem;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    color: var(--gray-500);
  }

  .expand-icon.expanded {
    transform: rotate(90deg);
  }

  /* Submenu Styles */
  .submenu {
    margin-left: var(--space-6);
    margin-top: var(--space-2);
    padding-left: var(--space-4);
    border-left: 2px solid var(--gray-200);
    overflow: hidden;
  }

  .submenu-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    margin-bottom: var(--space-1);
    border-radius: var(--radius-md);
    text-decoration: none;
    color: var(--gray-700);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 0.9rem;
  }

  .submenu-item:hover {
    background: var(--gray-50);
    color: var(--gray-900);
    transform: translateX(2px);
  }

  .submenu-item.active {
    background: var(--primary-100);
    color: var(--primary-700);
    font-weight: 600;
  }

  /* Submenu Animation */
  .submenu-enter-active,
  .submenu-leave-active {
    transition: all 0.3s ease;
    max-height: 300px;
  }

  .submenu-enter-from,
  .submenu-leave-to {
    max-height: 0;
    opacity: 0;
    margin-top: 0;
  }

  .sidebar-footer {
    padding: var(--space-4);
    border-top: 1px solid var(--gray-200);
  }

  .user-profile {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-lg);
    background-color: var(--gray-50);
    cursor: pointer;
    transition: all var(--transition-fast);
    position: relative;
  }

  .user-profile:hover {
    background-color: var(--gray-100);
  }

  .user-profile.collapsed {
    justify-content: center;
    cursor: default;
  }

  .user-profile.collapsed:hover {
    background-color: var(--gray-50);
  }

  /* Mobile user profile - always show info when mobile menu is open */
  .sidebar-mobile .user-profile {
    cursor: default;
  }

  .sidebar-mobile .user-profile:hover {
    background-color: var(--gray-50);
  }

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-full);
    background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .user-info {
    flex: 1;
  }

  .user-name {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--gray-900);
  }

  .user-role {
    font-size: 0.75rem;
    color: var(--gray-500);
    text-transform: capitalize;
  }

  .user-menu-btn {
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
  }

  .user-menu-btn:hover {
    background-color: var(--gray-200);
    color: var(--gray-700);
  }

  .user-menu-btn .rotated {
    transform: rotate(180deg);
  }

  .user-menu {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid var(--gray-200);
    border-radius: var(--radius-lg);
    box-shadow:
      0 10px 25px -5px rgba(0, 0, 0, 0.1),
      0 4px 6px -4px rgba(0, 0, 0, 0.1);
    margin-bottom: var(--space-2);
    overflow: hidden;
    z-index: 50;
    animation: slideUp 0.2s ease-out;
  }

  /* Modern Menu Design */
  .modern-menu {
    position: fixed !important;
    bottom: 90px !important;
    left: 20px !important;
    right: auto !important;
    width: 220px !important;
    z-index: 9999 !important;
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(20px) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    border-radius: 16px !important;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04),
      0 0 0 1px rgba(255, 255, 255, 0.05) !important;
    padding: 8px !important;
    animation: modernSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
  }

  .user-menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 12px 16px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--gray-700);
    border-radius: 12px;
    margin: 2px 0;
    position: relative;
    overflow: hidden;
  }

  .modern-menu .user-menu-item {
    border-radius: 10px !important;
    font-weight: 500 !important;
    letter-spacing: -0.01em !important;
  }

  .user-menu-item:hover {
    background-color: var(--gray-50);
    transform: translateX(2px);
  }

  .modern-menu .user-menu-item:hover {
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.08),
      rgba(59, 130, 246, 0.04)
    ) !important;
    color: var(--primary-700) !important;
    transform: translateX(4px) !important;
  }

  .user-menu-item.logout {
    color: var(--danger-600);
  }

  .user-menu-item.logout:hover {
    background-color: var(--danger-50);
    color: var(--danger-700);
  }

  .modern-menu .user-menu-item.logout:hover {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.08),
      rgba(239, 68, 68, 0.04)
    ) !important;
    color: var(--danger-700) !important;
  }

  .user-menu-divider {
    height: 1px;
    background-color: var(--gray-200);
    margin: 8px 12px;
    border-radius: 1px;
  }

  .modern-menu .user-menu-divider {
    background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.1), transparent) !important;
    margin: 8px 0 !important;
  }

  /* Modern Menu Icons */
  .modern-menu .user-menu-item svg {
    width: 18px !important;
    height: 18px !important;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
    opacity: 0.7 !important;
  }

  .modern-menu .user-menu-item:hover svg {
    opacity: 1 !important;
    transform: scale(1.1) !important;
  }

  .modern-menu .user-menu-item.logout svg {
    color: var(--danger-500) !important;
  }

  /* Add subtle glow effect on hover */
  .modern-menu .user-menu-item::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), transparent);
    opacity: 0;
    transition: opacity 0.2s ease;
    border-radius: inherit;
  }

  .modern-menu .user-menu-item:hover::before {
    opacity: 1;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes modernSlideUp {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      filter: blur(4px);
    }

    to {
      opacity: 1;
      transform: translateY(0) scale(1);
      filter: blur(0px);
    }
  }

  /* Main Content */
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

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

  .notification-btn {
    position: relative;
    padding: var(--space-3);
    border: 2px solid var(--gray-300);
    background: linear-gradient(135deg, var(--gray-100), var(--gray-200));
    color: var(--gray-700);
    cursor: pointer;
    border-radius: var(--radius-lg);
    transition: all var(--transition-fast);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
  }

  .notification-btn:hover {
    background: linear-gradient(135deg, var(--gray-200), var(--gray-300));
    color: var(--gray-900);
    border-color: var(--gray-400);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .notification-btn:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .notification-btn svg {
    transition: all var(--transition-fast);
  }

  .notification-btn:hover svg {
    transform: scale(1.1);
  }

  .notification-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 3px 7px;
    border-radius: var(--radius-full);
    min-width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
    animation: pulse-notification 2s infinite;
  }

  @keyframes pulse-notification {
    0%,
    100% {
      transform: scale(1);
      box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
    }

    50% {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.6);
    }
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
    /* 確保頁面內容區域也是固定背景色和滾動功能 */
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

  /* Firefox scrollbar */
  .page-content {
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.2) rgba(0, 0, 0, 0.05);
  }

  /* Notification Panel */
  .notification-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 50;
    display: flex;
    justify-content: flex-end;
  }

  .notification-content {
    width: 400px;
    background-color: white;
    box-shadow: var(--shadow-xl);
    display: flex;
    flex-direction: column;
    max-height: 100vh;
  }

  .notification-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-6);
    border-bottom: 1px solid var(--gray-200);
  }

  .notification-header h3 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    padding: var(--space-2);
    border: none;
    background: none;
    font-size: 1.5rem;
    color: var(--gray-500);
    cursor: pointer;
    border-radius: var(--radius-md);
  }

  .close-btn:hover {
    background-color: var(--gray-100);
  }

  .notification-list {
    flex: 1;
    overflow-y: auto;
  }

  .no-notifications {
    padding: var(--space-8);
    text-align: center;
    color: var(--gray-500);
  }

  .notification-item {
    padding: var(--space-4);
    border-bottom: 1px solid var(--gray-100);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .notification-item:hover {
    background-color: var(--gray-50);
  }

  .notification-item.unread {
    background-color: var(--primary-50);
  }

  .notification-title {
    font-weight: 500;
    margin-bottom: var(--space-1);
  }

  .notification-message {
    font-size: 0.875rem;
    color: var(--gray-600);
    margin-bottom: var(--space-2);
  }

  .notification-time {
    font-size: 0.75rem;
    color: var(--gray-500);
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

  /* Large screens - Full sidebar */
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

  /* Medium screens - Auto-collapsed sidebar */
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

    /* Ensure nav text is hidden on medium screens */
    .nav-text {
      opacity: 0;
    }

    .user-info {
      display: none;
    }

    .user-menu-btn {
      display: none;
    }
  }

  /* Small screens - Mobile sidebar with overlay */
  @media (max-width: 768px) {
    .main-content {
      margin-left: 0;
      padding-top: 80px; /* Account for mobile menu button */
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

    /* Mobile sidebar shows full content */
    .sidebar-mobile .nav-text,
    .sidebar-mobile .user-info {
      opacity: 1;
      display: block;
    }

    .sidebar-mobile .sidebar-header {
      justify-content: space-between;
      padding: var(--space-6);
    }

    .sidebar-mobile .logo {
      opacity: 1;
    }

    .notification-content {
      width: 100%;
    }

    .top-bar {
      padding-left: 80px; /* Account for mobile menu button */
    }
  }
</style>
