/**
 * Integration Tests for NotificationList
 *
 * Tests the complete NotificationList component with all composables and store integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import NotificationList from '@/views/NotificationList.vue'
import { useNotificationsStore } from '@/stores/notifications'
import { notificationApi } from '@/api/notifications'

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
    list: vi.fn().mockResolvedValue({
      success: true,
      data: { items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }
    }),
    getRecent: vi.fn().mockResolvedValue({ success: true, data: { notifications: [], count: 0 } }),
    getUnreadCount: vi.fn().mockResolvedValue({ success: true, data: { count: 0 } }),
    getStats: vi.fn().mockResolvedValue({
      success: true,
      data: { total: 0, unread: 0, byType: {}, byPriority: {} }
    }),
    getSettings: vi.fn().mockResolvedValue({ success: true, data: {} }),
    updateSettings: vi.fn().mockResolvedValue({ success: true }),
    markAsRead: vi.fn().mockResolvedValue({ success: true }),
    markAllAsRead: vi.fn().mockResolvedValue({ success: true }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    create: vi.fn().mockResolvedValue({ success: true })
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
    props: ['hasUnread', 'markingAllRead', 'stats']
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


const sampleNotification = {
  id: '1',
  type: 'new_message',
  title: 'Test',
  message: 'Test message',
  isRead: false,
  priority: 'normal',
  createdAt: new Date().toISOString(),
  data: {}
}

/** What the notifications list endpoint returns for the page under test */
function serveList(items: unknown[], total: number, totalPages: number) {
  vi.mocked(notificationApi.list).mockResolvedValue({
    success: true,
    data: { items, page: 1, pageSize: 20, total, totalPages }
  } as never)
}

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
    serveList([], 0, 0)
  })

  describe('component mounting', () => {
    it('should cleanup on unmount', async () => {
      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true,
            // The page renders inside the app shell; the shell itself is not under test here
            AppLayout: { template: '<div><slot /></div>' }
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
            Teleport: true,
            // The page renders inside the app shell; the shell itself is not under test here
            AppLayout: { template: '<div><slot /></div>' }
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
      serveList([], 0, 0)

      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true,
            // The page renders inside the app shell; the shell itself is not under test here
            AppLayout: { template: '<div><slot /></div>' }
          }
        }
      })

      await flushPromises()

      expect(wrapper.findComponent({ name: 'NotificationEmptyState' }).exists()).toBe(true)
    })

    it('should show notifications list when data available', async () => {
      serveList([sampleNotification], 1, 1)

      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true,
            // The page renders inside the app shell; the shell itself is not under test here
            AppLayout: { template: '<div><slot /></div>' }
          }
        }
      })

      await flushPromises()

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
            Teleport: true,
            // The page renders inside the app shell; the shell itself is not under test here
            AppLayout: { template: '<div><slot /></div>' }
          }
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.findComponent({ name: 'NotificationHeader' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'NotificationFilters' }).exists()).toBe(true)
    })

    it('should pass correct props to sub-components', async () => {
      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true,
            // The page renders inside the app shell; the shell itself is not under test here
            AppLayout: { template: '<div><slot /></div>' }
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

      expect(header.props('stats')).toEqual(store.stats)
    })
  })

  describe('pagination', () => {
    it('should show load more button when more data available', async () => {
      serveList([sampleNotification], 50, 3)

      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true,
            // The page renders inside the app shell; the shell itself is not under test here
            AppLayout: { template: '<div><slot /></div>' }
          }
        }
      })

      await flushPromises()

      expect(wrapper.find('.load-more-section').exists()).toBe(true)
    })

    it('should not show load more button when all data loaded', async () => {
      serveList([sampleNotification], 1, 1)

      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true,
            // The page renders inside the app shell; the shell itself is not under test here
            AppLayout: { template: '<div><slot /></div>' }
          }
        }
      })

      await flushPromises()

      expect(wrapper.find('.load-more-section').exists()).toBe(false)
    })
  })

  describe('accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      const wrapper = mount(NotificationList, {
        global: {
          plugins: [router],
          stubs: {
            Teleport: true,
            // The page renders inside the app shell; the shell itself is not under test here
            AppLayout: { template: '<div><slot /></div>' }
          }
        }
      })

      await wrapper.vm.$nextTick()

      const mainElement = wrapper.find('.notification-page')
      expect(mainElement.attributes('role')).toBe('main')
      expect(mainElement.attributes('aria-label')).toBe('通知頁面')

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
            Teleport: true,
            // The page renders inside the app shell; the shell itself is not under test here
            AppLayout: { template: '<div><slot /></div>' }
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
