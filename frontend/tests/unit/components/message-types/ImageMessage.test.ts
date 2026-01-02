import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ImageMessage from '@/components/conversation/message-types/ImageMessage.vue'
import type { Message } from '@/types'

describe('ImageMessage Component', () => {
  const createMessage = (): Message => ({
    id: 'test-1',
    conversationId: 'conv-1',
    content: '',
    messageType: 'image',
    senderType: 'customer',
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    metadata: null
  })

  it('renders successfully', () => {
    const wrapper = mount(ImageMessage, {
      props: {
        message: createMessage(),
        imageUrl: 'test.jpg'
      }
    })
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('displays image-message container', () => {
    const wrapper = mount(ImageMessage, {
      props: {
        message: createMessage(),
        imageUrl: 'test.jpg'
      }
    })
    expect(wrapper.find('.image-message').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows loading state', () => {
    const wrapper = mount(ImageMessage, {
      props: {
        message: createMessage(),
        imageUrl: 'test.jpg'
      }
    })
    expect(wrapper.find('.loading-spinner').exists()).toBe(true)
    wrapper.unmount()
  })

  it('displays caption when provided', () => {
    const wrapper = mount(ImageMessage, {
      props: {
        message: createMessage(),
        imageUrl: 'test.jpg',
        caption: 'My caption'
      }
    })
    const caption = wrapper.find('.image-caption')
    expect(caption.exists()).toBe(true)
    expect(caption.text()).toBe('My caption')
    wrapper.unmount()
  })

  it('hides caption when empty', () => {
    const wrapper = mount(ImageMessage, {
      props: {
        message: createMessage(),
        imageUrl: 'test.jpg',
        caption: ''
      }
    })
    expect(wrapper.find('.image-caption').exists()).toBe(false)
    wrapper.unmount()
  })

  it('accepts isOutgoing prop', () => {
    const wrapper = mount(ImageMessage, {
      props: {
        message: createMessage(),
        imageUrl: 'test.jpg',
        isOutgoing: true
      }
    })
    expect(wrapper.props('isOutgoing')).toBe(true)
    wrapper.unmount()
  })
})
