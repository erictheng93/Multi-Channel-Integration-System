/**
 * Shared utilities for the API monitoring dashboard.
 */

/**
 * Format a timestamp as relative time in Traditional Chinese (e.g. "5 秒前", "3 分鐘前", "2 小時前").
 */
export function formatRelativeTime(timestamp: string | number | Date): string {
  const now = Date.now()
  const then = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime()
  const diffSec = Math.max(0, Math.round((now - then) / 1000))

  if (diffSec < 60) {return `${diffSec} 秒前`}
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) {return `${diffMin} 分鐘前`}
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) {return `${diffHr} 小時前`}
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay} 天前`
}
