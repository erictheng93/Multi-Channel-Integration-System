import { describe, expect, it } from 'vitest'
import {
  arcLength,
  innerRadius,
  ringCircumference,
  ringFraction,
  ringRadius,
  type RingLayout,
} from './service-rings-geometry'

const layout: RingLayout = { size: 160, stroke: 16, gap: 4 }

describe('ringFraction', () => {
  it('is value over total', () => {
    expect(ringFraction(9, 36)).toBeCloseTo(0.25)
  })
  it('clamps above the total to a full circle', () => {
    expect(ringFraction(50, 10)).toBe(1)
  })
  it('is 0 for an empty, negative or invalid input', () => {
    expect(ringFraction(0, 10)).toBe(0)
    expect(ringFraction(-3, 10)).toBe(0)
    expect(ringFraction(3, 0)).toBe(0)
    expect(ringFraction(Number.NaN, 10)).toBe(0)
    expect(ringFraction(3, Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('ringRadius', () => {
  it('puts the outer stroke edge on the box edge', () => {
    expect(ringRadius(0, layout) + layout.stroke / 2).toBe(layout.size / 2)
  })
  it('steps inward by stroke + gap per arc', () => {
    expect(ringRadius(0, layout) - ringRadius(1, layout)).toBe(20)
    expect(ringRadius(1, layout) - ringRadius(2, layout)).toBe(20)
  })
})

describe('arcLength', () => {
  it('is the circumference at a full circle and half at 0.5', () => {
    const r = ringRadius(0, layout)
    expect(arcLength(1, r)).toBeCloseTo(ringCircumference(r))
    expect(arcLength(0.5, r)).toBeCloseTo(ringCircumference(r) / 2)
  })
  it('clamps the fraction', () => {
    const r = ringRadius(0, layout)
    expect(arcLength(2, r)).toBeCloseTo(ringCircumference(r))
    expect(arcLength(-1, r)).toBe(0)
  })
})

describe('innerRadius', () => {
  it('leaves room inside three arcs and never goes negative', () => {
    expect(innerRadius(3, layout)).toBeGreaterThan(0)
    expect(innerRadius(3, { size: 40, stroke: 16, gap: 4 })).toBe(0)
  })
  it('is the whole radius without arcs', () => {
    expect(innerRadius(0, layout)).toBe(80)
  })
})
