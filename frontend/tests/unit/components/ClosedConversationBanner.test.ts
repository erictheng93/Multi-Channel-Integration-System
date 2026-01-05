import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ClosedConversationBanner from '@/components/conversation/ClosedConversationBanner.vue'

describe('ClosedConversationBanner', () => {
  describe('Rendering', () => {
    it('should not render when isVisible is false', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: false,
        },
      })

      expect(wrapper.find('.closed-conversation-banner').exists()).toBe(false)
    })

    it('should render when isVisible is true', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
        },
      })

      expect(wrapper.find('.closed-conversation-banner').exists()).toBe(true)
    })

    it('should render with default title and message', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
        },
      })

      expect(wrapper.find('.banner-text strong').text()).toBe('此對話已關閉')
      expect(wrapper.find('.banner-hint').text()).toBe('對話已結束，無法發送訊息')
    })

    it('should render with custom title', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          title: 'Custom Closed Title',
        },
      })

      expect(wrapper.find('.banner-text strong').text()).toBe('Custom Closed Title')
    })

    it('should render with custom message', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          message: 'Custom message text',
        },
      })

      expect(wrapper.find('.banner-hint').text()).toBe('Custom message text')
    })

    it('should render default reopen button text', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
        },
      })

      expect(wrapper.find('.reopen-btn span').text()).toBe('重新打開對話')
    })

    it('should render custom reopen button text', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          reopenButtonText: 'Reopen Chat',
        },
      })

      expect(wrapper.find('.reopen-btn span').text()).toBe('Reopen Chat')
    })
  })

  describe('Loading state', () => {
    it('should not show loading state when loading is false', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          loading: false,
        },
      })

      expect(wrapper.find('.loading-spinner').exists()).toBe(false)
      expect(wrapper.find('.reopen-btn svg').exists()).toBe(true)
      expect(wrapper.find('.reopen-btn span').text()).toBe('重新打開對話')
    })

    it('should show loading state when loading is true', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          loading: true,
        },
      })

      expect(wrapper.find('.loading-spinner').exists()).toBe(true)
      expect(wrapper.find('.reopen-btn svg').exists()).toBe(false)
      expect(wrapper.find('.reopen-btn').text()).toContain('處理中...')
    })

    it('should show custom loading text', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          loading: true,
          reopenLoadingText: 'Please wait...',
        },
      })

      expect(wrapper.find('.reopen-btn').text()).toContain('Please wait...')
    })

    it('should disable button when loading', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          loading: true,
        },
      })

      expect(wrapper.find('.reopen-btn').attributes('disabled')).toBeDefined()
    })

    it('should not disable button when not loading', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          loading: false,
        },
      })

      expect(wrapper.find('.reopen-btn').attributes('disabled')).toBeUndefined()
    })
  })

  describe('Structure', () => {
    it('should have correct DOM structure', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
        },
      })

      expect(wrapper.find('.closed-conversation-banner').exists()).toBe(true)
      expect(wrapper.find('.banner-content').exists()).toBe(true)
      expect(wrapper.find('.banner-icon').exists()).toBe(true)
      expect(wrapper.find('.banner-text').exists()).toBe(true)
      expect(wrapper.find('.reopen-btn').exists()).toBe(true)
    })

    it('should contain SVG icon', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
        },
      })

      expect(wrapper.find('.banner-icon svg').exists()).toBe(true)
    })
  })

  describe('Events', () => {
    it('should emit reopen event when button is clicked', async () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
        },
      })

      await wrapper.find('.reopen-btn').trigger('click')

      expect(wrapper.emitted('reopen')).toBeTruthy()
      expect(wrapper.emitted('reopen')).toHaveLength(1)
    })

    it('should not emit reopen event when loading', async () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          loading: true,
        },
      })

      await wrapper.find('.reopen-btn').trigger('click')

      // The component should prevent the event when loading
      // But the native disabled attribute prevents the click, so event won't be emitted
      expect(wrapper.emitted('reopen')).toBeFalsy()
    })

    it('should emit multiple reopen events on multiple clicks', async () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
        },
      })

      await wrapper.find('.reopen-btn').trigger('click')
      await wrapper.find('.reopen-btn').trigger('click')
      await wrapper.find('.reopen-btn').trigger('click')

      expect(wrapper.emitted('reopen')).toHaveLength(3)
    })
  })

  describe('Reactivity', () => {
    it('should show banner when isVisible changes from false to true', async () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: false,
        },
      })

      expect(wrapper.find('.closed-conversation-banner').exists()).toBe(false)

      await wrapper.setProps({ isVisible: true })

      expect(wrapper.find('.closed-conversation-banner').exists()).toBe(true)
    })

    it('should hide banner when isVisible changes from true to false', async () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
        },
      })

      expect(wrapper.find('.closed-conversation-banner').exists()).toBe(true)

      await wrapper.setProps({ isVisible: false })

      expect(wrapper.find('.closed-conversation-banner').exists()).toBe(false)
    })

    it('should update title reactively', async () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          title: 'Initial Title',
        },
      })

      expect(wrapper.find('.banner-text strong').text()).toBe('Initial Title')

      await wrapper.setProps({ title: 'Updated Title' })

      expect(wrapper.find('.banner-text strong').text()).toBe('Updated Title')
    })

    it('should update message reactively', async () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          message: 'Initial Message',
        },
      })

      expect(wrapper.find('.banner-hint').text()).toBe('Initial Message')

      await wrapper.setProps({ message: 'Updated Message' })

      expect(wrapper.find('.banner-hint').text()).toBe('Updated Message')
    })

    it('should toggle loading state reactively', async () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          loading: false,
        },
      })

      expect(wrapper.find('.loading-spinner').exists()).toBe(false)

      await wrapper.setProps({ loading: true })

      expect(wrapper.find('.loading-spinner').exists()).toBe(true)

      await wrapper.setProps({ loading: false })

      expect(wrapper.find('.loading-spinner').exists()).toBe(false)
    })
  })

  describe('Props validation', () => {
    it('should accept all prop types correctly', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          loading: false,
          title: 'Test Title',
          message: 'Test Message',
          reopenButtonText: 'Test Button',
          reopenLoadingText: 'Test Loading',
        },
      })

      expect(wrapper.props('isVisible')).toBe(true)
      expect(wrapper.props('loading')).toBe(false)
      expect(wrapper.props('title')).toBe('Test Title')
      expect(wrapper.props('message')).toBe('Test Message')
      expect(wrapper.props('reopenButtonText')).toBe('Test Button')
      expect(wrapper.props('reopenLoadingText')).toBe('Test Loading')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty title', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          title: '',
        },
      })

      expect(wrapper.find('.banner-text strong').text()).toBe('')
    })

    it('should handle empty message', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          message: '',
        },
      })

      expect(wrapper.find('.banner-hint').text()).toBe('')
    })

    it('should handle rapid loading toggles', async () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          loading: false,
        },
      })

      await wrapper.setProps({ loading: true })
      await wrapper.setProps({ loading: false })
      await wrapper.setProps({ loading: true })
      await wrapper.setProps({ loading: false })

      expect(wrapper.find('.loading-spinner').exists()).toBe(false)
      expect(wrapper.find('.reopen-btn svg').exists()).toBe(true)
    })

    it('should handle special characters in text', () => {
      const specialText = '<script>alert("xss")</script>'
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          title: specialText,
          message: specialText,
        },
      })

      expect(wrapper.find('.banner-text strong').text()).toBe(specialText)
      expect(wrapper.find('.banner-hint').text()).toBe(specialText)
      expect(wrapper.find('.banner-text strong').html()).not.toContain('<script>')
      expect(wrapper.find('.banner-hint').html()).not.toContain('<script>')
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete reopen workflow', async () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          loading: false,
        },
      })

      // Click reopen button
      await wrapper.find('.reopen-btn').trigger('click')
      expect(wrapper.emitted('reopen')).toHaveLength(1)

      // Simulate loading state
      await wrapper.setProps({ loading: true })
      expect(wrapper.find('.loading-spinner').exists()).toBe(true)

      // Simulate completion
      await wrapper.setProps({ loading: false, isVisible: false })
      expect(wrapper.find('.closed-conversation-banner').exists()).toBe(false)
    })

    it('should maintain state during visibility changes', async () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          title: 'Persistent Title',
          message: 'Persistent Message',
        },
      })

      await wrapper.setProps({ isVisible: false })
      await wrapper.setProps({ isVisible: true })

      expect(wrapper.find('.banner-text strong').text()).toBe('Persistent Title')
      expect(wrapper.find('.banner-hint').text()).toBe('Persistent Message')
    })
  })

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
        },
      })

      const button = wrapper.find('.reopen-btn')
      expect(button.exists()).toBe(true)
      expect(button.element.tagName).toBe('BUTTON')
    })

    it('should have icon for visual feedback', () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
        },
      })

      const icon = wrapper.find('.banner-icon svg')
      expect(icon.exists()).toBe(true)
    })

    it('should have proper button states', async () => {
      const wrapper = mount(ClosedConversationBanner, {
        props: {
          isVisible: true,
          loading: false,
        },
      })

      const button = wrapper.find('.reopen-btn')
      expect(button.attributes('disabled')).toBeUndefined()

      await wrapper.setProps({ loading: true })
      expect(button.attributes('disabled')).toBeDefined()
    })
  })
})
