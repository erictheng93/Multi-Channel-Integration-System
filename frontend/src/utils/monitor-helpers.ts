/**
 * Shared utilities for the API monitoring dashboard.
 */

/**
 * Format a timestamp as relative time (e.g., "5s ago", "3m ago", "2h ago")
 */
export function formatRelativeTime(timestamp: string | number | Date): string {
  const now = Date.now()
  const then = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime()
  const diffSec = Math.round((now - then) / 1000)

  if (diffSec < 60) {return `${diffSec}s ago`}
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) {return `${diffMin}m ago`}
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) {return `${diffHr}h ago`}
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

/**
 * Return a Tailwind color class for a p95 latency value.
 */
export function getLatencyColorClass(ms: number): string {
  if (ms < 200) {return 'text-[#34C759]'}
  if (ms < 500) {return 'text-[#FF9500]'}
  return 'text-[#FF3B30]'
}
