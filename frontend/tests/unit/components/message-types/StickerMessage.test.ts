import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StickerMessage from '@/components/conversation/message-types/StickerMessage.vue'
import type { Message } from '@/types'

describe('StickerMessage Component', () => {
  const createMessage = (): Message => ({
    id: 'sticker-1',
    conversationId: 'conv-1',
    content: '',
    messageType: 'sticker',
    senderType: 'customer',
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    metadata: null
  })

  it('renders successfully', () => {
    const wrapper = mount(StickerMessage, {
      props: {
        message: createMessage(),
        stickerUrl: 'https://example.com/sticker.png'
      }
    })
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('displays sticker-message container', () => {
    const wrapper = mount(StickerMessage, {
      props: {
        message: createMessage(),
        stickerUrl: 'https://example.com/sticker.png'
      }
    })
    expect(wrapper.find('.sticker-message').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows loading state initially', () => {
    const wrapper = mount(StickerMessage, {
      props: {
        message: createMessage(),
        stickerUrl: 'https://example.com/sticker.png'
      }
    })
    expect(wrapper.find('.sticker-loading').exists()).toBe(true)
    expect(wrapper.find('.loading-spinner').exists()).toBe(true)
    expect(wrapper.find('.loading-text').text()).toBe('載入貼圖中...')
    wrapper.unmount()
  })

  it('passes stickerUrl prop correctly', () => {
    const testUrl = 'https://example.com/test-sticker.png'
    const wrapper = mount(StickerMessage, {
      props: {
        message: createMessage(),
        stickerUrl: testUrl
      }
    })
    expect(wrapper.props('stickerUrl')).toBe(testUrl)
    wrapper.unmount()
  })

  it('accepts fallbackText prop', () => {
    const wrapper = mount(StickerMessage, {
      props: {
        message: createMessage(),
        stickerUrl: 'https://example.com/sticker.png',
        fallbackText: 'Custom Sticker'
      }
    })
    expect(wrapper.props('fallbackText')).toBe('Custom Sticker')
    wrapper.unmount()
  })

  it('accepts stickerMetadata prop', () => {
    const metadata = {
      packageId: '11537',
      stickerId: '52002734'
    }
    const wrapper = mount(StickerMessage, {
      props: {
        message: createMessage(),
        stickerUrl: 'https://example.com/sticker.png',
        stickerMetadata: metadata
      }
    })
    expect(wrapper.props('stickerMetadata')).toEqual(metadata)
    wrapper.unmount()
  })

  it('accepts showMetadata prop', () => {
    const wrapper = mount(StickerMessage, {
      props: {
        message: createMessage(),
        stickerUrl: 'https://example.com/sticker.png',
        showMetadata: true
      }
    })
    expect(wrapper.props('showMetadata')).toBe(true)
    wrapper.unmount()
  })

  it('accepts cdnFallbackIndex prop', () => {
    const wrapper = mount(StickerMessage, {
      props: {
        message: createMessage(),
        stickerUrl: 'https://example.com/sticker.png',
        cdnFallbackIndex: 2
      }
    })
    expect(wrapper.props('cdnFallbackIndex')).toBe(2)
    wrapper.unmount()
  })

  it('accepts isOutgoing prop', () => {
    const wrapper = mount(StickerMessage, {
      props: {
        message: createMessage(),
        stickerUrl: 'https://example.com/sticker.png',
        isOutgoing: true
      }
    })
    expect(wrapper.props('isOutgoing')).toBe(true)
    wrapper.unmount()
  })
})
