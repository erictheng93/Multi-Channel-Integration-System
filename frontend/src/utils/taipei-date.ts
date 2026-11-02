/**
 * Asia/Taipei calendar days, whatever timezone the browser is in.
 *
 * The product's days are Taipei days (see src/utils/taipei-time.ts on the backend). Taipei is a
 * fixed UTC+8 with no daylight saving, so a day boundary is plain arithmetic.
 */

const TAIPEI_OFFSET = '+08:00'
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Taipei calendar date (YYYY-MM-DD) of an instant, `daysAgo` days back. */
export function taipeiDateString(nowMs: number = Date.now(), daysAgo = 0): string {
  return new Date(nowMs + TAIPEI_OFFSET_MS - daysAgo * DAY_MS).toISOString().slice(0, 10)
}

/** UTC ISO instant of the first millisecond of a Taipei calendar date. */
export function taipeiDayStartIso(date: string): string {
  return new Date(`${date}T00:00:00.000${TAIPEI_OFFSET}`).toISOString()
}

/** UTC ISO instant of the last millisecond of a Taipei calendar date. */
export function taipeiDayEndIso(date: string): string {
  return new Date(`${date}T23:59:59.999${TAIPEI_OFFSET}`).toISOString()
}
