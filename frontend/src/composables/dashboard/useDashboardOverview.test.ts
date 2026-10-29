import { describe, it, expect } from 'vitest'
import { compareDelta, formatWait, formatWaitText } from './useDashboardOverview'

describe('dashboard overview helpers', () => {
  it('formats waits in seconds, minutes and hours', () => {
    expect(formatWait(45)).toEqual({ value: '45', unit: '秒' })
    expect(formatWait(2520)).toEqual({ value: '42', unit: '分' })
    expect(formatWaitText(3 * 3600 + 5 * 60)).toBe('3 小時 5 分')
  })

  it('compares today with yesterday at the same time', () => {
    expect(compareDelta(0, 0)).toBeNull()
    expect(compareDelta(5, 0)).toEqual({ text: '+5', direction: 'up' })
    expect(compareDelta(248, 219)).toEqual({ text: '+13%', direction: 'up' })
    expect(compareDelta(10, 10)).toEqual({ text: '持平', direction: 'flat' })
    expect(compareDelta(5, 10)?.direction).toBe('down')
  })
})
