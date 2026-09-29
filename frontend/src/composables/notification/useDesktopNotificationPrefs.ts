/**
 * Desktop Notification Preferences (per-device)
 *
 * 每裝置偏好存 localStorage(瀏覽器通知權限本身即每裝置授權,偏好與其同生命週期)。
 * 模組級單例:App.vue 的通知核心與 NotificationSettingsModal 共享同一份 reactive 狀態。
 * Spec: docs/superpowers/specs/2026-09-29-desktop-notifications-design.md
 */

import { reactive, ref, type Ref } from 'vue'
import { createLogger } from '@/utils/logger'
import type { DesktopNotificationScope, DesktopPermission } from './desktopNotificationLogic'

const logger = createLogger('useDesktopNotificationPrefs')

export const DESKTOP_NOTIFICATION_PREFS_KEY = 'desktop-notification-prefs'

export interface DesktopNotificationPrefs {
  enabled: boolean
  scope: DesktopNotificationScope
  soundEnabled: boolean
}

const DEFAULT_PREFS: DesktopNotificationPrefs = {
  enabled: true,
  scope: 'all',
  soundEnabled: true
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

function ensureInitialized(): void {
  if (initialized) {
    return
  }
  Object.assign(prefs, readStoredPrefs())
  permission.value = isNotificationSupported() ? window.Notification.permission : 'unsupported'
  initialized = true
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
  }

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

  return { prefs, setPrefs, permission, refreshPermission, requestDesktopPermission }
}

/** 僅供測試重置模組單例 */
export function __resetDesktopNotificationPrefsForTest(): void {
  initialized = false
  Object.assign(prefs, DEFAULT_PREFS)
  permission.value = 'unsupported'
}
