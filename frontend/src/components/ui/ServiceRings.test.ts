import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ServiceRings from './ServiceRings.vue'

const rings = [
  { label: '待回覆', value: 9, total: 23, of: '處理中' },
  { label: '今日已結案', value: 31, total: 54 },
  { label: '線上客服', value: 0, total: 4 },
  { label: '第四圈', value: 1, total: 2 },
]

describe('ServiceRings', () => {
  it('is one image whose label states every value', () => {
    const wrapper = mount(ServiceRings, { props: { rings, summary: '服務概況' } })
    const label = wrapper.attributes('aria-label') ?? ''
    expect(wrapper.attributes('role')).toBe('img')
    expect(label).toContain('服務概況')
    expect(label).toContain('待回覆 9，共 23 處理中')
    expect(label).toContain('今日已結案 31，共 54')
    expect(label).toContain('線上客服 0，共 4')
  })

  it('draws at most three rings, each with a track and an arc', () => {
    const wrapper = mount(ServiceRings, { props: { rings } })
    expect(wrapper.findAll('.sr-track')).toHaveLength(3)
    expect(wrapper.findAll('.sr-arc')).toHaveLength(3)
    expect(wrapper.text()).not.toContain('第四圈')
  })

  it('hides the arc of an empty ring so no round-cap dot is left behind', () => {
    const wrapper = mount(ServiceRings, { props: { rings } })
    const arcs = wrapper.findAll('.sr-arc')
    expect(arcs[0]?.classes()).not.toContain('is-empty')
    expect(arcs[2]?.classes()).toContain('is-empty')
  })

  it('renders the centre text only when asked', () => {
    expect(mount(ServiceRings, { props: { rings } }).find('.sr-center').exists()).toBe(false)
    const wrapper = mount(ServiceRings, { props: { rings, centerValue: '9', centerLabel: '待回覆' } })
    expect(wrapper.find('.sr-center-value').text()).toBe('9')
  })
})
