/**
 * Interval that only exists while the tab is visible.
 *
 * Each poll is a D1 read on the backend, so a hidden tab must not keep polling. While
 * `document.hidden` the timer is cleared (not merely skipped); when the tab becomes
 * visible again `onVisible` runs once and the timer restarts. This REPLACES the
 * poller's own setInterval, it is not a second poller.
 */

export interface VisibleInterval {
  start: () => void
  stop: () => void
}

export interface VisibleIntervalOptions {
  /**
   * Runs once when the tab turns visible. Defaults to `tick`. Pass a freshness-aware
   * variant to avoid refetching data that was refreshed seconds ago.
   */
  onVisible?: () => void
}

export function createVisibleInterval(
  tick: () => void,
  intervalMs: number,
  options: VisibleIntervalOptions = {}
): VisibleInterval {
  let timer: ReturnType<typeof setInterval> | null = null
  let running = false

  const clearTimer = (): void => {
    if (timer) { clearInterval(timer); timer = null }
  }
  const armTimer = (): void => {
    if (!timer) { timer = setInterval(tick, intervalMs) }
  }

  const onVisibilityChange = (): void => {
    if (!running) { return }
    if (document.hidden) {
      clearTimer()
    } else {
      armTimer()
      ;(options.onVisible ?? tick)()
    }
  }

  return {
    start: () => {
      if (running) { return }
      running = true
      document.addEventListener('visibilitychange', onVisibilityChange)
      if (!document.hidden) { armTimer() }
    },
    stop: () => {
      running = false
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearTimer()
    }
  }
}
