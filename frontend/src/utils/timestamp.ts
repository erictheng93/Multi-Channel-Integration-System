/**
 * Timestamp utilities — single source of truth for date/time operations.
 *
 * Prefer these helpers over raw `new Date().toISOString()` / `Date.now()`
 * for consistency and easier testability (mock one module, not every call site).
 */

/** Current time as ISO-8601 string (e.g. "2025-01-28T12:34:56.789Z") */
export function nowISO(): string {
  return new Date().toISOString()
}

/** Current time as Unix milliseconds */
export function nowMs(): number {
  return Date.now()
}

export function toDate(timestamp: number | Date): Date {
  if (timestamp instanceof Date) {
    return timestamp
  }
  return new Date(timestamp)
}

export function toTimestamp(date: number | Date): number {
  if (typeof date === 'number') {
    return date
  }
  return date.getTime()
}

export function formatTimestamp(timestamp: number | Date): string {
  const date = toDate(timestamp)
  return date.toLocaleString()
}

export function formatTime(timestamp: number | Date | string): string {
  let date: Date
  
  if (typeof timestamp === 'string') {
    date = new Date(timestamp)
  } else {
    date = toDate(timestamp)
  }
  
  return date.toLocaleTimeString('zh-TW', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  })
}

export function formatDate(timestamp: number | Date | string): string {
  let date: Date
  
  if (typeof timestamp === 'string') {
    date = new Date(timestamp)
  } else {
    date = toDate(timestamp)
  }
  
  return date.toLocaleDateString('zh-TW')
}