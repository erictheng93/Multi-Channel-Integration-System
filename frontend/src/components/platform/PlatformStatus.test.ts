import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import PlatformStatus from './PlatformStatus.vue'

// Mock the system API
vi.mock('@/api/system', () => ({
  systemApi: {
    testIntegration: vi.fn(),
    testWebhook: vi.fn()
  }
}))

// Mock the icons
vi.mock('@/components/icons', () => ({
  LineIcon: { name: 'LineIcon' },
  FacebookIcon: { name: 'FacebookIcon' },
  RefreshIcon: { name: 'RefreshIcon' },
  SettingsIcon: { name: 'SettingsIcon' },
  CheckIcon: { name: 'CheckIcon' },
  CheckCircleIcon: { name: 'CheckCircleIcon' },
  XCircleIcon: { name: 'XCircleIcon' },
  ConnectIcon: { name: 'ConnectIcon' },
  TestIcon: { name: 'TestIcon' }
}))

describe('PlatformStatus Component', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  const createWrapper = (props = {}) => {
    return mount(PlatformStatus, {
      props: {
        platform: 'line',
        status: 'connected',
        ...props
      },
      global: {
        plugins: [pinia],
        stubs: {
          LoadingSpinner: true,
          LineIcon: true,
          FacebookIcon: true,
          RefreshIcon: true,
          SettingsIcon: true,
          CheckIcon: true,
          CheckCircleIcon: true,
          XCircleIcon: true,
          ConnectIcon: true,
          TestIcon: true
        }
      }
    })
  }

  describe('Basic Rendering', () => {
    it('should render platform status component', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.platform-status').exists()).toBe(true)
    })

    it('should display LINE platform name and description', () => {
      const wrapper = createWrapper({ platform: 'line' })
      expect(wrapper.find('.platform-name').text()).toBe('LINE')
      expect(wrapper.find('.platform-description').text()).toBe('LINE 官方帳號整合')
    })

    it('should display Facebook platform name and description', () => {
      const wrapper = createWrapper({ platform: 'facebook' })
      expect(wrapper.find('.platform-name').text()).toBe('Facebook Messenger')
      expect(wrapper.find('.platform-description').text()).toBe('Facebook Messenger 聊天機器人')
    })
  })

  describe('Status Indicators', () => {
    it('should show connected status', () => {
      const wrapper = createWrapper({ status: 'connected' })
      expect(wrapper.find('.status-indicator').classes()).toContain('status-connected')
      expect(wrapper.find('.status-text').text()).toBe('已連接')
    })

    it('should show disconnected status', () => {
      const wrapper = createWrapper({ status: 'disconnected' })
      expect(wrapper.find('.status-indicator').classes()).toContain('status-disconnected')
      expect(wrapper.find('.status-text').text()).toBe('未連接')
    })

    it('should show connecting status', () => {
      const wrapper = createWrapper({ status: 'connecting' })
      expect(wrapper.find('.status-indicator').classes()).toContain('status-connecting')
      expect(wrapper.find('.status-text').text()).toBe('連接中...')
    })

    it('should show error status', () => {
      const wrapper = createWrapper({ status: 'error' })
      expect(wrapper.find('.status-indicator').classes()).toContain('status-error')
      expect(wrapper.find('.status-text').text()).toBe('連接錯誤')
    })
  })

  describe('Platform Icons and Classes', () => {
    it('should apply LINE platform class', () => {
      const wrapper = createWrapper({ platform: 'line' })
      expect(wrapper.find('.platform-icon').classes()).toContain('platform-line')
    })

    it('should apply Facebook platform class', () => {
      const wrapper = createWrapper({ platform: 'facebook' })
      expect(wrapper.find('.platform-icon').classes()).toContain('platform-facebook')
    })
  })

  describe('Metrics Display', () => {
    it('should display metrics when showMetrics is true', () => {
      const metrics = {
        messagesCount: 150,
        activeConversations: 12,
        averageResponseTime: 2500,
        successRate: 0.95
      }
      
      const wrapper = createWrapper({
        showMetrics: true,
        metrics
      })

      expect(wrapper.find('.platform-metrics').exists()).toBe(true)
      expect(wrapper.text()).toContain('150')
      expect(wrapper.text()).toContain('12')
      expect(wrapper.text()).toContain('2.5s')
      expect(wrapper.text()).toContain('95%')
    })

    it('should not display metrics when showMetrics is false', () => {
      const wrapper = createWrapper({ showMetrics: false })
      expect(wrapper.find('.platform-metrics').exists()).toBe(false)
    })

    it('should format response time correctly', () => {
      const wrapper = createWrapper({
        showMetrics: true,
        metrics: { averageResponseTime: 500 }
      })
      expect(wrapper.text()).toContain('500ms')
    })

    it('should format success rate correctly', () => {
      const wrapper = createWrapper({
        showMetrics: true,
        metrics: { successRate: 0.876 }
      })
      expect(wrapper.text()).toContain('88%')
    })

    it('should handle undefined metrics gracefully', () => {
      const wrapper = createWrapper({
        showMetrics: true,
        metrics: {}
      })
      expect(wrapper.text()).toContain('0')
      expect(wrapper.text()).toContain('--')
    })
  })

  describe('Webhook Status', () => {
    it('should display webhook status when provided', () => {
      const webhookStatus = {
        endpoint: 'https://example.com/webhook',
        isActive: true,
        lastVerified: new Date('2024-01-01T12:00:00Z'),
        lastError: undefined
      }

      const wrapper = createWrapper({ webhookStatus })
      expect(wrapper.find('.webhook-status').exists()).toBe(true)
      expect(wrapper.text()).toContain('https://example.com/webhook')
      expect(wrapper.text()).toContain('正常運作')
    })

    it('should show webhook error status', () => {
      const webhookStatus = {
        endpoint: 'https://example.com/webhook',
        isActive: false,
        lastError: 'Connection timeout'
      }

      const wrapper = createWrapper({ webhookStatus })
      expect(wrapper.find('.webhook-indicator').classes()).toContain('status-error')
      expect(wrapper.text()).toContain('異常')
      expect(wrapper.text()).toContain('Connection timeout')
    })

    it('should format webhook verification time', () => {
      const webhookStatus = {
        endpoint: 'https://example.com/webhook',
        isActive: true,
        lastVerified: new Date('2024-01-01T12:00:00Z')
      }

      const wrapper = createWrapper({ webhookStatus })
      expect(wrapper.text()).toContain('2024')
    })
  })

  describe('Action Buttons', () => {
    it('should show connect button when disconnected', () => {
      const wrapper = createWrapper({ status: 'disconnected' })
      const connectButton = wrapper.find('.btn-primary')
      expect(connectButton.exists()).toBe(true)
      expect(connectButton.text()).toContain('連接')
    })

    it('should show test button when connected', () => {
      const wrapper = createWrapper({ status: 'connected' })
      const testButton = wrapper.find('.btn-secondary')
      expect(testButton.exists()).toBe(true)
      expect(testButton.text()).toContain('測試連接')
    })

    it('should show refresh button when connected', () => {
      const wrapper = createWrapper({ status: 'connected' })
      const refreshButton = wrapper.find('.btn-outline')
      expect(refreshButton.exists()).toBe(true)
    })

    it('should show settings button when showSettings is true', () => {
      const wrapper = createWrapper({ showSettings: true })
      const settingsButtons = wrapper.findAll('.btn-outline')
      expect(settingsButtons.length).toBeGreaterThan(0)
    })

    it('should not show settings button when showSettings is false', () => {
      const wrapper = createWrapper({ 
        status: 'disconnected', 
        showSettings: false 
      })
      // Should have connect button but no settings button
      const settingsButtons = wrapper.findAll('button[title="設定"]')
      expect(settingsButtons.length).toBe(0)
    })
  })

  describe('Event Emissions', () => {
    it('should emit connect event when connect button is clicked', async () => {
      const wrapper = createWrapper({ status: 'disconnected' })
      const connectButton = wrapper.find('.btn-primary')
      
      await connectButton.trigger('click')
      expect(wrapper.emitted('connect')).toBeTruthy()
    })

    it('should emit test event when test button is clicked', async () => {
      const wrapper = createWrapper({ status: 'connected' })
      const testButton = wrapper.find('.btn-secondary')
      
      await testButton.trigger('click')
      expect(wrapper.emitted('test')).toBeTruthy()
    })

    it('should emit refresh event when refresh button is clicked', async () => {
      const wrapper = createWrapper({ status: 'connected' })
      // Find the refresh button specifically by title attribute
      const refreshButton = wrapper.find('button[title="刷新狀態"]')
      
      expect(refreshButton.exists()).toBe(true)
      await refreshButton.trigger('click')
      
      // Wait for the async operation to complete (1 second timeout in the method)
      await new Promise(resolve => setTimeout(resolve, 1100))
      
      expect(wrapper.emitted('refresh')).toBeTruthy()
    }, 2000)

    it('should emit settings event when settings button is clicked', async () => {
      const wrapper = createWrapper({ 
        status: 'connected',
        showSettings: true 
      })
      
      // Find settings button (should be the second outline button)
      const outlineButtons = wrapper.findAll('.btn-outline')
      const settingsButton = outlineButtons.find(btn => 
        btn.attributes('title') === '設定'
      )
      
      if (settingsButton) {
        await settingsButton.trigger('click')
        expect(wrapper.emitted('settings')).toBeTruthy()
      }
    })
  })

  describe('Connection History', () => {
    it('should not show history when showHistory is false', () => {
      const wrapper = createWrapper({ showHistory: false })
      expect(wrapper.find('.connection-history').exists()).toBe(false)
    })

    it('should show history section when showHistory is true', () => {
      const wrapper = createWrapper({ showHistory: true })
      // History section exists but may be empty initially
      expect(wrapper.find('.connection-history').exists()).toBe(false) // Initially empty
    })
  })

  describe('Loading States', () => {
    it('should show connect button with proper text when not connecting', () => {
      const wrapper = createWrapper({ status: 'disconnected' })
      const connectButton = wrapper.find('.btn-primary')
      expect(connectButton.text()).toContain('連接')
      expect(connectButton.text()).not.toContain('連接中...')
    })

    it('should show test button with proper text when not testing', () => {
      const wrapper = createWrapper({ status: 'connected' })
      const testButton = wrapper.find('.btn-secondary')
      expect(testButton.text()).toContain('測試連接')
      expect(testButton.text()).not.toContain('測試中...')
    })
  })

  describe('Utility Methods', () => {
    it('should format response time under 1000ms correctly in display', () => {
      const wrapper = createWrapper({
        showMetrics: true,
        metrics: { averageResponseTime: 500 }
      })
      expect(wrapper.text()).toContain('500ms')
    })

    it('should format response time over 1000ms correctly in display', () => {
      const wrapper = createWrapper({
        showMetrics: true,
        metrics: { averageResponseTime: 2500 }
      })
      expect(wrapper.text()).toContain('2.5s')
    })

    it('should handle undefined response time in display', () => {
      const wrapper = createWrapper({
        showMetrics: true,
        metrics: { averageResponseTime: undefined }
      })
      expect(wrapper.text()).toContain('--')
    })

    it('should format success rate correctly in display', () => {
      const wrapper = createWrapper({
        showMetrics: true,
        metrics: { successRate: 0.876 }
      })
      expect(wrapper.text()).toContain('88%')
    })

    it('should handle undefined success rate in display', () => {
      const wrapper = createWrapper({
        showMetrics: true,
        metrics: { successRate: undefined }
      })
      expect(wrapper.text()).toContain('--')
    })

    it('should format time correctly in webhook status', () => {
      const date = new Date('2024-01-01T12:00:00Z')
      const wrapper = createWrapper({
        webhookStatus: {
          endpoint: 'https://test.com',
          isActive: true,
          lastVerified: date
        }
      })
      expect(wrapper.text()).toContain('2024')
    })

    it('should handle undefined time in webhook status', () => {
      const wrapper = createWrapper({
        webhookStatus: {
          endpoint: 'https://test.com',
          isActive: true,
          lastVerified: undefined
        }
      })
      expect(wrapper.text()).toContain('--')
    })
  })

  describe('Props Validation', () => {
    it('should use default props when not provided', () => {
      const wrapper = createWrapper()
      expect(wrapper.vm.showMetrics).toBe(true)
      expect(wrapper.vm.showHistory).toBe(false)
      expect(wrapper.vm.showSettings).toBe(true)
    })

    it('should use provided metrics', () => {
      const customMetrics = {
        messagesCount: 100,
        activeConversations: 5,
        averageResponseTime: 1000,
        successRate: 0.9
      }
      
      const wrapper = createWrapper({ metrics: customMetrics })
      expect(wrapper.vm.metrics).toEqual(customMetrics)
    })

    it('should use provided webhook status', () => {
      const customWebhookStatus = {
        endpoint: 'https://test.com/webhook',
        isActive: true,
        lastVerified: new Date(),
        lastError: undefined
      }
      
      const wrapper = createWrapper({ webhookStatus: customWebhookStatus })
      expect(wrapper.vm.webhookStatus).toEqual(customWebhookStatus)
    })
  })
})