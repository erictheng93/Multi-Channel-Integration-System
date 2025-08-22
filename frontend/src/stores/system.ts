import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface SystemSettings {
  theme: 'light' | 'dark' | 'auto'
  language: 'zh-TW' | 'en' | 'zh-CN'
  notifications: {
    enabled: boolean
    sound: boolean
    desktop: boolean
    email: boolean
  }
  autoRefresh: {
    enabled: boolean
    interval: number // in seconds
  }
  display: {
    density: 'compact' | 'comfortable' | 'spacious'
    showAvatars: boolean
    showTimestamps: boolean
    messagePreview: boolean
  }
}

export interface SystemStats {
  totalConversations: number
  activeAgents: number
  responseTime: number
  satisfaction: number
  uptime: number
}

export const useSystemStore = defineStore('system', () => {
  // State
  const settings = ref<SystemSettings>({
    theme: 'light',
    language: 'zh-TW',
    notifications: {
      enabled: true,
      sound: true,
      desktop: true,
      email: false
    },
    autoRefresh: {
      enabled: true,
      interval: 30
    },
    display: {
      density: 'comfortable',
      showAvatars: true,
      showTimestamps: true,
      messagePreview: true
    }
  })

  const stats = ref<SystemStats>({
    totalConversations: 0,
    activeAgents: 0,
    responseTime: 0,
    satisfaction: 0,
    uptime: 0
  })

  const loading = ref(false)
  const error = ref<string | null>(null)
  const isOnline = ref(navigator.onLine)

  // Computed
  const isDarkMode = computed(() => {
    if (settings.value.theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return settings.value.theme === 'dark'
  })

  const currentLanguage = computed(() => settings.value.language)

  const notificationsEnabled = computed(() => settings.value.notifications.enabled)

  // Utility functions
  const clearError = () => {
    error.value = null
  }

  const handleError = (err: unknown, defaultMessage: string) => {
    console.error(err)
    error.value = typeof err === 'string' ? err : ((err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') ? err.message : defaultMessage)
    setTimeout(clearError, 5000)
  }

  // Actions
  const loadSettings = async () => {
    loading.value = true
    error.value = null

    try {
      // Try to load from localStorage first
      const savedSettings = localStorage.getItem('system-settings')
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        settings.value = { ...settings.value, ...parsed }
      }

      // TODO: Load from API if needed
      // const response = await systemApi.getSettings()
      // if (response.success && response.data) {
      //   settings.value = response.data
      // }
    } catch (err) {
      handleError(err, '載入系統設定失敗')
    } finally {
      loading.value = false
    }
  }

  const saveSettings = async (newSettings: Partial<SystemSettings>) => {
    loading.value = true
    error.value = null

    try {
      // Update local state
      settings.value = { ...settings.value, ...newSettings }

      // Save to localStorage
      localStorage.setItem('system-settings', JSON.stringify(settings.value))

      // TODO: Save to API if needed
      // const response = await systemApi.updateSettings(settings.value)
      // if (!response.success) {
      //   handleError(response.error, '保存系統設定失敗')
      //   return false
      // }

      return true
    } catch (err) {
      handleError(err, '保存系統設定失敗')
      return false
    } finally {
      loading.value = false
    }
  }

  const loadStats = async () => {
    loading.value = true
    error.value = null

    try {
      // TODO: Load from API
      // const response = await systemApi.getStats()
      // if (response.success && response.data) {
      //   stats.value = response.data
      // }

      // Mock data for now
      stats.value = {
        totalConversations: 1250,
        activeAgents: 8,
        responseTime: 2.5,
        satisfaction: 4.2,
        uptime: 99.8
      }
    } catch (err) {
      handleError(err, '載入系統統計失敗')
    } finally {
      loading.value = false
    }
  }

  const updateTheme = async (theme: SystemSettings['theme']) => {
    await saveSettings({ theme })
    
    // Apply theme immediately
    if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const updateLanguage = async (language: SystemSettings['language']) => {
    await saveSettings({ language })
    // TODO: Update i18n locale if using internationalization
  }

  const updateNotifications = async (notifications: Partial<SystemSettings['notifications']>) => {
    const newNotifications = { ...settings.value.notifications, ...notifications }
    await saveSettings({ notifications: newNotifications })

    // Request permission if enabling desktop notifications
    if (newNotifications.desktop && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  const updateAutoRefresh = async (autoRefresh: Partial<SystemSettings['autoRefresh']>) => {
    const newAutoRefresh = { ...settings.value.autoRefresh, ...autoRefresh }
    await saveSettings({ autoRefresh: newAutoRefresh })
  }

  const updateDisplay = async (display: Partial<SystemSettings['display']>) => {
    const newDisplay = { ...settings.value.display, ...display }
    await saveSettings({ display: newDisplay })
  }

  const resetSettings = async () => {
    const defaultSettings: SystemSettings = {
      theme: 'light',
      language: 'zh-TW',
      notifications: {
        enabled: true,
        sound: true,
        desktop: true,
        email: false
      },
      autoRefresh: {
        enabled: true,
        interval: 30
      },
      display: {
        density: 'comfortable',
        showAvatars: true,
        showTimestamps: true,
        messagePreview: true
      }
    }

    await saveSettings(defaultSettings)
  }

  // Initialize online status listener
  const initializeOnlineStatus = () => {
    const updateOnlineStatus = () => {
      isOnline.value = navigator.onLine
    }

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    // Cleanup function
    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }

  // Initialize theme listener
  const initializeThemeListener = () => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleThemeChange = () => {
      if (settings.value.theme === 'auto') {
        if (mediaQuery.matches) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    }

    mediaQuery.addEventListener('change', handleThemeChange)
    handleThemeChange() // Apply initial theme

    // Cleanup function
    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange)
    }
  }

  return {
    // State
    settings,
    stats,
    loading,
    error,
    isOnline,

    // Computed
    isDarkMode,
    currentLanguage,
    notificationsEnabled,

    // Actions
    loadSettings,
    saveSettings,
    loadStats,
    updateTheme,
    updateLanguage,
    updateNotifications,
    updateAutoRefresh,
    updateDisplay,
    resetSettings,
    clearError,

    // Initialization
    initializeOnlineStatus,
    initializeThemeListener
  }
})