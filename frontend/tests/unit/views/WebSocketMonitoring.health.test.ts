/**
 * WebSocketMonitoring.vue: service status must come from the admin-only /websocket/health-detail.
 * /websocket/health is a liveness probe that always answers "healthy", so reading it meant the
 * degraded alert could never fire. /health-detail wakes every Durable Object, so it runs at most
 * once a minute even though metrics refresh every 15 s.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import WebSocketMonitoring from '@/views/WebSocketMonitoring.vue'
import { apiClient } from '@/api'

vi.mock('@/components/ui/AppLayout.vue', () => ({ default: { name: 'AppLayout', template: '<div><slot /></div>' } }))
vi.mock('@/components/ui/UiPageHead.vue', () => ({ default: { name: 'UiPageHead', template: '<div><slot name="actions" /></div>' } }))
vi.mock('@/components/lead/RingLead.vue', () => ({ default: { name: 'RingLead', template: '<div />' } }))
vi.mock('@/api', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('@/api/presence', () => ({
  presenceApi: { getWsMetricsHistory: vi.fn().mockResolvedValue({ success: true, data: { points: [] } }) }
}))

const connections = {
  totalConnections: 1, activeConnections: 1, registeredConnections: 1, onlineAgents: 1, averageLatency: 10,
  messagesThroughput: { inbound: 0, outbound: 0 }, windowSeconds: 60, errorRate: 0, lastUpdated: 0
}

function serve(overall: string) {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/websocket/metrics') { return { data: { connections } } }
    if (url === '/websocket/health-detail') { return { status: 'ok', data: { overall: { status: overall } } } }
    if (url === '/websocket/health') { return { status: 'healthy' } }
    throw new Error(`unexpected ${url}`)
  })
}
const calls = (url: string) => vi.mocked(apiClient.get).mock.calls.filter(c => c[0] === url).length

describe('WebSocketMonitoring.vue service health', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('raises the degraded alert from /health-detail', async () => {
    serve('degraded')
    const wrapper = mount(WebSocketMonitoring)
    await flushPromises()
    expect(calls('/websocket/health-detail')).toBe(1)
    expect(wrapper.text()).toContain('服務降級')
  })

  it('reports an unhealthy service too', async () => {
    serve('unhealthy')
    const wrapper = mount(WebSocketMonitoring)
    await flushPromises()
    expect(wrapper.text()).toContain('服務異常')
  })

  it('probes /health-detail at most once a minute while metrics keep refreshing', async () => {
    serve('healthy')
    const wrapper = mount(WebSocketMonitoring)
    await flushPromises()
    const refresh = wrapper.findAll('button').find(b => b.text().includes('重新整理'))
    await refresh!.trigger('click')
    await flushPromises()
    expect(calls('/websocket/metrics')).toBe(2)
    expect(calls('/websocket/health-detail')).toBe(1)
    expect(calls('/websocket/health')).toBe(0)
  })

  it('keeps the previous verdict and retries next poll when the client resolves a failure shape', async () => {
    let failing = false
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/websocket/metrics') { return { data: { connections } } }
      if (failing) { return { success: false, error: 'boom', status: 500 } }
      return { status: 'ok', data: { overall: { status: 'degraded' } } }
    })
    const wrapper = mount(WebSocketMonitoring)
    await flushPromises()
    expect(wrapper.text()).toContain('服務降級')
    // Force the next probe to be due, then fail it
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 61_000)
    failing = true
    const refresh = wrapper.findAll('button').find(b => b.text().includes('重新整理'))
    await refresh!.trigger('click')
    await flushPromises()
    expect(calls('/websocket/health-detail')).toBe(2)
    expect(wrapper.text()).toContain('服務降級')
    // Failure did not consume the interval: the very next refresh probes again
    await refresh!.trigger('click')
    await flushPromises()
    expect(calls('/websocket/health-detail')).toBe(3)
    vi.useRealTimers()
  })

  it('does not launch a second probe while one is in flight', async () => {
    let release: (_v: unknown) => void = () => {}
    const slow = new Promise(r => { release = r })
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/websocket/metrics') { return { data: { connections } } }
      return slow
    })
    const wrapper = mount(WebSocketMonitoring)
    await flushPromises()
    const refresh = wrapper.findAll('button').find(b => b.text().includes('重新整理'))
    await refresh!.trigger('click')
    await flushPromises()
    expect(calls('/websocket/health-detail')).toBe(1)
    release({ status: 'ok', data: { overall: { status: 'healthy' } } })
    await flushPromises()
  })

  it('updates the service alert when the verdict escalates from degraded to unhealthy', async () => {
    let overall = 'degraded'
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/websocket/metrics') { return { data: { connections } } }
      return { status: 'ok', data: { overall: { status: overall } } }
    })
    const wrapper = mount(WebSocketMonitoring)
    await flushPromises()
    expect(wrapper.text()).toContain('WebSocket 服務處於降級狀態')
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 61_000)
    overall = 'unhealthy'
    const refresh = wrapper.findAll('button').find(b => b.text().includes('重新整理'))
    await refresh!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('WebSocket 服務處於異常狀態')
    expect(wrapper.text()).not.toContain('WebSocket 服務處於降級狀態')
    vi.useRealTimers()
  })

  it('keeps showing metrics when the health probe fails', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/websocket/metrics') { return { data: { connections } } }
      throw new Error('health-detail 500')
    })
    const wrapper = mount(WebSocketMonitoring)
    await flushPromises()
    expect(wrapper.text()).not.toContain('無法載入監控資料')
  })
})
