import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ClosedConversationBanner from '@/components/conversation/ClosedConversationBanner.vue'

describe('ClosedConversationBanner (deprecated)', () => {
  it('should render as a no-op (never visible)', () => {
    const wrapper = mount(ClosedConversationBanner, {
      props: {
        isVisible: true,
      },
    })

    // Component is now a no-op - never renders anything visible
    expect(wrapper.find('.closed-conversation-banner').exists()).toBe(false)
  })

  it('should accept props without error', () => {
    const wrapper = mount(ClosedConversationBanner, {
      props: {
        isVisible: true,
        loading: true,
      },
    })

    expect(wrapper.exists()).toBe(true)
  })
})
