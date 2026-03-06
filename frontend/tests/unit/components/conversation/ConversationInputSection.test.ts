/**
 * ConversationInputSection.vue Unit Tests
 *
 * Test coverage:
 * - Props and initial rendering
 * - Child component presence (QuickReplies, ConnectionStatusBar)
 * - Slot content (message-input slot)
 * - Typing indicator conditional rendering and text variations
 * - Event forwarding (quick-reply-select, reconnect)
 * - Edge cases (empty arrays, undefined props, many typing users)
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConversationInputSection from '@/components/conversation/ConversationInputSection.vue'

// Stub child components
const QuickRepliesStub = {
  name: 'QuickReplies',
  template: '<div class="quick-replies-stub"><slot /></div>',
  props: ['quickReplies'],
  emits: ['select']
}

const ConnectionStatusBarStub = {
  name: 'ConnectionStatusBar',
  template: '<div class="connection-status-bar-stub" />',
  props: [
    'connectionState',
    'connectionProtocol',
    'connectionQuality',
    'showProtocol',
    'showQuality',
    'autoHide'
  ],
  emits: ['reconnect']
}

// Helper to create wrapper with default props
function createWrapper(
  propsOverrides: Record<string, unknown> = {},
  slotContent?: string
) {
  const defaultProps = {
    connectionState: 'connected' as const,
    ...propsOverrides
  }

  return mount(ConversationInputSection, {
    props: defaultProps,
    global: {
      stubs: {
        QuickReplies: QuickRepliesStub,
        ConnectionStatusBar: ConnectionStatusBarStub
      }
    },
    slots: slotContent ? { 'message-input': slotContent } : undefined
  })
}

describe('ConversationInputSection.vue', () => {
  // =========================================
  // Rendering
  // =========================================
  describe('Rendering', () => {
    it('renders the root container element', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.conversation-input-section').exists()).toBe(true)
    })

    it('renders ConnectionStatusBar child component', () => {
      const wrapper = createWrapper()
      expect(wrapper.findComponent(ConnectionStatusBarStub).exists()).toBe(true)
    })

    it('renders the input-wrapper section', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.input-wrapper').exists()).toBe(true)
    })

    it('renders default placeholder when no slot content provided', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.default-input-placeholder').exists()).toBe(true)
    })

    it('renders custom slot content when message-input slot is provided', () => {
      const wrapper = createWrapper({}, '<div class="custom-input">My Input</div>')
      expect(wrapper.find('.custom-input').exists()).toBe(true)
      expect(wrapper.find('.custom-input').text()).toBe('My Input')
      // Default placeholder should not appear when slot is filled
      expect(wrapper.find('.default-input-placeholder').exists()).toBe(false)
    })
  })

  // =========================================
  // QuickReplies
  // =========================================
  describe('QuickReplies', () => {
    it('does not render QuickReplies when quickReplies is empty', () => {
      const wrapper = createWrapper({ quickReplies: [] })
      // The v-if="quickReplies.length > 0" should hide it
      expect(wrapper.findComponent(QuickRepliesStub).exists()).toBe(false)
    })

    it('does not render QuickReplies when quickReplies prop is not provided', () => {
      const wrapper = createWrapper()
      // defaults to empty array via computed
      expect(wrapper.findComponent(QuickRepliesStub).exists()).toBe(false)
    })

    it('renders QuickReplies when quickReplies has items', () => {
      const replies = [
        { text: 'Hello!' },
        { text: 'Thank you' }
      ]
      const wrapper = createWrapper({ quickReplies: replies })
      const qr = wrapper.findComponent(QuickRepliesStub)
      expect(qr.exists()).toBe(true)
    })

    it('passes quickReplies prop to QuickReplies child', () => {
      const replies = [{ text: 'Hi' }, { text: 'Bye' }]
      const wrapper = createWrapper({ quickReplies: replies })
      const qr = wrapper.findComponent(QuickRepliesStub)
      expect(qr.props('quickReplies')).toEqual(replies)
    })
  })

  // =========================================
  // ConnectionStatusBar props
  // =========================================
  describe('ConnectionStatusBar props', () => {
    it('passes connectionState to ConnectionStatusBar', () => {
      const wrapper = createWrapper({ connectionState: 'connecting' })
      const bar = wrapper.findComponent(ConnectionStatusBarStub)
      expect(bar.props('connectionState')).toBe('connecting')
    })

    it('passes optional connection props to ConnectionStatusBar', () => {
      const wrapper = createWrapper({
        connectionState: 'connected',
        connectionProtocol: 'websocket',
        connectionQuality: 'excellent',
        showProtocol: true,
        showQuality: true,
        autoHideStatus: true
      })
      const bar = wrapper.findComponent(ConnectionStatusBarStub)
      expect(bar.props('connectionState')).toBe('connected')
      expect(bar.props('connectionProtocol')).toBe('websocket')
      expect(bar.props('connectionQuality')).toBe('excellent')
      expect(bar.props('showProtocol')).toBe(true)
      expect(bar.props('showQuality')).toBe(true)
    })
  })

  // =========================================
  // Typing indicator
  // =========================================
  describe('Typing indicator', () => {
    it('does not show typing indicator when isTyping is false', () => {
      const wrapper = createWrapper({
        isTyping: false,
        typingUsers: ['User A']
      })
      expect(wrapper.find('.typing-indicator').exists()).toBe(false)
    })

    it('does not show typing indicator when isTyping is true but typingUsers is empty', () => {
      const wrapper = createWrapper({
        isTyping: true,
        typingUsers: []
      })
      expect(wrapper.find('.typing-indicator').exists()).toBe(false)
    })

    it('does not show typing indicator when isTyping is true but typingUsers is undefined', () => {
      const wrapper = createWrapper({
        isTyping: true
      })
      expect(wrapper.find('.typing-indicator').exists()).toBe(false)
    })

    it('does not show typing indicator when neither isTyping nor typingUsers provided', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.typing-indicator').exists()).toBe(false)
    })

    it('shows typing indicator when isTyping is true and typingUsers has entries', () => {
      const wrapper = createWrapper({
        isTyping: true,
        typingUsers: ['Customer A']
      })
      expect(wrapper.find('.typing-indicator').exists()).toBe(true)
    })

    it('renders three typing dots', () => {
      const wrapper = createWrapper({
        isTyping: true,
        typingUsers: ['Customer A']
      })
      const dots = wrapper.findAll('.dot')
      expect(dots.length).toBe(3)
    })

    it('displays single user typing text', () => {
      const wrapper = createWrapper({
        isTyping: true,
        typingUsers: ['Alice']
      })
      expect(wrapper.find('.typing-text').text()).toBe('Alice 正在輸入...')
    })

    it('displays two users typing text', () => {
      const wrapper = createWrapper({
        isTyping: true,
        typingUsers: ['Alice', 'Bob']
      })
      expect(wrapper.find('.typing-text').text()).toBe('Alice 和 Bob 正在輸入...')
    })

    it('displays multiple (3+) users typing text', () => {
      const wrapper = createWrapper({
        isTyping: true,
        typingUsers: ['Alice', 'Bob', 'Charlie']
      })
      expect(wrapper.find('.typing-text').text()).toBe('Alice 和其他 2 人正在輸入...')
    })

    it('displays 4+ users typing text correctly', () => {
      const wrapper = createWrapper({
        isTyping: true,
        typingUsers: ['A', 'B', 'C', 'D']
      })
      expect(wrapper.find('.typing-text').text()).toBe('A 和其他 3 人正在輸入...')
    })
  })

  // =========================================
  // Event forwarding
  // =========================================
  describe('Event forwarding', () => {
    it('emits quick-reply-select when QuickReplies emits select', async () => {
      const replies = [{ text: 'Hello' }]
      const wrapper = createWrapper({ quickReplies: replies })
      const qr = wrapper.findComponent(QuickRepliesStub)

      await qr.vm.$emit('select', replies[0])
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('quick-reply-select')).toBeTruthy()
      expect(wrapper.emitted('quick-reply-select')![0]).toEqual([replies[0]])
    })

    it('emits reconnect when ConnectionStatusBar emits reconnect', async () => {
      const wrapper = createWrapper()
      const bar = wrapper.findComponent(ConnectionStatusBarStub)

      await bar.vm.$emit('reconnect')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('reconnect')).toBeTruthy()
      expect(wrapper.emitted('reconnect')!.length).toBe(1)
    })
  })

  // =========================================
  // Edge cases
  // =========================================
  describe('Edge cases', () => {
    it('handles quickReplies switching from populated to empty', async () => {
      const wrapper = createWrapper({
        quickReplies: [{ text: 'Hi' }]
      })
      expect(wrapper.findComponent(QuickRepliesStub).exists()).toBe(true)

      await wrapper.setProps({ quickReplies: [] })
      expect(wrapper.findComponent(QuickRepliesStub).exists()).toBe(false)
    })

    it('handles typing indicator toggling on and off', async () => {
      const wrapper = createWrapper({
        isTyping: false,
        typingUsers: ['Alice']
      })
      expect(wrapper.find('.typing-indicator').exists()).toBe(false)

      await wrapper.setProps({ isTyping: true })
      expect(wrapper.find('.typing-indicator').exists()).toBe(true)

      await wrapper.setProps({ isTyping: false })
      expect(wrapper.find('.typing-indicator').exists()).toBe(false)
    })

    it('handles typingUsers changing while visible', async () => {
      const wrapper = createWrapper({
        isTyping: true,
        typingUsers: ['Alice']
      })
      expect(wrapper.find('.typing-text').text()).toBe('Alice 正在輸入...')

      await wrapper.setProps({ typingUsers: ['Alice', 'Bob'] })
      expect(wrapper.find('.typing-text').text()).toBe('Alice 和 Bob 正在輸入...')
    })

    it('handles all connection states', () => {
      const states = ['disconnected', 'connecting', 'connected', 'reconnecting', 'error'] as const
      for (const state of states) {
        const wrapper = createWrapper({ connectionState: state })
        const bar = wrapper.findComponent(ConnectionStatusBarStub)
        expect(bar.props('connectionState')).toBe(state)
      }
    })

    it('handles quickReplies with shortcut field', () => {
      const replies = [
        { text: 'Hello', shortcut: 'Ctrl+1' },
        { text: 'Thanks' }
      ]
      const wrapper = createWrapper({ quickReplies: replies })
      const qr = wrapper.findComponent(QuickRepliesStub)
      expect(qr.props('quickReplies')).toEqual(replies)
    })
  })
})
