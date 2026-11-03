import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ApiTopology from './ApiTopology.vue'
import type { ChannelItem, InfrastructureItem } from '@/types/api-monitor'

const channels: ChannelItem[] = [
  { id: 'line', name: 'LINE', status: 'connected', details: 'LINE API reachable', latencyMs: 62, lastCheck: '' },
  { id: 'facebook', name: 'Facebook Messenger', status: 'error', details: 'Invalid OAuth access token', latencyMs: 340, lastCheck: '' },
  { id: 'webhook-delivery', name: 'Webhook Delivery', status: 'connected', details: 'ok', latencyMs: 118, lastCheck: '' },
]
const infrastructure: InfrastructureItem[] = [
  { id: 'd1', name: 'D1 Database', status: 'healthy', latencyMs: 18, lastCheck: '' },
  { id: 'r2', name: 'R2 Storage', status: 'warning', latencyMs: 91, lastCheck: '' },
]
function mountTopo() {
  return mount(ApiTopology, {
    props: { channels, infrastructure, events: [], verdict: '部分降級', tone: 'warn', meaning: 'x', avgMs: 118 },
  })
}

describe('ApiTopology', () => {
  it('colours each node by its state and derives webhook delivery from the channels', () => {
    const wrapper = mountTopo()
    const nodes = wrapper.findAll('.col-in .node')
    expect(nodes.map((n) => n.classes().find((c) => c.startsWith('is-')))).toEqual(['is-good', 'is-bad', 'is-warn'])
    expect(nodes[2]?.text()).toContain('部分可用')
    const out = wrapper.findAll('.col-out .node').map((n) => n.classes())
    expect(out[0]).toContain('is-good')
    expect(out[1]).toContain('is-warn')
  })

  it('shows the verdict with its state class and one node per channel and service', () => {
    const wrapper = mountTopo()
    expect(wrapper.find('.core-verdict').classes()).toContain('is-warn')
    expect(wrapper.findAll('.col-in .node')).toHaveLength(3)
    expect(wrapper.findAll('.col-out .node')).toHaveLength(2)
  })

  it('lists the recent events with a state class and shows the average response', () => {
    const wrapper = mount(ApiTopology, {
      props: {
        channels, infrastructure, verdict: '部分降級', tone: 'warn', meaning: 'x', avgMs: 118, counts: { healthy: 3, warning: 1, error: 1 },
        events: [{ id: 'e1', type: 'error', message: 'boom', timestamp: new Date().toISOString() }],
      },
    })
    expect(wrapper.findAll('.events li')).toHaveLength(1)
    expect(wrapper.find('.events li').classes()).toContain('is-error')
    expect(wrapper.find('.mix-head').text()).toContain('118 ms')
  })

  it('omits the events block when nothing happened', () => {
    expect(mountTopo().find('.events').exists()).toBe(false)
  })
})
