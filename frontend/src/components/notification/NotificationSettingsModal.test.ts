// 暫停通知的按鈕接線 (#55):判斷邏輯在 composable 測試,這裡只驗畫面與點擊
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import NotificationSettingsModal from './NotificationSettingsModal.vue'
import {
  useDesktopNotificationPrefs,
  __resetDesktopNotificationPrefsForTest
} from '@/composables/notification/useDesktopNotificationPrefs'

const settings = {
  pushEnabled: true,
  soundEnabled: true,
  emailEnabled: false,
  messageEnabled: true,
  assignmentEnabled: true,
  mentionEnabled: true
}

function mountModal() {
  return mount(NotificationSettingsModal, {
    props: { visible: true, settings },
    global: { stubs: { Modal: { props: ['show'], template: '<div v-if="show"><slot /></div>' } } }
  })
}

describe('NotificationSettingsModal 暫停通知', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 12, 13, 0))
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() })
    __resetDesktopNotificationPrefsForTest()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it.each([
    ['30m', new Date(2026, 9, 12, 13, 30)],
    ['1h', new Date(2026, 9, 12, 14, 0)],
    ['until-9', new Date(2026, 9, 13, 9, 0)]
  ])('按 %s → 暫停到對應時間並顯示狀態', async (key, expected) => {
    const wrapper = mountModal()
    await wrapper.find(`[data-testid="desktop-pause-${key}"]`).trigger('click')

    expect(useDesktopNotificationPrefs().prefs.pausedUntil).toBe(expected.getTime())
    expect(wrapper.find('[data-testid="desktop-paused-status"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="desktop-pause-30m"]').exists()).toBe(false)
  })

  it('立即恢復 → 解除暫停,選項回來', async () => {
    useDesktopNotificationPrefs().pauseUntil(Date.now() + 60_000)
    const wrapper = mountModal()
    expect(wrapper.find('[data-testid="desktop-paused-status"]').text()).toContain('至 13:01')

    await wrapper.find('[data-testid="desktop-resume-btn"]').trigger('click')

    expect(useDesktopNotificationPrefs().isPaused.value).toBe(false)
    expect(wrapper.find('[data-testid="desktop-pause-30m"]').exists()).toBe(true)
  })

  it('桌面通知關閉時 → 不顯示暫停區塊', () => {
    useDesktopNotificationPrefs().setPrefs({ enabled: false })
    expect(mountModal().find('[data-testid="desktop-pause"]').exists()).toBe(false)
  })
})
