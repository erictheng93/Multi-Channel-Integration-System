import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SystemSettings from '@/views/SystemSettings.vue'
import { systemApi } from '@/api/system'

// Mock vue-router
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRoute: vi.fn(() => ({
      path: '/settings',
      params: {},
      query: {}
    })),
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn()
    }))
  }
})

// Mock the system API
vi.mock('@/api/system', () => ({
  systemApi: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    testIntegration: vi.fn(),
    backupDatabase: vi.fn(),
    getBackups: vi.fn(),
    restoreDatabase: vi.fn(),
    clearCache: vi.fn(),
    healthCheck: vi.fn(),
    restartSystem: vi.fn()
  }
}))

// Mock AppLayout component
vi.mock('@/components/ui/AppLayout.vue', () => ({
  default: {
    name: 'AppLayout',
    template: '<div class="app-layout"><slot /></div>'
  }
}))

// Mock icons
vi.mock('@/components/icons', () => ({
  SettingsIcon: { name: 'SettingsIcon', template: '<div>Settings</div>' },
  IntegrationIcon: { name: 'IntegrationIcon', template: '<div>Integration</div>' },
  AdvancedIcon: { name: 'AdvancedIcon', template: '<div>Advanced</div>' },
  SystemIcon: { name: 'SystemIcon', template: '<div>System</div>' }
}))

describe('SystemSettings', () => {
  let pinia: any

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    
    // Mock successful API responses
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
      }
    })

    vi.mocked(systemApi.getBackups).mockResolvedValue({
      success: true,
      data: []
    })
  })

  it('renders correctly', async () => {
    const wrapper = mount(SystemSettings, {
      global: {
        plugins: [pinia]
      }
    })

    // Wait for component to load
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(wrapper.find('.system-settings').exists()).toBe(true)
    expect(wrapper.find('.settings-title').text()).toBe('系統設定')
  })

  it('displays navigation tabs', async () => {
    const wrapper = mount(SystemSettings, {
      global: {
        plugins: [pinia]
      }
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    const tabs = wrapper.findAll('.nav-tab')
    expect(tabs).toHaveLength(4)
    
    const tabTexts = tabs.map(tab => tab.text())
    expect(tabTexts).toContain('一般設定')
    expect(tabTexts).toContain('平台整合')
    expect(tabTexts).toContain('進階設定')
    expect(tabTexts).toContain('系統管理')
  })

  it('loads settings on mount', async () => {
    mount(SystemSettings, {
      global: {
        plugins: [pinia]
      }
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(systemApi.getSettings).toHaveBeenCalled()
    expect(systemApi.getBackups).toHaveBeenCalled()
  })

  it('shows loading state initially', () => {
    const wrapper = mount(SystemSettings, {
      global: {
        plugins: [pinia]
      }
    })

    expect(wrapper.find('.loading-container').exists()).toBe(true)
    expect(wrapper.find('.loading-spinner').exists()).toBe(true)
  })

  it('handles API errors gracefully', async () => {
    vi.mocked(systemApi.getSettings).mockRejectedValue(new Error('API Error'))

    const wrapper = mount(SystemSettings, {
      global: {
        plugins: [pinia]
      }
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    // Should still render the component structure
    expect(wrapper.find('.system-settings').exists()).toBe(true)
  })
})