import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

vi.mock('@/components/icons', () => {
  const stub = defineComponent({
    name: 'IconStub',
    props: { size: { type: Number, default: 24 } },
    setup() {
      return () => h('svg', { class: 'icon-stub' })
    },
  })
  return {
    ClockIcon: stub,
  }
})

import ActivityEmptyState from './ActivityEmptyState.vue'

function mountEmpty(props: { variant: 'loading' | 'empty' | 'error'; message?: string }) {
  return mount(ActivityEmptyState, { props })
}

describe('ActivityEmptyState', () => {
  it('shows spinner when variant is loading', () => {
    const wrapper = mountEmpty({ variant: 'loading' })
    expect(wrapper.find('.empty-state__spinner').exists()).toBe(true)
  })

  it('shows loading text when variant is loading', () => {
    const wrapper = mountEmpty({ variant: 'loading' })
    expect(wrapper.find('.empty-state__text').exists()).toBe(true)
    // Text contains loading indicator characters
    expect(wrapper.text().length).toBeGreaterThan(0)
  })

  it('shows empty icon when variant is empty', () => {
    const wrapper = mountEmpty({ variant: 'empty' })
    expect(wrapper.find('.icon-stub').exists()).toBe(true)
  })

  it('shows empty title and subtitle when variant is empty', () => {
    const wrapper = mountEmpty({ variant: 'empty' })
    expect(wrapper.find('.empty-state__title').exists()).toBe(true)
    expect(wrapper.find('.empty-state__text').exists()).toBe(true)
  })

  it('does not show spinner when variant is empty', () => {
    const wrapper = mountEmpty({ variant: 'empty' })
    expect(wrapper.find('.empty-state__spinner').exists()).toBe(false)
  })

  it('shows error message when variant is error with custom message', () => {
    const wrapper = mountEmpty({ variant: 'error', message: 'Network failure' })
    const errorText = wrapper.find('.empty-state__text--error')
    expect(errorText.exists()).toBe(true)
    expect(errorText.text()).toBe('Network failure')
  })

  it('shows default error message when variant is error without message', () => {
    const wrapper = mountEmpty({ variant: 'error' })
    const errorText = wrapper.find('.empty-state__text--error')
    expect(errorText.exists()).toBe(true)
    expect(errorText.text().length).toBeGreaterThan(0)
  })

  it('applies error class to container when variant is error', () => {
    const wrapper = mountEmpty({ variant: 'error' })
    expect(wrapper.find('.empty-state--error').exists()).toBe(true)
  })

  it('does not apply error class when variant is empty', () => {
    const wrapper = mountEmpty({ variant: 'empty' })
    expect(wrapper.find('.empty-state--error').exists()).toBe(false)
  })

  it('does not apply error class when variant is loading', () => {
    const wrapper = mountEmpty({ variant: 'loading' })
    expect(wrapper.find('.empty-state--error').exists()).toBe(false)
  })
})
