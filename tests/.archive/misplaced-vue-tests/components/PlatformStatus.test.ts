// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/unit/components/PlatformStatus.test.ts
// Created by: Component Test Developer

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PlatformStatus from '@/components/platform/PlatformStatus.vue'

describe('PlatformStatus Component', () => {
  let pinia: any

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  const createWrapper = (props = {}) => {
    return mount(PlatformStatus, {
      props: {
        platform: 'line',
        status: 'connected',
        ...props
      },
      global: {
        plugins: [pinia]
      }
    })
  }

  describe('Basic Rendering', () => {
    it('should render platform status component', () => {
      const wrapper = createWrapper()

      expect(wrapper.find('.platform-status').exists()).toBe(true)
    })

    it('should display platform name', () => {
      const wrapper = createWrapper({ platform: 'line' })

      expect(wrapper.text()).toContain('LINE')
    })

    it('should display Facebook platform name', () => {
      const wrapper = createWrapper({ platform: 'facebook' })

      expect(wrapper.text()).toContain('Facebook')
    })
  })

  describe('Status Indicators', () => {
    it('should show connected status', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'connected' 
      })

      expect(wrapper.find('.status-indicator').exists()).toBe(true)
      expect(wrapper.find('.status-indicator').classes()).toContain('connected')
      expect(wrapper.text()).toContain('已連接')
    })

    it('should show disconnected status', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'disconnected' 
      })

      expect(wrapper.find('.status-indicator').classes()).toContain('disconnected')
      expect(wrapper.text()).toContain('未連接')
    })

    it('should show connecting status', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'connecting' 
      })

      expect(wrapper.find('.status-indicator').classes()).toContain('connecting')
      expect(wrapper.text()).toContain('連接中')
    })

    it('should show error status', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'error' 
      })

      expect(wrapper.find('.status-indicator').classes()).toContain('error')
      expect(wrapper.text()).toContain('連接錯誤')
    })
  })

  describe('Platform Icons', () => {
    it('should show LINE icon for LINE platform', () => {
      const wrapper = createWrapper({ platform: 'line' })

      expect(wrapper.find('.platform-icon').exists()).toBe(true)
      expect(wrapper.find('.platform-icon').classes()).toContain('line')
    })

    it('should show Facebook icon for Facebook platform', () => {
      const wrapper = createWrapper({ platform: 'facebook' })

      expect(wrapper.find('.platform-icon').exists()).toBe(true)
      expect(wrapper.find('.platform-icon').classes()).toContain('facebook')
    })
  })

  describe('Status Colors', () => {
    it('should apply green color for connected status', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'connected' 
      })

      const statusIndicator = wrapper.find('.status-indicator')
      expect(statusIndicator.classes()).toContain('connected')
    })

    it('should apply red color for disconnected status', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'disconnected' 
      })

      const statusIndicator = wrapper.find('.status-indicator')
      expect(statusIndicator.classes()).toContain('disconnected')
    })

    it('should apply yellow color for connecting status', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'connecting' 
      })

      const statusIndicator = wrapper.find('.status-indicator')
      expect(statusIndicator.classes()).toContain('connecting')
    })

    it('should apply red color for error status', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'error' 
      })

      const statusIndicator = wrapper.find('.status-indicator')
      expect(statusIndicator.classes()).toContain('error')
    })
  })

  describe('Interactive Features', () => {
    it('should emit reconnect event when reconnect button is clicked', async () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'disconnected' 
      })

      const reconnectButton = wrapper.find('.reconnect-button')
      if (reconnectButton.exists()) {
        await reconnectButton.trigger('click')
        expect(wrapper.emitted('reconnect')).toBeTruthy()
        expect(wrapper.emitted('reconnect')?.[0]).toEqual(['line'])
      }
    })

    it('should show reconnect button for disconnected status', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'disconnected' 
      })

      expect(wrapper.find('.reconnect-button').exists()).toBe(true)
    })

    it('should not show reconnect button for connected status', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'connected' 
      })

      expect(wrapper.find('.reconnect-button').exists()).toBe(false)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'connected' 
      })

      expect(wrapper.attributes('role')).toBe('status')
      expect(wrapper.attributes('aria-label')).toContain('LINE')
      expect(wrapper.attributes('aria-label')).toContain('已連接')
    })

    it('should have proper button accessibility', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'disconnected' 
      })

      const reconnectButton = wrapper.find('.reconnect-button')
      if (reconnectButton.exists()) {
        expect(reconnectButton.attributes('aria-label')).toContain('重新連接')
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle unknown platform gracefully', () => {
      const wrapper = createWrapper({ 
        platform: 'unknown', 
        status: 'connected' 
      })

      expect(wrapper.find('.platform-status').exists()).toBe(true)
      expect(wrapper.text()).toContain('Unknown')
    })

    it('should handle unknown status gracefully', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'unknown' 
      })

      expect(wrapper.find('.platform-status').exists()).toBe(true)
      expect(wrapper.find('.status-indicator').exists()).toBe(true)
    })
  })

  describe('Last Updated Time', () => {
    it('should display last updated time when provided', () => {
      const lastUpdated = new Date('2024-01-01T12:00:00Z').toISOString()
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'connected',
        lastUpdated 
      })

      expect(wrapper.text()).toContain('最後更新')
    })

    it('should not display last updated time when not provided', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        status: 'connected' 
      })

      expect(wrapper.text()).not.toContain('最後更新')
    })
  })
})