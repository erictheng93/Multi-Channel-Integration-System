/**
 * Unit Tests for useNotificationSettings
 *
 * Tests notification settings management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useNotificationSettings } from '@/composables/notification/useNotificationSettings'

// Mock API
const mockNotificationApi = {
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getNotifications: vi.fn(),
  getNotificationById: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  getStats: vi.fn()
}

describe('useNotificationSettings', () => {
  let showSuccess: ReturnType<typeof vi.fn>
  let localStorageMock: Record<string, string>

  beforeEach(() => {
    // Mock showSuccess
    showSuccess = vi.fn()

    // Mock localStorage
    localStorageMock = {}

    const localStorageGetItemMock = vi.fn((key: string) => localStorageMock[key] || null)
    const localStorageSetItemMock = vi.fn((key: string, value: string) => {
      localStorageMock[key] = value
    })

    global.localStorage = {
      getItem: localStorageGetItemMock,
      setItem: localStorageSetItemMock,
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn()
    }

    // Reset API mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default settings', () => {
      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      expect(settings.settings.value).toEqual({
        pushEnabled: true,
        soundEnabled: true,
        emailEnabled: false,
        messageEnabled: true,
        assignmentEnabled: true,
        mentionEnabled: true
      })
    })

    it('should provide settings management methods', () => {
      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      expect(settings.saveSettings).toBeInstanceOf(Function)
      expect(settings.loadSettings).toBeInstanceOf(Function)
    })
  })

  describe('saveSettings', () => {
    it('should save settings to localStorage and API', async () => {
      mockNotificationApi.updateSettings.mockResolvedValue({ success: true })

      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      settings.settings.value.pushEnabled = false

      await settings.saveSettings()

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'notification-settings',
        expect.stringContaining('"pushEnabled":false')
      )
      expect(mockNotificationApi.updateSettings).toHaveBeenCalledWith(settings.settings.value)
      expect(showSuccess).toHaveBeenCalledWith('設定已儲存')
    })

    it('should save to localStorage first (synchronous)', async () => {
      mockNotificationApi.updateSettings.mockResolvedValue({ success: true })

      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      const savePromise = settings.saveSettings()

      // localStorage should be called immediately
      expect(localStorage.setItem).toHaveBeenCalled()

      await savePromise
    })

    it('should show offline mode message when API fails', async () => {
      mockNotificationApi.updateSettings.mockResolvedValue({
        success: false,
        error: 'Network error'
      })

      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      await settings.saveSettings()

      expect(localStorage.setItem).toHaveBeenCalled()
      expect(showSuccess).toHaveBeenCalledWith('設定已暫存（離線模式）')
    })

    it('should handle API errors gracefully', async () => {
      mockNotificationApi.updateSettings.mockRejectedValue(new Error('Network error'))

      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      await settings.saveSettings()

      expect(localStorage.setItem).toHaveBeenCalled()
      expect(showSuccess).toHaveBeenCalledWith('設定已暫存（離線模式）')
    })

    it('should save all settings properties', async () => {
      mockNotificationApi.updateSettings.mockResolvedValue({ success: true })

      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      settings.settings.value = {
        pushEnabled: false,
        soundEnabled: false,
        emailEnabled: true,
        messageEnabled: false,
        assignmentEnabled: false,
        mentionEnabled: false
      }

      await settings.saveSettings()

      expect(mockNotificationApi.updateSettings).toHaveBeenCalledWith({
        pushEnabled: false,
        soundEnabled: false,
        emailEnabled: true,
        messageEnabled: false,
        assignmentEnabled: false,
        mentionEnabled: false
      })
    })
  })

  describe('loadSettings', () => {
    it('should load settings from API successfully', async () => {
      const mockSettings = {
        pushEnabled: false,
        soundEnabled: false,
        emailEnabled: true,
        messageEnabled: false,
        assignmentEnabled: false,
        mentionEnabled: false
      }

      mockNotificationApi.getSettings.mockResolvedValue({
        success: true,
        data: mockSettings
      })

      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      await settings.loadSettings()

      expect(mockNotificationApi.getSettings).toHaveBeenCalled()
      expect(settings.settings.value).toEqual(mockSettings)
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'notification-settings',
        JSON.stringify(mockSettings)
      )
    })

    it('should fallback to localStorage when API fails', async () => {
      const cachedSettings = {
        pushEnabled: false,
        soundEnabled: false,
        emailEnabled: true,
        messageEnabled: false,
        assignmentEnabled: false,
        mentionEnabled: false
      }

      localStorageMock['notification-settings'] = JSON.stringify(cachedSettings)

      mockNotificationApi.getSettings.mockResolvedValue({
        success: false,
        error: 'Network error'
      })

      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      await settings.loadSettings()

      expect(settings.settings.value).toEqual(cachedSettings)
    })

    it('should fallback to localStorage when API throws error', async () => {
      const cachedSettings = {
        pushEnabled: false,
        soundEnabled: true,
        emailEnabled: false,
        messageEnabled: true,
        assignmentEnabled: true,
        mentionEnabled: true
      }

      localStorageMock['notification-settings'] = JSON.stringify(cachedSettings)

      mockNotificationApi.getSettings.mockRejectedValue(new Error('Network error'))

      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      await settings.loadSettings()

      expect(settings.settings.value).toEqual(cachedSettings)
    })

    it('should handle localStorage parse errors', async () => {
      localStorageMock['notification-settings'] = 'invalid json'

      mockNotificationApi.getSettings.mockRejectedValue(new Error('Network error'))

      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      // Should not throw
      await settings.loadSettings()

      // Should keep default settings
      expect(settings.settings.value).toEqual({
        pushEnabled: true,
        soundEnabled: true,
        emailEnabled: false,
        messageEnabled: true,
        assignmentEnabled: true,
        mentionEnabled: true
      })
    })

    it('should handle empty localStorage', async () => {
      mockNotificationApi.getSettings.mockRejectedValue(new Error('Network error'))

      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      await settings.loadSettings()

      // Should keep default settings
      expect(settings.settings.value).toEqual({
        pushEnabled: true,
        soundEnabled: true,
        emailEnabled: false,
        messageEnabled: true,
        assignmentEnabled: true,
        mentionEnabled: true
      })
    })

    it('should update localStorage backup when loading from API', async () => {
      const apiSettings = {
        pushEnabled: false,
        soundEnabled: true,
        emailEnabled: false,
        messageEnabled: false,
        assignmentEnabled: true,
        mentionEnabled: false
      }

      mockNotificationApi.getSettings.mockResolvedValue({
        success: true,
        data: apiSettings
      })

      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      await settings.loadSettings()

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'notification-settings',
        JSON.stringify(apiSettings)
      )
    })
  })

  describe('settings reactivity', () => {
    it('should update settings reactively', () => {
      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      expect(settings.settings.value.pushEnabled).toBe(true)

      settings.settings.value.pushEnabled = false

      expect(settings.settings.value.pushEnabled).toBe(false)
    })

    it('should maintain reactivity after load', async () => {
      mockNotificationApi.getSettings.mockResolvedValue({
        success: true,
        data: {
          pushEnabled: false,
          soundEnabled: false,
          emailEnabled: true,
          messageEnabled: false,
          assignmentEnabled: false,
          mentionEnabled: false
        }
      })

      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      await settings.loadSettings()

      settings.settings.value.pushEnabled = true

      expect(settings.settings.value.pushEnabled).toBe(true)
    })
  })

  describe('integration scenarios', () => {
    it('should handle save-load cycle', async () => {
      mockNotificationApi.updateSettings.mockResolvedValue({ success: true })
      mockNotificationApi.getSettings.mockResolvedValue({
        success: true,
        data: {
          pushEnabled: false,
          soundEnabled: false,
          emailEnabled: true,
          messageEnabled: false,
          assignmentEnabled: false,
          mentionEnabled: false
        }
      })

      const settings = useNotificationSettings(mockNotificationApi, showSuccess)

      // Change settings
      settings.settings.value.pushEnabled = false
      settings.settings.value.emailEnabled = true

      // Save
      await settings.saveSettings()

      // Load (should get same settings)
      await settings.loadSettings()

      expect(settings.settings.value.pushEnabled).toBe(false)
      expect(settings.settings.value.emailEnabled).toBe(true)
    })

    it('should handle offline-to-online transition', async () => {
      const offlineSettings = {
        pushEnabled: false,
        soundEnabled: true,
        emailEnabled: false,
        messageEnabled: true,
        assignmentEnabled: true,
        mentionEnabled: true
      }

      // First save fails (offline)
      mockNotificationApi.updateSettings.mockRejectedValue(new Error('Network error'))

      const settings = useNotificationSettings(mockNotificationApi, showSuccess)
      settings.settings.value = offlineSettings

      await settings.saveSettings()

      expect(showSuccess).toHaveBeenCalledWith('設定已暫存（離線模式）')

      // Now online - should load from API
      mockNotificationApi.getSettings.mockResolvedValue({
        success: true,
        data: offlineSettings
      })

      await settings.loadSettings()

      expect(settings.settings.value).toEqual(offlineSettings)
    })
  })
})
