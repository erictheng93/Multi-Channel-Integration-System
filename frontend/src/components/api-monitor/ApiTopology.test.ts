import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ApiTopology from './ApiTopology.vue'
import type { ApiEndpoint, ChannelItem, InfrastructureItem } from '@/types/api-monitor'

const channels: ChannelItem[] = [
  { id: 'line', name: 'LINE', status: 'connected', details: 'LINE API reachable', latencyMs: 62, lastCheck: '' },
  { id: 'facebook', name: 'Facebook Messenger', status: 'error', details: 'Invalid OAuth access token', latencyMs: 340, lastCheck: '' },
  { id: 'webhook-delivery', name: 'Webhook Delivery', status: 'connected', details: 'ok', latencyMs: 118, lastCheck: '' },
]
const infrastructure: InfrastructureItem[] = [
  { id: 'd1', name: 'D1 Database', status: 'healthy', latencyMs: 18, lastCheck: '' },
  { id: 'r2', name: 'R2 Storage', status: 'warning', latencyMs: 91, lastCheck: '' },
]
const ep = (id: string, endpoint: string, responseTime: number, status: ApiEndpoint['status']): ApiEndpoint => ({
  id, endpoint, method: 'GET', category: 'system', description: '', status, responseTime, avgResponseTime: 1, p50ResponseTime: 1,
  successRate: 99, requestCount: 10, errorCount: 0, statusCodes: {}, lastCheck: '',
})

function mountTopo(endpoints: ApiEndpoint[] = []) {
  return mount(ApiTopology, {
    props: { channels, infrastructure, endpoints, events: [], verdict: '部分降級', tone: 'warn', meaning: 'x', avgMs: 118 },
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

  it('draws one line stub per node on each side', () => {
    const wrapper = mountTopo()
    expect(wrapper.findAll('.gut-in i')).toHaveLength(3)
    expect(wrapper.findAll('.gut-out i')).toHaveLength(2)
  })

  it('lists the worst endpoints first with the 500 ms line when something is slower', () => {
    const wrapper = mountTopo([ep('1', '/api/a', 40, 'healthy'), ep('2', '/api/b', 1380, 'error'), ep('3', '/api/c', 612, 'warning')])
    expect(wrapper.findAll('.p95 li').map((l) => l.find('.p95-path').text())).toEqual(['/b', '/c', '/a'])
    expect(wrapper.find('.p95-note').text()).toContain('500 ms')
    expect(wrapper.find('.p95-note').text()).toContain('118 ms')
  })

  it('omits the P95 bars until endpoint metrics exist', () => {
    expect(mountTopo().find('.p95').exists()).toBe(false)
  })
})
