<template>
  <div class="sidebar-footer">
    <div
      class="user-profile"
      :class="{
        collapsed: sidebarCollapsed && !isMobile,
        'user-profile--mobile': isMobile,
      }"
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
        v-if="!sidebarCollapsed || isMobile"
        class="user-menu-btn"
        title="用戶菜單"
        @click.stop="toggleUserMenu()"
      >
        <ChevronUpIcon :class="{ rotated: showUserMenu }" />
      </button>
    </div>

    <!-- User Dropdown Menu -->
    <!-- BUG FIX: Original condition was `showUserMenu && (!sidebarCollapsed || isMobile) && !isMobile`
         which simplified to `showUserMenu && !sidebarCollapsed && !isMobile` — making it impossible
         to open on mobile. Fixed to: `showUserMenu && !sidebarCollapsed` (desktop only, sidebar expanded) -->
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
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
  import { useRoute } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'
  import { useToast } from '@/composables/useToast'
  import { useConfirm } from '@/composables/useConfirm'
  import ChevronUpIcon from '@/components/icons/ChevronUpIcon.vue'
  import UserIcon from '@/components/icons/UserIcon.vue'
  import KeyIcon from '@/components/icons/KeyIcon.vue'
  import LogoutIcon from '@/components/icons/LogoutIcon.vue'

  const props = defineProps<{
    sidebarCollapsed: boolean
    isMobile: boolean
  }>()

  const route = useRoute()
  const authStore = useAuthStore()
  const { showError } = useToast()
  const { confirmInfo } = useConfirm()

  const showUserMenu = ref(false)

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

  const handleUserProfileClick = () => {
    if (!props.sidebarCollapsed) {
      toggleUserMenu()
    }
  }

  const toggleUserMenu = () => {
    showUserMenu.value = !showUserMenu.value
  }

  const viewProfile = () => {
    showUserMenu.value = false
    console.log('查看個人資料')
  }

  const changePassword = () => {
    showUserMenu.value = false
    console.log('修改密碼')
  }

  const handleLogout = async () => {
    showUserMenu.value = false
    const confirmed = await confirmInfo(
      '登出確認',
      '確定要登出嗎？登出後需要重新輸入帳號密碼。',
      '登出',
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

  // Click outside handler for user menu
  const handleClickOutside = (event: Event) => {
    const target = event.target as globalThis.Element
    if (!target.closest('.user-profile') && !target.closest('.user-menu')) {
      showUserMenu.value = false
    }
  }

  // Close user menu on route change
  watch(
    () => route.path,
    () => {
      showUserMenu.value = false
    },
    { flush: 'post' },
  )

  onMounted(() => {
    document.addEventListener('click', handleClickOutside)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
  })
</script>

<style scoped>
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

  /* Prop-driven mobile style (replaces .sidebar-mobile .user-profile) */
  .user-profile--mobile {
    cursor: default;
  }

  .user-profile--mobile:hover {
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

  /* Subtle glow effect on hover */
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

  /* Medium screens - hide user info */
  @media (min-width: 769px) and (max-width: 1024px) {
    .user-info {
      display: none;
    }

    .user-menu-btn {
      display: none;
    }
  }
</style>
