// src/modules/auto-reply/services/schedule-service.ts
// Determines if the current time is within business hours for a team

import type { Bindings } from '@/types';
import type { ScheduleData } from '../types';
import { createDbClient } from '@/db/drizzle-factory';
import { autoReplySchedules } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('ScheduleService');

const KV_SCHEDULE_PREFIX = 'auto-reply:schedule:';
const KV_SCHEDULE_TTL = 300; // 5 minutes

/**
 * Check if the current time is within business hours for a team.
 * Returns true if currently within business hours.
 * If no schedule is defined, returns true (always business hours = no off-hours reply).
 */
export async function isWithinBusinessHours(
  teamId: number | null,
  env: Bindings
): Promise<boolean> {
  try {
    // For global rules (no team), load any available schedule
    const schedules = teamId !== null
      ? await getTeamSchedules(teamId, env)
      : await getAnySchedules(env);

    // No schedules defined → treat as "always business hours"
    if (schedules.length === 0) {
      return true;
    }

    // Determine timezone from schedule (all entries share the same timezone)
    const timezone = schedules[0].timezone || 'Asia/Taipei';

    // Get current time in the team's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    });

    const parts = formatter.formatToParts(now);
    const hourStr = parts.find((p) => p.type === 'hour')?.value || '0';
    const minuteStr = parts.find((p) => p.type === 'minute')?.value || '0';
    const weekdayStr = parts.find((p) => p.type === 'weekday')?.value || 'Sun';

    const currentTimeMinutes = parseInt(hourStr) * 60 + parseInt(minuteStr);
    const currentDayOfWeek = weekdayToNumber(weekdayStr);

    // Find schedule for current day
    const todaySchedule = schedules.find(
      (s) => s.dayOfWeek === currentDayOfWeek && s.isActive
    );

    if (!todaySchedule) {
      // No schedule for today → outside business hours
      return false;
    }

    // Parse start/end times
    const startMinutes = parseTimeToMinutes(todaySchedule.startTime);
    const endMinutes = parseTimeToMinutes(todaySchedule.endTime);

    // Handle midnight crossing (e.g., 22:00 - 06:00)
    if (endMinutes <= startMinutes) {
      return currentTimeMinutes >= startMinutes || currentTimeMinutes <= endMinutes;
    }

    return currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes;
  } catch (error) {
    log.error('Error checking business hours', {
      teamId,
      error: error instanceof Error ? error.message : String(error),
    });
    // On error, assume business hours (don't trigger off-hours reply)
    return true;
  }
}

export interface BusinessHoursStatus {
  /** false when no schedule is configured at all (treated as always open, like isWithinBusinessHours). */
  hasSchedule: boolean;
  isOpen: boolean;
  timezone: string;
  /** 'HH:mm' in `timezone` when open and a closing time applies today; otherwise null. */
  closesAt: string | null;
  /** Next opening, in `timezone`, when closed: { dayOfWeek, time }; otherwise null. */
  opensAt: { dayOfWeek: number; time: string } | null;
}

/**
 * Business-hours state evaluated server-side in the schedule's own timezone (default Asia/Taipei),
 * with the closing / next opening time for display.
 */
export function evaluateBusinessHours(schedules: ScheduleData[], now: Date = new Date()): BusinessHoursStatus {
  const active = schedules.filter((s) => s.isActive);
  const timezone = schedules[0]?.timezone || 'Asia/Taipei';
  if (active.length === 0) {
    return { hasSchedule: schedules.length > 0, isOpen: schedules.length === 0, timezone, closesAt: null, opensAt: null };
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(now);
  // hour12:false can render midnight as "24" in some engines
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0') % 24;
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0');
  const day = weekdayToNumber(parts.find((p) => p.type === 'weekday')?.value || 'Sun');
  const current = hour * 60 + minute;

  const today = active.find((s) => s.dayOfWeek === day);
  if (today) {
    const start = parseTimeToMinutes(today.startTime);
    const end = parseTimeToMinutes(today.endTime);
    const open = end <= start ? current >= start || current <= end : current >= start && current <= end;
    if (open) {
      return { hasSchedule: true, isOpen: true, timezone, closesAt: today.endTime, opensAt: null };
    }
    if (current < start) {
      return { hasSchedule: true, isOpen: false, timezone, closesAt: null, opensAt: { dayOfWeek: day, time: today.startTime } };
    }
  }

  for (let offset = 1; offset <= 7; offset++) {
    const candidate = active.find((s) => s.dayOfWeek === (day + offset) % 7);
    if (candidate) {
      return {
        hasSchedule: true,
        isOpen: false,
        timezone,
        closesAt: null,
        opensAt: { dayOfWeek: candidate.dayOfWeek, time: candidate.startTime },
      };
    }
  }
  return { hasSchedule: true, isOpen: false, timezone, closesAt: null, opensAt: null };
}

/** Load the team's schedules (KV cached) and evaluate them now. */
export async function getBusinessHoursStatus(teamId: number, env: Bindings): Promise<BusinessHoursStatus> {
  return evaluateBusinessHours(await getTeamSchedules(teamId, env));
}

/**
 * Load any available schedule (for global off_hours rules without team context).
 * Picks the first team's schedules found in D1.
 */
async function getAnySchedules(
  env: Bindings
): Promise<ScheduleData[]> {
  const kvKey = `${KV_SCHEDULE_PREFIX}global`;

  try {
    const cached = await env.CACHE.get(kvKey, 'json');
    if (cached) {
      return cached as ScheduleData[];
    }
  } catch {
    // KV miss
  }

  const drizzleDb = createDbClient(env.DB);
  const rows = await drizzleDb
    .select()
    .from(autoReplySchedules)
    .where(eq(autoReplySchedules.isActive, true));

  const schedules: ScheduleData[] = rows.map((row) => ({
    id: row.id,
    teamId: row.teamId,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    timezone: row.timezone || 'Asia/Taipei',
    isActive: row.isActive ?? true,
  }));

  try {
    await env.CACHE.put(kvKey, JSON.stringify(schedules), {
      expirationTtl: KV_SCHEDULE_TTL,
    });
  } catch {
    // Non-fatal
  }

  return schedules;
}

/**
 * Load team schedules from KV cache or D1.
 */
async function getTeamSchedules(
  teamId: number,
  env: Bindings
): Promise<ScheduleData[]> {
  const kvKey = `${KV_SCHEDULE_PREFIX}${teamId}`;

  // Try KV cache first
  try {
    const cached = await env.CACHE.get(kvKey, 'json');
    if (cached) {
      return cached as ScheduleData[];
    }
  } catch {
    // KV miss or error — fall through to D1
  }

  // Query D1
  const drizzleDb = createDbClient(env.DB);
  const rows = await drizzleDb
    .select()
    .from(autoReplySchedules)
    .where(
      and(
        eq(autoReplySchedules.teamId, teamId),
        eq(autoReplySchedules.isActive, true)
      )
    );

  const schedules: ScheduleData[] = rows.map((row) => ({
    id: row.id,
    teamId: row.teamId,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    timezone: row.timezone || 'Asia/Taipei',
    isActive: row.isActive ?? true,
  }));

  // Cache in KV
  try {
    await env.CACHE.put(kvKey, JSON.stringify(schedules), {
      expirationTtl: KV_SCHEDULE_TTL,
    });
  } catch {
    // Non-fatal: cache write failure
  }

  return schedules;
}

/**
 * Invalidate KV cache for a team's schedules.
 */
export async function invalidateScheduleCache(
  teamId: number,
  env: Bindings
): Promise<void> {
  try {
    await env.CACHE.delete(`${KV_SCHEDULE_PREFIX}${teamId}`);
  } catch {
    // Non-fatal
  }
}

// ==================== Helpers ====================

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function weekdayToNumber(weekday: string): number {
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}
