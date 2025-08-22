<template>
  <div class="app-layout">
    <!-- Sidebar -->
    <aside
      class="sidebar"
      :class="{ 'sidebar-collapsed': sidebarCollapsed }"
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
          class="sidebar-toggle"
          :class="{ 'collapsed': sidebarCollapsed }"
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
      </div>

      <nav class="sidebar-nav">
        <router-link
          v-for="item in navigationItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: $route.path === item.path }"
        >
          <component
            :is="item.icon"
            class="nav-icon"
          />
          <span
            v-if="!sidebarCollapsed"
            class="nav-text"
          >{{ item.label }}</span>
        </router-link>
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
            v-if="!sidebarCollapsed"
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
            v-if="!sidebarCollapsed"
            class="user-menu-btn"
            title="用戶菜單"
            @click.stop="toggleUserMenu()"
          >
            <ChevronUpIcon :class="{ 'rotated': showUserMenu }" />
          </button>
        </div>

        <!-- User Dropdown Menu -->
        <div
          v-if="showUserMenu && !sidebarCollapsed"
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
          <!-- Notifications -->
          <button
            class="notification-btn"
            @click="showNotifications = !showNotifications"
          >
            <BellIcon />
            <span
              v-if="unreadCount > 0"
              class="notification-badge"
            >{{ unreadCount }}</span>
          </button>

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

    <!-- Notification Panel -->
    <div
      v-if="showNotifications"
      class="notification-panel"
      @click.self="showNotifications = false"
    >
      <div class="notification-content">
        <div class="notification-header">
          <h3>通知</h3>
          <button
            class="close-btn"
            @click="showNotifications = false"
          >
            ×
          </button>
        </div>
        <div class="notification-list">
          <div
            v-if="notifications.length === 0"
            class="no-notifications"
          >
            暫無新通知
          </div>
          <div
            v-for="notification in notifications"
            :key="notification.id"
            class="notification-item"
            :class="{ unread: !notification.read }"
          >
            <div class="notification-content">
              <div class="notification-title">
                {{ notification.title }}
              </div>
              <div class="notification-message">
                {{ notification.message }}
              </div>
              <div class="notification-time">
                {{ formatTime(notification.createdAt) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'

// Icons (using simple SVG components)
const DashboardIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`
}

const ChatIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>`
}

const BellIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    <circle cx="12" cy="8" r="1" fill="currentColor"/>
  </svg>`
}

const LogoutIcon = {
  template: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`
}

const ChevronUpIcon = {
  template: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>`
}

const UserIcon = {
  template: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
}

const KeyIcon = {
  template: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>`
}

const UsersIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m22 21-3-3m0 0a2 2 0 0 0-3-3 2 2 0 0 0-3 3 2 2 0 0 0 3 3 2 2 0 0 0 3-3Z"/></svg>`
}

const ActivityIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>`
}

const SettingsIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`
}

const route = useRoute()
const authStore = useAuthStore()
const { showError } = useToast()
const { confirmInfo } = useConfirm()

const sidebarCollapsed = ref(false)
const showNotifications = ref(false)
const showUserMenu = ref(false)
const notifications = ref([
  {
    id: '1',
    title: '新訊息',
    message: '來自 LINE 用戶的新訊息',
    createdAt: new Date(),
    read: false
  }
])

const navigationItems = computed(() => {
  const baseItems = [
    { path: '/dashboard', label: '儀表板', icon: DashboardIcon },
    { path: '/conversations', label: '對話管理', icon: ChatIcon }
  ]

  // Navigation items based on user role

  // Show admin features only for admin users
  try {
    // Only show admin menu items if we have confirmed the user is an admin
    if (authStore.currentAgent && authStore.isAdmin) {
      baseItems.push(
        { path: '/team', label: '團隊管理', icon: UsersIcon },
        { path: '/activities', label: '活動記錄', icon: ActivityIcon },
        { path: '/settings', label: '系統設定', icon: SettingsIcon }
      )
    }
    // Remove the temporary admin menu display during loading to prevent confusion
  } catch (error) {
    console.warn('Error in navigation items:', error)
    // Fallback: only show basic items if there's an error
  }

  return baseItems
})

const currentPageTitle = computed(() => {
  const item = navigationItems.value.find(item => item.path === route.path)
  return item?.label || '頁面'
})

const userInitials = computed(() => {
  const name = authStore.currentAgent?.name || 'User'
  return name.split(' ').map(n => n[0]).join('').toUpperCase()
})

const unreadCount = computed(() => {
  return notifications.value.filter(n => !n.read).length
})

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
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

const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

// 移除未使用的 handleNavigation 函數

// 點擊外部關閉菜單
const handleClickOutside = (event: Event) => {
  const target = event.target as Element
  if (!target.closest('.user-profile') && !target.closest('.user-menu')) {
    showUserMenu.value = false
  }
  if (!target.closest('.notification-btn') && !target.closest('.notification-panel')) {
    showNotifications.value = false
  }
}

// 監聽路由變化，確保組件正確更新
watch(() => route.path, (newPath, oldPath) => {
  console.log('🔄 AppLayout detected route change:', oldPath, '->', newPath)

  // 強制更新組件狀態
  nextTick(() => {
    // 關閉任何打開的菜單
    showUserMenu.value = false
    showNotifications.value = false

    // 強制重新計算導航項目
    console.log('🔄 AppLayout: Current page title updated to:', currentPageTitle.value)
  })
}, { immediate: true, flush: 'post' })

onMounted(() => {
  // Load notifications or other initialization
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
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
  width: 280px;
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
}

.sidebar-collapsed .nav-text {
  opacity: 0;
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
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
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
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.04)) !important;
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
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.04)) !important;
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
  padding: var(--space-4) var(--space-6);
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
  overflow: auto;
  padding: var(--space-6);
  background-color: #f9fafb !important;
  /* 確保頁面內容區域也是固定背景色 */
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

/* Responsive */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: -280px;
    z-index: 20;
    transition: left var(--transition-normal);
  }

  .sidebar.open {
    left: 0;
  }

  .main-content {
    margin-left: 0;
  }

  .notification-content {
    width: 100%;
  }
}
</style>