import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  useDesktopNotificationPrefs,
  __resetDesktopNotificationPrefsForTest,
  DESKTOP_NOTIFICATION_PREFS_KEY
} from './useDesktopNotificationPrefs'

// vitest.setup.ts 全域將 window.localStorage 換成永遠回傳 null 的 no-op mock(供不需要真實
// 持久化的測試使用),因此需要真實 get/set 語意的測試要自行換上有實際存值的假物件。
// 與 src/utils/authStorage.test.ts 的 createStorageMock 相同作法。
function createStorageMock(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value))
  }
}

describe('useDesktopNotificationPrefs', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: createStorageMock(), configurable: true })
    localStorage.clear()
    __resetDesktopNotificationPrefsForTest()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('無存檔時回傳預設值', () => {
    const { prefs } = useDesktopNotificationPrefs()
    expect(prefs.enabled).toBe(true)
    expect(prefs.scope).toBe('all')
    expect(prefs.soundEnabled).toBe(true)
  })

  it('setPrefs 更新並持久化到 localStorage', () => {
    const { prefs, setPrefs } = useDesktopNotificationPrefs()
    setPrefs({ scope: 'my-teams', soundEnabled: false })
    expect(prefs.scope).toBe('my-teams')
    const stored = JSON.parse(localStorage.getItem(DESKTOP_NOTIFICATION_PREFS_KEY) as string)
    expect(stored).toEqual({ enabled: true, scope: 'my-teams', soundEnabled: false, pausedUntil: null })
  })

  it('從 localStorage 載入既有偏好,缺欄位補預設值', () => {
    localStorage.setItem(DESKTOP_NOTIFICATION_PREFS_KEY, JSON.stringify({ enabled: false }))
    const { prefs } = useDesktopNotificationPrefs()
    expect(prefs.enabled).toBe(false)
    expect(prefs.scope).toBe('all')
  })

  it('localStorage 損壞 JSON → 回退預設值不 throw', () => {
    localStorage.setItem(DESKTOP_NOTIFICATION_PREFS_KEY, '{not json')
    const { prefs } = useDesktopNotificationPrefs()
    expect(prefs.enabled).toBe(true)
  })

  it('localStorage 不可寫(private mode)→ setPrefs 仍更新記憶體狀態,存檔停留在最後成功寫入的值', () => {
    const { prefs, setPrefs } = useDesktopNotificationPrefs()

    // 第一次寫入成功,確立存檔基準
    setPrefs({ soundEnabled: false })
    const storedAfterFirstWrite = localStorage.getItem(DESKTOP_NOTIFICATION_PREFS_KEY)
    expect(storedAfterFirstWrite).not.toBeNull()

    // 之後 setItem 開始拋錯(模擬 private mode / quota 滿)
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    setPrefs({ enabled: false })

    // 記憶體狀態已更新,但存檔仍是第一次寫入的內容(寫入失敗被 catch 吞掉、不 throw)
    expect(prefs.enabled).toBe(false)
    expect(prefs.soundEnabled).toBe(false)
    expect(localStorage.getItem(DESKTOP_NOTIFICATION_PREFS_KEY)).toBe(storedAfterFirstWrite)
    expect(JSON.parse(storedAfterFirstWrite as string)).toEqual({
      enabled: true,
      scope: 'all',
      soundEnabled: false,
      pausedUntil: null
    })
  })

  it('兩次呼叫共享同一份狀態(單例)', () => {
    const a = useDesktopNotificationPrefs()
    const b = useDesktopNotificationPrefs()
    a.setPrefs({ enabled: false })
    expect(b.prefs.enabled).toBe(false)
  })

  it('其他分頁寫入偏好(storage 事件)→ 同步到此分頁記憶體,之後 setPrefs 不會蓋回舊值', () => {
    const { prefs, setPrefs } = useDesktopNotificationPrefs()
    localStorage.setItem(DESKTOP_NOTIFICATION_PREFS_KEY, JSON.stringify({ enabled: false, scope: 'all', soundEnabled: true }))
    window.dispatchEvent(new window.StorageEvent('storage', { key: DESKTOP_NOTIFICATION_PREFS_KEY }))
    expect(prefs.enabled).toBe(false)

    setPrefs({ soundEnabled: false })
    expect(JSON.parse(localStorage.getItem(DESKTOP_NOTIFICATION_PREFS_KEY) as string).enabled).toBe(false)
  })

  it('無關 key 的 storage 事件 → 不影響偏好', () => {
    const { prefs } = useDesktopNotificationPrefs()
    localStorage.setItem(DESKTOP_NOTIFICATION_PREFS_KEY, JSON.stringify({ enabled: false }))
    window.dispatchEvent(new window.StorageEvent('storage', { key: 'other-key' }))
    expect(prefs.enabled).toBe(true)
  })

  it('暫停:pauseUntil → isPaused 為真且持久化;到期自動變回 false(不需重新整理);resume 立即恢復', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 9, 12, 13, 0))
      __resetDesktopNotificationPrefsForTest()
      const { isPaused, pauseUntil, resume } = useDesktopNotificationPrefs()
      expect(isPaused.value).toBe(false)

      pauseUntil(Date.now() + 30 * 60_000)
      expect(isPaused.value).toBe(true)
      expect(JSON.parse(localStorage.getItem(DESKTOP_NOTIFICATION_PREFS_KEY) as string).pausedUntil).toBe(Date.now() + 30 * 60_000)

      vi.advanceTimersByTime(30 * 60_000)
      expect(isPaused.value).toBe(false)
      expect(vi.getTimerCount()).toBe(0)

      pauseUntil(Date.now() + 60_000)
      resume()
      expect(isPaused.value).toBe(false)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('暫停:重新載入時讀回未到期的 pausedUntil', () => {
    localStorage.setItem(DESKTOP_NOTIFICATION_PREFS_KEY, JSON.stringify({ pausedUntil: Date.now() + 60_000 }))
    const { isPaused } = useDesktopNotificationPrefs()
    expect(isPaused.value).toBe(true)
  })

  it('權限:支援時反映 Notification.permission;requestPermission 更新狀態', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    vi.stubGlobal('Notification', { permission: 'default', requestPermission })
    __resetDesktopNotificationPrefsForTest()

    const { permission, requestDesktopPermission } = useDesktopNotificationPrefs()
    expect(permission.value).toBe('default')
    const result = await requestDesktopPermission()
    expect(result).toBe('granted')
    expect(permission.value).toBe('granted')
  })

  it('權限:refreshPermission 重新讀取瀏覽器目前的權限狀態', () => {
    const notificationStub: { permission: NotificationPermission; requestPermission: ReturnType<typeof vi.fn> } = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted')
    }
    vi.stubGlobal('Notification', notificationStub)
    __resetDesktopNotificationPrefsForTest()

    const { permission, refreshPermission } = useDesktopNotificationPrefs()
    expect(permission.value).toBe('default')

    notificationStub.permission = 'granted'
    refreshPermission()
    expect(permission.value).toBe('granted')
  })

  it('權限:環境不支援 Notification → unsupported,requestDesktopPermission 回傳 unsupported', async () => {
    vi.stubGlobal('Notification', undefined)
    __resetDesktopNotificationPrefsForTest()

    const { permission, requestDesktopPermission } = useDesktopNotificationPrefs()
    expect(permission.value).toBe('unsupported')
    await expect(requestDesktopPermission()).resolves.toBe('unsupported')
  })
})
