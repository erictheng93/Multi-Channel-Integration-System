import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import NotificationSettingsModal from '@/components/notification/NotificationSettingsModal.vue'
import {
  useDesktopNotificationPrefs,
  __resetDesktopNotificationPrefsForTest,
} from '@/composables/notification/useDesktopNotificationPrefs'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 13, 23, 59, 59))
  __resetDesktopNotificationPrefsForTest()
})

afterEach(() => {
  __resetDesktopNotificationPrefsForTest()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('updates the open settings modal at midnight', async () => {
  vi.stubGlobal('Notification', { permission: 'granted' })
  useDesktopNotificationPrefs().pauseUntil(new Date(2026, 9, 14, 9).getTime())
  const wrapper = mount(NotificationSettingsModal, {
    props: {
      visible: true,
      settings: {
        pushEnabled: true,
        soundEnabled: true,
        emailEnabled: false,
        messageEnabled: true,
        assignmentEnabled: true,
        mentionEnabled: true,
      },
    },
    global: { stubs: { Modal: { template: '<div><slot /></div>' } } },
  })
  try {
    expect(wrapper.text()).toContain('通知已暫停，至 明天 09:00')
    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(wrapper.text()).toContain('通知已暫停，至 09:00')
    expect(wrapper.text()).not.toContain('明天 09:00')
  } finally {
    wrapper.unmount()
  }
})

it('refreshes tomorrow to today at midnight without changing the pause deadline', () => {
  const { prefs, pauseUntil, pausedUntilText, isPaused } = useDesktopNotificationPrefs()
  const until = new Date(2026, 9, 14, 9).getTime()
  pauseUntil(until)
  expect(pausedUntilText.value).toBe('明天 09:00')
  vi.advanceTimersByTime(1000)
  expect(pausedUntilText.value).toBe('09:00')
  expect(prefs.pausedUntil).toBe(until)
  expect(isPaused.value).toBe(true)
  vi.advanceTimersByTime(9 * 60 * 60_000)
  expect(isPaused.value).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
})

it('updates across multiple date boundaries and stops scheduling after resume', () => {
  const { pauseUntil, pausedUntilText, resume } = useDesktopNotificationPrefs()
  pauseUntil(new Date(2026, 9, 15, 9).getTime())
  expect(pausedUntilText.value).toBe('10/15 09:00')
  vi.advanceTimersByTime(1000)
  expect(pausedUntilText.value).toBe('明天 09:00')
  vi.advanceTimersByTime(24 * 60 * 60_000)
  expect(pausedUntilText.value).toBe('09:00')
  resume()
  expect(pausedUntilText.value).toBe('')
  expect(vi.getTimerCount()).toBe(0)
})

it('refreshes immediately on focus when a background timer has not fired', () => {
  const { pauseUntil, pausedUntilText, isPaused } = useDesktopNotificationPrefs()
  pauseUntil(new Date(2026, 9, 14, 9).getTime())
  expect(pausedUntilText.value).toBe('明天 09:00')
  vi.setSystemTime(new Date(2026, 9, 14, 1))
  window.dispatchEvent(new Event('focus'))
  expect(pausedUntilText.value).toBe('09:00')
  expect(isPaused.value).toBe(true)
  vi.setSystemTime(new Date(2026, 9, 14, 10))
  window.dispatchEvent(new Event('focus'))
  expect(isPaused.value).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
})

it('does not schedule clock updates when no pause is active', () => {
  const { isPaused, pausedUntilText } = useDesktopNotificationPrefs()
  expect(isPaused.value).toBe(false)
  expect(pausedUntilText.value).toBe('')
  expect(vi.getTimerCount()).toBe(0)
})
