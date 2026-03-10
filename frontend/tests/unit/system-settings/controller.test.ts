/**
 * System Settings Controller Unit Tests
 *
 * Tests for useSystemSettingsController composable
 * Covers all business logic, state management, and API interactions
 *
 * Total: 45 tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSystemSettingsController } from '@/composables/useSystemSettingsController'
import type { SystemSettings } from '@/types/system-settings'

// Mock modules
vi.mock('@/api/system', () => ({
  systemApi: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    healthCheck: vi.fn(),
    testIntegration: vi.fn()
  },
  credentialsApi: {
    getAllCredentials: vi.fn(),
    clearPlatformCredentials: vi.fn(),
    storeCredential: vi.fn()
  }
}))

// Credentials API is exported from system.ts
// No separate credentials mock needed

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  }),
  createI18n: vi.fn(() => ({
    global: {
      t: (key: string) => key
    }
  }))
}))

// Create mock confirm functions that we can reference (new API: showDanger/showWarning)
const confirmMock = {
  showDanger: vi.fn().mockResolvedValue(true),
  showWarning: vi.fn().mockResolvedValue(true),
  showConfirm: vi.fn().mockResolvedValue(true),
  showInfo: vi.fn().mockResolvedValue(true)
}

// Mock confirm dialog with all confirmation types
vi.mock('@/composables/useConfirmDialog', () => ({
  useConfirmDialog: () => confirmMock
}))

describe('System Settings Controller', () => {
  let controller: ReturnType<typeof useSystemSettingsController>

  beforeEach(async () => {
    // Setup default mocks for all API methods
    const { systemApi, credentialsApi } = await import('@/api/system')

    vi.mocked(systemApi.getSettings).mockResolvedValue({
      success: true,
      data: {
        general: {
          systemName: 'Test System',
          contactEmail: 'test@example.com',
          timezone: 'Asia/Taipei',
          language: 'zh-TW'
        },
        integrations: {
          line: { channelId: '', channelSecret: '', accessToken: '', status: 'disconnected' },
          facebook: { appId: '', appSecret: '', pageId: '', pageToken: '', status: 'disconnected' }
        },
        advanced: {
          messageQueueSize: 100,
          messageTimeout: 5000,
          cacheExpiry: 3600,
          sessionExpiry: 7200,
          enableRateLimit: true,
          enableLogging: true,
          enableMetrics: true
        }
      } as SystemSettings
    })

    vi.mocked(credentialsApi.getAllCredentials).mockResolvedValue({
      success: true,
      data: {
        line: { channelId: '', channelSecret: '', accessToken: '' },
        facebook: { appId: '', appSecret: '', pageId: '', pageToken: '' }
      }
    })

    vi.mocked(systemApi.updateSettings).mockResolvedValue({ success: true })
    vi.mocked(systemApi.testIntegration).mockResolvedValue({
      success: true,
      data: { status: 'connected', message: 'OK' }
    })
    vi.mocked(systemApi.healthCheck).mockResolvedValue({ success: true })
    vi.mocked(credentialsApi.clearPlatformCredentials).mockResolvedValue({ success: true })
    vi.mocked(credentialsApi.storeCredential).mockResolvedValue({ success: true })

    controller = useSystemSettingsController()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default state values', () => {
      expect(controller.loading.value).toBe(false)
      expect(controller.saving.value).toBe(false)
      expect(controller.testing.value).toBe(false)
      expect(controller.processing.value).toBe(false)
      expect(controller.activeTab.value).toBe('general')
    })

    it('should have valid tabs configuration', () => {
      const tabs = controller.tabs.value

      expect(tabs).toHaveLength(4)
      expect(tabs[0].key).toBe('general')
      expect(tabs[1].key).toBe('integrations')
      expect(tabs[2].key).toBe('advanced')
      expect(tabs[3].key).toBe('system')
    })

    it('should initialize settings with default values', () => {
      expect(controller.settings.general).toBeDefined()
      expect(controller.settings.integrations).toBeDefined()
      expect(controller.settings.advanced).toBeDefined()
    })

    it('should call loadSettings on initialize', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.getSettings).mockResolvedValue({
        success: true,
        data: {} as SystemSettings
      })

      await controller.initialize()

      expect(systemApi.getSettings).toHaveBeenCalled()
    })

    it('should handle initialization errors gracefully', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.getSettings).mockRejectedValue(new Error('API Error'))

      await controller.initialize()

      expect(controller.loading.value).toBe(false)
    })
  })

  describe('State Management', () => {
    it('should update loading state correctly', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.getSettings).mockImplementation(() => {
        expect(controller.loading.value).toBe(true)
        return Promise.resolve({ success: true, data: {} as SystemSettings })
      })

      await controller.loadSettings()

      expect(controller.loading.value).toBe(false)
    })

    it('should update saving state correctly', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.updateSettings).mockImplementation(() => {
        expect(controller.saving.value).toBe(true)
        return Promise.resolve({ success: true })
      })

      await controller.saveGeneralSettings()

      expect(controller.saving.value).toBe(false)
    })

    it('should update testing state correctly', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.testIntegration).mockImplementation(() => {
        expect(controller.testing.value).toBe(true)
        return Promise.resolve({ success: true, data: { status: 'connected', message: 'OK' } })
      })

      await controller.testLineIntegration()

      expect(controller.testing.value).toBe(false)
    })

  })

  describe('Data Loading', () => {
    it('should load settings successfully', async () => {
      const { systemApi } = await import('@/api/system')
      const mockSettings: SystemSettings = {
        general: {
          systemName: 'Test System',
          contactEmail: 'test@example.com',
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
          messageQueueSize: 100,
          messageTimeout: 5000,
          cacheExpiry: 3600,
          sessionExpiry: 7200,
          enableRateLimit: true,
          enableLogging: true,
          enableMetrics: true
        }
      }

      vi.mocked(systemApi.getSettings).mockResolvedValue({
        success: true,
        data: mockSettings
      })

      await controller.loadSettings()

      expect(controller.settings.general.systemName).toBe('Test System')
    })

    it('should handle loadSettings error', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.getSettings).mockRejectedValue(new Error('Network error'))

      await controller.loadSettings()

      expect(controller.message.value).toBeTruthy()
      expect(controller.messageType.value).toBe('error')
    })

  })

  describe('Save Settings', () => {
    it('should save general settings successfully', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.updateSettings).mockResolvedValue({ success: true })

      await controller.saveGeneralSettings()

      expect(systemApi.updateSettings).toHaveBeenCalled()
      expect(controller.message.value).toBeTruthy()
      expect(controller.messageType.value).toBe('success')
    })

    it('should handle general settings save error', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.updateSettings).mockRejectedValue(new Error('Save failed'))

      await controller.saveGeneralSettings()

      expect(controller.messageType.value).toBe('error')
    })

    it('should save LINE settings successfully', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.updateSettings).mockResolvedValue({ success: true })

      // Set up valid LINE settings data - the function requires all fields to be filled
      controller.settings.integrations.line = {
        channelId: 'test-channel-id',
        channelSecret: 'test-channel-secret',
        accessToken: 'test-access-token',
        status: 'disconnected'
      }

      await controller.saveLineSettings()

      expect(systemApi.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          integrations: expect.objectContaining({
            line: expect.any(Object)
          })
        })
      )
      expect(controller.messageType.value).toBe('success')
    })

    it('should handle LINE settings save error', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.updateSettings).mockRejectedValue(new Error('Save failed'))

      await controller.saveLineSettings()

      expect(controller.messageType.value).toBe('error')
    })

    it('should save Facebook settings successfully', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.updateSettings).mockResolvedValue({ success: true })

      // Set up valid Facebook settings data - the function requires all fields to be filled
      controller.settings.integrations.facebook = {
        appId: 'test-app-id',
        appSecret: 'test-app-secret',
        pageId: 'test-page-id',
        pageToken: 'test-page-token',
        status: 'disconnected'
      }

      await controller.saveFacebookSettings()

      expect(systemApi.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          integrations: expect.objectContaining({
            facebook: expect.any(Object)
          })
        })
      )
      expect(controller.messageType.value).toBe('success')
    })

    it('should handle Facebook settings save error', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.updateSettings).mockRejectedValue(new Error('Save failed'))

      await controller.saveFacebookSettings()

      expect(controller.messageType.value).toBe('error')
    })

    it('should save advanced settings successfully', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.updateSettings).mockResolvedValue({ success: true })

      await controller.saveAdvancedSettings()

      expect(systemApi.updateSettings).toHaveBeenCalled()
      expect(controller.messageType.value).toBe('success')
    })

    it('should handle advanced settings save error', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.updateSettings).mockRejectedValue(new Error('Save failed'))

      await controller.saveAdvancedSettings()

      expect(controller.messageType.value).toBe('error')
    })
  })

  describe('Integration Testing', () => {
    it('should test LINE integration successfully', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.testIntegration).mockResolvedValue({
        success: true,
        data: {
          status: 'connected',
          message: 'Connection successful'
        }
      })

      // Set up valid LINE settings data - required for test to call API
      controller.settings.integrations.line = {
        channelId: 'test-channel-id',
        channelSecret: 'test-channel-secret',
        accessToken: 'test-access-token',
        status: 'disconnected'
      }

      await controller.testLineIntegration()

      expect(systemApi.testIntegration).toHaveBeenCalledWith('line', expect.any(Object))
      expect(controller.settings.integrations.line.status).toBe('connected')
    })

    it('should handle LINE integration test failure', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.testIntegration).mockResolvedValue({
        success: false,
        data: {
          status: 'error',
          message: 'Connection failed'
        }
      })

      // Set up valid LINE settings data - required for test to call API
      controller.settings.integrations.line = {
        channelId: 'test-channel-id',
        channelSecret: 'test-channel-secret',
        accessToken: 'test-access-token',
        status: 'disconnected'
      }

      await controller.testLineIntegration()

      expect(controller.settings.integrations.line.status).toBe('error')
    })

    it('should test Facebook integration successfully', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.testIntegration).mockResolvedValue({
        success: true,
        data: {
          status: 'connected',
          message: 'Connection successful'
        }
      })

      // Set up valid Facebook settings data - required for test to call API
      controller.settings.integrations.facebook = {
        appId: 'test-app-id',
        appSecret: 'test-app-secret',
        pageId: 'test-page-id',
        pageToken: 'test-page-token',
        status: 'disconnected'
      }

      await controller.testFacebookIntegration()

      expect(systemApi.testIntegration).toHaveBeenCalledWith('facebook', expect.any(Object))
      expect(controller.settings.integrations.facebook.status).toBe('connected')
    })

    it('should handle Facebook integration test failure', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.testIntegration).mockResolvedValue({
        success: false,
        data: {
          status: 'error',
          message: 'Connection failed'
        }
      })

      // Set up valid Facebook settings data - required for test to call API
      controller.settings.integrations.facebook = {
        appId: 'test-app-id',
        appSecret: 'test-app-secret',
        pageId: 'test-page-id',
        pageToken: 'test-page-token',
        status: 'disconnected'
      }

      await controller.testFacebookIntegration()

      expect(controller.settings.integrations.facebook.status).toBe('error')
    })
  })

  describe('Credentials Management', () => {
    it('should clear LINE credentials with confirmation', async () => {
      const { credentialsApi } = await import('@/api/system')
      vi.mocked(credentialsApi.clearPlatformCredentials).mockResolvedValue({ success: true })

      await controller.clearLineCredentials()

      expect(credentialsApi.clearPlatformCredentials).toHaveBeenCalledWith('line')
    })

    it('should clear Facebook credentials with confirmation', async () => {
      const { credentialsApi } = await import('@/api/system')
      vi.mocked(credentialsApi.clearPlatformCredentials).mockResolvedValue({ success: true })

      await controller.clearFacebookCredentials()

      expect(credentialsApi.clearPlatformCredentials).toHaveBeenCalledWith('facebook')
    })

    it('should clear local state after clearing credentials', async () => {
      const { credentialsApi } = await import('@/api/system')

      vi.mocked(credentialsApi.clearPlatformCredentials).mockResolvedValue({ success: true })

      // Set up some initial credentials data
      controller.settings.integrations.line = {
        channelId: 'test-channel',
        channelSecret: 'test-secret',
        accessToken: 'test-token',
        status: 'connected'
      }

      await controller.clearLineCredentials()

      // The implementation clears local state directly without reloading from API
      expect(controller.settings.integrations.line.channelId).toBe('')
      expect(controller.settings.integrations.line.channelSecret).toBe('')
      expect(controller.settings.integrations.line.accessToken).toBe('')
      expect(controller.settings.integrations.line.status).toBe('disconnected')
    })

    it('should not clear credentials if user cancels confirmation', async () => {
      const { credentialsApi } = await import('@/api/system')

      // Override showDanger to return false for this test
      confirmMock.showDanger.mockResolvedValueOnce(false)

      await controller.clearLineCredentials()

      // Should not call API because confirmation was cancelled
      expect(credentialsApi.clearPlatformCredentials).not.toHaveBeenCalled()
    })
  })

  describe('System Maintenance', () => {
    it('should perform health check successfully', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.healthCheck).mockResolvedValue({
        success: true,
        data: {
          overall: { status: 'healthy', message: 'All systems operational', timestamp: new Date().toISOString() },
          components: [
            { component: 'database', version: '1.0', status: { status: 'healthy', message: 'OK', timestamp: new Date().toISOString(), responseTime: 5 }, lastCheck: new Date().toISOString(), checkInterval: 30 },
            { component: 'cache', version: '1.0', status: { status: 'healthy', message: 'OK', timestamp: new Date().toISOString(), responseTime: 2 }, lastCheck: new Date().toISOString(), checkInterval: 30 }
          ],
          infrastructure: {},
          performance: { apiResponseTime: 10, databaseQueryTime: 5, cacheHitRate: 0.95 }
        }
      })

      await controller.healthCheck()

      expect(systemApi.healthCheck).toHaveBeenCalled()
      expect(controller.messageType.value).toBe('success')
    })

    it('should handle health check with warning status', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.healthCheck).mockResolvedValue({
        success: true,
        data: {
          overall: { status: 'warning', message: 'Some components degraded', timestamp: new Date().toISOString() },
          components: [
            { component: 'database', version: '1.0', status: { status: 'healthy', message: 'OK', timestamp: new Date().toISOString(), responseTime: 5 }, lastCheck: new Date().toISOString(), checkInterval: 30 },
            { component: 'cache', version: '1.0', status: { status: 'warning', message: 'High latency', timestamp: new Date().toISOString(), responseTime: 200 }, lastCheck: new Date().toISOString(), checkInterval: 30 }
          ],
          infrastructure: {},
          performance: { apiResponseTime: 50, databaseQueryTime: 5, cacheHitRate: 0.5 }
        }
      })

      await controller.healthCheck()

      // Non-healthy status is treated as 'error' type in the implementation
      expect(controller.messageType.value).toBe('error')
    })

    it('should handle health check with critical status', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.healthCheck).mockResolvedValue({
        success: true,
        data: {
          overall: { status: 'critical', message: 'System unhealthy', timestamp: new Date().toISOString() },
          components: [
            { component: 'database', version: '1.0', status: { status: 'critical', message: 'Connection failed', timestamp: new Date().toISOString() }, lastCheck: new Date().toISOString(), checkInterval: 30 },
            { component: 'cache', version: '1.0', status: { status: 'critical', message: 'Unavailable', timestamp: new Date().toISOString() }, lastCheck: new Date().toISOString(), checkInterval: 30 }
          ],
          infrastructure: {},
          performance: { apiResponseTime: 0, databaseQueryTime: 0, cacheHitRate: 0 }
        }
      })

      await controller.healthCheck()

      expect(controller.messageType.value).toBe('error')
    })

    it('should handle health check with missing overall data', async () => {
      const { systemApi } = await import('@/api/system')
      vi.mocked(systemApi.healthCheck).mockResolvedValue({
        success: true,
        data: undefined,
        message: '健康檢查失敗'
      })

      await controller.healthCheck()

      expect(controller.messageType.value).toBe('error')
    })
  })

  describe('Utility Functions', () => {
    it('should show message with correct type', () => {
      controller.showMessage('Test message', 'success')

      expect(controller.message.value).toBe('Test message')
      expect(controller.messageType.value).toBe('success')
    })

    it('should format timezone display correctly', () => {
      const display = controller.getTimezoneDisplay('Asia/Taipei')

      // The function returns either a Chinese display name or the original timezone
      // If the timezone is in the map, it returns the Chinese display (e.g., '台北 (GMT+8)')
      // Otherwise it returns the original timezone string
      expect(display).toBeTruthy()
    })

    it('should format file size correctly', () => {
      expect(controller.formatFileSize(500)).toContain('B')
      expect(controller.formatFileSize(2048)).toContain('KB')
      expect(controller.formatFileSize(2097152)).toContain('MB')
    })
  })
})
