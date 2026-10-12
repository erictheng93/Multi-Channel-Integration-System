/**
 * Desktop Notification Preferences (per-device)
 *
 * 每裝置偏好存 localStorage(瀏覽器通知權限本身即每裝置授權,偏好與其同生命週期)。
 * 模組級單例:App.vue 的通知核心與 NotificationSettingsModal 共享同一份 reactive 狀態。
 * Spec: docs/superpowers/specs/2026-09-29-desktop-notifications-design.md
 */

import { computed, reactive, ref, type Ref } from 'vue'
import { createLogger } from '@/utils/logger'
import { isPaused, type DesktopNotificationScope, type DesktopPermission } from './desktopNotificationLogic'

const logger = createLogger('useDesktopNotificationPrefs')

export const DESKTOP_NOTIFICATION_PREFS_KEY = 'desktop-notification-prefs'

export interface DesktopNotificationPrefs {
  enabled: boolean
  scope: DesktopNotificationScope
  soundEnabled: boolean
  /** 暫停通知(含音效)到此時間戳;null 代表未暫停。過期值不必清除,判斷時自然失效 */
  pausedUntil: number | null
}

const DEFAULT_PREFS: DesktopNotificationPrefs = {
  enabled: true,
  scope: 'all',
  soundEnabled: true,
  pausedUntil: null
}

function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Notification !== 'undefined'
}

function readStoredPrefs(): DesktopNotificationPrefs {
  try {
    const raw = localStorage.getItem(DESKTOP_NOTIFICATION_PREFS_KEY)
    if (raw) {
      return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<DesktopNotificationPrefs>) }
    }
  } catch (error) {
    logger.debug('Failed to read desktop notification prefs, using defaults', error)
  }
  return { ...DEFAULT_PREFS }
}

// ==================== Module-level singleton state ====================

let initialized = false
const prefs = reactive<DesktopNotificationPrefs>({ ...DEFAULT_PREFS })
const permission: Ref<DesktopPermission> = ref('unsupported')

// 供 UI 顯示「暫停中」用的時鐘。通知判斷每次都用 Date.now(),不依賴它;
// 這裡只排一個 setTimeout 在到期瞬間刷新,讓提示不需重新整理就消失。
const clock = ref(Date.now())
let expiryTimer: ReturnType<typeof setTimeout> | null = null

function scheduleExpiry(): void {
  if (expiryTimer) {
    clearTimeout(expiryTimer)
    expiryTimer = null
  }
  clock.value = Date.now()
  const until = prefs.pausedUntil
  // 停止條件:到期後 clock 追上 until,不再排程
  if (until !== null && clock.value < until) {
    expiryTimer = setTimeout(scheduleExpiry, until - clock.value)
  }
}

const paused = computed(() => isPaused(prefs.pausedUntil, clock.value))

function ensureInitialized(): void {
  if (initialized) {
    return
  }
  Object.assign(prefs, readStoredPrefs())
  permission.value = isNotificationSupported() ? window.Notification.permission : 'unsupported'
  initialized = true
  scheduleExpiry()
}

// 其他分頁改了偏好時同步記憶體:否則此分頁照舊彈通知,且下次 setPrefs 會把舊值整包寫回、蓋掉對方的變更。
// storage 事件只在「其他」分頁寫入時觸發;key 為 null 代表 localStorage.clear()。
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (initialized && (event.key === DESKTOP_NOTIFICATION_PREFS_KEY || event.key === null)) {
      Object.assign(prefs, readStoredPrefs())
      scheduleExpiry()
    }
  })
}

// ==================== Composable ====================

export function useDesktopNotificationPrefs() {
  ensureInitialized()

  const setPrefs = (patch: Partial<DesktopNotificationPrefs>): void => {
    Object.assign(prefs, patch)
    try {
      localStorage.setItem(DESKTOP_NOTIFICATION_PREFS_KEY, JSON.stringify(prefs))
    } catch (error) {
      // private mode 等:僅記憶體生效,不持久化
      logger.debug('Failed to persist desktop notification prefs', error)
    }
    if ('pausedUntil' in patch) {
      scheduleExpiry()
    }
  }

  const pauseUntil = (timestamp: number): void => setPrefs({ pausedUntil: timestamp })
  const resume = (): void => setPrefs({ pausedUntil: null })

  /** 重新讀取瀏覽器權限(使用者可能在瀏覽器設定中變更) */
  const refreshPermission = (): void => {
    permission.value = isNotificationSupported() ? window.Notification.permission : 'unsupported'
  }

  /** 必須在使用者手勢(點擊)中呼叫 */
  const requestDesktopPermission = async (): Promise<DesktopPermission> => {
    if (!isNotificationSupported()) {
      return 'unsupported'
    }
    try {
      const result = await window.Notification.requestPermission()
      permission.value = result
      return result
    } catch (error) {
      logger.debug('requestPermission failed', error)
      refreshPermission()
      return permission.value
    }
  }

  return { prefs, setPrefs, permission, refreshPermission, requestDesktopPermission, isPaused: paused, pauseUntil, resume }
}

/** 僅供測試重置模組單例 */
export function __resetDesktopNotificationPrefsForTest(): void {
  initialized = false
  Object.assign(prefs, DEFAULT_PREFS)
  scheduleExpiry()
  permission.value = 'unsupported'
}
