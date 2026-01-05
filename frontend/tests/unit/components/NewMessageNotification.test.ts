import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NewMessageNotification from '@/components/conversation/NewMessageNotification.vue'

describe('NewMessageNotification', () => {
  describe('Rendering', () => {
    it('should not render when isVisible is false', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: false,
          count: 5,
        },
      })

      expect(wrapper.find('.glassmorphism-notification').exists()).toBe(false)
    })

    it('should not render when count is 0 even if visible', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 0,
        },
      })

      expect(wrapper.find('.glassmorphism-notification').exists()).toBe(false)
    })

    it('should render when isVisible is true and count > 0', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
        },
      })

      expect(wrapper.find('.glassmorphism-notification').exists()).toBe(true)
    })

    it('should display correct message count', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 10,
        },
      })

      expect(wrapper.find('.message-count').text()).toBe('10')
    })

    it('should display default label', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
        },
      })

      expect(wrapper.find('.message-label').text()).toBe('新消息')
    })

    it('should display custom label', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
          label: 'New Messages',
        },
      })

      expect(wrapper.find('.message-label').text()).toBe('New Messages')
    })
  })

  describe('Realtime status', () => {
    it('should not show realtime badge when isRealtime is false', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
          isRealtime: false,
        },
      })

      expect(wrapper.find('.delivery-status').exists()).toBe(false)
    })

    it('should show realtime badge when isRealtime is true', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
          isRealtime: true,
        },
      })

      expect(wrapper.find('.delivery-status').exists()).toBe(true)
    })

    it('should display default realtime label', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
          isRealtime: true,
        },
      })

      expect(wrapper.find('.delivery-status').text()).toBe('即時')
    })

    it('should display custom realtime label', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
          isRealtime: true,
          realtimeLabel: 'Live',
        },
      })

      expect(wrapper.find('.delivery-status').text()).toBe('Live')
    })
  })

  describe('Structure', () => {
    it('should have correct DOM structure', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
        },
      })

      expect(wrapper.find('.glassmorphism-notification').exists()).toBe(true)
      expect(wrapper.find('.glass-content').exists()).toBe(true)
      expect(wrapper.find('.notification-pulse').exists()).toBe(true)
      expect(wrapper.find('.glass-text').exists()).toBe(true)
      expect(wrapper.find('.glass-dismiss').exists()).toBe(true)
    })

    it('should contain notification icon', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
        },
      })

      expect(wrapper.find('.notification-pulse svg').exists()).toBe(true)
    })

    it('should contain dismiss button icon', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
        },
      })

      expect(wrapper.find('.glass-dismiss svg').exists()).toBe(true)
    })
  })

  describe('Events', () => {
    it('should emit click event when notification is clicked', async () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
        },
      })

      await wrapper.find('.glassmorphism-notification').trigger('click')

      expect(wrapper.emitted('click')).toBeTruthy()
      expect(wrapper.emitted('click')).toHaveLength(1)
    })

    it('should emit dismiss event when dismiss button is clicked', async () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
        },
      })

      await wrapper.find('.glass-dismiss').trigger('click')

      expect(wrapper.emitted('dismiss')).toBeTruthy()
      expect(wrapper.emitted('dismiss')).toHaveLength(1)
    })

    it('should not emit click event when dismiss button is clicked', async () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
        },
      })

      await wrapper.find('.glass-dismiss').trigger('click')

      // Dismiss button has @click.stop, so it shouldn't trigger the parent click
      expect(wrapper.emitted('click')).toBeFalsy()
    })

    it('should emit multiple click events on multiple clicks', async () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
        },
      })

      await wrapper.find('.glassmorphism-notification').trigger('click')
      await wrapper.find('.glassmorphism-notification').trigger('click')
      await wrapper.find('.glassmorphism-notification').trigger('click')

      expect(wrapper.emitted('click')).toHaveLength(3)
    })
  })

  describe('Reactivity', () => {
    it('should show notification when isVisible changes to true', async () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: false,
          count: 5,
        },
      })

      expect(wrapper.find('.glassmorphism-notification').exists()).toBe(false)

      await wrapper.setProps({ isVisible: true })

      expect(wrapper.find('.glassmorphism-notification').exists()).toBe(true)
    })

    it('should hide notification when isVisible changes to false', async () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
        },
      })

      expect(wrapper.find('.glassmorphism-notification').exists()).toBe(true)

      await wrapper.setProps({ isVisible: false })

      expect(wrapper.find('.glassmorphism-notification').exists()).toBe(false)
    })

    it('should update count reactively', async () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
        },
      })

      expect(wrapper.find('.message-count').text()).toBe('5')

      await wrapper.setProps({ count: 10 })

      expect(wrapper.find('.message-count').text()).toBe('10')
    })

    it('should hide when count changes to 0', async () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
        },
      })

      expect(wrapper.find('.glassmorphism-notification').exists()).toBe(true)

      await wrapper.setProps({ count: 0 })

      expect(wrapper.find('.glassmorphism-notification').exists()).toBe(false)
    })

    it('should toggle realtime badge reactively', async () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
          isRealtime: false,
        },
      })

      expect(wrapper.find('.delivery-status').exists()).toBe(false)

      await wrapper.setProps({ isRealtime: true })

      expect(wrapper.find('.delivery-status').exists()).toBe(true)

      await wrapper.setProps({ isRealtime: false })

      expect(wrapper.find('.delivery-status').exists()).toBe(false)
    })

    it('should update label reactively', async () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
          label: 'Initial Label',
        },
      })

      expect(wrapper.find('.message-label').text()).toBe('Initial Label')

      await wrapper.setProps({ label: 'Updated Label' })

      expect(wrapper.find('.message-label').text()).toBe('Updated Label')
    })
  })

  describe('Props validation', () => {
    it('should accept all prop types correctly', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
          isRealtime: true,
          label: 'Test Label',
          realtimeLabel: 'Test Realtime',
          dismissTitle: 'Test Dismiss',
        },
      })

      expect(wrapper.props('isVisible')).toBe(true)
      expect(wrapper.props('count')).toBe(5)
      expect(wrapper.props('isRealtime')).toBe(true)
      expect(wrapper.props('label')).toBe('Test Label')
      expect(wrapper.props('realtimeLabel')).toBe('Test Realtime')
      expect(wrapper.props('dismissTitle')).toBe('Test Dismiss')
    })
  })

  describe('Edge cases', () => {
    it('should handle count of 1', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 1,
        },
      })

      expect(wrapper.find('.message-count').text()).toBe('1')
    })

    it('should handle large count numbers', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 999,
        },
      })

      expect(wrapper.find('.message-count').text()).toBe('999')
    })

    it('should handle very large count numbers', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 99999,
        },
      })

      expect(wrapper.find('.message-count').text()).toBe('99999')
    })

    it('should handle negative count (edge case)', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: -5,
        },
      })

      // Component still renders with negative count (doesn't prevent it)
      // but count <= 0 should hide the notification
      expect(wrapper.find('.glassmorphism-notification').exists()).toBe(false)
    })

    it('should handle empty label', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
          label: '',
        },
      })

      expect(wrapper.find('.message-label').text()).toBe('')
    })

    it('should handle special characters in label', () => {
      const specialLabel = '<script>alert("xss")</script>'
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
          label: specialLabel,
        },
      })

      expect(wrapper.find('.message-label').text()).toBe(specialLabel)
      expect(wrapper.find('.message-label').html()).not.toContain('<script>')
    })
  })

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
        },
      })

      const notification = wrapper.find('.glassmorphism-notification')
      expect(notification.exists()).toBe(true)
    })

    it('should have dismiss button with title attribute', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
        },
      })

      const dismissBtn = wrapper.find('.glass-dismiss')
      expect(dismissBtn.attributes('title')).toBe('暫時忽略')
    })

    it('should have custom dismiss button title', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
          dismissTitle: 'Hide Notification',
        },
      })

      const dismissBtn = wrapper.find('.glass-dismiss')
      expect(dismissBtn.attributes('title')).toBe('Hide Notification')
    })

    it('should have button element for dismiss', () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
        },
      })

      const dismissBtn = wrapper.find('.glass-dismiss')
      expect(dismissBtn.element.tagName).toBe('BUTTON')
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete notification workflow', async () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: false,
          count: 0,
        },
      })

      // Initially hidden
      expect(wrapper.find('.glassmorphism-notification').exists()).toBe(false)

      // New message arrives
      await wrapper.setProps({ isVisible: true, count: 1 })
      expect(wrapper.find('.glassmorphism-notification').exists()).toBe(true)

      // More messages arrive
      await wrapper.setProps({ count: 5 })
      expect(wrapper.find('.message-count').text()).toBe('5')

      // User clicks notification
      await wrapper.find('.glassmorphism-notification').trigger('click')
      expect(wrapper.emitted('click')).toHaveLength(1)

      // Notification dismissed
      await wrapper.setProps({ isVisible: false })
      expect(wrapper.find('.glassmorphism-notification').exists()).toBe(false)
    })

    it('should handle realtime status changes', async () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 5,
          isRealtime: false,
        },
      })

      expect(wrapper.find('.delivery-status').exists()).toBe(false)

      // WebSocket connects
      await wrapper.setProps({ isRealtime: true })
      expect(wrapper.find('.delivery-status').exists()).toBe(true)
      expect(wrapper.find('.delivery-status').text()).toBe('即時')

      // WebSocket disconnects
      await wrapper.setProps({ isRealtime: false })
      expect(wrapper.find('.delivery-status').exists()).toBe(false)
    })

    it('should maintain state during rapid updates', async () => {
      const wrapper = mount(NewMessageNotification, {
        props: {
          isVisible: true,
          count: 1,
        },
      })

      // Rapid count updates
      await wrapper.setProps({ count: 2 })
      await wrapper.setProps({ count: 3 })
      await wrapper.setProps({ count: 4 })
      await wrapper.setProps({ count: 5 })

      expect(wrapper.find('.message-count').text()).toBe('5')
      expect(wrapper.find('.glassmorphism-notification').exists()).toBe(true)
    })
  })
})
