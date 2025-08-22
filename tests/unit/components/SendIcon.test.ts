import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SendIcon from '@/components/icons/SendIcon.vue'

describe('SendIcon Component', () => {
  describe('Basic Rendering', () => {
    it('should render SVG with default props', () => {
      const wrapper = mount(SendIcon)
      const svg = wrapper.find('svg')
      
      expect(svg.exists()).toBe(true)
      expect(svg.attributes('width')).toBe('20')
      expect(svg.attributes('height')).toBe('20')
      expect(svg.attributes('viewBox')).toBe('0 0 24 24')
      expect(svg.attributes('fill')).toBe('none')
      expect(svg.attributes('stroke')).toBe('currentColor')
      expect(svg.attributes('stroke-width')).toBe('2')
    })

    it('should render correct path elements', () => {
      const wrapper = mount(SendIcon)
      const paths = wrapper.findAll('path')
      
      expect(paths).toHaveLength(2)
      expect(paths[0].attributes('d')).toBe('m22 2-7 20-4-9-9-4Z')
      expect(paths[1].attributes('d')).toBe('M22 2 11 13')
    })
  })

  describe('Props Handling', () => {
    it('should accept custom size as number', () => {
      const wrapper = mount(SendIcon, {
        props: { size: 24 }
      })
      const svg = wrapper.find('svg')
      
      expect(svg.attributes('width')).toBe('24')
      expect(svg.attributes('height')).toBe('24')
    })

    it('should accept custom size as string', () => {
      const wrapper = mount(SendIcon, {
        props: { size: '32' }
      })
      const svg = wrapper.find('svg')
      
      expect(svg.attributes('width')).toBe('32')
      expect(svg.attributes('height')).toBe('32')
    })

    it('should accept custom strokeWidth as number', () => {
      const wrapper = mount(SendIcon, {
        props: { strokeWidth: 3 }
      })
      const svg = wrapper.find('svg')
      
      expect(svg.attributes('stroke-width')).toBe('3')
    })

    it('should accept custom strokeWidth as string', () => {
      const wrapper = mount(SendIcon, {
        props: { strokeWidth: '1.5' }
      })
      const svg = wrapper.find('svg')
      
      expect(svg.attributes('stroke-width')).toBe('1.5')
    })

    it('should handle both size and strokeWidth props together', () => {
      const wrapper = mount(SendIcon, {
        props: { 
          size: 16,
          strokeWidth: 1
        }
      })
      const svg = wrapper.find('svg')
      
      expect(svg.attributes('width')).toBe('16')
      expect(svg.attributes('height')).toBe('16')
      expect(svg.attributes('stroke-width')).toBe('1')
    })
  })

  describe('CSS and Styling', () => {
    it('should inherit color from parent through currentColor', () => {
      const wrapper = mount(SendIcon)
      const svg = wrapper.find('svg')
      
      expect(svg.attributes('stroke')).toBe('currentColor')
    })

    it('should maintain aspect ratio with viewBox', () => {
      const wrapper = mount(SendIcon, {
        props: { size: 48 }
      })
      const svg = wrapper.find('svg')
      
      expect(svg.attributes('viewBox')).toBe('0 0 24 24')
      expect(svg.attributes('width')).toBe('48')
      expect(svg.attributes('height')).toBe('48')
    })
  })

  describe('Accessibility', () => {
    it('should be focusable when used in interactive contexts', () => {
      const wrapper = mount(SendIcon)
      const svg = wrapper.find('svg')
      
      // SVG should not have tabindex by default (handled by parent button/link)
      expect(svg.attributes('tabindex')).toBeUndefined()
    })

    it('should work with screen readers through parent context', () => {
      const wrapper = mount(SendIcon)
      const svg = wrapper.find('svg')
      
      // Icon should rely on parent for aria-label or title
      expect(svg.attributes('aria-label')).toBeUndefined()
      expect(svg.attributes('role')).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero size', () => {
      const wrapper = mount(SendIcon, {
        props: { size: 0 }
      })
      const svg = wrapper.find('svg')
      
      expect(svg.attributes('width')).toBe('0')
      expect(svg.attributes('height')).toBe('0')
    })

    it('should handle very large size', () => {
      const wrapper = mount(SendIcon, {
        props: { size: 1000 }
      })
      const svg = wrapper.find('svg')
      
      expect(svg.attributes('width')).toBe('1000')
      expect(svg.attributes('height')).toBe('1000')
    })

    it('should handle decimal strokeWidth', () => {
      const wrapper = mount(SendIcon, {
        props: { strokeWidth: 0.5 }
      })
      const svg = wrapper.find('svg')
      
      expect(svg.attributes('stroke-width')).toBe('0.5')
    })
  })

  describe('Integration with UI Components', () => {
    it('should work as button icon', () => {
      const ButtonWithIcon = {
        template: `
          <button class="send-button">
            <SendIcon :size="16" />
            Send
          </button>
        `,
        components: { SendIcon }
      }
      
      const wrapper = mount(ButtonWithIcon)
      const button = wrapper.find('button')
      const icon = wrapper.findComponent(SendIcon)
      
      expect(button.exists()).toBe(true)
      expect(icon.exists()).toBe(true)
      expect(icon.props('size')).toBe(16)
    })

    it('should maintain consistent appearance across different contexts', () => {
      const contexts = [
        { size: 16, strokeWidth: 1.5 }, // Small button
        { size: 20, strokeWidth: 2 },   // Default
        { size: 24, strokeWidth: 2 },   // Large button
      ]

      contexts.forEach(props => {
        const wrapper = mount(SendIcon, { props })
        const svg = wrapper.find('svg')
        
        expect(svg.attributes('viewBox')).toBe('0 0 24 24')
        expect(svg.attributes('fill')).toBe('none')
        expect(svg.attributes('stroke')).toBe('currentColor')
      })
    })
  })

  describe('Performance', () => {
    it('should render quickly with default props', () => {
      const start = performance.now()
      const wrapper = mount(SendIcon)
      const end = performance.now()
      
      expect(wrapper.exists()).toBe(true)
      expect(end - start).toBeLessThan(10) // Should render in less than 10ms
    })

    it('should handle multiple instances efficiently', () => {
      const MultipleIcons = {
        template: `
          <div>
            <SendIcon v-for="i in 10" :key="i" :size="20" />
          </div>
        `,
        components: { SendIcon }
      }
      
      const start = performance.now()
      const wrapper = mount(MultipleIcons)
      const end = performance.now()
      
      const icons = wrapper.findAllComponents(SendIcon)
      expect(icons).toHaveLength(10)
      expect(end - start).toBeLessThan(50) // Should render 10 icons in less than 50ms
    })
  })
})