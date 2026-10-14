import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HistoryRetentionNotice from './HistoryRetentionNotice.vue'

function stubVisualViewport(height: number): EventTarget & { height: number; scale: number } {
  const vv = Object.assign(new EventTarget(), { height, scale: 1 })
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 812, configurable: true })
  return vv
}

describe('HistoryRetentionNotice keyboard detection', () => {
  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', { value: null, configurable: true })
  })

  it('flags keyboard-open when only the visual viewport shrinks', async () => {
    const vv = stubVisualViewport(812)
    const wrapper = mount(HistoryRetentionNotice, { props: { platform: 'line' } })
    expect(wrapper.classes()).not.toContain('is-keyboard-open')

    vv.height = 480
    vv.dispatchEvent(new Event('resize'))
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).toContain('is-keyboard-open')

    vv.height = 812
    vv.dispatchEvent(new Event('resize'))
    await wrapper.vm.$nextTick()
    expect(wrapper.classes()).not.toContain('is-keyboard-open')
  })
})
