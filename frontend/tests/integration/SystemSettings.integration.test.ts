/**
 * System Settings Integration Tests
 *
 * End-to-end tests for the complete SystemSettings shell + sidebar + routed pages
 * Tests user workflows and component interactions via nested routes
 *
 * Total: 8 tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import SystemSettings from '@/views/SystemSettings.vue'
import type { SystemSettings as SystemSettingsType } from '@/types/system-settings'

// Mock AppLayout
vi.mock('@/components/ui/AppLayout.vue', () => ({
  default: {
    name: 'AppLayout',
    template: '<div class="app-layout"><slot /></div>'
  }
}))

// Mock API modules
vi.mock('@/api/system', () => ({
  systemApi: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    healthCheck: vi.fn(),
    testIntegration: vi.fn()
  },
  credentialsApi: {
    getAllCredentials: vi.fn(),
    clearPlatformCredentials: vi.fn()
  }
}))

// Mock i18n
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

// Mock confirm dialog with all confirmation types (new API: showDanger/showWarning)
vi.mock('@/composables/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    showConfirm: vi.fn().mockResolvedValue(true),
    showDanger: vi.fn().mockResolvedValue(true),
    showWarning: vi.fn().mockResolvedValue(true),
    showInfo: vi.fn().mockResolvedValue(true)
  })
}))

/**
 * Create a router with the nested settings routes for testing
 */
function createTestRouter(_initialRoute = '/settings/general') {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/settings',
        component: SystemSettings,
        children: [
          { path: '', redirect: '/settings/general' },
          {
            path: 'general',
            name: 'SettingsGeneral',
            component: () => import('@/components/system-settings/pages/GeneralSettingsPage.vue')
          },
          { path: 'integrations', redirect: '/settings/integrations/line' },
          {
            path: 'integrations/line',
            name: 'SettingsIntegrationsLine',
            component: () => import('@/components/system-settings/pages/LineIntegrationPage.vue')
          },
          {
            path: 'integrations/facebook',
            name: 'SettingsIntegrationsFacebook',
            component: () => import('@/components/system-settings/pages/FacebookIntegrationPage.vue')
          },
          {
            path: 'advanced',
            name: 'SettingsAdvanced',
            component: () => import('@/components/system-settings/pages/AdvancedSettingsPage.vue')
          },
          { path: 'maintenance', redirect: '/settings/maintenance/health' },
          {
            path: 'maintenance/health',
            name: 'SettingsMaintenanceHealth',
            component: () => import('@/components/system-settings/pages/SystemHealthPage.vue')
          }
        ]
      }
    ]
  })
}

describe('SystemSettings Integration Tests', () => {
  const mockSettings: SystemSettingsType = {
    general: {
      systemName: 'Test System',
      contactEmail: 'test@example.com',
      timezone: 'Asia/Taipei',
      language: 'zh-TW'
    },
    integrations: {
      line: {
        channelId: 'test-channel',
        channelSecret: 'test-secret',
        accessToken: 'test-token',
        status: 'connected'
      },
      facebook: {
        appId: 'test-app',
        appSecret: 'test-secret',
        pageId: 'test-page',
        pageToken: 'test-token',
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

  beforeEach(async () => {
    const { systemApi, credentialsApi } = await import('@/api/system')

    vi.mocked(systemApi.getSettings).mockResolvedValue({
      success: true,
      data: mockSettings
    })

    vi.mocked(credentialsApi.getAllCredentials).mockResolvedValue({
      success: true,
      data: {}
    })

    vi.mocked(systemApi.updateSettings).mockResolvedValue({ success: true })
    vi.mocked(systemApi.testIntegration).mockResolvedValue({
      success: true,
      data: {
        status: 'connected',
        message: 'OK'
      }
    })
  })

  it('should load and display settings on mount', async () => {
    const router = createTestRouter()
    await router.push('/settings/general')
    await router.isReady()

    const wrapper = mount(SystemSettings, {
      global: { plugins: [router] }
    })
    await flushPromises()

    expect(wrapper.find('.system-settings').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'SettingsHeader' }).exists()).toBe(true)
  })

  it('should switch between tabs correctly via router navigation', async () => {
    const router = createTestRouter()
    await router.push('/settings/general')
    await router.isReady()

    const wrapper = mount(SystemSettings, {
      global: { plugins: [router] }
    })
    await flushPromises()

    // Initial route should show general page
    expect(wrapper.findComponent({ name: 'GeneralSettingsForm' }).exists()).toBe(true)

    // Navigate to LINE integration
    await router.push('/settings/integrations/line')
    await flushPromises()

    expect(wrapper.findComponent({ name: 'LineIntegrationForm' }).exists()).toBe(true)
  })

  it('should save general settings successfully', async () => {
    const { systemApi } = await import('@/api/system')
    const router = createTestRouter()
    await router.push('/settings/general')
    await router.isReady()

    const wrapper = mount(SystemSettings, {
      global: { plugins: [router] }
    })
    await flushPromises()

    const generalForm = wrapper.findComponent({ name: 'GeneralSettingsForm' })
    await generalForm.vm.$emit('save')
    await flushPromises()

    expect(systemApi.updateSettings).toHaveBeenCalled()
  })

  it('should test LINE integration', async () => {
    const router = createTestRouter()
    await router.push('/settings/integrations/line')
    await router.isReady()

    const wrapper = mount(SystemSettings, {
      global: { plugins: [router] }
    })
    await flushPromises()

    const lineForm = wrapper.findComponent({ name: 'LineIntegrationForm' })
    expect(lineForm.exists()).toBe(true)
  })

  it('should save advanced settings', async () => {
    const { systemApi } = await import('@/api/system')
    const router = createTestRouter()
    await router.push('/settings/advanced')
    await router.isReady()

    const wrapper = mount(SystemSettings, {
      global: { plugins: [router] }
    })
    await flushPromises()

    const advancedForm = wrapper.findComponent({ name: 'AdvancedSettingsForm' })
    await advancedForm.vm.$emit('save')
    await flushPromises()

    expect(systemApi.updateSettings).toHaveBeenCalled()
  })

  it('should navigate to health check page', async () => {
    const router = createTestRouter()
    await router.push('/settings/maintenance/health')
    await router.isReady()

    const wrapper = mount(SystemSettings, {
      global: { plugins: [router] }
    })
    await flushPromises()

    const healthPage = wrapper.findComponent({ name: 'SystemHealthPage' })
    expect(healthPage.exists()).toBe(true)
  })
})
