// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/unit/components/RefreshIcon.test.ts
// Created by: Component Test Developer

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RefreshIcon from '@/components/icons/RefreshIcon.vue'

describe('RefreshIcon Component', () => {
  beforeEach(() => {
    // Set up Pinia for any potential store dependencies
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  describe('Basic Rendering', () => {
    it('should render SVG element', () => {
      const wrapper = mount(RefreshIcon)
      
      expect(wrapper.find('svg').exists()).toBe(true)
      expect(wrapper.find('svg').attributes('viewBox')).toBe('0 0 24 24')
    })

    it('should render with default props', () => {
      const wrapper = mount(RefreshIcon)
      const svg = wrapper.find('svg')
      
      expect(svg.attributes('width')).toBe('20')
      expect(svg.attributes('height')).toBe('20')
      expect(svg.attributes('stroke-width')).toBe('2')
      expect(svg.classes()).not.toContain('animate-spin')
    })

    it('should render with custom size', () => {
      const wrapper = mount(RefreshIcon, {
        props: { size: 24 }
      })
      const svg = wrapper.find('svg')
      
      expect(svg.attributes('width')).toBe('24')
      expect(svg.attributes('height')).toBe('24')
    })

    it('should render with custom stroke width', () => {
      const wrapper = mount(RefreshIcon, {
        props: { strokeWidth: 3 }
      })
      const svg = wrapper.find('svg')
      
      expect(svg.attributes('stroke-width')).toBe('3')
    })
  })

  describe('Spinning Animation', () => {
    it('should not have spinning class by default', () => {
      const wrapper = mount(RefreshIcon)
      const svg = wrapper.find('svg')
      
      expect(svg.classes()).not.toContain('animate-spin')
    })

    it('should add spinning class when spinning prop is true', () => {
      const wrapper = mount(RefreshIcon, {
        props: { spinning: true }
      })
      const svg = wrapper.find('svg')
      
      expect(svg.classes()).toContain('animate-spin')
    })

    it('should remove spinning class when spinning prop changes to false', async () => {
      const wrapper = mount(RefreshIcon, {
        props: { spinning: true }
      })
      
      expect(wrapper.find('svg').classes()).toContain('animate-spin')
      
      await wrapper.setProps({ spinning: false })
      
      expect(wrapper.find('svg').classes()).not.toContain('animate-spin')
    })

    it('should handle spinning prop reactively', async () => {
      const wrapper = mount(RefreshIcon, {
        props: { spinning: false }
      })
      const svg = wrapper.find('svg')
      
      // Initially not spinning
      expect(svg.classes()).not.toContain('animate-spin')
      
      // Start spinning
      await wrapper.setProps({ spinning: true })
      expect(svg.classes()).toContain('animate-spin')
      
      // Stop spinning
      await wrapper.setProps({ spinning: false })
      expect(svg.classes()).not.toContain('animate-spin')
    })
  })

  describe('SVG Path Elements', () => {
    it('should render correct path elements for refresh icon', () => {
      const wrapper = mount(RefreshIcon)
      const paths = wrapper.findAll('path')
      
      expect(paths).toHaveLength(4)
      
      // Check that paths have the expected d attributes for refresh icon
      expect(paths[0].attributes('d')).toBe('M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8')
      expect(paths[1].attributes('d')).toBe('M21 3v5h-5')
      expect(paths[2].attributes('d')).toBe('M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16')
      expect(paths[3].attributes('d')).toBe('M3 21v-5h5')
    })
  })

  describe('CSS Animation', () => {
    it('should have CSS animation keyframes defined', () => {
      const wrapper = mount(RefreshIcon, {
        props: { spinning: true }
      })
      
      // Check that the component has the animate-spin class
      expect(wrapper.find('svg').classes()).toContain('animate-spin')
      
      // The actual CSS animation is defined in the component's style block
      // We can verify the class is applied correctly
    })
  })

  describe('Integration with ConversationDetail', () => {
    it('should work correctly when used in ConversationDetail context', () => {
      // Test the specific change: :spinning prop instead of :class
      const wrapper = mount(RefreshIcon, {
        props: { 
          spinning: true,
          size: 20,
          strokeWidth: 2
        }
      })
      
      const svg = wrapper.find('svg')
      
      // Verify the spinning prop works as expected
      expect(svg.classes()).toContain('animate-spin')
      expect(svg.attributes('width')).toBe('20')
      expect(svg.attributes('height')).toBe('20')
      expect(svg.attributes('stroke-width')).toBe('2')
    })

    it('should handle loading state changes like in ConversationDetail', async () => {
      const wrapper = mount(RefreshIcon, {
        props: { spinning: false }
      })
      
      // Simulate loading state change (like loadingMessages in ConversationDetail)
      await wrapper.setProps({ spinning: true })
      expect(wrapper.find('svg').classes()).toContain('animate-spin')
      
      // Simulate loading complete
      await wrapper.setProps({ spinning: false })
      expect(wrapper.find('svg').classes()).not.toContain('animate-spin')
    })
  })

  describe('Props Validation', () => {
    it('should handle string size prop', () => {
      const wrapper = mount(RefreshIcon, {
        props: { size: '32' }
      })
      const svg = wrapper.find('svg')
      
      expect(svg.attributes('width')).toBe('32')
      expect(svg.attributes('height')).toBe('32')
    })

    it('should handle string strokeWidth prop', () => {
      const wrapper = mount(RefreshIcon, {
        props: { strokeWidth: '1.5' }
      })
      const svg = wrapper.find('svg')
      
      expect(svg.attributes('stroke-width')).toBe('1.5')
    })

    it('should handle boolean spinning prop correctly', () => {
      // Test explicit true
      const wrapper1 = mount(RefreshIcon, {
        props: { spinning: true }
      })
      expect(wrapper1.find('svg').classes()).toContain('animate-spin')
      
      // Test explicit false
      const wrapper2 = mount(RefreshIcon, {
        props: { spinning: false }
      })
      expect(wrapper2.find('svg').classes()).not.toContain('animate-spin')
    })
  })
})