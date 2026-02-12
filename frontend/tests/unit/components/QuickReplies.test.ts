import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuickReplies from '@/components/conversation/QuickReplies.vue'
import type { QuickReply } from '@/components/conversation/QuickReplies.vue'

describe('QuickReplies', () => {
  const mockReplies: QuickReply[] = [
    { id: '1', text: 'Reply 1' },
    { id: '2', text: 'Reply 2' },
    { id: '3', text: 'Reply 3' },
  ]

  describe('Rendering', () => {
    it('should not render when replies array is empty', () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: [],
        },
      })

      expect(wrapper.find('.quick-replies').exists()).toBe(false)
    })

    it('should render when replies array has items', () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      expect(wrapper.find('.quick-replies').exists()).toBe(true)
    })

    it('should render correct number of buttons', () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      const buttons = wrapper.findAll('.quick-reply-btn')
      expect(buttons).toHaveLength(3)
    })

    it('should render button text correctly', () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      const buttons = wrapper.findAll('.quick-reply-btn')
      expect(buttons[0].text()).toBe('Reply 1')
      expect(buttons[1].text()).toBe('Reply 2')
      expect(buttons[2].text()).toBe('Reply 3')
    })

    it('should render single reply', () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: [{ id: '1', text: 'Single Reply' }],
        },
      })

      const buttons = wrapper.findAll('.quick-reply-btn')
      expect(buttons).toHaveLength(1)
      expect(buttons[0].text()).toBe('Single Reply')
    })

    it('should render many replies', () => {
      const manyReplies = Array.from({ length: 20 }, (_, i) => ({
        id: `${i + 1}`,
        text: `Reply ${i + 1}`,
      }))

      const wrapper = mount(QuickReplies, {
        props: {
          replies: manyReplies,
        },
      })

      const buttons = wrapper.findAll('.quick-reply-btn')
      expect(buttons).toHaveLength(20)
    })
  })

  describe('Disabled state', () => {
    it('should not disable buttons by default', () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      const buttons = wrapper.findAll('.quick-reply-btn')
      buttons.forEach(button => {
        expect(button.attributes('disabled')).toBeUndefined()
      })
    })

    it('should disable all buttons when disabled prop is true', () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
          disabled: true,
        },
      })

      const buttons = wrapper.findAll('.quick-reply-btn')
      buttons.forEach(button => {
        expect(button.attributes('disabled')).toBeDefined()
      })
    })

    it('should enable buttons when disabled changes to false', async () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
          disabled: true,
        },
      })

      let buttons = wrapper.findAll('.quick-reply-btn')
      buttons.forEach(button => {
        expect(button.attributes('disabled')).toBeDefined()
      })

      await wrapper.setProps({ disabled: false })

      buttons = wrapper.findAll('.quick-reply-btn')
      buttons.forEach(button => {
        expect(button.attributes('disabled')).toBeUndefined()
      })
    })
  })

  describe('Events', () => {
    it('should emit select event when button is clicked', async () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      await wrapper.findAll('.quick-reply-btn')[0].trigger('click')

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')).toHaveLength(1)
    })

    it('should emit correct reply object when clicked', async () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      await wrapper.findAll('.quick-reply-btn')[1].trigger('click')

      const emitted = wrapper.emitted('select')
      expect(emitted).toBeTruthy()
      expect(emitted![0][0]).toEqual(mockReplies[1])
    })

    it('should emit different replies for different buttons', async () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      const buttons = wrapper.findAll('.quick-reply-btn')

      await buttons[0].trigger('click')
      await buttons[1].trigger('click')
      await buttons[2].trigger('click')

      const emitted = wrapper.emitted('select')
      expect(emitted).toHaveLength(3)
      expect(emitted![0][0]).toEqual(mockReplies[0])
      expect(emitted![1][0]).toEqual(mockReplies[1])
      expect(emitted![2][0]).toEqual(mockReplies[2])
    })

    it('should not emit event when disabled button is clicked', async () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
          disabled: true,
        },
      })

      await wrapper.findAll('.quick-reply-btn')[0].trigger('click')

      // Disabled buttons don't trigger click events in Vue
      expect(wrapper.emitted('select')).toBeFalsy()
    })
  })

  describe('Reactivity', () => {
    it('should update when replies change', async () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      expect(wrapper.findAll('.quick-reply-btn')).toHaveLength(3)

      const newReplies: QuickReply[] = [
        { id: '4', text: 'New Reply 1' },
        { id: '5', text: 'New Reply 2' },
      ]

      await wrapper.setProps({ replies: newReplies })

      const buttons = wrapper.findAll('.quick-reply-btn')
      expect(buttons).toHaveLength(2)
      expect(buttons[0].text()).toBe('New Reply 1')
      expect(buttons[1].text()).toBe('New Reply 2')
    })

    it('should hide when replies become empty', async () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      expect(wrapper.find('.quick-replies').exists()).toBe(true)

      await wrapper.setProps({ replies: [] })

      expect(wrapper.find('.quick-replies').exists()).toBe(false)
    })

    it('should show when replies are added', async () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: [],
        },
      })

      expect(wrapper.find('.quick-replies').exists()).toBe(false)

      await wrapper.setProps({ replies: mockReplies })

      expect(wrapper.find('.quick-replies').exists()).toBe(true)
    })

    it('should maintain button key stability', async () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      const initialKeys = wrapper.findAll('.quick-reply-btn').map(b => b.attributes('data-key') || b.key)

      await wrapper.setProps({ replies: [...mockReplies] })

      const updatedKeys = wrapper.findAll('.quick-reply-btn').map(b => b.attributes('data-key') || b.key)

      // Keys should remain stable for same reply IDs
      expect(initialKeys).toEqual(updatedKeys)
    })
  })

  describe('Props validation', () => {
    it('should accept replies array', () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      expect(wrapper.props('replies')).toEqual(mockReplies)
    })

    it('should accept disabled boolean', () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
          disabled: true,
        },
      })

      expect(wrapper.props('disabled')).toBe(true)
    })

    it('should default disabled to false', () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      expect(wrapper.props('disabled')).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('should handle reply with empty text', () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: [{ id: '1', text: '' }],
        },
      })

      const button = wrapper.find('.quick-reply-btn')
      expect(button.text()).toBe('')
    })

    it('should handle reply with very long text', () => {
      const longText = 'A'.repeat(500)
      const wrapper = mount(QuickReplies, {
        props: {
          replies: [{ id: '1', text: longText }],
        },
      })

      const button = wrapper.find('.quick-reply-btn')
      expect(button.text()).toBe(longText)
    })

    it('should handle reply with special characters', () => {
      const specialText = '<script>alert("xss")</script>'
      const wrapper = mount(QuickReplies, {
        props: {
          replies: [{ id: '1', text: specialText }],
        },
      })

      const button = wrapper.find('.quick-reply-btn')
      expect(button.text()).toBe(specialText)
      expect(button.html()).not.toContain('<script>')
    })

    it('should handle replies with duplicate IDs', () => {
      const duplicateReplies: QuickReply[] = [
        { id: '1', text: 'First' },
        { id: '1', text: 'Second' }, // Duplicate ID
      ]

      const wrapper = mount(QuickReplies, {
        props: {
          replies: duplicateReplies,
        },
      })

      // Component should still render both
      const buttons = wrapper.findAll('.quick-reply-btn')
      expect(buttons).toHaveLength(2)
    })

    it('should handle replies with optional properties', () => {
      const repliesWithOptional: QuickReply[] = [
        { id: '1', text: 'Reply 1', category: 'greeting' },
        { id: '2', text: 'Reply 2', enabled: true },
        { id: '3', text: 'Reply 3', category: 'farewell', enabled: false },
      ]

      const wrapper = mount(QuickReplies, {
        props: {
          replies: repliesWithOptional,
        },
      })

      // Should render all replies regardless of optional properties
      expect(wrapper.findAll('.quick-reply-btn')).toHaveLength(3)
    })
  })

  describe('Accessibility', () => {
    it('should use button elements', () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      const buttons = wrapper.findAll('.quick-reply-btn')
      buttons.forEach(button => {
        expect(button.element.tagName).toBe('BUTTON')
      })
    })

    it('should have proper button structure', () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      const buttons = wrapper.findAll('.quick-reply-btn')
      buttons.forEach((button, index) => {
        expect(button.text()).toBe(mockReplies[index].text)
      })
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete interaction workflow', async () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
          disabled: false,
        },
      })

      // User selects first reply
      await wrapper.findAll('.quick-reply-btn')[0].trigger('click')
      expect(wrapper.emitted('select')).toHaveLength(1)

      // Component becomes disabled (e.g., while processing)
      await wrapper.setProps({ disabled: true })
      expect(wrapper.findAll('.quick-reply-btn')[0].attributes('disabled')).toBeDefined()

      // Component re-enabled
      await wrapper.setProps({ disabled: false })
      expect(wrapper.findAll('.quick-reply-btn')[0].attributes('disabled')).toBeUndefined()

      // User selects different reply
      await wrapper.findAll('.quick-reply-btn')[2].trigger('click')
      expect(wrapper.emitted('select')).toHaveLength(2)
      expect(wrapper.emitted('select')![1][0]).toEqual(mockReplies[2])
    })

    it('should handle dynamic reply updates', async () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      // Initial selection
      await wrapper.findAll('.quick-reply-btn')[0].trigger('click')
      expect(wrapper.emitted('select')).toHaveLength(1)

      // Replies updated (e.g., new context)
      const newReplies: QuickReply[] = [
        { id: '4', text: 'Updated Reply 1' },
        { id: '5', text: 'Updated Reply 2' },
      ]
      await wrapper.setProps({ replies: newReplies })

      // User selects from new replies
      await wrapper.findAll('.quick-reply-btn')[0].trigger('click')
      expect(wrapper.emitted('select')).toHaveLength(2)
      expect(wrapper.emitted('select')![1][0]).toEqual(newReplies[0])
    })

    it('should handle rapid clicks', async () => {
      const wrapper = mount(QuickReplies, {
        props: {
          replies: mockReplies,
        },
      })

      const button = wrapper.findAll('.quick-reply-btn')[0]

      // Rapid clicks
      await button.trigger('click')
      await button.trigger('click')
      await button.trigger('click')

      expect(wrapper.emitted('select')).toHaveLength(3)
    })
  })
})
