// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/components/ui/StatusBadge.test.ts
// Created by: Component Test Developer

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import StatusBadge from './StatusBadge.vue'

describe('StatusBadge Component', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  const createWrapper = (props = {}) => {
    return mount(StatusBadge, {
      props: {
        status: 'pending',
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
      const wrapper = createWrapper({ status: 'pending' })

      expect(wrapper.text()).toContain('待處理')
    })
  })

  describe('Status Types', () => {
    it('should render pending status', () => {
      const wrapper = createWrapper({ status: 'pending' })

      expect(wrapper.find('.status-badge').classes()).toContain('pending')
      expect(wrapper.text()).toBe('待處理')
    })

    it('should render in-progress status', () => {
      const wrapper = createWrapper({ status: 'in-progress' })

      expect(wrapper.find('.status-badge').classes()).toContain('in-progress')
      expect(wrapper.text()).toBe('處理中')
    })

    it('should render closed status', () => {
      const wrapper = createWrapper({ status: 'closed' })

      expect(wrapper.find('.status-badge').classes()).toContain('closed')
      expect(wrapper.text()).toBe('已結束')
    })

    it('should render resolved status', () => {
      const wrapper = createWrapper({ status: 'resolved' })

      expect(wrapper.find('.status-badge').classes()).toContain('resolved')
      expect(wrapper.text()).toBe('已解決')
    })

    it('should render active status', () => {
      const wrapper = createWrapper({ status: 'active' })

      expect(wrapper.find('.status-badge').classes()).toContain('active')
      expect(wrapper.text()).toBe('活躍')
    })

    it('should render inactive status', () => {
      const wrapper = createWrapper({ status: 'inactive' })

      expect(wrapper.find('.status-badge').classes()).toContain('inactive')
      expect(wrapper.text()).toBe('非活躍')
    })

    it('should render online status', () => {
      const wrapper = createWrapper({ status: 'online' })

      expect(wrapper.find('.status-badge').classes()).toContain('online')
      expect(wrapper.text()).toBe('在線')
    })

    it('should render offline status', () => {
      const wrapper = createWrapper({ status: 'offline' })

      expect(wrapper.find('.status-badge').classes()).toContain('offline')
      expect(wrapper.text()).toBe('離線')
    })
  })

  describe('Size Variants', () => {
    it('should render small size badge', () => {
      const wrapper = createWrapper({ 
        status: 'pending', 
        size: 'small' 
      })

      expect(wrapper.find('.status-badge').classes()).toContain('small')
    })

    it('should render medium size badge (default)', () => {
      const wrapper = createWrapper({ status: 'pending' })

      expect(wrapper.find('.status-badge').classes()).toContain('medium')
    })

    it('should render large size badge', () => {
      const wrapper = createWrapper({ 
        status: 'pending', 
        size: 'large' 
      })

      expect(wrapper.find('.status-badge').classes()).toContain('large')
    })
  })

  describe('Custom Text', () => {
    it('should display custom text when provided', () => {
      const wrapper = createWrapper({ 
        status: 'pending',
        text: '自定義狀態'
      })

      expect(wrapper.text()).toBe('自定義狀態')
    })

    it('should use default text when custom text is not provided', () => {
      const wrapper = createWrapper({ status: 'pending' })

      expect(wrapper.text()).toBe('待處理')
    })
  })

  describe('Interactive Features', () => {
    it('should emit click event when clicked', async () => {
      const wrapper = createWrapper({ 
        status: 'pending',
        clickable: true
      })

      await wrapper.trigger('click')

      expect(wrapper.emitted('click')).toBeTruthy()
    })

    it('should not emit click event when not clickable', async () => {
      const wrapper = createWrapper({ 
        status: 'pending',
        clickable: false
      })

      await wrapper.trigger('click')

      expect(wrapper.emitted('click')).toBeFalsy()
    })

    it('should apply clickable class when clickable', () => {
      const wrapper = createWrapper({ 
        status: 'pending',
        clickable: true
      })

      expect(wrapper.find('.status-badge').classes()).toContain('clickable')
    })
  })

  describe('Error Handling', () => {
    it('should handle unknown status gracefully', () => {
      const wrapper = createWrapper({ status: 'unknown' })

      expect(wrapper.find('.status-badge').exists()).toBe(true)
      expect(wrapper.text()).toBe('未知')
    })

    it('should handle empty status', () => {
      const wrapper = createWrapper({ status: '' })

      expect(wrapper.find('.status-badge').exists()).toBe(true)
    })
  })
})