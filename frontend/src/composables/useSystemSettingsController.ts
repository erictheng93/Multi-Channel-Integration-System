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
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { createLogger } from '@/utils/logger'
import type { systemApi as SystemApiType } from '@/api/system'
import type { CredentialsStatus, MaskedCredential } from '@shared/api-contracts/system'
import type {
  IntegrationLastTest,
  SystemSettings,
  AdvancedSettings,
  SettingsTab,
  MessageType,
  TabConfig,
  StatusClasses
} from '@/types/system-settings'

type HealthData = NonNullable<Awaited<ReturnType<typeof SystemApiType.healthCheck>>['data']>

const frontendLogger = createLogger('useSystemSettingsController')

/**
 * 舊環境的 system_settings 可能以錯誤單位殘留數值（歷史 UI 曾把 messageTimeout
 * 存成「秒」、sessionExpiry 存成「小時」），落在表單 min/max 之外時整張表單會
 * 無法送出（HTML 驗證靜默擋下 submit）。載入時先按舊單位升級換算，再對齊表單
 * step 粒度並夾擠進表單有效範圍，保證表單永遠可儲存。
 */
export function normalizeAdvancedSettings(
  advanced: Partial<AdvancedSettings>
): Partial<AdvancedSettings> {
  const fit = (value: number, unit: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, Math.round(value / unit) * unit))

  const normalized = { ...advanced }

  if (typeof normalized.messageTimeout === 'number') {
    // < 1000 → 歷史資料以「秒」儲存；正規單位為毫秒（表單以秒編輯，step 1s）
    const ms =
      normalized.messageTimeout < 1000
        ? normalized.messageTimeout * 1000
        : normalized.messageTimeout
    normalized.messageTimeout = fit(ms, 1000, 1000, 300000)
  }

  if (typeof normalized.cacheExpiry === 'number') {
    // < 60 → 歷史資料以「分鐘」儲存；正規單位為秒（表單以分鐘編輯，step 1min）
    const seconds =
      normalized.cacheExpiry < 60 ? normalized.cacheExpiry * 60 : normalized.cacheExpiry
    normalized.cacheExpiry = fit(seconds, 60, 60, 86400)
  }

  if (typeof normalized.sessionExpiry === 'number') {
    // < 300 → 歷史資料以「小時」儲存；正規單位為秒（表單以小時編輯，step 1h，
    // 下限取表單的 1 小時而非後端的 300 秒，確保換算後的值可被表單接受）
    const seconds =
      normalized.sessionExpiry < 300
        ? normalized.sessionExpiry * 3600
        : normalized.sessionExpiry
    normalized.sessionExpiry = fit(seconds, 3600, 3600, 604800)
  }

  return normalized
}

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
  const { showDanger } = useConfirmDialog()

  // ============================================================================
  // State Management
  // ============================================================================

  /** Loading state for initial load */
  const loading = ref(false)

  /** Saving state for save operations */
  const saving = ref(false)

  /** Testing state for integration tests */
  const testing = ref(false)
  // Server-reported state of stored credentials (configured / last4). Secrets themselves never reach the browser.
  const credentialStatus = ref<CredentialsStatus | null>(null)

  /** Processing state for system operations */
  const processing = ref(false)

  /** Health check results for each component */
  const healthCheckResults = ref<Array<{
    /** Backend component id (database, cache, r2, durable_object, queue) */
    key: string
    name: string
    status: 'healthy' | 'warning' | 'critical' | 'unknown'
    message: string
    responseTime?: number
  }>>([])

  /** Overall health status */
  const healthOverall = ref<{ status: string; message: string } | null>(null)

  /** Result of the on-demand LINE webhook test; only present after a deep check */
  const healthLineWebhook = ref<NonNullable<HealthData['deep']>['lineWebhook'] | null>(null)

  /** ISO time of the last completed health check */
  const healthCheckedAt = ref<string | null>(null)

  /** Active settings tab */
  const activeTab = ref<SettingsTab>('general')

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
      messageTimeout: 30000,
      cacheExpiry: 3600,
      sessionExpiry: 86400,
      enableRateLimit: true,
      enableLogging: true,
      enableMetrics: true,
      recallWindowSeconds: 0
    }
  })

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
          Object.assign(
            settings.advanced,
            normalizeAdvancedSettings(settingsResponse.data.advanced)
          )
        }
        // Only merge status, not entire structure
        if (settingsResponse.data.integrations?.line?.status) {
          settings.integrations.line.status = settingsResponse.data.integrations.line.status
        }
        if (settingsResponse.data.integrations?.facebook?.status) {
          settings.integrations.facebook.status = settingsResponse.data.integrations.facebook.status
        }
        settings.integrations.line.lastTest = settingsResponse.data.integrations?.line?.lastTest ?? null
        settings.integrations.facebook.lastTest = settingsResponse.data.integrations?.facebook?.lastTest ?? null
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

        // Secrets are never sent to the browser: the form fields stay empty and hold only values the
        // user types. The server reports just configured/last4 per field.
        credentialStatus.value = credentialsResponse.data
      }

      frontendLogger.debug('Loaded settings:', settings)
    } catch (error) {
      console.error('Failed to load settings:', error)
      showMessage(t('systemSettings.messages.loadFailed'), 'error')
    } finally {
      loading.value = false
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

  const LINE_FIELDS = ['channelId', 'channelSecret', 'accessToken'] as const
  const FACEBOOK_FIELDS = ['appId', 'appSecret', 'pageId', 'pageToken'] as const

  /** A value is only "replaced" when the user typed something that is not a masked placeholder. */
  function isReplacement(value: string | undefined): value is string {
    const trimmed = (value ?? '').trim()
    return trimmed.length > 0 && !/^[•*]+/.test(trimmed)
  }

  /** Fields the user explicitly replaced, and fields that are neither replaced nor already stored. */
  function collectCredentialEdits<K extends string>(
    platform: 'line' | 'facebook',
    fields: readonly K[],
    values: Record<K, string>
  ): { edits: Partial<Record<K, string>>; missing: K[] } {
    const stored = credentialStatus.value?.[platform] as Record<string, MaskedCredential> | undefined
    const edits: Partial<Record<K, string>> = {}
    const missing: K[] = []
    for (const field of fields) {
      if (isReplacement(values[field])) {
        edits[field] = values[field].trim()
      } else if (!stored?.[field]?.configured) {
        missing.push(field)
      }
    }
    return { edits, missing }
  }

  /** Mirror the server-persisted result so the page can show "last tested ... N ms" without a reload. */
  function recordLastTest(platform: 'line' | 'facebook', data: unknown): void {
    const d = data as Partial<IntegrationLastTest> | undefined
    if (!d || typeof d.latencyMs !== 'number' || typeof d.testedAt !== 'string') {
      return
    }
    settings.integrations[platform].lastTest = {
      status: d.status === 'success' ? 'success' : 'error',
      message: d.message ?? '',
      latencyMs: d.latencyMs,
      testedAt: d.testedAt
    }
  }

  async function refreshCredentialStatus(): Promise<void> {
    const response = await credentialsApi.getAllCredentials()
    if (response.success && response.data) {credentialStatus.value = response.data}
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

      const { edits, missing } = collectCredentialEdits('line', LINE_FIELDS, settings.integrations.line)

      if (missing.length > 0) {
        showMessage('請填寫完整的 LINE 設定資料', 'error')
        return
      }

      // Only fields the user explicitly replaced are written; stored secrets are never echoed back.
      const results = await Promise.all(
        LINE_FIELDS.filter(f => edits[f] !== undefined).map(f =>
          credentialsApi.storeCredential('line', f, edits[f] as string)
        )
      )

      if (results.some(r => !r.success)) {
        showMessage('部分 LINE 憑證儲存失敗', 'error')
        return
      }

      for (const f of LINE_FIELDS) {settings.integrations.line[f] = ''}
      await refreshCredentialStatus()

      // Update integration status in system settings (no credentials)
      await systemApi.updateSettings({
        integrations: { line: { status: 'connected' } }
      })
      settings.integrations.line.status = 'connected'

      showMessage('LINE 設定已儲存', 'success')
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

      const { edits, missing } = collectCredentialEdits('facebook', FACEBOOK_FIELDS, settings.integrations.facebook)

      if (missing.length > 0) {
        showMessage('請填寫完整的 Facebook 設定資料', 'error')
        return
      }

      // Only fields the user explicitly replaced are written; stored secrets are never echoed back.
      const results = await Promise.all(
        FACEBOOK_FIELDS.filter(f => edits[f] !== undefined).map(f =>
          credentialsApi.storeCredential('facebook', f, edits[f] as string)
        )
      )

      if (results.some(r => !r.success)) {
        showMessage('部分 Facebook 憑證儲存失敗', 'error')
        return
      }

      for (const f of FACEBOOK_FIELDS) {settings.integrations.facebook[f] = ''}
      await refreshCredentialStatus()

      // Update integration status in system settings (no credentials)
      await systemApi.updateSettings({
        integrations: { facebook: { status: 'connected' } }
      })
      settings.integrations.facebook.status = 'connected'

      showMessage('Facebook 設定已儲存', 'success')
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
   *
   * @param updated form-local edits; without this the form's changes never
   *        reach the controller copy (the form clones props into local state)
   */
  async function saveAdvancedSettings(updated?: AdvancedSettings): Promise<void> {
    try {
      saving.value = true

      if (updated) {
        Object.assign(settings.advanced, updated)
      }

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

      const { edits, missing } = collectCredentialEdits('line', LINE_FIELDS, settings.integrations.line)

      if (missing.length > 0) {
        showMessage('請先填寫 LINE 設定資料', 'error')
        return
      }

      // Unreplaced fields are omitted; the server falls back to the stored (encrypted) values.
      const response = await systemApi.testIntegration('line', edits)

      if (response.success) {
        settings.integrations.line.status = 'connected'
        recordLastTest('line', response.data)
        showMessage('LINE 連線測試成功', 'success')
      } else {
        settings.integrations.line.status = 'error'
        recordLastTest('line', response.data)
        const errorMessage = response.error || response.message || 'LINE 連線測試失敗'
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

      const { edits, missing } = collectCredentialEdits('facebook', FACEBOOK_FIELDS, settings.integrations.facebook)

      if (missing.length > 0) {
        showMessage('請先填寫 Facebook 設定資料', 'error')
        return
      }

      // Unreplaced fields are omitted; the server falls back to the stored (encrypted) values.
      const response = await systemApi.testIntegration('facebook', edits)

      if (response.success) {
        settings.integrations.facebook.status = 'connected'
        recordLastTest('facebook', response.data)
        showMessage('Facebook 連線測試成功', 'success')
      } else {
        settings.integrations.facebook.status = 'error'
        recordLastTest('facebook', response.data)
        const errorMessage = response.error || response.message || 'Facebook 連線測試失敗'
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
      const confirmed = await showDanger('清除 LINE 憑證', '確定要清除 LINE 憑證嗎？此操作無法復原。', {
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
        await refreshCredentialStatus().catch(() => undefined)
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
      const confirmed = await showDanger('清除 Facebook 憑證', '確定要清除 Facebook 憑證嗎？此操作無法復原。', {
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
        await refreshCredentialStatus().catch(() => undefined)
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
   * Perform health check using the full /health/system endpoint
   *
   * @param deep also run the on-demand LINE webhook test (admin only)
   * @param announce show the result banner; the page runs a silent check when it opens
   */
  async function healthCheck(deep = false, announce = true): Promise<void> {
    try {
      processing.value = true

      const response = await systemApi.healthCheck(deep)
      const data = response.data

      if (data?.overall) {
        // Map overall status
        healthOverall.value = {
          status: data.overall.status,
          message: data.overall.message
        }

        // Map components to display list
        const componentNameMap: Record<string, string> = {
          'database': '資料庫 (D1)',
          'cache': '快取 (KV)',
          'r2': '物件儲存 (R2)',
          'durable_object': 'Durable Object',
          'queue': '佇列 (Queue)'
        }

        healthCheckedAt.value = data.overall.timestamp ?? new Date().toISOString()
        // The webhook test only runs on demand; a plain refresh keeps the last deep result.
        if (deep) {
          healthLineWebhook.value = data.deep?.lineWebhook ?? null
        }

        healthCheckResults.value = (data.components ?? []).map(c => ({
          key: c.component,
          name: componentNameMap[c.component] ?? c.component,
          status: c.status.status as 'healthy' | 'warning' | 'critical' | 'unknown',
          message: c.status.message,
          responseTime: c.status.responseTime
        }))

        if (announce) {
          const overallStatus = data.overall.status
          const statusText = overallStatus === 'healthy' ? '正常'
            : overallStatus === 'warning' ? '降級' : '異常'
          const msgType = overallStatus === 'healthy' ? 'success' : 'error'

          showMessage(`系統狀態: ${statusText}`, msgType as MessageType)
        }
      } else {
        showMessage(response.message || '健康檢查失敗', 'error')
      }
    } catch (error) {
      console.error('Health check failed:', error)
      const errorMessage = error instanceof Error ? error.message : '健康檢查失敗'
      showMessage(`健康檢查失敗: ${errorMessage}`, 'error')
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
    if (bytes === 0) {return '0 B'}

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
    message,
    messageType,
    settings,
    credentialStatus,

    // Computed
    tabs,
    lineStatus,
    facebookStatus,
    isDev,

    // Data Loading
    loadSettings,

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

    // System Maintenance
    healthCheck,
    healthCheckResults,
    healthOverall,
    healthLineWebhook,
    healthCheckedAt,

    // Utilities
    showMessage,
    getTimezoneDisplay,
    formatFileSize,

    // Lifecycle
    initialize,
    cleanup
  }
}
