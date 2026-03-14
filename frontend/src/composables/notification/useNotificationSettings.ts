/**
 * Notification Settings Composable
 *
 * Manages notification settings (push, sound, email, etc.)
 */

import { ref } from 'vue'
import type { notificationApi as NotificationApiType } from '@/api/notifications'

export function useNotificationSettings(
  notificationApi: typeof NotificationApiType,
  showSuccess: (_message: string) => void
) {
  // ==================== State ====================

  const settings = ref({
    pushEnabled: true,
    soundEnabled: true,
    emailEnabled: false,
    messageEnabled: true,
    assignmentEnabled: true,
    mentionEnabled: true
  })

  // ==================== Methods ====================

  const saveSettings = async () => {
    try {
      // Save to localStorage as backup (synchronous)
      localStorage.setItem('notification-settings', JSON.stringify(settings.value))

      // Save to API (asynchronous)
      const response = await notificationApi.updateSettings(settings.value)

      if (response.success) {
        showSuccess('設定已儲存')
      } else {
        // If API fails, keep localStorage backup
        console.warn('[NotificationSettings] API save failed, using localStorage backup:', response.error)
        showSuccess('設定已暫存（離線模式）')
      }
    } catch (error) {
      // On error, keep localStorage backup
      console.error('[NotificationSettings] Failed to save settings:', error)
      showSuccess('設定已暫存（離線模式）')
    }
  }

  const loadSettings = async () => {
    try {
      // Try to load from API first
      const response = await notificationApi.getSettings()

      if (response.success && response.data) {
        settings.value = {
          pushEnabled: response.data.pushEnabled,
          soundEnabled: response.data.soundEnabled,
          emailEnabled: response.data.emailEnabled,
          messageEnabled: response.data.messageEnabled,
          assignmentEnabled: response.data.assignmentEnabled,
          mentionEnabled: response.data.mentionEnabled
        }

        // Update localStorage backup
        localStorage.setItem('notification-settings', JSON.stringify(settings.value))
        console.log('[NotificationSettings] Settings loaded from API')
      } else {
        // Fallback to localStorage
        const cached = localStorage.getItem('notification-settings')
        if (cached) {
          settings.value = JSON.parse(cached)
          console.log('[NotificationSettings] Settings loaded from localStorage (fallback)')
        }
      }
    } catch (_error) {
      // Fallback to localStorage on error
      const cached = localStorage.getItem('notification-settings')
      if (cached) {
        try {
          settings.value = JSON.parse(cached)
          console.log('[NotificationSettings] Settings loaded from localStorage (error fallback)')
        } catch (parseError) {
          console.error('[NotificationSettings] Failed to parse localStorage settings:', parseError)
        }
      }
    }
  }

  // ==================== Return API ====================

  return {
    // State
    settings,

    // Methods
    saveSettings,
    loadSettings
  }
}
