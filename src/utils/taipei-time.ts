// Asia/Taipei (UTC+8, no DST) day boundaries as UTC instants, for comparing raw timestamp columns.

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO instant of 00:00 Asia/Taipei for the day containing `nowMs`, shifted by `dayOffset` days. */
export function taipeiDayStartISO(nowMs: number = Date.now(), dayOffset = 0): string {
  const shifted = nowMs + TAIPEI_OFFSET_MS;
  const startShifted = shifted - (((shifted % DAY_MS) + DAY_MS) % DAY_MS);
  return new Date(startShifted - TAIPEI_OFFSET_MS + dayOffset * DAY_MS).toISOString();
}
