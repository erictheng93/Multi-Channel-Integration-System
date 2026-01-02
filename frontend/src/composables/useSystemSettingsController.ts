/**
 * System Settings Controller Composable
 *
 * Central business logic for System Settings feature
 * Manages state, API calls, and user interactions
 *
 * Based on the Controller Pattern from ApiMonitor and ConversationDetail refactoring
 */

import { ref, reactive, computed, onUnmounted, getCurrentInstance } from 'vue'
import { systemApi, credentialsApi } from '@/api/system'
import { SettingsIcon, IntegrationIcon, AdvancedIcon, SystemIcon } from '@/components/icons'
import { useI18n } from '@/composables/useI18n'
import { useConfirm } from '@/composables/useConfirm'
import type {
  SystemSettings,
  SettingsTab,
  CacheType,
  MessageType,
  Backup,
  TabConfig,
  StatusClasses,
  HealthCheckResult
} from '@/types/system-settings'

/**
 * System Settings Controller Composable
 *
 * @returns Controller object with state and methods
 */
export function useSystemSettingsController() {
  // ============================================================================
  // Composables
  // ============================================================================

  const { t } = useI18n()
  const { confirmDanger, confirmWarning } = useConfirm()

  // ============================================================================
  // State Management
  // ============================================================================

  /** Loading state for initial load */
  const loading = ref(false)

  /** Saving state for save operations */
  const saving = ref(false)

  /** Testing state for integration tests */
  const testing = ref(false)

  /** Processing state for system operations */
  const processing = ref(false)

  /** Active settings tab */
  const activeTab = ref<SettingsTab>('general')

  /** Show backup list flag */
  const showBackupList = ref(false)

  /** Message for user feedback */
  const message = ref('')

  /** Message type for styling */
  const messageType = ref<MessageType>('success')

  /** All settings data */
  const settings = reactive<SystemSettings>({
    general: {
      systemName: '',
      contactEmail: '',
      timezone: 'Asia/Taipei',
      language: 'zh-TW'
    },
    integrations: {
      line: {
        channelId: '',
        channelSecret: '',
        accessToken: '',
        status: 'disconnected'
      },
      facebook: {
        appId: '',
        appSecret: '',
        pageId: '',
        pageToken: '',
        status: 'disconnected'
      }
    },
    advanced: {
      messageQueueSize: 1000,
      messageTimeout: 30,
      cacheExpiry: 60,
      sessionExpiry: 24,
      enableRateLimit: true,
      enableLogging: true,
      enableMetrics: true
    }
  })

  /** Backup list */
  const backups = ref<Backup[]>([])

  // ============================================================================
  // Computed Properties
  // ============================================================================

  /**
   * Tab configuration
   */
  const tabs = computed<TabConfig[]>(() => [
    { key: 'general', label: t('systemSettings.tabs.general'), icon: SettingsIcon },
    { key: 'integrations', label: t('systemSettings.tabs.integrations'), icon: IntegrationIcon },
    { key: 'advanced', label: t('systemSettings.tabs.advanced'), icon: AdvancedIcon },
    { key: 'system', label: t('systemSettings.tabs.system'), icon: SystemIcon }
  ])

  /**
   * LINE integration status classes
   */
  const lineStatus = computed<StatusClasses>(() => {
    const status = settings.integrations.line?.status
    return {
      'status-connected': status === 'connected',
      'status-disconnected': status === 'disconnected',
      'status-error': status === 'error'
    }
  })

  /**
   * Facebook integration status classes
   */
  const facebookStatus = computed<StatusClasses>(() => {
    const status = settings.integrations.facebook?.status
    return {
      'status-connected': status === 'connected',
      'status-disconnected': status === 'disconnected',
      'status-error': status === 'error'
    }
  })

  /**
   * Development environment flag
   */
  const isDev = computed(() => import.meta.env.DEV)

  // ============================================================================
  // Data Loading Methods
  // ============================================================================

  /**
   * Load all settings from backend
   */
  async function loadSettings(): Promise<void> {
    try {
      loading.value = true

      // Load basic settings
      const settingsResponse = await systemApi.getSettings()
      if (settingsResponse.success && settingsResponse.data) {
        // Safely merge settings
        if (settingsResponse.data.general) {
          Object.assign(settings.general, settingsResponse.data.general)
        }
        if (settingsResponse.data.advanced) {
          Object.assign(settings.advanced, settingsResponse.data.advanced)
        }
        // Only merge status, not entire structure
        if (settingsResponse.data.integrations?.line?.status) {
          settings.integrations.line.status = settingsResponse.data.integrations.line.status
        }
        if (settingsResponse.data.integrations?.facebook?.status) {
          settings.integrations.facebook.status = settingsResponse.data.integrations.facebook.status
        }
      }

      // Load credentials data
      const credentialsResponse = await credentialsApi.getAllCredentials()
      if (credentialsResponse.success && credentialsResponse.data) {
        // Ensure structures exist
        if (!settings.integrations) {
          settings.integrations = {
            line: { channelId: '', channelSecret: '', accessToken: '', status: 'disconnected' },
            facebook: { appId: '', appSecret: '', pageId: '', pageToken: '', status: 'disconnected' }
          }
        }

        if (!settings.integrations.line) {
          settings.integrations.line = { channelId: '', channelSecret: '', accessToken: '', status: 'disconnected' }
        }
        if (!settings.integrations.facebook) {
          settings.integrations.facebook = { appId: '', appSecret: '', pageId: '', pageToken: '', status: 'disconnected' }
        }

        // Safely merge credentials data
        if (credentialsResponse.data.line) {
          settings.integrations.line.channelId = credentialsResponse.data.line.channelId || ''
          settings.integrations.line.channelSecret = credentialsResponse.data.line.channelSecret || ''
          settings.integrations.line.accessToken = credentialsResponse.data.line.accessToken || ''
        }
        if (credentialsResponse.data.facebook) {
          settings.integrations.facebook.appId = credentialsResponse.data.facebook.appId || ''
          settings.integrations.facebook.appSecret = credentialsResponse.data.facebook.appSecret || ''
          settings.integrations.facebook.pageId = credentialsResponse.data.facebook.pageId || ''
          settings.integrations.facebook.pageToken = credentialsResponse.data.facebook.pageToken || ''
        }
      }

      console.log('Loaded settings:', settings)
    } catch (error) {
      console.error('Failed to load settings:', error)
      showMessage(t('systemSettings.messages.loadFailed'), 'error')
    } finally {
      loading.value = false
    }
  }

  /**
   * Load backup list
   */
  async function loadBackups(): Promise<void> {
    try {
      // TODO: Implement backend API for backup list
      // const response = await systemApi.getBackups()
      // if (response.success && response.data) {
      //   backups.value = response.data.map(backup => ({
      //     ...backup,
      //     createdAt: new Date(backup.createdAt)
      //   }))
      // }
      console.log('Load backups - not yet implemented')
    } catch (error) {
      console.error('Failed to load backups:', error)
      showMessage('載入備份列表失敗', 'error')
    }
  }

  // ============================================================================
  // Save Settings Methods
  // ============================================================================

  /**
   * Save general settings
   */
  async function saveGeneralSettings(): Promise<void> {
    try {
      saving.value = true

      // Ensure language is always zh-TW
      const settingsToSave = {
        ...settings.general,
        language: 'zh-TW'
      }

      const response = await systemApi.updateSettings({ general: settingsToSave })

      if (response.success) {
        showMessage(t('systemSettings.messages.saveSuccess'), 'success')
      } else {
        const errorMessage = response.message || t('systemSettings.messages.saveFailed')
        showMessage(errorMessage, 'error')
        console.error('Settings save failed:', response)
      }
    } catch (error) {
      console.error('Failed to save general settings:', error)
      const errorMessage = error instanceof Error ? error.message : t('systemSettings.messages.saveFailed')
      showMessage(`${t('systemSettings.messages.saveFailed')}: ${errorMessage}`, 'error')
    } finally {
      saving.value = false
    }
  }

  /**
   * Save LINE integration settings
   */
  async function saveLineSettings(): Promise<void> {
    try {
      saving.value = true

      // Ensure LINE settings structure exists
      if (!settings.integrations?.line) {
        showMessage('LINE 設定結構異常，請重新載入頁面', 'error')
        return
      }

      const { channelId, channelSecret, accessToken } = settings.integrations.line

      if (!channelId || !channelSecret || !accessToken) {
        showMessage('請填寫完整的 LINE 設定資料', 'error')
        return
      }

      const response = await systemApi.updateSettings({
        integrations: {
          line: {
            channelId,
            channelSecret,
            accessToken
          }
        }
      })

      if (response.success) {
        showMessage('LINE 設定已儲存', 'success')
      } else {
        const errorMessage = response.message || '儲存 LINE 設定失敗'
        showMessage(errorMessage, 'error')
        console.error('LINE settings save failed:', response)
      }
    } catch (error) {
      console.error('Failed to save LINE settings:', error)
      const errorMessage = error instanceof Error ? error.message : '儲存 LINE 設定失敗'
      showMessage(`儲存 LINE 設定失敗: ${errorMessage}`, 'error')
    } finally {
      saving.value = false
    }
  }

  /**
   * Save Facebook integration settings
   */
  async function saveFacebookSettings(): Promise<void> {
    try {
      saving.value = true

      // Ensure Facebook settings structure exists
      if (!settings.integrations?.facebook) {
        showMessage('Facebook 設定結構異常，請重新載入頁面', 'error')
        return
      }

      const { appId, appSecret, pageId, pageToken } = settings.integrations.facebook

      if (!appId || !appSecret || !pageId || !pageToken) {
        showMessage('請填寫完整的 Facebook 設定資料', 'error')
        return
      }

      const response = await systemApi.updateSettings({
        integrations: {
          facebook: {
            appId,
            appSecret,
            pageId,
            pageToken
          }
        }
      })

      if (response.success) {
        showMessage('Facebook 設定已儲存', 'success')
      } else {
        const errorMessage = response.message || '儲存 Facebook 設定失敗'
        showMessage(errorMessage, 'error')
        console.error('Facebook settings save failed:', response)
      }
    } catch (error) {
      console.error('Failed to save Facebook settings:', error)
      const errorMessage = error instanceof Error ? error.message : '儲存 Facebook 設定失敗'
      showMessage(`儲存 Facebook 設定失敗: ${errorMessage}`, 'error')
    } finally {
      saving.value = false
    }
  }

  /**
   * Save advanced settings
   */
  async function saveAdvancedSettings(): Promise<void> {
    try {
      saving.value = true

      const response = await systemApi.updateSettings({ advanced: settings.advanced })

      if (response.success) {
        showMessage(t('systemSettings.messages.saveSuccess'), 'success')
      } else {
        const errorMessage = response.message || t('systemSettings.messages.saveFailed')
        showMessage(errorMessage, 'error')
        console.error('Advanced settings save failed:', response)
      }
    } catch (error) {
      console.error('Failed to save advanced settings:', error)
      const errorMessage = error instanceof Error ? error.message : t('systemSettings.messages.saveFailed')
      showMessage(`${t('systemSettings.messages.saveFailed')}: ${errorMessage}`, 'error')
    } finally {
      saving.value = false
    }
  }

  // ============================================================================
  // Integration Testing Methods
  // ============================================================================

  /**
   * Test LINE integration connection
   */
  async function testLineIntegration(): Promise<void> {
    try {
      testing.value = true

      if (!settings.integrations?.line) {
        showMessage('LINE 設定結構異常', 'error')
        return
      }

      const { channelId, channelSecret, accessToken } = settings.integrations.line

      if (!channelId || !channelSecret || !accessToken) {
        showMessage('請先填寫 LINE 設定資料', 'error')
        return
      }

      const response = await systemApi.testIntegration('line', {
        channelId,
        channelSecret,
        accessToken
      })

      if (response.success) {
        settings.integrations.line.status = 'connected'
        showMessage('LINE 連線測試成功', 'success')
      } else {
        settings.integrations.line.status = 'error'
        const errorMessage = response.message || 'LINE 連線測試失敗'
        showMessage(errorMessage, 'error')
      }
    } catch (error) {
      settings.integrations.line.status = 'error'
      console.error('LINE integration test failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'LINE 連線測試失敗'
      showMessage(`LINE 連線測試失敗: ${errorMessage}`, 'error')
    } finally {
      testing.value = false
    }
  }

  /**
   * Test Facebook integration connection
   */
  async function testFacebookIntegration(): Promise<void> {
    try {
      testing.value = true

      if (!settings.integrations?.facebook) {
        showMessage('Facebook 設定結構異常', 'error')
        return
      }

      const { appId, appSecret, pageId, pageToken } = settings.integrations.facebook

      if (!appId || !appSecret || !pageId || !pageToken) {
        showMessage('請先填寫 Facebook 設定資料', 'error')
        return
      }

      const response = await systemApi.testIntegration('facebook', {
        appId,
        appSecret,
        pageId,
        pageToken
      })

      if (response.success) {
        settings.integrations.facebook.status = 'connected'
        showMessage('Facebook 連線測試成功', 'success')
      } else {
        settings.integrations.facebook.status = 'error'
        const errorMessage = response.message || 'Facebook 連線測試失敗'
        showMessage(errorMessage, 'error')
      }
    } catch (error) {
      settings.integrations.facebook.status = 'error'
      console.error('Facebook integration test failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Facebook 連線測試失敗'
      showMessage(`Facebook 連線測試失敗: ${errorMessage}`, 'error')
    } finally {
      testing.value = false
    }
  }

  // ============================================================================
  // Credentials Management Methods
  // ============================================================================

  /**
   * Clear LINE credentials
   */
  async function clearLineCredentials(): Promise<void> {
    try {
      const confirmed = await confirmDanger({
        title: '清除 LINE 憑證',
        message: '確定要清除 LINE 憑證嗎？此操作無法復原。',
        confirmText: '確定清除',
        cancelText: '取消'
      })

      if (!confirmed) {
        return
      }

      saving.value = true

      const response = await credentialsApi.clearPlatformCredentials('line')

      if (response.success) {
        // Clear local state
        settings.integrations.line = {
          channelId: '',
          channelSecret: '',
          accessToken: '',
          status: 'disconnected'
        }
        showMessage('LINE 憑證已清除', 'success')
      } else {
        const errorMessage = response.message || '清除 LINE 憑證失敗'
        showMessage(errorMessage, 'error')
      }
    } catch (error) {
      console.error('Failed to clear LINE credentials:', error)
      const errorMessage = error instanceof Error ? error.message : '清除 LINE 憑證失敗'
      showMessage(`清除 LINE 憑證失敗: ${errorMessage}`, 'error')
    } finally {
      saving.value = false
    }
  }

  /**
   * Clear Facebook credentials
   */
  async function clearFacebookCredentials(): Promise<void> {
    try {
      const confirmed = await confirmDanger({
        title: '清除 Facebook 憑證',
        message: '確定要清除 Facebook 憑證嗎？此操作無法復原。',
        confirmText: '確定清除',
        cancelText: '取消'
      })

      if (!confirmed) {
        return
      }

      saving.value = true

      const response = await credentialsApi.clearPlatformCredentials('facebook')

      if (response.success) {
        // Clear local state
        settings.integrations.facebook = {
          appId: '',
          appSecret: '',
          pageId: '',
          pageToken: '',
          status: 'disconnected'
        }
        showMessage('Facebook 憑證已清除', 'success')
      } else {
        const errorMessage = response.message || '清除 Facebook 憑證失敗'
        showMessage(errorMessage, 'error')
      }
    } catch (error) {
      console.error('Failed to clear Facebook credentials:', error)
      const errorMessage = error instanceof Error ? error.message : '清除 Facebook 憑證失敗'
      showMessage(`清除 Facebook 憑證失敗: ${errorMessage}`, 'error')
    } finally {
      saving.value = false
    }
  }

  /**
   * Backup all credentials
   */
  async function backupCredentials(): Promise<void> {
    try {
      processing.value = true

      const response = await credentialsApi.backupCredentials()

      if (response.success) {
        showMessage('憑證已備份', 'success')
      } else {
        const errorMessage = response.message || '備份憑證失敗'
        showMessage(errorMessage, 'error')
      }
    } catch (error) {
      console.error('Failed to backup credentials:', error)
      const errorMessage = error instanceof Error ? error.message : '備份憑證失敗'
      showMessage(`備份憑證失敗: ${errorMessage}`, 'error')
    } finally {
      processing.value = false
    }
  }

  // ============================================================================
  // System Maintenance Methods
  // ============================================================================

  /**
   * Create database backup
   */
  async function backupDatabase(): Promise<void> {
    try {
      processing.value = true

      const response = await systemApi.backupDatabase()

      if (response.success) {
        showMessage('資料庫備份已建立', 'success')
        // Reload backup list
        await loadBackups()
      } else {
        const errorMessage = response.message || '建立資料庫備份失敗'
        showMessage(errorMessage, 'error')
      }
    } catch (error) {
      console.error('Failed to backup database:', error)
      const errorMessage = error instanceof Error ? error.message : '建立資料庫備份失敗'
      showMessage(`建立資料庫備份失敗: ${errorMessage}`, 'error')
    } finally {
      processing.value = false
    }
  }

  /**
   * Restore database from backup
   */
  async function restoreDatabase(backupId: string): Promise<void> {
    try {
      const confirmed = await confirmDanger({
        title: '還原資料庫',
        message: '確定要還原資料庫嗎？當前資料將被覆蓋，此操作無法復原。',
        confirmText: '確定還原',
        cancelText: '取消'
      })

      if (!confirmed) {
        return
      }

      processing.value = true

      const response = await systemApi.restoreDatabase(backupId)

      if (response.success) {
        showMessage('資料庫已還原', 'success')
        // Reload settings after restore
        await loadSettings()
      } else {
        const errorMessage = response.message || '還原資料庫失敗'
        showMessage(errorMessage, 'error')
      }
    } catch (error) {
      console.error('Failed to restore database:', error)
      const errorMessage = error instanceof Error ? error.message : '還原資料庫失敗'
      showMessage(`還原資料庫失敗: ${errorMessage}`, 'error')
    } finally {
      processing.value = false
    }
  }

  /**
   * Clear cache
   */
  async function clearCache(type: CacheType): Promise<void> {
    try {
      const typeNames: Record<CacheType, string> = {
        all: '所有快取',
        conversations: '對話快取',
        messages: '訊息快取',
        sessions: '會話快取'
      }

      const confirmed = await confirmWarning({
        title: '清除快取',
        message: `確定要清除${typeNames[type]}嗎？`,
        confirmText: '確定清除',
        cancelText: '取消'
      })

      if (!confirmed) {
        return
      }

      processing.value = true

      const response = await systemApi.clearCache(type)

      if (response.success) {
        showMessage(`${typeNames[type]}已清除`, 'success')
      } else {
        const errorMessage = response.message || `清除${typeNames[type]}失敗`
        showMessage(errorMessage, 'error')
      }
    } catch (error) {
      console.error('Failed to clear cache:', error)
      const errorMessage = error instanceof Error ? error.message : '清除快取失敗'
      showMessage(`清除快取失敗: ${errorMessage}`, 'error')
    } finally {
      processing.value = false
    }
  }

  /**
   * Perform health check
   */
  async function healthCheck(): Promise<void> {
    try {
      processing.value = true

      const response = await systemApi.healthCheck()

      if (response.success && response.data) {
        // Build HealthCheckResult from API response
        const apiData = response.data as any
        const result: HealthCheckResult = {
          success: response.success,
          status: apiData.status || 'unhealthy',
          checks: {
            database: apiData.checks?.database ?? false,
            cache: apiData.checks?.cache ?? false,
            queue: apiData.checks?.queue ?? false,
            integrations: apiData.checks?.integrations ?? false
          },
          message: apiData.message
        }

        const statusText = result.status === 'healthy' ? '正常' :
          result.status === 'degraded' ? '降級' : '異常'

        showMessage(`系統狀態: ${statusText}`, result.status === 'healthy' ? 'success' : 'error')
      } else {
        const errorMessage = response.message || '健康檢查失敗'
        showMessage(errorMessage, 'error')
      }
    } catch (error) {
      console.error('Health check failed:', error)
      const errorMessage = error instanceof Error ? error.message : '健康檢查失敗'
      showMessage(`健康檢查失敗: ${errorMessage}`, 'error')
    } finally {
      processing.value = false
    }
  }

  /**
   * Restart system
   */
  async function restartSystem(): Promise<void> {
    try {
      const confirmed = await confirmDanger({
        title: '重啟系統',
        message: '確定要重啟系統嗎？系統將暫時無法使用。',
        confirmText: '確定重啟',
        cancelText: '取消'
      })

      if (!confirmed) {
        return
      }

      processing.value = true

      const response = await systemApi.restartSystem()

      if (response.success) {
        showMessage('系統正在重啟...', 'info')
      } else {
        const errorMessage = response.message || '重啟系統失敗'
        showMessage(errorMessage, 'error')
      }
    } catch (error) {
      console.error('Failed to restart system:', error)
      const errorMessage = error instanceof Error ? error.message : '重啟系統失敗'
      showMessage(`重啟系統失敗: ${errorMessage}`, 'error')
    } finally {
      processing.value = false
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Show message to user
   */
  function showMessage(msg: string, type: MessageType): void {
    message.value = msg
    messageType.value = type

    // Auto-hide after 3 seconds
    setTimeout(() => {
      message.value = ''
    }, 3000)
  }

  /**
   * Get timezone display string
   */
  function getTimezoneDisplay(timezone: string): string {
    const timezoneMap: Record<string, string> = {
      'Asia/Taipei': '台北 (GMT+8)',
      'Asia/Tokyo': '東京 (GMT+9)',
      'America/New_York': '紐約 (GMT-5)',
      'Europe/London': '倫敦 (GMT+0)',
      'UTC': 'UTC (GMT+0)'
    }
    return timezoneMap[timezone] || timezone
  }

  /**
   * Format file size
   */
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
   * Initialize controller
   */
  async function initialize(): Promise<void> {
    await loadSettings()
    await loadBackups()
  }

  /**
   * Cleanup controller (call in onUnmounted)
   */
  function cleanup(): void {
    // Clear any timeouts or intervals
    // No cleanup needed currently
  }

  // Auto-cleanup on unmount (only if running inside a component)
  if (getCurrentInstance()) {
    onUnmounted(cleanup)
  }

  // ============================================================================
  // Public API
  // ============================================================================

  return {
    // State
    loading,
    saving,
    testing,
    processing,
    activeTab,
    showBackupList,
    message,
    messageType,
    settings,
    backups,

    // Computed
    tabs,
    lineStatus,
    facebookStatus,
    isDev,

    // Data Loading
    loadSettings,
    loadBackups,

    // Save Settings
    saveGeneralSettings,
    saveLineSettings,
    saveFacebookSettings,
    saveAdvancedSettings,

    // Integration Testing
    testLineIntegration,
    testFacebookIntegration,

    // Credentials Management
    clearLineCredentials,
    clearFacebookCredentials,
    backupCredentials,

    // System Maintenance
    backupDatabase,
    restoreDatabase,
    clearCache,
    healthCheck,
    restartSystem,

    // Utilities
    showMessage,
    getTimezoneDisplay,
    formatFileSize,

    // Lifecycle
    initialize,
    cleanup
  }
}
