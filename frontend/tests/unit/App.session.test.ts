import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { shallowMount } from '@vue/test-utils'

const session = vi.hoisted(() => ({
  isAuthenticated: undefined as unknown as { value: boolean },
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn()
}))

vi.mock('vue-router', () => ({ useRoute: () => ({ path: '/', query: {} }) }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get isAuthenticated() { return session.isAuthenticated.value },
    validateSession: () => false
  })
}))
vi.mock('@/stores/websocket', () => ({
  useWebSocketStore: () => ({ connect: session.connect, disconnect: session.disconnect })
}))
vi.mock('@/composables/notification/useDesktopNotifications', () => ({
  useDesktopNotifications: () => ({ start: session.start, stop: session.stop })
}))
vi.mock('@/composables/notification/usePageTitleUnread', () => ({ usePageTitleUnread: vi.fn() }))
vi.mock('@/composables/useActivityTracker', () => ({
  useActivityTracker: () => ({ startTracking: vi.fn() })
}))
vi.mock('@/composables/useTokenRefresh', () => ({
  useTokenRefresh: () => ({ startTokenRefreshCheck: vi.fn() })
}))
vi.mock('@/composables/useAccountStatusMonitor', () => ({
  useAccountStatusMonitor: () => ({ showDisabledModal: ref(false) })
}))
vi.mock('@/services/preloadService', () => ({
  preloadService: { init: vi.fn().mockResolvedValue(undefined), cleanup: vi.fn() }
}))
vi.mock('@/services/tagCacheService', () => ({
  tagCacheService: { init: vi.fn().mockResolvedValue(undefined), cleanup: vi.fn() }
}))

import App from '@/App.vue'

const mountApp = () => shallowMount(App, { global: { stubs: { RouterView: true } } })

describe('App websocket session lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.isAuthenticated = ref(false)
  })

  it('connects when a fresh login happens after startup', async () => {
    const wrapper = mountApp()
    expect(session.connect).not.toHaveBeenCalled()

    session.isAuthenticated.value = true
    await nextTick()

    expect(session.connect).toHaveBeenCalledTimes(1)
    expect(session.start).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('drops the socket on logout so the next user cannot inherit it', async () => {
    session.isAuthenticated.value = true
    const wrapper = mountApp()

    session.isAuthenticated.value = false
    await nextTick()

    expect(session.stop).toHaveBeenCalled()
    expect(session.disconnect).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
