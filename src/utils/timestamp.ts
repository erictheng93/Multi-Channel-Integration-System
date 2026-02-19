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

/** Convert any date-like value to ISO string */
export function toISO(value: string | number | Date): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return new Date(value).toISOString()
  return value.toISOString()
}

/** Convert any date-like value to Unix milliseconds */
export function toMs(value: string | number | Date): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return new Date(value).getTime()
  return value.getTime()
}

/** Difference in milliseconds between two timestamps */
export function diffMs(a: string | number | Date, b: string | number | Date): number {
  return toMs(a) - toMs(b)
}

/** Check if timestamp is older than `maxAgeMs` milliseconds */
export function isStale(timestamp: string | number | Date, maxAgeMs: number): boolean {
  return nowMs() - toMs(timestamp) > maxAgeMs
}
