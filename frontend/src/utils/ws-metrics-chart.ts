/**
 * Geometry for the WebSocket history chart. Everything is computed from the real snapshot
 * timestamps and values (x = time over the selected range, y = value on its own axis); null
 * values break the line instead of being drawn as zero.
 */

import type { WsMetricsPointDto, WsMetricsRange } from '@shared/api-contracts'

export const CHART = {
  width: 720,
  height: 300,
  left: 44,
  right: 672,
  top: 20,
  bottom: 258
} as const

export interface ChartGeometry {
  width: number
  height: number
  left: number
  right: number
  top: number
  bottom: number
}

/** Phone geometry: a taller plot (about 240px on a 360px screen) with one axis only */
export const CHART_COMPACT: ChartGeometry = {
  width: 360,
  height: 250,
  left: 34,
  right: 348,
  top: 16,
  bottom: 208
}

export const RANGE_MS: Record<WsMetricsRange, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000
}

export interface ChartTick {
  /** Pixel position along the axis */
  pos: number
  label: string
}

export interface ChartSeries {
  /** One SVG path per uninterrupted run of non-null points */
  lines: string[]
  /** Runs of exactly one point: a path would draw nothing, so each is marked with a dot instead */
  dots: Array<{ x: number; y: number }>
  /** Closed path under the line, for runs with at least two points */
  areas: string[]
  /** Last non-null point, for the end marker */
  last: { x: number; y: number } | null
  /** Axis maximum (a "nice" number) */
  max: number
  /** Number of non-null points */
  count: number
}

/** Smallest 1 / 2 / 5 x 10^n at or above the value (minimum 1). */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 1) {
    return 1
  }
  const exponent = Math.floor(Math.log10(value))
  const base = 10 ** exponent
  const fraction = value / base
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return step * base
}

export function xFor(ts: number, from: number, to: number, geom: ChartGeometry = CHART): number {
  const span = Math.max(1, to - from)
  const ratio = Math.min(1, Math.max(0, (ts - from) / span))
  return geom.left + ratio * (geom.right - geom.left)
}

export function yFor(value: number, max: number, geom: ChartGeometry = CHART): number {
  const ratio = Math.min(1, Math.max(0, value / max))
  return geom.bottom - ratio * (geom.bottom - geom.top)
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

export function buildSeries(
  points: WsMetricsPointDto[],
  pick: (_point: WsMetricsPointDto) => number | null,
  from: number,
  to: number,
  geom: ChartGeometry = CHART
): ChartSeries {
  const values = points.map(pick)
  const finite = values.filter((v): v is number => v !== null && Number.isFinite(v))
  const max = niceMax(finite.length > 0 ? Math.max(...finite) : 1)

  const runs: Array<Array<{ x: number; y: number }>> = []
  let current: Array<{ x: number; y: number }> = []
  points.forEach((point, index) => {
    const value = values[index]
    if (value === null || value === undefined || !Number.isFinite(value)) {
      if (current.length > 0) {
        runs.push(current)
        current = []
      }
      return
    }
    current.push({ x: round(xFor(point.ts, from, to, geom)), y: round(yFor(value, max, geom)) })
  })
  if (current.length > 0) {
    runs.push(current)
  }

  const lines = runs.map(run => run.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' '))
  const areas = runs
    .filter(run => run.length >= 2)
    .map((run) => {
      const first = run[0]
      const last = run[run.length - 1]
      const body = run.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
      return `${body} L${last?.x} ${geom.bottom} L${first?.x} ${geom.bottom}Z`
    })
  const dots = runs.filter(run => run.length === 1).map(run => run[0] as { x: number; y: number })
  const lastRun = runs[runs.length - 1]
  const last = lastRun ? (lastRun[lastRun.length - 1] ?? null) : null

  return { lines, dots, areas, last, max, count: finite.length }
}

/**
 * Number of gridline steps for an axis maximum from niceMax (1, 2, 5, 10, 20, 50 ...): five steps from 5 up
 * (whole-number labels for counts), otherwise as many steps as the maximum or two for a maximum of 1.
 */
export function axisSteps(max: number): number {
  if (max >= 5) {
    return 5
  }
  return max >= 2 ? max : 2
}

export function yTicks(max: number, steps = axisSteps(max), geom: ChartGeometry = CHART): ChartTick[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const value = (max / steps) * i
    return {
      pos: round(yFor(value, max, geom)),
      label: String(Number(value.toFixed(2)))
    }
  })
}

/** Evenly spaced time labels across the window; HH:mm for short ranges, M/D HH:mm for long ones. */
export function xTicks(from: number, to: number, range: WsMetricsRange, count = 5, geom: ChartGeometry = CHART): ChartTick[] {
  const formatter = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    ...(range === '7d' ? { month: 'numeric', day: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  return Array.from({ length: count }, (_, i) => {
    const ts = from + ((to - from) / (count - 1)) * i
    return { pos: round(xFor(ts, from, to, geom)), label: formatter.format(new Date(ts)) }
  })
}

/** Geometry of a KPI sparkline (no axes: the card prints the current value, the line shows the shape of the period) */
export const SPARK: ChartGeometry = { width: 200, height: 40, left: 2, right: 198, top: 4, bottom: 36 }

export interface Sparkline {
  /** One sub-path per uninterrupted run of two or more samples (gaps are never drawn as zero) */
  line: string
  area: string
  /** Number of non-null samples; two or more are needed to draw a shape */
  count: number
}

/**
 * A sparkline from real samples. The y-scale runs from zero to the series maximum (plus headroom, so a steady value sits mid-card), so a flat
 * zero line is honestly flat and a rising line is honestly rising; null samples break the line.
 */
export function buildSpark(
  points: WsMetricsPointDto[],
  pick: (_point: WsMetricsPointDto) => number | null,
  from: number,
  to: number,
  geom: ChartGeometry = SPARK
): Sparkline {
  const values = points.map(pick)
  const finite = values.filter((v): v is number => v !== null && Number.isFinite(v))
  const peak = finite.length > 0 ? Math.max(...finite) : 0
  const max = peak > 0 ? peak * 1.35 : 1
  const coords: Array<{ x: number; y: number } | null> = points.map((point, i) => {
    const value = values[i]
    return value === null || value === undefined || !Number.isFinite(value)
      ? null
      : { x: round(xFor(point.ts, from, to, geom)), y: round(yFor(value, max, geom)) }
  })
  const runs: Array<Array<{ x: number; y: number }>> = []
  let run: Array<{ x: number; y: number }> = []
  for (const c of [...coords, null]) {
    if (c) {
      run.push(c)
    } else {
      if (run.length >= 2) {
        runs.push(run)
      }
      run = []
    }
  }
  // A genuinely flat series is a thin line, never a filled slab
  const flat = finite.length > 0 && Math.min(...finite) === peak
  const path = (r: Array<{ x: number; y: number }>) => r.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
  return {
    line: runs.map(path).join(' '),
    area: flat ? '' : runs.map((r) => {
      const first = r[0]
      const last = r[r.length - 1]
      return `${path(r)} L${last?.x} ${geom.bottom} L${first?.x} ${geom.bottom}Z`
    }).join(' '),
    count: finite.length
  }
}
