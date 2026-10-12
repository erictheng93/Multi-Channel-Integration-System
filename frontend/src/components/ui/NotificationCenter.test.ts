// 桌面通知暫停中,頂部列必須一直看得到,否則客服忘了恢復會默默漏接客戶訊息 (#55)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import NotificationCenter from './NotificationCenter.vue'
import {
  useDesktopNotificationPrefs,
  __resetDesktopNotificationPrefsForTest
} from '@/composables/notification/useDesktopNotificationPrefs'

vi.mock('@/stores/notifications', () => ({
  useNotificationsStore: () => ({
    notifications: [],
    recentNotifications: [],
    unreadCount: 0,
    loading: false,
    loadingMore: false,
    canLoadMore: false,
    fetchUnreadCount: vi.fn(),
    fetchRecentNotifications: vi.fn(),
    startPolling: vi.fn(),
    stopPolling: vi.fn()
  })
}))

const pill = () => mount(NotificationCenter).find('[data-testid="desktop-paused-pill"]')

describe('NotificationCenter 暫停提示', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 12, 13, 0))
    __resetDesktopNotificationPrefsForTest()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('未暫停 → 不顯示', () => {
    expect(pill().exists()).toBe(false)
  })

  it('暫停中 → 顯示恢復時間', () => {
    useDesktopNotificationPrefs().pauseUntil(new Date(2026, 9, 12, 14, 30).getTime())
    expect(pill().text()).toContain('至 14:30')
  })

  it('到期 → 自動消失,不需重新整理', async () => {
    useDesktopNotificationPrefs().pauseUntil(Date.now() + 60_000)
    const wrapper = mount(NotificationCenter)
    expect(wrapper.find('[data-testid="desktop-paused-pill"]').exists()).toBe(true)

    vi.advanceTimersByTime(60_000)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="desktop-paused-pill"]').exists()).toBe(false)
  })

  it('桌面通知已關閉 → 不顯示「已暫停」(本來就不會通知)', () => {
    const { setPrefs, pauseUntil } = useDesktopNotificationPrefs()
    pauseUntil(Date.now() + 60_000)
    setPrefs({ enabled: false })
    expect(pill().exists()).toBe(false)
  })
})
