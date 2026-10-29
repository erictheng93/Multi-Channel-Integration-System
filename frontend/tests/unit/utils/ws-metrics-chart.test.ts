import { describe, it, expect } from 'vitest'
import type { WsMetricsPointDto } from '@shared/api-contracts'
import { CHART, buildSeries, niceMax, xFor, yFor, yTicks } from '@/utils/ws-metrics-chart'

function point(ts: number, active: number, eventsIn: number | null): WsMetricsPointDto {
  return {
    ts,
    activeConnections: active,
    onlineAgents: 1,
    eventsInPerS: eventsIn,
    eventsOutPerS: eventsIn,
    avgProcessingMs: null,
    errorRate: null
  }
}

describe('ws-metrics-chart', () => {
  it('rounds the axis maximum up to 1/2/5 steps', () => {
    expect(niceMax(0)).toBe(1)
    expect(niceMax(3.1)).toBe(5)
    expect(niceMax(38)).toBe(50)
    expect(niceMax(61)).toBe(100)
  })

  it('maps time and value onto the plot box', () => {
    expect(xFor(0, 0, 100)).toBe(CHART.left)
    expect(xFor(100, 0, 100)).toBe(CHART.right)
    expect(yFor(0, 10)).toBe(CHART.bottom)
    expect(yFor(10, 10)).toBe(CHART.top)
  })

  it('breaks the line at null values instead of drawing zero', () => {
    const points = [point(0, 10, 1), point(50, 20, null), point(100, 30, 2)]
    const series = buildSeries(points, p => p.eventsInPerS, 0, 100)
    expect(series.lines).toHaveLength(2)
    expect(series.count).toBe(2)
    expect(series.areas).toHaveLength(0)
  })

  it('reports an empty series without points', () => {
    const series = buildSeries([], p => p.activeConnections, 0, 100)
    expect(series.lines).toEqual([])
    expect(series.last).toBeNull()
  })

  it('labels ticks without rounding noise', () => {
    expect(yTicks(5).map(t => t.label)).toEqual(['0', '1.25', '2.5', '3.75', '5'])
  })
})
