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
  // Global rules (no team) have no schedule — always business hours
  if (teamId === null) {
    return true;
  }

  try {
    const schedules = await getTeamSchedules(teamId, env);

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
