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
        <span
          class="user-presence"
          :class="`user-presence--${connection.tone}`"
          :title="connection.label"
        />
      </div>
      <div
        v-if="!sidebarCollapsed || isMobile"
        class="user-info"
      >
        <div class="user-name">
          {{ authStore.currentAgent?.name }}
        </div>
        <div class="user-role">
          {{ roleSubtitle }}
        </div>
      </div>
      <button
        v-if="!sidebarCollapsed || isMobile"
        class="user-menu-btn"
        title="用戶菜單"
        aria-label="用戶菜單"
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
        <span>個人設定</span>
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
import { createLogger } from '@/utils/logger'

const props = defineProps<{
    sidebarCollapsed: boolean
    isMobile: boolean
  }>()
  const frontendLogger = createLogger('SidebarUserProfile')
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'
  import { useWebSocketStore } from '@/stores/websocket'
  import { useConnectionStatus } from '@/composables/useConnectionStatus'
  import { useToast } from '@/composables/useToast'
  import { useConfirmDialog } from '@/composables/useConfirmDialog'
  import ChevronUpIcon from '@/components/icons/ChevronUpIcon.vue'
  import UserIcon from '@/components/icons/UserIcon.vue'
  import LogoutIcon from '@/components/icons/LogoutIcon.vue'

  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()
  const { showError } = useToast()
  const { showInfo } = useConfirmDialog()

  const showUserMenu = ref(false)

  // Own presence dot = own websocket state (see docs/architecture/REALTIME_PRESENCE.md)
  const connection = useConnectionStatus(useWebSocketStore())

  // 「角色 · 主要團隊」 from /auth/me teams[] (isPrimary); team omitted when none
  const roleSubtitle = computed(() => {
    const agent = authStore.currentAgent
    if (!agent) { return '' }
    const roleLabel = agent.role === 'admin' ? '管理員' : '客服'
    const primary = agent.teams?.find((t) => t.isPrimary) ?? agent.teams?.[0]
    return primary?.name ? `${roleLabel} · ${primary.name}` : roleLabel
  })

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
    frontendLogger.debug('查看個人設定')
    router.push('/profile')
  }

  const handleLogout = async () => {
    showUserMenu.value = false
    const confirmed = await showInfo(
      '登出確認',
      '確定要登出嗎？登出後需要重新輸入帳號密碼。',
      { confirmText: '登出' },
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
  /* Pinned under the scrolling nav (never shrinks, never scrolls away) */
  .sidebar-footer {
    flex: none;
    padding: 8px 10px 12px;
    box-shadow: inset 0 0.5px 0 var(--ui-sep);
  }

  .user-profile {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 14px;
    cursor: pointer;
    transition: background-color var(--ui-dur) var(--ui-ease);
  }

  .user-profile:hover {
    background-color: var(--ui-fill);
  }

  .user-profile.collapsed {
    justify-content: center;
    padding: 8px 0;
    cursor: default;
  }

  .user-profile.collapsed:hover {
    background-color: transparent;
  }

  /* Prop-driven mobile style (replaces .sidebar-mobile .user-profile) */
  .user-profile--mobile {
    cursor: default;
  }

  .user-profile--mobile:hover {
    background-color: transparent;
  }

  .user-avatar {
    position: relative;
    flex: none;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: linear-gradient(160deg, #5aa8ff, #1d6fe0);
    color: #fff;
    font: 600 13px var(--ui-font-display);
  }

  .user-presence {
    position: absolute;
    right: -1px;
    bottom: -1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--ui-green);
    box-shadow: 0 0 0 2px var(--ui-canvas);
  }

  .user-presence--connecting {
    background: var(--ui-orange);
  }

  .user-presence--offline {
    background: var(--ui-faint);
  }

  .user-info {
    flex: 1;
    min-width: 0;
  }

  .user-name {
    overflow: hidden;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--ui-ink);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-role {
    font-size: var(--ui-t-cap);
    color: var(--ui-muted);
  }

  .user-menu-btn {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--ui-faint);
    cursor: pointer;
    transition:
      background-color var(--ui-dur) var(--ui-ease),
      color var(--ui-dur) var(--ui-ease);
  }

  .user-menu-btn:hover {
    background-color: var(--ui-fill);
    color: var(--ui-ink-2);
  }

  .user-menu-btn .rotated {
    transform: rotate(180deg);
  }

  /* Dropdown: a floating card above the profile row */
  .user-menu {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    margin-bottom: 8px;
    padding: 6px;
    border-radius: 16px;
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow-raised);
    overflow: hidden;
    z-index: 50;
    animation: menuRise var(--ui-dur) var(--ui-ease);
  }

  .modern-menu {
    position: fixed;
    bottom: 76px;
    left: 14px;
    right: auto;
    width: 220px;
    z-index: 9999;
  }

  .user-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 10px;
    color: var(--ui-ink-2);
    font-size: 13.5px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color var(--ui-dur) var(--ui-ease),
      color var(--ui-dur) var(--ui-ease);
  }

  .user-menu-item svg {
    width: 17px;
    height: 17px;
    color: var(--ui-muted);
  }

  .user-menu-item:hover {
    background-color: var(--ui-fill);
    color: var(--ui-ink);
  }

  .user-menu-item.logout,
  .user-menu-item.logout svg {
    color: var(--ui-red-ink);
  }

  .user-menu-item.logout:hover {
    background-color: var(--ui-red-soft);
  }

  .user-menu-divider {
    height: 0.5px;
    margin: 4px 8px;
    background-color: var(--ui-sep);
  }

  @keyframes menuRise {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Medium screens - hide user info */
  @media (min-width: 769px) and (max-width: 1024px) {
    .user-info,
    .user-menu-btn {
      display: none;
    }

    .user-profile {
      justify-content: center;
      padding: 8px 0;
    }
  }
</style>
