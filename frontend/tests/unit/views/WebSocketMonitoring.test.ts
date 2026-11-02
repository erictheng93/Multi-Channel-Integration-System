/**
 * WebSocketMonitoring.vue: switching the chart range must not let a slower response for the
 * previous range replace the data of the range now on screen.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import WebSocketMonitoring from '@/views/WebSocketMonitoring.vue'
import { presenceApi, type WsMetricsPointDto, type WsMetricsRange } from '@/api/presence'

vi.mock('@/components/ui/AppLayout.vue', () => ({
  default: { name: 'AppLayout', template: '<div><slot /></div>' }
}))
vi.mock('@/components/ui/UiPageHead.vue', () => ({
  default: { name: 'UiPageHead', template: '<div><slot name="actions" /></div>' }
}))
vi.mock('@/components/lead/RingLead.vue', () => ({
  default: { name: 'RingLead', template: '<div />' }
}))
vi.mock('@/api', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: {
        connections: {
          totalConnections: 1,
          activeConnections: 1,
          registeredConnections: 1,
          onlineAgents: 1,
          averageLatency: 10,
          messagesThroughput: { inbound: 0, outbound: 0 },
          windowSeconds: 60,
          errorRate: 0,
          lastUpdated: 0
        }
      }
    })
  }
}))
vi.mock('@/api/presence', () => ({ presenceApi: { getWsMetricsHistory: vi.fn() } }))

function historyOf(activeConnections: number) {
  const point = { ts: Date.now(), activeConnections } as WsMetricsPointDto
  return { success: true, data: { points: [point] } } as Awaited<ReturnType<typeof presenceApi.getWsMetricsHistory>>
}

function peakShown(wrapper: ReturnType<typeof mount>): string | undefined {
  return wrapper.findAll('.fact').find(f => f.text().includes('連線峰值'))?.find('b').text()
}

describe('WebSocketMonitoring.vue history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ignores a response for a range that was superseded while it loaded', async () => {
    type Pending = (_value: ReturnType<typeof historyOf>) => void
    const pending: Partial<Record<WsMetricsRange, Pending>> = {}
    vi.mocked(presenceApi.getWsMetricsHistory).mockImplementationOnce(async () => historyOf(1))
    vi.mocked(presenceApi.getWsMetricsHistory).mockImplementation(
      (range: WsMetricsRange) => new Promise((resolve) => { pending[range] = resolve })
    )

    const wrapper = mount(WebSocketMonitoring)
    await flushPromises()

    const rangeButton = (label: string) => {
      const button = wrapper.findAll('button').find(b => b.text() === label)
      if (!button) { throw new Error(`no range button ${label}`) }
      return button
    }
    await rangeButton('7 天').trigger('click')
    await rangeButton('6 小時').trigger('click')

    pending['6h']?.(historyOf(5))
    await flushPromises()
    expect(peakShown(wrapper)).toBe('5')

    pending['7d']?.(historyOf(999))
    await flushPromises()
    expect(peakShown(wrapper)).toBe('5')

    wrapper.unmount()
  })
})
