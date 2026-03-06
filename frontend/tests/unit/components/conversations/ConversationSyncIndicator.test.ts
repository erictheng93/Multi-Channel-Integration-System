/**
 * ConversationSyncIndicator.vue Unit Tests
 *
 * Tests:
 * - Visibility controlled by 'visible' prop
 * - Renders sync message text
 * - Accessibility attributes (role, aria-live, aria-label)
 * - Progress dots rendering
 * - SVG icon rendering
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConversationSyncIndicator from '@/components/conversations/ConversationSyncIndicator.vue'

function mountIndicator(visible: boolean) {
  return mount(ConversationSyncIndicator, {
    props: { visible }
  })
}

describe('ConversationSyncIndicator.vue', () => {
  describe('Visibility', () => {
    it('should render when visible is true', () => {
      const wrapper = mountIndicator(true)
      expect(wrapper.find('.updating-indicator').exists()).toBe(true)
    })

    it('should not render when visible is false', () => {
      const wrapper = mountIndicator(false)
      expect(wrapper.find('.updating-indicator').exists()).toBe(false)
    })
  })

  describe('Sync message text', () => {
    it('should display primary sync text', () => {
      const wrapper = mountIndicator(true)
      expect(wrapper.find('.sync-primary-text').text()).toBe('正在同步最新對話')
    })

    it('should display secondary sync text', () => {
      const wrapper = mountIndicator(true)
      expect(wrapper.find('.sync-secondary-text').text()).toBe('獲取最新消息中...')
    })
  })

  describe('Accessibility', () => {
    it('should have role="status" on message container', () => {
      const wrapper = mountIndicator(true)
      const container = wrapper.find('.sync-message-container')
      expect(container.attributes('role')).toBe('status')
    })

    it('should have aria-live="polite"', () => {
      const wrapper = mountIndicator(true)
      const container = wrapper.find('.sync-message-container')
      expect(container.attributes('aria-live')).toBe('polite')
    })

    it('should have aria-label for screen readers', () => {
      const wrapper = mountIndicator(true)
      const container = wrapper.find('.sync-message-container')
      expect(container.attributes('aria-label')).toBe('正在同步最新對話')
    })

    it('should mark decorative elements as aria-hidden', () => {
      const wrapper = mountIndicator(true)
      const icon = wrapper.find('.sync-icon')
      expect(icon.attributes('aria-hidden')).toBe('true')

      const dots = wrapper.find('.sync-progress-dots')
      expect(dots.attributes('aria-hidden')).toBe('true')

      const svg = wrapper.find('.sync-svg')
      expect(svg.attributes('aria-hidden')).toBe('true')
    })
  })

  describe('Structure', () => {
    it('should render SVG sync icon', () => {
      const wrapper = mountIndicator(true)
      expect(wrapper.find('.sync-icon').exists()).toBe(true)
      expect(wrapper.find('.sync-svg').exists()).toBe(true)
      expect(wrapper.find('.sync-path').exists()).toBe(true)
    })

    it('should render three progress dots', () => {
      const wrapper = mountIndicator(true)
      const dots = wrapper.findAll('.dot')
      expect(dots).toHaveLength(3)
      expect(dots[0].classes()).toContain('dot-1')
      expect(dots[1].classes()).toContain('dot-2')
      expect(dots[2].classes()).toContain('dot-3')
    })

    it('should have updating-content wrapper', () => {
      const wrapper = mountIndicator(true)
      expect(wrapper.find('.updating-content').exists()).toBe(true)
    })

    it('should have sync-text-content wrapper', () => {
      const wrapper = mountIndicator(true)
      expect(wrapper.find('.sync-text-content').exists()).toBe(true)
    })
  })

  describe('Reactivity', () => {
    it('should show/hide when visible prop changes', async () => {
      const wrapper = mountIndicator(false)
      expect(wrapper.find('.updating-indicator').exists()).toBe(false)

      await wrapper.setProps({ visible: true })
      expect(wrapper.find('.updating-indicator').exists()).toBe(true)

      await wrapper.setProps({ visible: false })
      expect(wrapper.find('.updating-indicator').exists()).toBe(false)
    })
  })
})
