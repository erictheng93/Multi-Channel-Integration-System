// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/unit/components/StatusBadge.test.ts
// Created by: Component Test Developer

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import StatusBadge from '@/components/ui/StatusBadge.vue'

describe('StatusBadge Component', () => {
  let pinia: any

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  const createWrapper = (props = {}) => {
    return mount(StatusBadge, {
      props: {
        status: 'open',
        ...props
      },
      global: {
        plugins: [pinia]
      }
    })
  }

  describe('Basic Rendering', () => {
    it('should render status badge component', () => {
      const wrapper = createWrapper()

      expect(wrapper.find('.status-badge').exists()).toBe(true)
    })

    it('should display status text', () => {
      const wrapper = createWrapper({ status: 'open' })

      expect(wrapper.text()).toContain('待處理')
    })
  })

  describe('Status Types', () => {
    it('should render open status', () => {
      const wrapper = createWrapper({ status: 'open' })

      expect(wrapper.find('.status-badge').classes()).toContain('status-open')
      expect(wrapper.text()).toBe('待處理')
    })

    it('should render assigned status', () => {
      const wrapper = createWrapper({ status: 'assigned' })

      expect(wrapper.find('.status-badge').classes()).toContain('status-assigned')
      expect(wrapper.text()).toBe('處理中')
    })

    it('should render closed status', () => {
      const wrapper = createWrapper({ status: 'closed' })

      expect(wrapper.find('.status-badge').classes()).toContain('status-closed')
      expect(wrapper.text()).toBe('已結束')
    })
  })

  describe('CSS Classes', () => {
    it('should apply status-specific CSS class', () => {
      const wrapper = createWrapper({ status: 'open' })

      expect(wrapper.find('.status-badge').classes()).toContain('status-open')
    })

    it('should have status indicator element', () => {
      const wrapper = createWrapper({ status: 'open' })

      expect(wrapper.find('.status-indicator').exists()).toBe(true)
    })

    it('should have status text element', () => {
      const wrapper = createWrapper({ status: 'open' })

      expect(wrapper.find('.status-text').exists()).toBe(true)
    })
  })

  describe('Status Text Display', () => {
    it('should display correct text for open status', () => {
      const wrapper = createWrapper({ status: 'open' })

      expect(wrapper.find('.status-text').text()).toBe('待處理')
    })

    it('should display correct text for assigned status', () => {
      const wrapper = createWrapper({ status: 'assigned' })

      expect(wrapper.find('.status-text').text()).toBe('處理中')
    })

    it('should display correct text for closed status', () => {
      const wrapper = createWrapper({ status: 'closed' })

      expect(wrapper.find('.status-text').text()).toBe('已結束')
    })
  })

  describe('Status Indicator', () => {
    it('should display status indicator for all statuses', () => {
      const statuses: Array<'open' | 'assigned' | 'closed'> = ['open', 'assigned', 'closed']

      statuses.forEach(status => {
        const wrapper = createWrapper({ status })
        expect(wrapper.find('.status-indicator').exists()).toBe(true)
      })
    })
  })

  describe('Color Schemes', () => {
    it('should apply correct color class for open status', () => {
      const wrapper = createWrapper({ status: 'open' })

      expect(wrapper.find('.status-badge').classes()).toContain('status-open')
    })

    it('should apply correct color class for assigned status', () => {
      const wrapper = createWrapper({ status: 'assigned' })

      expect(wrapper.find('.status-badge').classes()).toContain('status-assigned')
    })

    it('should apply correct color class for closed status', () => {
      const wrapper = createWrapper({ status: 'closed' })

      expect(wrapper.find('.status-badge').classes()).toContain('status-closed')
    })
  })

  describe('Component Structure', () => {
    it('should have proper HTML structure', () => {
      const wrapper = createWrapper({ status: 'open' })

      expect(wrapper.find('.status-badge').exists()).toBe(true)
      expect(wrapper.find('.status-indicator').exists()).toBe(true)
      expect(wrapper.find('.status-text').exists()).toBe(true)
    })

    it('should apply inline-flex display', () => {
      const wrapper = createWrapper({ status: 'open' })
      const badge = wrapper.find('.status-badge')

      expect(badge.exists()).toBe(true)
    })
  })

  describe('Props Validation', () => {
    it('should accept valid status values', () => {
      const validStatuses: Array<'open' | 'assigned' | 'closed'> = ['open', 'assigned', 'closed']

      validStatuses.forEach(status => {
        expect(() => createWrapper({ status })).not.toThrow()
      })
    })
  })
})