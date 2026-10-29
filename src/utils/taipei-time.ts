/**
 * Asia/Taipei calendar helpers.
 *
 * Taipei is a fixed UTC+8 with no daylight saving, so a day boundary is plain
 * arithmetic. Everything here returns UTC instants (epoch ms / ISO strings)
 * so SQL can compare RAW indexed columns against them -- never wrap a column
 * in date()/strftime() in a WHERE clause just to bucket by Taipei day.
 */

export const TAIPEI_TIMEZONE = 'Asia/Taipei'
export const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000

/** UTC epoch ms of 00:00 Taipei on the Taipei calendar day containing `ms`. */
export function taipeiDayStartMs(ms: number): number {
  return Math.floor((ms + TAIPEI_OFFSET_MS) / DAY_MS) * DAY_MS - TAIPEI_OFFSET_MS
}

/** Same as taipeiDayStartMs, shifted by whole Taipei days (negative = past). */
export function taipeiDayStartOffsetMs(ms: number, dayOffset: number): number {
  return taipeiDayStartMs(ms) + dayOffset * DAY_MS
}

/** Taipei calendar date (YYYY-MM-DD) of an instant. */
export function taipeiDateString(ms: number): string {
  return new Date(ms + TAIPEI_OFFSET_MS).toISOString().slice(0, 10)
}

/** UTC epoch ms of 00:00 Taipei on Monday of the week containing `ms`. */
export function taipeiWeekStartMs(ms: number): number {
  const dayStart = taipeiDayStartMs(ms)
  // getUTCDay on the shifted instant: 0 = Sunday ... 6 = Saturday (Taipei weekday)
  const weekday = new Date(dayStart + TAIPEI_OFFSET_MS).getUTCDay()
  const sinceMonday = (weekday + 6) % 7
  return dayStart - sinceMonday * DAY_MS
}

/** ISO string used for comparisons against stored ISO timestamps. */
export function isoOf(ms: number): string {
  return new Date(ms).toISOString()
}

/** ISO instant of 00:00 Asia/Taipei for the day containing `nowMs`, shifted by `dayOffset` days. */
export function taipeiDayStartISO(nowMs: number = Date.now(), dayOffset = 0): string {
  return isoOf(taipeiDayStartOffsetMs(nowMs, dayOffset))
}
