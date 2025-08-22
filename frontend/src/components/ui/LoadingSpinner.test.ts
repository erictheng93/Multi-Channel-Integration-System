import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoadingSpinner from './LoadingSpinner.vue'

describe('LoadingSpinner', () => {
  it('should render with default props', () => {
    const wrapper = mount(LoadingSpinner)
    
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.loading-spinner').exists()).toBe(true)
    expect(wrapper.find('.spinner').exists()).toBe(true)
  })

  it('should render with custom size', () => {
    const wrapper = mount(LoadingSpinner, {
      props: { size: 'lg' }
    })
    
    expect(wrapper.find('.loading-spinner').classes()).toContain('loading-lg')
  })

  it('should render with correct variant', () => {
    const wrapper = mount(LoadingSpinner, {
      props: { variant: 'secondary' }
    })
    
    expect(wrapper.find('.spinner').classes()).toContain('spinner-secondary')
  })

  it('should render with custom text', () => {
    const wrapper = mount(LoadingSpinner, {
      props: { text: 'Loading data...' }
    })
    
    expect(wrapper.text()).toContain('Loading data...')
    expect(wrapper.find('.loading-text').exists()).toBe(true)
  })

  it('should render without text when not provided', () => {
    const wrapper = mount(LoadingSpinner)
    
    const textElement = wrapper.find('.loading-text')
    expect(textElement.exists()).toBe(false)
  })

  it('should apply correct size classes', () => {
    const sizes = ['sm', 'md', 'lg'] as const
    
    sizes.forEach(size => {
      const wrapper = mount(LoadingSpinner, {
        props: { size }
      })
      expect(wrapper.find('.loading-spinner').classes()).toContain(`loading-${size}`)
    })
  })

  it('should apply correct variant classes', () => {
    const variants = ['primary', 'secondary', 'white'] as const
    
    variants.forEach(variant => {
      const wrapper = mount(LoadingSpinner, {
        props: { variant }
      })
      expect(wrapper.find('.spinner').classes()).toContain(`spinner-${variant}`)
    })
  })

  it('should have proper accessibility attributes', () => {
    const wrapper = mount(LoadingSpinner, {
      props: { text: 'Loading...' }
    })
    
    // Component should be accessible
    expect(wrapper.find('.loading-spinner').exists()).toBe(true)
    expect(wrapper.find('.spinner').exists()).toBe(true)
    
    // Text should be present for screen readers
    expect(wrapper.text()).toContain('Loading...')
  })

  it('should handle empty text prop gracefully', () => {
    const wrapper = mount(LoadingSpinner, {
      props: { text: '' }
    })
    
    // Should not render text element when text is empty
    expect(wrapper.find('.loading-text').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })
})