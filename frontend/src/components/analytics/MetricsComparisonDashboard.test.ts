import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MetricsComparisonDashboard from './MetricsComparisonDashboard.vue'

const subscribe = vi.fn(() => 'analytics-subscription-1')
const unsubscribe = vi.fn()
const connect = vi.fn()

type IdleCallback = (_deadline: { didTimeout: boolean; timeRemaining: () => number }) => void

vi.mock('@/stores/websocket', () => ({
  useWebSocketStore: () => ({
    subscribe,
    unsubscribe,
    connect
  })
}))

vi.mock('@/config/runtime', () => ({
  getApiUrl: (path: string) => path
}))

vi.mock('@/api/authenticatedFetch', () => ({
  authenticatedFetch: vi.fn(() => Promise.resolve(new Response(JSON.stringify({
    success: true,
    data: {
      metrics: {},
      summary: {
        totalMetrics: 0,
        improvedMetrics: 0,
        declinedMetrics: 0,
        stableMetrics: 0,
        overallTrend: 'neutral'
      }
    }
  }), { status: 200 })))
}))

describe('MetricsComparisonDashboard realtime refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: (callback: IdleCallback) => {
        callback({ didTimeout: false, timeRemaining: () => 50 })
        return 1
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test('uses WebSocket analytics subscription with interval polling fallback for auto refresh', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    const wrapper = mount(MetricsComparisonDashboard, {
      props: {
        autoRefresh: true,
        refreshInterval: 1000
      },
      global: {
        stubs: {
          MetricComparison: { template: '<div />' },
          Modal: { template: '<div><slot /></div>' }
        }
      }
    })

    expect(subscribe).toHaveBeenCalledWith('analytics', expect.any(Function))
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000)

    wrapper.unmount()

    expect(unsubscribe).toHaveBeenCalledWith('analytics-subscription-1')
    expect(clearIntervalSpy).toHaveBeenCalled()
  })
})
