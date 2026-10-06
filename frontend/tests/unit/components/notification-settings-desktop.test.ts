import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import NotificationSettingsModal from '@/components/notification/NotificationSettingsModal.vue'
import { __resetDesktopNotificationPrefsForTest, useDesktopNotificationPrefs } from '@/composables/notification/useDesktopNotificationPrefs'

const baseSettings = {
  pushEnabled: true,
  soundEnabled: true,
  emailEnabled: false,
  messageEnabled: true,
  assignmentEnabled: true,
  mentionEnabled: true
}

function mountModal() {
  return mount(NotificationSettingsModal, {
    props: { visible: true, settings: baseSettings },
    global: {
      stubs: {
        Modal: { template: '<div><slot /><slot name="footer" /></div>' }
      }
    }
  })
}

describe('NotificationSettingsModal desktop section', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetDesktopNotificationPrefsForTest()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('permission=default → 顯示啟用按鈕', () => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() })
    const wrapper = mountModal()
    expect(wrapper.find('[data-testid="desktop-enable-btn"]').exists()).toBe(true)
  })

  it('permission=granted → 顯示三個開關', () => {
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() })
    const wrapper = mountModal()
    expect(wrapper.find('[data-testid="desktop-enabled-toggle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="desktop-scope-toggle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="desktop-sound-toggle"]').exists()).toBe(true)
  })

  it('permission=granted → 顯示 Windows 設定提示與測試按鈕', () => {
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() })
    const wrapper = mountModal()
    expect(wrapper.find('[data-testid="desktop-os-hint"]').text()).toContain('Windows')
    expect(wrapper.find('[data-testid="desktop-test-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="desktop-test-sent"]').exists()).toBe(false)
  })

  it('點測試按鈕 → 送出測試通知並顯示已送出提示', async () => {
    const NotificationMock = vi.fn()
    Object.assign(NotificationMock, { permission: 'granted', requestPermission: vi.fn() })
    vi.stubGlobal('Notification', NotificationMock)
    const wrapper = mountModal()

    await wrapper.find('[data-testid="desktop-test-btn"]').trigger('click')

    expect(NotificationMock).toHaveBeenCalledWith('測試通知', expect.objectContaining({ tag: 'desktop-notification-test' }))
    expect(wrapper.find('[data-testid="desktop-test-sent"]').exists()).toBe(true)
  })

  it('permission=denied → 顯示封鎖說明', () => {
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() })
    const wrapper = mountModal()
    expect(wrapper.find('[data-testid="desktop-denied-hint"]').exists()).toBe(true)
  })

  it('不支援 Notification → 顯示不支援說明', () => {
    vi.stubGlobal('Notification', undefined)
    const wrapper = mountModal()
    expect(wrapper.find('[data-testid="desktop-unsupported-hint"]').exists()).toBe(true)
  })

  it('點啟用按鈕 → 呼叫 requestPermission,granted 後切換為開關畫面', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    vi.stubGlobal('Notification', { permission: 'default', requestPermission })
    const wrapper = mountModal()
    await wrapper.find('[data-testid="desktop-enable-btn"]').trigger('click')
    await vi.waitFor(() => {
      expect(requestPermission).toHaveBeenCalled()
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="desktop-enabled-toggle"]').exists()).toBe(true)
  })

  it('切換範圍開關 → prefs.scope 更新為 my-teams', async () => {
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() })
    const wrapper = mountModal()
    await wrapper.find('[data-testid="desktop-scope-toggle"]').setValue(true)
    const { prefs } = useDesktopNotificationPrefs()
    expect(prefs.scope).toBe('my-teams')
  })

  it('denied 下以 visible:false 掛載 → 瀏覽器權限變更為 granted 後重開 Modal → 顯示三個開關', async () => {
    const notifStub = { permission: 'denied', requestPermission: vi.fn() }
    vi.stubGlobal('Notification', notifStub)
    const wrapper = mount(NotificationSettingsModal, {
      props: { visible: false, settings: baseSettings },
      global: {
        stubs: {
          Modal: { template: '<div><slot /><slot name="footer" /></div>' }
        }
      }
    })

    notifStub.permission = 'granted'
    await wrapper.setProps({ visible: true })

    expect(wrapper.find('[data-testid="desktop-enabled-toggle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="desktop-scope-toggle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="desktop-sound-toggle"]').exists()).toBe(true)
  })
})
