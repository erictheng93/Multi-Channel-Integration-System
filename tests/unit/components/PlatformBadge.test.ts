// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/unit/components/PlatformBadge.test.ts
// Created by: Component Test Developer

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PlatformBadge from '@/components/ui/PlatformBadge.vue'

describe('PlatformBadge Component', () => {
  let pinia: any

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  const createWrapper = (props = {}) => {
    return mount(PlatformBadge, {
      props: {
        platform: 'line',
        ...props
      },
      global: {
        plugins: [pinia]
      }
    })
  }

  describe('Basic Rendering', () => {
    it('should render platform badge component', () => {
      const wrapper = createWrapper()

      expect(wrapper.find('.platform-badge').exists()).toBe(true)
    })

    it('should display platform name', () => {
      const wrapper = createWrapper({ platform: 'line' })

      expect(wrapper.text()).toContain('LINE')
    })
  })

  describe('Platform Types', () => {
    it('should render LINE platform badge', () => {
      const wrapper = createWrapper({ platform: 'line' })

      expect(wrapper.find('.platform-badge').classes()).toContain('line')
      expect(wrapper.text()).toBe('LINE')
    })

    it('should render Facebook platform badge', () => {
      const wrapper = createWrapper({ platform: 'facebook' })

      expect(wrapper.find('.platform-badge').classes()).toContain('facebook')
      expect(wrapper.text()).toBe('Facebook')
    })

    it('should render Instagram platform badge', () => {
      const wrapper = createWrapper({ platform: 'instagram' })

      expect(wrapper.find('.platform-badge').classes()).toContain('instagram')
      expect(wrapper.text()).toBe('Instagram')
    })

    it('should render WhatsApp platform badge', () => {
      const wrapper = createWrapper({ platform: 'whatsapp' })

      expect(wrapper.find('.platform-badge').classes()).toContain('whatsapp')
      expect(wrapper.text()).toBe('WhatsApp')
    })

    it('should render Telegram platform badge', () => {
      const wrapper = createWrapper({ platform: 'telegram' })

      expect(wrapper.find('.platform-badge').classes()).toContain('telegram')
      expect(wrapper.text()).toBe('Telegram')
    })
  })

  describe('Size Variants', () => {
    it('should render small size badge', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        size: 'small' 
      })

      expect(wrapper.find('.platform-badge').classes()).toContain('small')
    })

    it('should render medium size badge (default)', () => {
      const wrapper = createWrapper({ platform: 'line' })

      expect(wrapper.find('.platform-badge').classes()).toContain('medium')
    })

    it('should render large size badge', () => {
      const wrapper = createWrapper({ 
        platform: 'line', 
        size: 'large' 
      })

      expect(wrapper.find('.platform-badge').classes()).toContain('large')
    })
  })

  describe('Icon Display', () => {
    it('should show platform icon when showIcon is true', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        showIcon: true
      })

      expect(wrapper.find('.platform-icon').exists()).toBe(true)
    })

    it('should not show platform icon when showIcon is false', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        showIcon: false
      })

      expect(wrapper.find('.platform-icon').exists()).toBe(false)
    })

    it('should show icon by default', () => {
      const wrapper = createWrapper({ platform: 'line' })

      expect(wrapper.find('.platform-icon').exists()).toBe(true)
    })

    it('should show correct icon for LINE platform', () => {
      const wrapper = createWrapper({ platform: 'line' })

      expect(wrapper.find('.platform-icon').classes()).toContain('line-icon')
    })

    it('should show correct icon for Facebook platform', () => {
      const wrapper = createWrapper({ platform: 'facebook' })

      expect(wrapper.find('.platform-icon').classes()).toContain('facebook-icon')
    })
  })

  describe('Color Schemes', () => {
    it('should apply LINE brand colors', () => {
      const wrapper = createWrapper({ platform: 'line' })

      expect(wrapper.find('.platform-badge').classes()).toContain('line')
    })

    it('should apply Facebook brand colors', () => {
      const wrapper = createWrapper({ platform: 'facebook' })

      expect(wrapper.find('.platform-badge').classes()).toContain('facebook')
    })

    it('should apply Instagram brand colors', () => {
      const wrapper = createWrapper({ platform: 'instagram' })

      expect(wrapper.find('.platform-badge').classes()).toContain('instagram')
    })

    it('should apply WhatsApp brand colors', () => {
      const wrapper = createWrapper({ platform: 'whatsapp' })

      expect(wrapper.find('.platform-badge').classes()).toContain('whatsapp')
    })
  })

  describe('Interactive Features', () => {
    it('should emit click event when clicked and clickable', async () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        clickable: true
      })

      await wrapper.trigger('click')

      expect(wrapper.emitted('click')).toBeTruthy()
      expect(wrapper.emitted('click')?.[0]).toEqual(['line'])
    })

    it('should not emit click event when not clickable', async () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        clickable: false
      })

      await wrapper.trigger('click')

      expect(wrapper.emitted('click')).toBeFalsy()
    })

    it('should apply clickable class when clickable', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        clickable: true
      })

      expect(wrapper.find('.platform-badge').classes()).toContain('clickable')
    })

    it('should have pointer cursor when clickable', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        clickable: true
      })

      expect(wrapper.find('.platform-badge').classes()).toContain('clickable')
    })
  })

  describe('Status Indicator', () => {
    it('should show status indicator when status is provided', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        status: 'connected'
      })

      expect(wrapper.find('.status-indicator').exists()).toBe(true)
      expect(wrapper.find('.status-indicator').classes()).toContain('connected')
    })

    it('should not show status indicator when status is not provided', () => {
      const wrapper = createWrapper({ platform: 'line' })

      expect(wrapper.find('.status-indicator').exists()).toBe(false)
    })

    it('should show connected status indicator', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        status: 'connected'
      })

      expect(wrapper.find('.status-indicator').classes()).toContain('connected')
    })

    it('should show disconnected status indicator', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        status: 'disconnected'
      })

      expect(wrapper.find('.status-indicator').classes()).toContain('disconnected')
    })

    it('should show error status indicator', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        status: 'error'
      })

      expect(wrapper.find('.status-indicator').classes()).toContain('error')
    })
  })

  describe('Custom Text', () => {
    it('should display custom text when provided', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        text: '自定義文字'
      })

      expect(wrapper.text()).toContain('自定義文字')
    })

    it('should use platform name when custom text is not provided', () => {
      const wrapper = createWrapper({ platform: 'line' })

      expect(wrapper.text()).toBe('LINE')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const wrapper = createWrapper({ platform: 'line' })

      expect(wrapper.attributes('role')).toBe('badge')
      expect(wrapper.attributes('aria-label')).toContain('LINE')
    })

    it('should have button role when clickable', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        clickable: true
      })

      expect(wrapper.attributes('role')).toBe('button')
      expect(wrapper.attributes('tabindex')).toBe('0')
    })

    it('should support keyboard navigation when clickable', async () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        clickable: true
      })

      await wrapper.trigger('keydown', { key: 'Enter' })
      expect(wrapper.emitted('click')).toBeTruthy()

      await wrapper.trigger('keydown', { key: ' ' })
      expect(wrapper.emitted('click')).toHaveLength(2)
    })

    it('should have proper alt text for icon', () => {
      const wrapper = createWrapper({ platform: 'line' })

      const icon = wrapper.find('.platform-icon')
      expect(icon.attributes('aria-label')).toContain('LINE')
    })
  })

  describe('Error Handling', () => {
    it('should handle unknown platform gracefully', () => {
      const wrapper = createWrapper({ platform: 'unknown' })

      expect(wrapper.find('.platform-badge').exists()).toBe(true)
      expect(wrapper.text()).toBe('Unknown')
      expect(wrapper.find('.platform-badge').classes()).toContain('unknown')
    })

    it('should handle empty platform', () => {
      const wrapper = createWrapper({ platform: '' })

      expect(wrapper.find('.platform-badge').exists()).toBe(true)
    })
  })

  describe('Tooltip Support', () => {
    it('should show tooltip when provided', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        tooltip: 'LINE 官方帳號'
      })

      expect(wrapper.attributes('title')).toBe('LINE 官方帳號')
    })

    it('should not show tooltip when not provided', () => {
      const wrapper = createWrapper({ platform: 'line' })

      expect(wrapper.attributes('title')).toBeUndefined()
    })

    it('should show default tooltip with platform info', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        showDefaultTooltip: true
      })

      expect(wrapper.attributes('title')).toContain('LINE')
    })
  })

  describe('Badge Variants', () => {
    it('should render solid variant', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        variant: 'solid'
      })

      expect(wrapper.find('.platform-badge').classes()).toContain('solid')
    })

    it('should render outline variant', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        variant: 'outline'
      })

      expect(wrapper.find('.platform-badge').classes()).toContain('outline')
    })

    it('should render ghost variant', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        variant: 'ghost'
      })

      expect(wrapper.find('.platform-badge').classes()).toContain('ghost')
    })
  })

  describe('Count Display', () => {
    it('should show count when provided', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        count: 5
      })

      expect(wrapper.find('.badge-count').exists()).toBe(true)
      expect(wrapper.find('.badge-count').text()).toBe('5')
    })

    it('should not show count when not provided', () => {
      const wrapper = createWrapper({ platform: 'line' })

      expect(wrapper.find('.badge-count').exists()).toBe(false)
    })

    it('should show 99+ for counts over 99', () => {
      const wrapper = createWrapper({ 
        platform: 'line',
        count: 150
      })

      expect(wrapper.find('.badge-count').text()).toBe('99+')
    })
  })
})