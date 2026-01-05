import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConnectionStatusBar from '@/components/conversation/ConnectionStatusBar.vue'

describe('ConnectionStatusBar', () => {
  describe('Rendering', () => {
    it('should not render when isVisible is false', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: false,
          statusText: 'Connected',
          statusClass: 'connected',
        },
      })

      expect(wrapper.find('.connection-status-bar').exists()).toBe(false)
    })

    it('should render when isVisible is true', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
        },
      })

      expect(wrapper.find('.connection-status-bar').exists()).toBe(true)
    })

    it('should display status text correctly', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected to server',
          statusClass: 'connected',
        },
      })

      expect(wrapper.find('.status-text').text()).toBe('Connected to server')
    })

    it('should render status indicator', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
        },
      })

      expect(wrapper.find('.status-indicator').exists()).toBe(true)
      expect(wrapper.find('.status-dot').exists()).toBe(true)
    })
  })

  describe('Status classes', () => {
    it('should apply connected class', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
        },
      })

      expect(wrapper.find('.status-dot').classes()).toContain('connected')
      expect(wrapper.find('.connection-status-bar').classes()).toContain('connected')
    })

    it('should apply connecting class', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connecting...',
          statusClass: 'connecting',
        },
      })

      expect(wrapper.find('.status-dot').classes()).toContain('connecting')
      expect(wrapper.find('.connection-status-bar').classes()).toContain('connecting')
    })

    it('should apply disconnected class', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Disconnected',
          statusClass: 'disconnected',
        },
      })

      expect(wrapper.find('.status-dot').classes()).toContain('disconnected')
      expect(wrapper.find('.connection-status-bar').classes()).toContain('disconnected')
    })

    it('should apply error class', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connection Error',
          statusClass: 'error',
        },
      })

      expect(wrapper.find('.status-dot').classes()).toContain('error')
      expect(wrapper.find('.connection-status-bar').classes()).toContain('error')
    })
  })

  describe('Reconnect attempts', () => {
    it('should not show reconnect attempts when count is 0', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
          reconnectAttempts: 0,
        },
      })

      expect(wrapper.text()).not.toContain('重連次數')
    })

    it('should show reconnect attempts when count > 0', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connecting...',
          statusClass: 'connecting',
          reconnectAttempts: 3,
        },
      })

      expect(wrapper.text()).toContain('重連次數')
      expect(wrapper.text()).toContain('3')
    })

    it('should display correct reconnect count', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connecting...',
          statusClass: 'connecting',
          reconnectAttempts: 5,
        },
      })

      expect(wrapper.text()).toContain('重連次數: 5')
    })

    it('should show reconnect icon when attempts > 0', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connecting...',
          statusClass: 'connecting',
          reconnectAttempts: 1,
        },
      })

      const detailItems = wrapper.findAll('.detail-item')
      const reconnectItem = detailItems.find(item => item.text().includes('重連次數'))
      expect(reconnectItem).toBeDefined()
      expect(reconnectItem!.find('svg').exists()).toBe(true)
    })
  })

  describe('Typing users', () => {
    it('should not show typing users when count is 0', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
          typingUsers: 0,
        },
      })

      expect(wrapper.text()).not.toContain('人正在輸入')
    })

    it('should show typing users when count > 0', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
          typingUsers: 2,
        },
      })

      expect(wrapper.text()).toContain('人正在輸入')
      expect(wrapper.text()).toContain('2')
    })

    it('should display correct typing user count', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
          typingUsers: 3,
        },
      })

      expect(wrapper.text()).toContain('3 人正在輸入')
    })

    it('should show typing icon when users > 0', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
          typingUsers: 1,
        },
      })

      const detailItems = wrapper.findAll('.detail-item')
      const typingItem = detailItems.find(item => item.text().includes('人正在輸入'))
      expect(typingItem).toBeDefined()
      expect(typingItem!.find('svg').exists()).toBe(true)
    })
  })

  describe('Structure', () => {
    it('should have correct DOM structure', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
        },
      })

      expect(wrapper.find('.connection-status-bar').exists()).toBe(true)
      expect(wrapper.find('.status-content').exists()).toBe(true)
      expect(wrapper.find('.status-indicator').exists()).toBe(true)
      expect(wrapper.find('.connection-details').exists()).toBe(true)
    })

    it('should show both reconnect and typing when both > 0', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
          reconnectAttempts: 2,
          typingUsers: 3,
        },
      })

      expect(wrapper.text()).toContain('重連次數: 2')
      expect(wrapper.text()).toContain('3 人正在輸入')
    })
  })

  describe('Reactivity', () => {
    it('should show status bar when isVisible changes to true', async () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: false,
          statusText: 'Connected',
          statusClass: 'connected',
        },
      })

      expect(wrapper.find('.connection-status-bar').exists()).toBe(false)

      await wrapper.setProps({ isVisible: true })

      expect(wrapper.find('.connection-status-bar').exists()).toBe(true)
    })

    it('should hide status bar when isVisible changes to false', async () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
        },
      })

      expect(wrapper.find('.connection-status-bar').exists()).toBe(true)

      await wrapper.setProps({ isVisible: false })

      expect(wrapper.find('.connection-status-bar').exists()).toBe(false)
    })

    it('should update status text reactively', async () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
        },
      })

      expect(wrapper.find('.status-text').text()).toBe('Connected')

      await wrapper.setProps({ statusText: 'Disconnected' })

      expect(wrapper.find('.status-text').text()).toBe('Disconnected')
    })

    it('should update status class reactively', async () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
        },
      })

      expect(wrapper.find('.status-dot').classes()).toContain('connected')

      await wrapper.setProps({ statusClass: 'disconnected' })

      expect(wrapper.find('.status-dot').classes()).toContain('disconnected')
      expect(wrapper.find('.status-dot').classes()).not.toContain('connected')
    })

    it('should update reconnect attempts reactively', async () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connecting...',
          statusClass: 'connecting',
          reconnectAttempts: 0,
        },
      })

      expect(wrapper.text()).not.toContain('重連次數')

      await wrapper.setProps({ reconnectAttempts: 3 })

      expect(wrapper.text()).toContain('重連次數: 3')

      await wrapper.setProps({ reconnectAttempts: 0 })

      expect(wrapper.text()).not.toContain('重連次數')
    })

    it('should update typing users reactively', async () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
          typingUsers: 0,
        },
      })

      expect(wrapper.text()).not.toContain('人正在輸入')

      await wrapper.setProps({ typingUsers: 2 })

      expect(wrapper.text()).toContain('2 人正在輸入')

      await wrapper.setProps({ typingUsers: 0 })

      expect(wrapper.text()).not.toContain('人正在輸入')
    })
  })

  describe('Props validation', () => {
    it('should accept all prop types correctly', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Test Status',
          statusClass: 'connected',
          reconnectAttempts: 5,
          typingUsers: 3,
        },
      })

      expect(wrapper.props('isVisible')).toBe(true)
      expect(wrapper.props('statusText')).toBe('Test Status')
      expect(wrapper.props('statusClass')).toBe('connected')
      expect(wrapper.props('reconnectAttempts')).toBe(5)
      expect(wrapper.props('typingUsers')).toBe(3)
    })

    it('should default reconnectAttempts to 0', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
        },
      })

      expect(wrapper.props('reconnectAttempts')).toBe(0)
    })

    it('should default typingUsers to 0', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
        },
      })

      expect(wrapper.props('typingUsers')).toBe(0)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty status text', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: '',
          statusClass: 'connected',
        },
      })

      expect(wrapper.find('.status-text').text()).toBe('')
    })

    it('should handle very long status text', () => {
      const longText = 'A'.repeat(200)
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: longText,
          statusClass: 'connected',
        },
      })

      expect(wrapper.find('.status-text').text()).toBe(longText)
    })

    it('should handle large reconnect attempts', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connecting...',
          statusClass: 'connecting',
          reconnectAttempts: 999,
        },
      })

      expect(wrapper.text()).toContain('重連次數: 999')
    })

    it('should handle large typing user count', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
          typingUsers: 100,
        },
      })

      expect(wrapper.text()).toContain('100 人正在輸入')
    })

    it('should handle special characters in status text', () => {
      const specialText = '<script>alert("xss")</script>'
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: specialText,
          statusClass: 'connected',
        },
      })

      expect(wrapper.find('.status-text').text()).toBe(specialText)
      expect(wrapper.find('.status-text').html()).not.toContain('<script>')
    })
  })

  describe('Integration scenarios', () => {
    it('should handle connection lifecycle', async () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connecting...',
          statusClass: 'connecting',
          reconnectAttempts: 0,
        },
      })

      expect(wrapper.find('.status-dot').classes()).toContain('connecting')
      expect(wrapper.text()).toContain('Connecting...')

      // Connection fails, shows reconnect attempts
      await wrapper.setProps({
        statusClass: 'error',
        statusText: 'Connection Error',
        reconnectAttempts: 1,
      })

      expect(wrapper.find('.status-dot').classes()).toContain('error')
      expect(wrapper.text()).toContain('Connection Error')
      expect(wrapper.text()).toContain('重連次數: 1')

      // Reconnecting
      await wrapper.setProps({
        statusClass: 'connecting',
        statusText: 'Reconnecting...',
        reconnectAttempts: 2,
      })

      expect(wrapper.text()).toContain('重連次數: 2')

      // Finally connected
      await wrapper.setProps({
        statusClass: 'connected',
        statusText: 'Connected',
        reconnectAttempts: 0,
      })

      expect(wrapper.find('.status-dot').classes()).toContain('connected')
      expect(wrapper.text()).toContain('Connected')
      expect(wrapper.text()).not.toContain('重連次數')
    })

    it('should handle typing indicators', async () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
          typingUsers: 0,
        },
      })

      expect(wrapper.text()).not.toContain('人正在輸入')

      // One user starts typing
      await wrapper.setProps({ typingUsers: 1 })
      expect(wrapper.text()).toContain('1 人正在輸入')

      // More users start typing
      await wrapper.setProps({ typingUsers: 3 })
      expect(wrapper.text()).toContain('3 人正在輸入')

      // All users stop typing
      await wrapper.setProps({ typingUsers: 0 })
      expect(wrapper.text()).not.toContain('人正在輸入')
    })

    it('should handle rapid state changes', async () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
        },
      })

      await wrapper.setProps({ statusClass: 'disconnected' })
      await wrapper.setProps({ statusClass: 'connecting' })
      await wrapper.setProps({ statusClass: 'error' })
      await wrapper.setProps({ statusClass: 'connected' })

      expect(wrapper.find('.status-dot').classes()).toContain('connected')
      expect(wrapper.find('.connection-status-bar').classes()).toContain('connected')
    })
  })

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
        },
      })

      const statusBar = wrapper.find('.connection-status-bar')
      expect(statusBar.exists()).toBe(true)
    })

    it('should have visual status indicator', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
        },
      })

      const statusDot = wrapper.find('.status-dot')
      expect(statusDot.exists()).toBe(true)
    })

    it('should have icons for reconnect and typing', () => {
      const wrapper = mount(ConnectionStatusBar, {
        props: {
          isVisible: true,
          statusText: 'Connected',
          statusClass: 'connected',
          reconnectAttempts: 1,
          typingUsers: 2,
        },
      })

      const icons = wrapper.findAll('.detail-item svg')
      expect(icons.length).toBeGreaterThan(0)
    })
  })
})
