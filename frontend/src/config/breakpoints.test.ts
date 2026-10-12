import { describe, it, expect } from 'vitest'
import { BREAKPOINTS, isPhoneWidth, isTabletWidth } from './breakpoints'

describe('breakpoints', () => {
  it('phone boundary matches @media (max-width: 768px)', () => {
    expect(isPhoneWidth(BREAKPOINTS.md)).toBe(true)
    expect(isPhoneWidth(BREAKPOINTS.md + 1)).toBe(false)
  })

  it('tablet is the open range 769..1024 and never overlaps phone or desktop', () => {
    expect(isTabletWidth(BREAKPOINTS.md)).toBe(false)
    expect(isTabletWidth(BREAKPOINTS.md + 1)).toBe(true)
    expect(isTabletWidth(BREAKPOINTS.lg)).toBe(true)
    expect(isTabletWidth(BREAKPOINTS.lg + 1)).toBe(false)
  })

  it('scale is strictly ascending', () => {
    const v = Object.values(BREAKPOINTS)
    expect([...v].sort((a, b) => a - b)).toEqual(v)
  })
})
