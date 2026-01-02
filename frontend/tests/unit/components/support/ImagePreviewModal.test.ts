import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ImagePreviewModal from '@/components/conversation/support/ImagePreviewModal.vue'

describe('ImagePreviewModal Component', () => {
  const defaultProps = {
    show: true,
    imageUrl: 'https://example.com/image.jpg',
    imageName: 'test-image.jpg',
    imageSize: 1024000
  }

  it('renders successfully', () => {
    const wrapper = mount(ImagePreviewModal, {
      props: defaultProps
    })
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('accepts show prop', () => {
    const wrapper = mount(ImagePreviewModal, {
      props: defaultProps
    })
    expect(wrapper.props('show')).toBe(true)
    wrapper.unmount()
  })

  it('accepts imageUrl prop', () => {
    const wrapper = mount(ImagePreviewModal, {
      props: defaultProps
    })
    expect(wrapper.props('imageUrl')).toBe(defaultProps.imageUrl)
    wrapper.unmount()
  })

  it('accepts imageName prop', () => {
    const wrapper = mount(ImagePreviewModal, {
      props: defaultProps
    })
    expect(wrapper.props('imageName')).toBe(defaultProps.imageName)
    wrapper.unmount()
  })

  it('accepts imageSize prop', () => {
    const wrapper = mount(ImagePreviewModal, {
      props: defaultProps
    })
    expect(wrapper.props('imageSize')).toBe(defaultProps.imageSize)
    wrapper.unmount()
  })

  it('uses default empty string for imageName when not provided', () => {
    const wrapper = mount(ImagePreviewModal, {
      props: {
        show: true,
        imageUrl: 'https://example.com/image.jpg'
      }
    })
    expect(wrapper.props('imageName')).toBe('')
    wrapper.unmount()
  })

  it('uses default 0 for imageSize when not provided', () => {
    const wrapper = mount(ImagePreviewModal, {
      props: {
        show: true,
        imageUrl: 'https://example.com/image.jpg'
      }
    })
    expect(wrapper.props('imageSize')).toBe(0)
    wrapper.unmount()
  })

  it('handles show prop being false', () => {
    const wrapper = mount(ImagePreviewModal, {
      props: {
        ...defaultProps,
        show: false
      }
    })
    expect(wrapper.props('show')).toBe(false)
    wrapper.unmount()
  })
})
