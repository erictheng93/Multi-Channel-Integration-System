import { describe, it, expect } from 'vitest'
import { squarify } from './treemap'

describe('squarify', () => {
  it('fills the box exactly with tiles proportional to their values', () => {
    const items = [34, 28, 22, 21, 19, 17, 16, 14, 12, 8, 6].map((value, i) => ({ id: i, value }))
    const rects = squarify(items, 640, 240)
    expect(rects).toHaveLength(items.length)
    const area = rects.reduce((n, r) => n + r.w * r.h, 0)
    expect(area).toBeCloseTo(640 * 240, 3)
    const total = items.reduce((n, i) => n + i.value, 0)
    for (const r of rects) {
      const value = items[r.id as number]?.value ?? 0
      expect((r.w * r.h) / (640 * 240)).toBeCloseTo(value / total, 6)
      expect(r.x).toBeGreaterThanOrEqual(-1e-9)
      expect(r.y).toBeGreaterThanOrEqual(-1e-9)
      expect(r.x + r.w).toBeLessThanOrEqual(640 + 1e-6)
      expect(r.y + r.h).toBeLessThanOrEqual(240 + 1e-6)
    }
  })

  it('keeps tiles roughly square', () => {
    const items = [30, 20, 15, 10, 10, 8, 4, 3].map((value, i) => ({ id: i, value }))
    for (const r of squarify(items, 600, 300)) {
      expect(Math.max(r.w / r.h, r.h / r.w)).toBeLessThan(4)
    }
  })

  it('drops empty items and survives an empty box', () => {
    expect(squarify([{ id: 'a', value: 0 }], 100, 100)).toEqual([])
    expect(squarify([{ id: 'a', value: 5 }], 0, 100)).toEqual([])
    expect(squarify([{ id: 'a', value: 5 }], 100, 50)).toEqual([{ id: 'a', x: 0, y: 0, w: 100, h: 50 }])
  })
})
