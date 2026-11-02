import { describe, it, expect } from 'vitest'
import type { WsMetricsPointDto } from '@shared/api-contracts'
import { buildSpark } from '@/utils/ws-metrics-chart'

const pt = (ts: number, v: number | null): WsMetricsPointDto => ({
  ts, activeConnections: 1, onlineAgents: 1, eventsInPerS: v, eventsOutPerS: v, avgProcessingMs: v, errorRate: v
})

describe('buildSpark', () => {
  it('draws one sub-path per run of two or more samples and breaks at nulls', () => {
    const s = buildSpark([pt(0, 1), pt(10, 2), pt(20, null), pt(30, 3), pt(40, 4)], p => p.avgProcessingMs, 0, 40)
    expect(s.line.match(/M/g)).toHaveLength(2)
    expect(s.count).toBe(4)
  })

  it('draws nothing when there is no shape (a single sample or none)', () => {
    expect(buildSpark([pt(0, 1)], p => p.avgProcessingMs, 0, 40).line).toBe('')
    expect(buildSpark([], p => p.avgProcessingMs, 0, 40).line).toBe('')
  })

  it('gives a flat series a line but no filled area', () => {
    const s = buildSpark([pt(0, 5), pt(10, 5), pt(20, 5)], p => p.avgProcessingMs, 0, 20)
    expect(s.line).not.toBe('')
    expect(s.area).toBe('')
  })
})
