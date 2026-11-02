import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVisibleInterval } from './visibleInterval'

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('createVisibleInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setHidden(false)
  })
  afterEach(() => {
    vi.useRealTimers()
    setHidden(false)
  })

  it('ticks on the interval while visible', () => {
    const tick = vi.fn()
    const poller = createVisibleInterval(tick, 1000)
    poller.start()
    vi.advanceTimersByTime(3000)
    expect(tick).toHaveBeenCalledTimes(3)
    poller.stop()
  })

  it('clears the timer while hidden and refreshes exactly once when visible again', () => {
    const tick = vi.fn()
    const poller = createVisibleInterval(tick, 1000)
    poller.start()
    vi.advanceTimersByTime(1000)
    expect(tick).toHaveBeenCalledTimes(1)

    setHidden(true)
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(60_000)
    expect(tick).toHaveBeenCalledTimes(1)

    setHidden(false)
    expect(tick).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(1000)
    expect(tick).toHaveBeenCalledTimes(3)
    poller.stop()
  })

  it('uses onVisible instead of tick when provided, and does not start while hidden', () => {
    setHidden(true)
    const tick = vi.fn()
    const onVisible = vi.fn()
    const poller = createVisibleInterval(tick, 1000, { onVisible })
    poller.start()
    expect(vi.getTimerCount()).toBe(0)
    setHidden(false)
    expect(onVisible).toHaveBeenCalledTimes(1)
    expect(tick).not.toHaveBeenCalled()
    poller.stop()
  })

  it('stop removes the timer and the listener', () => {
    const tick = vi.fn()
    const poller = createVisibleInterval(tick, 1000)
    poller.start()
    poller.stop()
    expect(vi.getTimerCount()).toBe(0)
    setHidden(true)
    setHidden(false)
    expect(tick).not.toHaveBeenCalled()
  })
})
