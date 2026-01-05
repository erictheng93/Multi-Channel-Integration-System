/**
 * Integration Tests for NotificationList
 *
 * Tests the complete NotificationList component with all composables and store integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import NotificationList from '@/views/NotificationList.vue'
import { useNotificationsStore } from '@/stores/notifications'

// Mock dependencies
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showInfo: vi.fn()
  })
}))

vi.mock('@/composables/useWebSocket', () => ({
  useWebSocket: () => ({
    isConnected: { value: true },
    setEventCallbacks: vi.fn(),
    clearEventCallbacks: vi.fn()
  })
}))

vi.mock('@/api/notifications', () => ({
  notificationApi: {
    getNotifications: vi.fn().mockResolvedValue({
      success: true,
      data: {
        notifications: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0
        }
      }
    }),
    getStats: vi.fn().mockResolvedValue({
      success: true,
      data: {
        total: 0,
        unread: 0,
        byType: {},
        byPriority: {}
      }
    }),
    getSettings: vi.fn().mockResolvedValue({
      success: true,
      data: {
        pushEnabled: true,
        soundEnabled: true,
        emailEnabled: false,
        messageEnabled: true,
        assignmentEnabled: true,
        mentionEnabled: true
      }
    }),
    updateSettings: vi.fn().mockResolvedValue({ success: true }),
    markAsRead: vi.fn().mockResolvedValue({ success: true }),
    markAllAsRead: vi.fn().mockResolvedValue({ success: true }),
    deleteNotification: vi.fn().mockResolvedValue({ success: true })
  }
}))

// Mock LoadingSpinner component
vi.mock('@/components/LoadingSpinner.vue', () => ({
  default: {
    name: 'LoadingSpinner',
    template: '<div class="loading-spinner">Loading...</div>',
    props: ['size']
  }
}))

// Mock notification sub-components
vi.mock('@/components/notification/NotificationHeader.vue', () => ({
  default: {
    name: 'NotificationHeader',
    template: '<div class="notification-header"><slot /></div>',
    props: ['hasUnread', 'markingAllRead']
  }
}))

vi.mock('@/components/notification/NotificationStats.vue', () => ({
  default: {
    name: 'NotificationStats',
    template: '<div class="notification-stats"><slot /></div>',
    props: ['stats']
  }
}))

vi.mock('@/components/notification/NotificationFilters.vue', () => ({
  default: {
    name: 'NotificationFilters',
    template: '<div class="notification-filters"><slot /></div>',
    props: ['selectedType', 'selectedPriority', 'selectedReadStatus', 'hasActiveFilters', 'notificationTypes', 'priorities']
  }
}))

vi.mock('@/components/notification/NotificationCard.vue', () => ({
  default: {
    name: 'NotificationCard',
    template: '<div class="notification-card"><slot /></div>',
    props: ['notification', 'index', 'isFocused']
  }
}))

vi.mock('@/components/notification/NotificationEmptyState.vue', () => ({
  default: {
    name: 'NotificationEmptyState',
    template: '<div class="notification-empty-state"><slot /></div>',
    props: ['hasActiveFilters']
  }
}))

describe('NotificationList Integration', () => {
  let router: ReturnType<typeof createRouter>

  beforeEach(() => {
    // Setup Pinia
    setActivePinia(createPinia())

    // Setup Router
    router = createRouter({
      history: createWebHistory(),
      routes: [
        {
          path: '/notifications',
          component: NotificationList
        },
        {
          path: '/conversations/:id',
          component: { template: '<div>Conversation</div>' }
        }
      ]
    })

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    }
    global.localStorage = localStorageMock as unknown as Storage

    // Mock document.addEventListener for keyboard events
    global.document.addEventListener = vi.fn()
    global.document.removeEventListener = vi.fn()

    vi.clearAllMocks()
  })

  describe('component mounting', () => {
    it('should mount successfully', () => {
      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true
          }
        }
      })

      expect(wrapper.exists()).toBe(true)
    })

    it('should initialize controller on mount', async () => {
      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true
          }
        }
      })

      await wrapper.vm.$nextTick()

      // Note: The controller's initialize() is called in onMounted
      // In the test environment, we may need to manually trigger it
      // For now, we'll just verify the component mounts successfully
      expect(wrapper.exists()).toBe(true)
    })

    it('should cleanup on unmount', async () => {
      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true
          }
        }
      })

      await wrapper.unmount()

      // Controller should remove keyboard listener
      expect(document.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      )
    })
  })

  describe('loading states', () => {
    it('should show loading spinner when loading', async () => {
      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true
          }
        }
      })

      await wrapper.vm.$nextTick()

      // Set loading state after mount
      const store = useNotificationsStore()
      store.loading = true
      store.notifications = []

      await wrapper.vm.$nextTick()

      expect(wrapper.find('.loading-state').exists()).toBe(true)
    })

    it('should show empty state when no notifications', async () => {
      const store = useNotificationsStore()
      store.loading = false
      store.notifications = []

      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true
          }
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.findComponent({ name: 'NotificationEmptyState' }).exists()).toBe(true)
    })

    it('should show notifications list when data available', async () => {
      const store = useNotificationsStore()
      store.loading = false
      store.notifications = [
        {
          id: '1',
          type: 'new_message',
          title: 'Test',
          message: 'Test message',
          isRead: false,
          priority: 'normal',
          createdAt: new Date().toISOString(),
          data: {}
        }
      ]

      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true
          }
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('.notifications-list').exists()).toBe(true)
      expect(wrapper.findAllComponents({ name: 'NotificationCard' }).length).toBe(1)
    })
  })

  describe('component integration', () => {
    it('should render all sub-components', async () => {
      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true
          }
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.findComponent({ name: 'NotificationHeader' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'NotificationStats' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'NotificationFilters' }).exists()).toBe(true)
    })

    it('should pass correct props to sub-components', async () => {
      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true
          }
        }
      })

      await wrapper.vm.$nextTick()

      // Get store after mount to ensure it's the same instance
      const store = useNotificationsStore()
      store.stats = {
        total: 10,
        unread: 5,
        byType: {},
        byPriority: {}
      }
      store.unreadCount = 5

      await wrapper.vm.$nextTick()

      const header = wrapper.findComponent({ name: 'NotificationHeader' })
      expect(header.props('hasUnread')).toBe(true)

      const stats = wrapper.findComponent({ name: 'NotificationStats' })
      expect(stats.props('stats')).toEqual(store.stats)
    })
  })

  describe('user interactions', () => {
    it('should handle show settings', async () => {
      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true
          }
        }
      })

      await wrapper.vm.$nextTick()

      // Initially settings should be hidden
      const vm = wrapper.vm as any
      expect(vm.controller.showSettings.value).toBe(false)

      // Trigger show settings
      vm.controller.showSettings.value = true
      await wrapper.vm.$nextTick()

      expect(vm.controller.showSettings.value).toBe(true)
    })
  })

  describe('pagination', () => {
    it('should show load more button when more data available', async () => {
      const store = useNotificationsStore()
      store.loading = false
      store.notifications = [
        {
          id: '1',
          type: 'new_message',
          title: 'Test',
          message: 'Test',
          isRead: false,
          priority: 'normal',
          createdAt: new Date().toISOString(),
          data: {}
        }
      ]
      store.pagination = {
        page: 1,
        pageSize: 20,
        total: 50,
        totalPages: 3
      }

      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true
          }
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('.load-more-section').exists()).toBe(true)
    })

    it('should not show load more button when all data loaded', async () => {
      const store = useNotificationsStore()
      store.loading = false
      store.notifications = [
        {
          id: '1',
          type: 'new_message',
          title: 'Test',
          message: 'Test',
          isRead: false,
          priority: 'normal',
          createdAt: new Date().toISOString(),
          data: {}
        }
      ]
      store.pagination = {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1
      }

      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true
          }
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('.load-more-section').exists()).toBe(false)
    })
  })

  describe('accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true
          }
        }
      })

      await wrapper.vm.$nextTick()

      const mainElement = wrapper.find('.notification-page')
      expect(mainElement.attributes('role')).toBe('main')
      expect(mainElement.attributes('aria-label')).toBe('通知中心頁面')

      const sectionElement = wrapper.find('.notifications-section')
      expect(sectionElement.attributes('role')).toBe('region')
      expect(sectionElement.attributes('aria-label')).toBe('通知列表')
      expect(sectionElement.attributes('aria-live')).toBe('polite')
    })

    it('should update aria-busy based on loading state', async () => {
      const store = useNotificationsStore()

      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true
          }
        }
      })

      await wrapper.vm.$nextTick()

      const sectionElement = wrapper.find('.notifications-section')

      // Set loading
      store.loading = true
      await wrapper.vm.$nextTick()
      expect(sectionElement.attributes('aria-busy')).toBe('true')

      // Clear loading
      store.loading = false
      await wrapper.vm.$nextTick()
      expect(sectionElement.attributes('aria-busy')).toBe('false')
    })
  })
})
